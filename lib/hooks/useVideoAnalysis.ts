import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth'
import { queryClient } from '../queryClient'
import { queryKeys } from '../queryKeys'
import { supabase } from '../supabase'
import { discardExtractedAudio, extractAudioForAnalysis } from '../analysis/audioExtract'
import type { AnalysisJobRecord, CountGrid, VideoUploadRecord } from '../models'

const BUCKET = 'analysis-audio'
const MAX_DURATION_S = 180

function newId(): string {
    // RFC 4122 v4 without a crypto dependency; only used to name the upload object.
    const hex = '0123456789abcdef'
    let out = ''
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) out += '-'
        else if (i === 14) out += '4'
        else if (i === 19) out += hex[(Math.random() * 4) | 8]
        else out += hex[(Math.random() * 16) | 0]
    }
    return out
}

/**
 * Queue an audio-only analysis for a local video (Fable v2 §6 Prompt 8):
 * extract the audio on device -> upload to the private bucket under <user>/<id>.m4a
 * -> RPC queue_analysis_job (inserts the job, flips the video to 'queued').
 * The worker does the rest and deletes the audio.
 */
export function useRequestVideoAnalysis() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async ({ video, localUri }: { video: VideoUploadRecord; localUri: string }) => {
            if (!user) throw new Error('Not signed in')
            if (video.duration_seconds && video.duration_seconds > MAX_DURATION_S) {
                throw new Error(`Videos longer than ${MAX_DURATION_S / 60} minutes cannot be analysed yet.`)
            }
            const id = newId()
            const audio = await extractAudioForAnalysis(localUri, id)
            try {
                const path = `${user.id}/${id}.m4a`
                const file = await fetch(audio.uri)
                const body = await file.arrayBuffer()
                const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, body, {
                    contentType: audio.mimeType,
                    upsert: false,
                })
                if (upErr) throw upErr
                const { data, error } = await supabase.rpc('queue_analysis_job', {
                    p_video_upload_id: video.id,
                    p_audio_path: path,
                    p_duration_seconds: audio.durationSeconds || video.duration_seconds || null,
                })
                if (error) {
                    // Unique partial index: a job is already queued/processing for this video.
                    if (error.code === '23505') throw new Error('This video is already being analysed.')
                    throw error
                }
                return data as AnalysisJobRecord
            } finally {
                await discardExtractedAudio(audio.uri)
            }
        },
        onSuccess: (_job, { video }) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoUploads(user?.id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoUpload(video.id, user?.id) })
        },
    })
}

/**
 * Music mode: the user taps the bar that is "1". Persist it on the grid so the
 * builder (and any later re-open) shows 1/5 labels without asking again.
 */
export function useUpdateCountGridPhase() {
    const { user } = useAuth()
    return useMutation({
        mutationFn: async ({ videoId, grid, phaseOffsetBars }: { videoId: string; grid: CountGrid; phaseOffsetBars: number }) => {
            const bars = grid.bar_times
            const count1 = bars.filter((_, i) => (i - phaseOffsetBars) % 2 === 0)
            const next: CountGrid = { ...grid, count1_times: count1, ambiguous_1_vs_5: false }
            const { error } = await supabase
                .from('video_uploads')
                .update({ count_grid: next })
                .eq('id', videoId)
                .eq('user_id', user!.id)
            if (error) throw error
            return next
        },
        onSuccess: (_grid, { videoId }) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoUpload(videoId, user?.id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.videoUploads(user?.id) })
        },
    })
}

export function analysisStatusLabel(video: Pick<VideoUploadRecord, 'analysis_status' | 'analysis_mode' | 'count_grid'>): string {
    switch (video.analysis_status ?? 'none') {
        case 'queued': return 'Queued'
        case 'processing': return 'Analysing…'
        case 'ready':
            if (video.analysis_mode === 'music' && video.count_grid?.ambiguous_1_vs_5) return 'Ready · needs a tap'
            if (video.analysis_mode === 'none') return 'No usable audio'
            return 'Ready'
        case 'failed': return 'Analysis failed'
        default: return 'Not analysed'
    }
}

/**
 * Add Video auto-snip: watch one video row until its analysis finishes. Polls
 * every 4 s while the job is queued/processing, then stops.
 */
export function useVideoAnalysisStatus(videoId: string | null) {
    const { user } = useAuth()
    return useQuery({
        queryKey: queryKeys.videoUpload(videoId, user?.id),
        enabled: !!videoId && !!user,
        refetchInterval: (query) => {
            const s = query.state.data?.analysis_status
            return s === 'queued' || s === 'processing' ? 4000 : false
        },
        queryFn: async (): Promise<VideoUploadRecord> => {
            const { data, error } = await supabase
                .from('video_uploads')
                .select('*')
                .eq('id', videoId!)
                .eq('user_id', user!.id)
                .single()
            if (error) throw error
            return data as VideoUploadRecord
        },
    })
}

/**
 * Reuse a finished analysis for the same file. The media picker hands the app a new
 * reference key on every pick, so re-picking an analysed clip creates a new
 * video_uploads row with no grid. The sampled content fingerprint identifies the
 * file, so copy the grid from the user's newest 'ready' row with the same hash.
 * Returns the updated row, or null when there is nothing to copy.
 */
export async function reuseStoredAnalysis(video: VideoUploadRecord, userId: string): Promise<VideoUploadRecord | null> {
    if (!video.content_hash || (video.analysis_status === 'ready' && video.count_grid)) return null
    const { data: donor, error } = await supabase
        .from('video_uploads')
        .select('analysis_mode, count_grid, analysed_at')
        .eq('user_id', userId)
        .eq('content_hash', video.content_hash)
        .eq('analysis_status', 'ready')
        .not('count_grid', 'is', null)
        .neq('id', video.id)
        .order('analysed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    if (error) throw error
    if (!donor) return null
    const { data, error: upErr } = await supabase
        .from('video_uploads')
        .update({ analysis_status: 'ready', analysis_mode: donor.analysis_mode, count_grid: donor.count_grid, analysed_at: donor.analysed_at })
        .eq('id', video.id)
        .eq('user_id', userId)
        .select()
        .single()
    if (upErr) throw upErr
    void queryClient.invalidateQueries({ queryKey: queryKeys.videoUploads(userId) })
    return data as VideoUploadRecord
}
