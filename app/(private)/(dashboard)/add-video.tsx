import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { Image as ExpoImage } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import ThemedInput from 'Components/ThemedInput'
import LocalSegmentPlayer from '../../../Components/LocalSegmentPlayer'
import { useTheme } from 'constants/useTheme'
import { useAuth } from 'lib/auth'
import { showSnack } from 'lib/snackbarService'
import { useDeleteVideoUpload, useSyncVideoUpload } from 'lib/hooks/useVideoUploads'
import { errorMessage } from 'lib/errorMessage'
import { useUserRoadmaps } from 'lib/hooks/useUserRoadmaps'
import { useCreateVideoCategory, useVideoCategories } from 'lib/hooks/useVideoCategories'
import { useCreateVideoSegment } from 'lib/hooks/useSegments'
import type { LocalVideoUpload } from 'lib/models'
import { calculateVideoContentHash } from 'lib/videoHash'
import { useLocalSearchParams } from 'expo-router'
import { useRequestVideoAnalysis, useVideoAnalysisStatus, analysisStatusLabel, reuseStoredAnalysis } from 'lib/hooks/useVideoAnalysis'
import { buildChunks, nearestBeat, type ChunkSize } from 'lib/analysis/chunks'
import type { CountGrid } from 'lib/models'

function formatTimestamp(value: number) {
    return value.toFixed(2)
}

type SegmentDraft = {
    id: string
    start: string
    end: string
    title: string
    description: string
    categoryId: string
    thumbnailTime: string
    thumbnailReference: string | null
    thumbnailLoading: boolean
    /** Set by auto-snip: 1 or 5 when the chunk starts on a known count; 'talk' when the instructor is mostly talking. */
    badge?: string
}

function createSegmentDraft(duration: number | null, categoryId: string): SegmentDraft {
    return {
        id: `segment-${Date.now()}-${Math.random()}`,
        start: '0.00',
        end: formatTimestamp(duration ?? 10),
        title: '',
        description: '',
        categoryId,
        thumbnailTime: '0.00',
        thumbnailReference: null,
        thumbnailLoading: false,
    }
}

/** Round ±1 button used inside the start/end steppers. */
function StepButton({ icon, onPress, label, color }: { icon: 'add' | 'remove'; onPress: () => void; label: string; color: string }) {
    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => [styles.stepButton, { opacity: pressed ? 0.5 : 1 }]}>
            <Ionicons name={icon} size={18} color={color} />
        </Pressable>
    )
}

export default function AddVideoScreen() {
    const { colors } = useTheme()
    const { user } = useAuth()
    const syncVideoUpload = useSyncVideoUpload()
    const deleteVideoUpload = useDeleteVideoUpload()
    const createSegment = useCreateVideoSegment()
    const createCategory = useCreateVideoCategory()
    const roadmapsQuery = useUserRoadmaps()
    const params = useLocalSearchParams<{ roadmapId?: string; categoryId?: string }>()
    const [selectedVideo, setSelectedVideo] = useState<LocalVideoUpload | null>(null)
    const [roadmapId, setRoadmapId] = useState('')
    const categoriesQuery = useVideoCategories(roadmapId || null)
    const [roadmapMenuOpen, setRoadmapMenuOpen] = useState(false)
    const [picking, setPicking] = useState(false)
    const [segmentDrafts, setSegmentDrafts] = useState<SegmentDraft[]>([])
    const [activeSegmentIndex, setActiveSegmentIndex] = useState(0)
    const [categoryModalOpen, setCategoryModalOpen] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryDescription, setNewCategoryDescription] = useState('')

    // ----- Auto snip (Fable v2) ---------------------------------------------------
    // The video row is created up front so the worker has something to write the
    // count grid to; the segments are still only saved when the user taps Save.
    const requestAnalysis = useRequestVideoAnalysis()
    const [autoSnipVideoId, setAutoSnipVideoId] = useState<string | null>(null)
    const [autoSnipStarting, setAutoSnipStarting] = useState(false)
    const analysedVideo = useVideoAnalysisStatus(autoSnipVideoId)
    const grid: CountGrid | null = analysedVideo.data?.analysis_status === 'ready' ? analysedVideo.data.count_grid ?? null : null
    const [gridApplied, setGridApplied] = useState<string | null>(null)
    // 8 counts by default; music clips default to 4 (one bar) because which bar is "1"
    // is unknown without a tap, and 4-count boundaries do not depend on it.
    const [chunkSize, setChunkSize] = useState<ChunkSize>(8)
    const analysisBusy = autoSnipStarting || analysedVideo.data?.analysis_status === 'queued' || analysedVideo.data?.analysis_status === 'processing'

    async function autoSnip() {
        if (!selectedVideo) { showSnack('Choose a local video first.'); return }
        if (!roadmapId) { showSnack('Create or select a roadmap first.'); return }
        setAutoSnipStarting(true)
        chunkChoice.current = null  // new video: back to the mode default
        try {
            let saved = await syncVideoUpload.mutateAsync({ ...selectedVideo, roadmapId })
            // Same file analysed before under another pick? Copy that grid instead of re-running.
            if (user && !(saved.analysis_status === 'ready' && saved.count_grid)) {
                saved = (await reuseStoredAnalysis(saved, user.id)) ?? saved
            }
            setAutoSnipVideoId(saved.id)
            setGridApplied(null)
            if (saved.analysis_status === 'ready' && saved.count_grid) {
                // Analysed before (same file picked again): no need to re-upload the audio.
                void analysedVideo.refetch()
            } else {
                await requestAnalysis.mutateAsync({ video: saved, localUri: selectedVideo.uri })
                showSnack('Listening for counts… this takes about half the video length.')
            }
        } catch (error) {
            showSnack(errorMessage(error, 'Could not start auto snip.'))
        } finally {
            setAutoSnipStarting(false)
        }
    }
    // The user's explicit 8/4 choice for the current video; null = use the mode default.
    const chunkChoice = useRef<ChunkSize | null>(null)
    /** User picks 8 or 4 counts: rebuild the drafts from the grid (edits are discarded). */
    function changeChunkSize(size: ChunkSize) {
        if (size === chunkSize) return
        chunkChoice.current = size
        setChunkSize(size)
        setGridApplied(null)
    }
    // When the grid arrives (or the chunk size changes), replace the drafts with one per chunk.
    useEffect(() => {
        if (!grid || !selectedVideo || !autoSnipVideoId || gridApplied === autoSnipVideoId) return
        // Decide the size here, in the same pass as the build, so the toggle and the
        // drafts can never disagree (a separate effect did, once).
        const size: ChunkSize = chunkChoice.current ?? (grid.mode === 'music' ? 4 : 8)
        if (size !== chunkSize) setChunkSize(size)
        const chunks = buildChunks(grid, size)
        if (chunks.length === 0) { showSnack('No counts were found in this video.'); setGridApplied(autoSnipVideoId); return }
        const defaultCategory = params.categoryId ?? ''
        const drafts: SegmentDraft[] = chunks.map((c) => ({
            ...createSegmentDraft(selectedVideo.duration, defaultCategory),
            id: `chunk-${c.index}-${Date.now()}`,
            start: formatTimestamp(c.start),
            end: formatTimestamp(c.end),
            thumbnailTime: formatTimestamp(c.start),
            // Music: 1/5 labels are a guess until the phase is tapped, so show none.
            badge: c.talking ? 'talk' : grid.mode === 'music' && grid.ambiguous_1_vs_5 ? undefined : c.countLabel != null ? String(c.countLabel) : undefined,
        }))
        setSegmentDrafts(drafts)
        setActiveSegmentIndex(0)
        setGridApplied(autoSnipVideoId)
        showSnack(`${drafts.length} snippets of ${size} counts. Merge, trim, and give each a position.`)
        // Thumbnails one by one so the UI stays responsive.
        void (async () => {
            for (const d of drafts) {
                try {
                    const r = await VideoThumbnails.getThumbnailAsync(selectedVideo.uri, { time: Math.round((Number(d.start) + 0.2) * 1000), quality: 0.5 })
                    updateSegmentDraft(d.id, { thumbnailReference: r.uri })
                } catch { /* cosmetic */ }
            }
        })()
        // gridApplied is a dep so 'Re-snip' on an already-analysed video rebuilds the drafts.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grid, autoSnipVideoId, gridApplied])

    /** Merge the snippet at `index` with its neighbour: the union of both ranges, one draft fewer. */
    function mergeDraft(index: number, dir: -1 | 1) {
        const other = index + dir
        if (other < 0 || other >= segmentDrafts.length) return
        const a = segmentDrafts[Math.min(index, other)], b = segmentDrafts[Math.max(index, other)]
        const merged: SegmentDraft = {
            ...a,
            start: formatTimestamp(Math.min(Number(a.start), Number(b.start))),
            end: formatTimestamp(Math.max(Number(a.end), Number(b.end))),
            categoryId: a.categoryId || b.categoryId,
            title: a.title || b.title,
            badge: a.badge && a.badge !== 'talk' ? a.badge : b.badge,
        }
        const next = segmentDrafts.filter((_, i) => i !== index && i !== other)
        next.splice(Math.min(index, other), 0, merged)
        setSegmentDrafts(next)
        setActiveSegmentIndex(Math.min(index, other))
    }

    /** Move one edge by one count (snapped to the beat grid). Lets a snippet overlap its neighbours. */
    function nudgeDraft(id: string, edge: 'start' | 'end', dir: -1 | 1) {
        const draft = segmentDrafts.find((d) => d.id === id)
        if (!draft) return
        const cur = Number(edge === 'start' ? draft.start : draft.end)
        let next: number
        if (grid && grid.beat_times.length) {
            const beats = grid.beat_times
            const i = beats.indexOf(nearestBeat(grid, cur))
            next = beats[i + dir] ?? cur + dir * (grid.count_period_s ?? 0.5)
        } else {
            next = cur + dir * 0.5
        }
        const max = selectedVideo?.duration ?? Number.POSITIVE_INFINITY
        next = Math.max(0, Math.min(max, next))
        const start = edge === 'start' ? next : Number(draft.start)
        const end = edge === 'end' ? next : Number(draft.end)
        if (end - start < 0.2) return
        updateSegmentDraft(id, { start: formatTimestamp(start), end: formatTimestamp(end) })
    }

    useEffect(() => {
        if (params.roadmapId) setRoadmapId(params.roadmapId)
        else if (!roadmapId && roadmapsQuery.data?.[0]) setRoadmapId(roadmapsQuery.data[0].id)
    }, [params.roadmapId, roadmapId, roadmapsQuery.data])

    async function chooseVideo() {
        setPicking(true)
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
            if (!permission.granted) {
                showSnack('Media library permission is required to choose a video.')
                return
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['videos'],
                allowsEditing: false,
                quality: 1,
            })
            if (result.canceled) return

            const asset = result.assets[0]
            const durationSeconds = asset.duration == null ? null : asset.duration / 1000
            const originalFilename = asset.fileName ?? asset.uri.split('/').pop() ?? null
            const contentHash = await calculateVideoContentHash(asset.uri)
            const nextVideo: LocalVideoUpload = {
                id: `${asset.assetId ?? asset.uri}-${Date.now()}`,
                assetId: asset.assetId ?? null,
                uri: asset.uri,
                fileName: originalFilename,
                originalFilename,
                contentHash,
                mimeType: asset.mimeType ?? 'video/*',
                duration: durationSeconds,
                fileSize: asset.fileSize ?? null,
                width: asset.width ?? null,
                height: asset.height ?? null,
                creationTime: null,
                rangeStart: 0,
                rangeEnd: durationSeconds ?? 10,
                thumbnailReference: null,
                status: 'AVAILABLE',
                updatedAt: new Date().toISOString(),
            }
            setSelectedVideo(nextVideo)
            setAutoSnipVideoId(null)
            setGridApplied(null)
            const miscCategoryId = categoriesQuery.data?.find((category) => category.system_category && category.name.toLowerCase() === 'misc')?.id ?? ''
            const initialDraft = createSegmentDraft(durationSeconds, params.categoryId ?? miscCategoryId)
            setSegmentDrafts([initialDraft])
            setActiveSegmentIndex(0)
            await generateSegmentThumbnail(nextVideo, initialDraft.id, initialDraft.start)
        } catch (error) {
            showSnack(errorMessage(error, 'Could not choose that video.'))
        } finally {
            setPicking(false)
        }
    }

    function updateSegmentDraft(id: string, patch: Partial<SegmentDraft>) {
        setSegmentDrafts((drafts) => drafts.map((draft) => draft.id === id ? { ...draft, ...patch } : draft))
    }

    function addSegmentDraft() {
        if (!selectedVideo) return
        const categoryId = segmentDrafts[segmentDrafts.length - 1]?.categoryId ?? ''
        setActiveSegmentIndex(segmentDrafts.length)
        setSegmentDrafts([...segmentDrafts, createSegmentDraft(selectedVideo.duration, categoryId)])
    }

    function removeSegmentDraft(id: string) {
        if (segmentDrafts.length <= 1) return
        const removedIndex = segmentDrafts.findIndex((draft) => draft.id === id)
        const nextDrafts = segmentDrafts.filter((draft) => draft.id !== id)
        setActiveSegmentIndex((currentIndex) => Math.min(currentIndex > removedIndex ? currentIndex - 1 : currentIndex, nextDrafts.length - 1))
        setSegmentDrafts(nextDrafts)
    }

    async function generateSegmentThumbnail(video: LocalVideoUpload, draftId: string, timeValue?: string) {
        const draft = segmentDrafts.find((item) => item.id === draftId)
        if (!draft && timeValue == null) return
        const defaultTime = draft?.thumbnailTime || draft?.start || '0.00'
        const seconds = Number(timeValue ?? defaultTime)
        const maxSeconds = video.duration == null ? seconds : Math.max(0, Math.min(seconds, video.duration))
        if (!Number.isFinite(maxSeconds) || maxSeconds < 0) {
            return
        }

        updateSegmentDraft(draftId, { thumbnailLoading: true })
        try {
            const result = await VideoThumbnails.getThumbnailAsync(video.uri, { time: Math.round(maxSeconds * 1000) })
            updateSegmentDraft(draftId, { thumbnailReference: result.uri, thumbnailLoading: false })
            setSelectedVideo((current) => current ? { ...current, thumbnailReference: current.thumbnailReference ?? result.uri } : current)
        } catch (error) {
            updateSegmentDraft(draftId, { thumbnailLoading: false })
            showSnack(errorMessage(error, 'Could not generate a thumbnail from this video.'))
        }
    }

    async function saveVideoReference() {
        if (!selectedVideo) {
            showSnack('Choose a local video first.')
            return
        }
        if (!roadmapId) {
            showSnack('Create or select a roadmap first.')
            return
        }
        const segmentRanges = segmentDrafts.map((draft) => {
            const start = Number(draft.start)
            const enteredEnd = Number(draft.end)
            const end = selectedVideo.duration != null && Number.isFinite(selectedVideo.duration)
                ? Math.min(enteredEnd, selectedVideo.duration)
                : enteredEnd
            return { start, end }
        })
        for (const [index, range] of segmentRanges.entries()) {
            const { start, end } = range
            const draft = segmentDrafts[index]
            if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= end) {
                showSnack(`Enter a valid range for segment ${index + 1}.`)
                return
            }
            if (!draft.categoryId) {
                showSnack(`Choose a category for segment ${index + 1}.`)
                return
            }
        }

        let savedUploadId: string | null = null
        try {
            const savedUpload = await syncVideoUpload.mutateAsync({
                ...selectedVideo,
                thumbnailReference: selectedVideo.thumbnailReference ?? segmentDrafts[0].thumbnailReference,
                roadmapId,
            })
            savedUploadId = savedUpload.id
            for (const [index, draft] of segmentDrafts.entries()) {
                const range = segmentRanges[index]
                await createSegment.mutateAsync({
                    videoUploadId: savedUpload.id,
                    startTime: range.start,
                    endTime: range.end,
                    durationSeconds: selectedVideo.duration,
                    categoryId: draft.categoryId,
                    title: draft.title,
                    userNotes: draft.description,
                    thumbnailReference: draft.thumbnailReference,
                })
            }
            showSnack(segmentDrafts.length === 1 ? 'Video segment added.' : `${segmentDrafts.length} video segments added.`)
            setSelectedVideo(null)
            setSegmentDrafts([])
            setActiveSegmentIndex(0)
            setAutoSnipVideoId(null)
            setGridApplied(null)
        } catch (error) {
            // Only remove the row if we created it just now; an auto-snipped video keeps its count grid.
            if (savedUploadId && savedUploadId !== autoSnipVideoId) {
                await deleteVideoUpload.mutateAsync(savedUploadId).catch(() => undefined)
            }
            showSnack(errorMessage(error, 'Could not save the video reference.'))
        }
    }

    async function addCategory() {
        if (!roadmapId) {
            showSnack('Select a roadmap before adding a category.')
            return
        }
        const name = newCategoryName.trim()
        if (!name) {
            showSnack('Enter a category name.')
            return
        }
        try {
            const category = await createCategory.mutateAsync({
                roadmapId,
                name,
                description: newCategoryDescription,
            })
            updateSegmentDraft(segmentDrafts[activeSegmentIndex]?.id ?? '', { categoryId: category.id })
            setNewCategoryName('')
            setNewCategoryDescription('')
            setCategoryModalOpen(false)
            showSnack('Category created.')
        } catch (error) {
            showSnack(errorMessage(error, 'Could not create category.'))
        }
    }

    function returnToRoadmap() {
        if (params.roadmapId) {
            router.replace({
                pathname: '/(private)/(dashboard)/user-roadmap',
                params: { roadmapId: params.roadmapId },
            })
            return
        }

        router.back()
    }

    const activeDraft = segmentDrafts[activeSegmentIndex] ?? null
    const activeDraftStart = activeDraft ? Number(activeDraft.start) : 0
    const activeDraftEnd = activeDraft ? Number(activeDraft.end) : 0
    const activeDraftHasRange = Number.isFinite(activeDraftStart) && Number.isFinite(activeDraftEnd) && activeDraftStart < activeDraftEnd

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                <View style={styles.titleRow}>
                    <Pressable
                        onPress={returnToRoadmap}
                        style={({ pressed }) => [styles.backIconButton, pressed ? styles.backIconPressed : null]}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                    >
                        <Ionicons name="arrow-back" size={20} color={colors.text} />
                    </Pressable>
                    <ThemedText variant="title">Add Video</ThemedText>
                </View>
                <ThemedText variant="subheader" style={styles.intro}>
                    Add one or more segments from a video already on your device. The video is only a source reference and is not uploaded.
                </ThemedText>

                <View style={[styles.formSection, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <ThemedText variant="small" style={styles.label}>Roadmap</ThemedText>
                    <Pressable onPress={() => setRoadmapMenuOpen(true)} style={[styles.dropdown, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <ThemedText>{roadmapsQuery.data?.find((roadmap) => roadmap.id === roadmapId)?.name ?? 'Select a roadmap'}</ThemedText>
                        <ThemedText variant="small">▼</ThemedText>
                    </Pressable>
                    {roadmapsQuery.data?.length === 0 ? <ThemedText variant="small">Create a roadmap before adding a video.</ThemedText> : null}

                    <Modal visible={roadmapMenuOpen} transparent animationType="fade" onRequestClose={() => setRoadmapMenuOpen(false)}>
                        <Pressable style={styles.modalBackdrop} onPress={() => setRoadmapMenuOpen(false)}>
                            <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <ThemedText variant="subheader">Choose roadmap</ThemedText>
                                {(roadmapsQuery.data ?? []).map((roadmap) => (
                                    <ThemedButton
                                        key={roadmap.id}
                                        title={roadmap.name}
                                        variant={roadmapId === roadmap.id ? 'primary' : 'ghost'}
                                        onPress={() => { setRoadmapId(roadmap.id); setRoadmapMenuOpen(false) }}
                                        style={styles.fullButton}
                                    />
                                ))}
                            </View>
                        </Pressable>
                    </Modal>

                    <Modal visible={categoryModalOpen} transparent animationType="fade" onRequestClose={() => setCategoryModalOpen(false)}>
                        <Pressable style={styles.modalBackdrop} onPress={() => setCategoryModalOpen(false)}>
                            <Pressable
                                style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={(event) => event.stopPropagation()}
                            >
                                <ThemedText variant="subheader">Create category</ThemedText>
                                <ThemedInput
                                    value={newCategoryName}
                                    onChangeText={setNewCategoryName}
                                    placeholder="Category name"
                                    style={styles.input}
                                />
                                <ThemedInput
                                    value={newCategoryDescription}
                                    onChangeText={setNewCategoryDescription}
                                    placeholder="Optional category description"
                                    multiline
                                    style={[styles.input, styles.multilineInput]}
                                />
                                <View style={styles.modalActions}>
                                    <ThemedButton title="Cancel" variant="ghost" onPress={() => setCategoryModalOpen(false)} style={styles.modalActionButton} />
                                    <ThemedButton title="Create" onPress={() => void addCategory()} loading={createCategory.isPending} style={styles.modalActionButton} />
                                </View>
                            </Pressable>
                        </Pressable>
                    </Modal>

                    <ThemedButton
                        title={picking ? 'Opening media library...' : selectedVideo ? 'Choose a different video' : 'Choose local video'}
                        onPress={() => void chooseVideo()}
                        loading={picking}
                        style={styles.fullButton}
                    />

                    {selectedVideo ? (
                        <View style={styles.snippetSection}>
                            {/* Header: title, status pill, auto-snip action */}
                            <View style={styles.snippetHeader}>
                                <View style={{ flex: 1, gap: 2 }}>
                                    <ThemedText variant="subheader">Snippets</ThemedText>
                                    {analysisBusy ? (
                                        <View style={styles.statusRow}>
                                            <ActivityIndicator size="small" color={colors.primary} />
                                            <ThemedText variant="small" style={{ color: colors.placeholder }}>
                                                {analysedVideo.data ? analysisStatusLabel(analysedVideo.data) : 'Starting…'}
                                            </ThemedText>
                                        </View>
                                    ) : analysedVideo.data?.analysis_status === 'failed' ? (
                                        <ThemedText variant="small" style={{ color: colors.warning }}>Analysis failed. Try again or edit by hand.</ThemedText>
                                    ) : grid ? (
                                        <View style={[styles.statusPill, { backgroundColor: colors.uiBackground }]}>
                                            <Ionicons name={grid.mode === 'none' ? 'volume-mute-outline' : 'musical-notes-outline'} size={12} color={colors.primary} />
                                            <ThemedText variant="small" style={{ color: colors.primary }}>
                                                {grid.mode === 'counting' ? 'Spoken counts' : grid.mode === 'music' ? 'Music beat' : 'No usable audio'}
                                                {grid.mode === 'music' && grid.ambiguous_1_vs_5 ? ' · 1/5 unsure' : ''}
                                            </ThemedText>
                                        </View>
                                    ) : (
                                        <ThemedText variant="small" style={{ color: colors.placeholder }}>Let the app find the counts, or add snippets by hand.</ThemedText>
                                    )}
                                </View>
                                {grid ? (
                                    <View style={[styles.segmented, { borderColor: colors.border }]} accessibilityRole="radiogroup">
                                        {([8, 4] as ChunkSize[]).map((size) => (
                                            <Pressable
                                                key={size}
                                                onPress={() => changeChunkSize(size)}
                                                accessibilityRole="radio"
                                                accessibilityState={{ checked: chunkSize === size }}
                                                style={[styles.segment, chunkSize === size ? { backgroundColor: colors.primary } : null]}
                                            >
                                                <ThemedText variant="small" style={{ color: chunkSize === size ? colors.onPrimary : colors.text, fontWeight: '700' }}>{size}</ThemedText>
                                            </Pressable>
                                        ))}
                                    </View>
                                ) : null}
                                <Pressable
                                    onPress={() => void autoSnip()}
                                    disabled={analysisBusy || picking}
                                    accessibilityRole="button"
                                    accessibilityLabel={grid ? 'Auto snip again' : 'Auto snip into 8-counts'}
                                    style={({ pressed }) => [styles.autoSnipButton, { backgroundColor: colors.primary, opacity: analysisBusy || picking ? 0.5 : pressed ? 0.85 : 1 }]}
                                >
                                    <Ionicons name="sparkles" size={16} color={colors.onPrimary} />
                                    <ThemedText variant="small" style={{ color: colors.onPrimary, fontWeight: '700' }}>{grid ? 'Re-snip' : 'Auto snip'}</ThemedText>
                                </Pressable>
                            </View>

                            {/* Snippet strip: thumbnail cards */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.snippetStrip}>
                                {segmentDrafts.map((draft, index) => {
                                    const active = index === activeSegmentIndex
                                    return (
                                        <Pressable
                                            key={draft.id}
                                            onPress={() => setActiveSegmentIndex(index)}
                                            accessibilityRole="tab"
                                            accessibilityState={{ selected: active }}
                                            style={[styles.snippetCard, { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.background }]}
                                        >
                                            {draft.thumbnailReference ? (
                                                <ExpoImage source={{ uri: draft.thumbnailReference }} style={StyleSheet.absoluteFill} contentFit="cover" />
                                            ) : null}
                                            <View style={[styles.snippetCardShade, draft.thumbnailReference ? null : { backgroundColor: 'transparent' }]} />
                                            <View style={styles.snippetCardTop}>
                                                <View style={[styles.snippetIndex, { backgroundColor: active ? colors.primary : 'rgba(0,0,0,0.55)' }]}>
                                                    <ThemedText variant="small" style={styles.snippetIndexText}>{index + 1}</ThemedText>
                                                </View>
                                                {draft.categoryId ? <Ionicons name="checkmark-circle" size={16} color={colors.primary} /> : null}
                                            </View>
                                            <View style={styles.snippetCardBottom}>
                                                {draft.badge ? (
                                                    <ThemedText variant="small" style={styles.snippetBadge}>{draft.badge === 'talk' ? 'talk' : `on ${draft.badge}`}</ThemedText>
                                                ) : null}
                                                <ThemedText variant="small" style={styles.snippetTime}>{draft.start}–{draft.end}s</ThemedText>
                                            </View>
                                        </Pressable>
                                    )
                                })}
                                <Pressable onPress={addSegmentDraft} accessibilityRole="button" accessibilityLabel="Add another snippet" style={[styles.snippetAddCard, { borderColor: colors.border }]}>
                                    <Ionicons name="add" size={22} color={colors.primary} />
                                    <ThemedText variant="small" style={{ color: colors.primary }}>Add</ThemedText>
                                </Pressable>
                            </ScrollView>

                            {activeDraft ? (
                                <View style={[styles.detailCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                                    <View style={styles.segmentHeader}>
                                        <View style={styles.statusRow}>
                                            <ThemedText variant="subheader">Snippet {activeSegmentIndex + 1}</ThemedText>
                                            <ThemedText variant="small" style={{ color: colors.placeholder }}>of {segmentDrafts.length}</ThemedText>
                                        </View>
                                        {segmentDrafts.length > 1 ? (
                                            <Pressable onPress={() => removeSegmentDraft(activeDraft.id)} accessibilityRole="button" accessibilityLabel={`Remove snippet ${activeSegmentIndex + 1}`} hitSlop={8}>
                                                <Ionicons name="trash-outline" size={20} color={colors.warning} />
                                            </Pressable>
                                        ) : null}
                                    </View>

                                    {activeDraftHasRange ? (
                                        <View style={styles.playerWrap}>
                                            <LocalSegmentPlayer
                                                source={selectedVideo.uri}
                                                startTime={activeDraftStart}
                                                endTime={activeDraftEnd}
                                                editableRange
                                                enableFullscreen={false}
                                                onRangeChange={(nextStart, nextEnd) => updateSegmentDraft(activeDraft.id, { start: formatTimestamp(nextStart), end: formatTimestamp(nextEnd) })}
                                            />
                                        </View>
                                    ) : null}

                                    {/* Range: inputs with ±1 count steppers when a grid exists */}
                                    <View style={styles.rangeRow}>
                                        <View style={styles.rangeField}>
                                            <ThemedText variant="small" style={[styles.fieldLabel, { color: colors.placeholder }]}>Start</ThemedText>
                                            <View style={[styles.stepperInput, { borderColor: colors.border, backgroundColor: colors.card }]}>
                                                {grid ? <StepButton icon="remove" onPress={() => nudgeDraft(activeDraft.id, 'start', -1)} label="Start one count earlier" color={colors.text} /> : null}
                                                <ThemedInput value={activeDraft.start} onChangeText={(value) => updateSegmentDraft(activeDraft.id, { start: value.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" style={styles.stepperText} />
                                                {grid ? <StepButton icon="add" onPress={() => nudgeDraft(activeDraft.id, 'start', 1)} label="Start one count later" color={colors.text} /> : null}
                                            </View>
                                        </View>
                                        <View style={styles.rangeField}>
                                            <ThemedText variant="small" style={[styles.fieldLabel, { color: colors.placeholder }]}>End</ThemedText>
                                            <View style={[styles.stepperInput, { borderColor: colors.border, backgroundColor: colors.card }]}>
                                                {grid ? <StepButton icon="remove" onPress={() => nudgeDraft(activeDraft.id, 'end', -1)} label="End one count earlier" color={colors.text} /> : null}
                                                <ThemedInput value={activeDraft.end} onChangeText={(value) => updateSegmentDraft(activeDraft.id, { end: value.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" style={styles.stepperText} />
                                                {grid ? <StepButton icon="add" onPress={() => nudgeDraft(activeDraft.id, 'end', 1)} label="End one count later" color={colors.text} /> : null}
                                            </View>
                                        </View>
                                    </View>
                                    {grid ? (
                                        <View style={styles.mergeRow}>
                                            <Pressable
                                                onPress={() => mergeDraft(activeSegmentIndex, -1)}
                                                disabled={activeSegmentIndex === 0}
                                                accessibilityRole="button"
                                                style={[styles.mergeButton, { borderColor: colors.border, opacity: activeSegmentIndex === 0 ? 0.4 : 1 }]}
                                            >
                                                <Ionicons name="arrow-back" size={14} color={colors.text} />
                                                <ThemedText variant="small">Merge with previous</ThemedText>
                                            </Pressable>
                                            <Pressable
                                                onPress={() => mergeDraft(activeSegmentIndex, 1)}
                                                disabled={activeSegmentIndex >= segmentDrafts.length - 1}
                                                accessibilityRole="button"
                                                style={[styles.mergeButton, { borderColor: colors.border, opacity: activeSegmentIndex >= segmentDrafts.length - 1 ? 0.4 : 1 }]}
                                            >
                                                <ThemedText variant="small">Merge with next</ThemedText>
                                                <Ionicons name="arrow-forward" size={14} color={colors.text} />
                                            </Pressable>
                                        </View>
                                    ) : null}

                                    <View style={styles.sectionHeader}>
                                        <ThemedText variant="small" style={[styles.fieldLabel, { color: colors.placeholder }]}>Position</ThemedText>
                                        <Pressable onPress={() => setCategoryModalOpen(true)} accessibilityRole="button" accessibilityLabel="Create a new category" hitSlop={8} style={styles.statusRow}>
                                            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                                            <ThemedText variant="small" style={{ color: colors.primary }}>New</ThemedText>
                                        </Pressable>
                                    </View>
                                    <View style={styles.chipWrap}>
                                        {(categoriesQuery.data ?? []).map((category) => {
                                            const on = activeDraft.categoryId === category.id
                                            return (
                                                <Pressable
                                                    key={category.id}
                                                    onPress={() => updateSegmentDraft(activeDraft.id, { categoryId: category.id })}
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: on }}
                                                    style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }]}
                                                >
                                                    <ThemedText variant="small" style={{ color: on ? colors.onPrimary : colors.text }}>{category.name}</ThemedText>
                                                </Pressable>
                                            )
                                        })}
                                    </View>

                                    <ThemedText variant="small" style={[styles.fieldLabel, { color: colors.placeholder }]}>Title</ThemedText>
                                    <ThemedInput value={activeDraft.title} onChangeText={(value) => updateSegmentDraft(activeDraft.id, { title: value })} placeholder="Optional" style={[styles.input, { backgroundColor: colors.card }]} />
                                    <ThemedText variant="small" style={[styles.fieldLabel, { color: colors.placeholder }]}>Notes</ThemedText>
                                    <ThemedInput value={activeDraft.description} onChangeText={(value) => updateSegmentDraft(activeDraft.id, { description: value })} placeholder="Optional" multiline style={[styles.input, styles.multilineInput, { backgroundColor: colors.card }]} />

                                    <ThemedText variant="small" style={[styles.fieldLabel, { color: colors.placeholder }]}>Thumbnail</ThemedText>
                                    <View style={styles.thumbnailRow}>
                                        {activeDraft.thumbnailReference ? (
                                            <ExpoImage source={{ uri: activeDraft.thumbnailReference }} style={[styles.thumbnailPreview, { borderColor: colors.border }]} contentFit="cover" />
                                        ) : (
                                            <View style={[styles.thumbnailPreview, styles.thumbnailEmpty, { borderColor: colors.border, backgroundColor: colors.card }]}>
                                                <Ionicons name="image-outline" size={20} color={colors.placeholder} />
                                            </View>
                                        )}
                                        <View style={{ flex: 1, gap: 6 }}>
                                            <ThemedInput value={activeDraft.thumbnailTime} onChangeText={(value) => updateSegmentDraft(activeDraft.id, { thumbnailTime: value.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" placeholder="Frame time (s)" style={[styles.input, { backgroundColor: colors.card }]} />
                                            <ThemedButton title={activeDraft.thumbnailLoading ? 'Generating…' : 'Use this frame'} variant="ghost" onPress={() => void generateSegmentThumbnail(selectedVideo, activeDraft.id)} loading={activeDraft.thumbnailLoading} />
                                        </View>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ) : <ThemedText variant="small" style={styles.thumbnailPrompt}>Select a video above to choose a thumbnail frame from it.</ThemedText>}

                    <ThemedButton
                        title={syncVideoUpload.isPending || createSegment.isPending ? 'Saving segments...' : 'Add video segments'}
                        onPress={() => void saveVideoReference()}
                        loading={syncVideoUpload.isPending || createSegment.isPending}
                        style={styles.fullButton}
                    />
                    {syncVideoUpload.isPending ? <ActivityIndicator /> : null}
                </View>
            </ScrollView>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 40,
        gap: 12,
    },
    intro: {
        lineHeight: 24,
        marginBottom: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    backIconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backIconPressed: {
        opacity: 0.65,
    },
    formSection: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        gap: 10,
    },
    label: {
        fontWeight: '700',
        marginTop: 4,
    },
    input: {
        borderWidth: 1,
        borderRadius: 6,
        minHeight: 44,
        paddingHorizontal: 10,
    },
    multilineInput: {
        minHeight: 84,
        textAlignVertical: 'top',
        paddingTop: 10,
    },
    dropdown: {
        minHeight: 44,
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    dropdownMenu: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        gap: 8,
    },
    modalCard: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        gap: 10,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 8,
    },
    modalActionButton: {
        flex: 1,
    },
    fullButton: {
        width: '100%',
        marginTop: 6,
    },
    segmentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    thumbnailPrompt: {
        marginTop: 4,
    },
    // --- Snippet form -------------------------------------------------------
    snippetSection: {
        gap: 12,
        marginTop: 4,
    },
    snippetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusPill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    autoSnipButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    snippetStrip: {
        gap: 8,
        paddingVertical: 2,
    },
    snippetCard: {
        width: 104,
        height: 76,
        borderRadius: 12,
        borderWidth: 2,
        overflow: 'hidden',
        padding: 6,
        justifyContent: 'space-between',
    },
    snippetCardShade: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    snippetCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    snippetIndex: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    snippetIndexText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
        lineHeight: 14,
    },
    snippetCardBottom: {
        gap: 0,
    },
    snippetBadge: {
        fontSize: 10,
        lineHeight: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: '#E9D5FF',
    },
    snippetTime: {
        fontSize: 11,
        lineHeight: 14,
        color: '#FFFFFF',
    },
    snippetAddCard: {
        width: 72,
        height: 76,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailCard: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        gap: 8,
    },
    playerWrap: {
        borderRadius: 10,
        overflow: 'hidden',
    },
    fieldLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginTop: 4,
    },
    rangeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    rangeField: {
        flex: 1,
        gap: 4,
    },
    stepperInput: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        overflow: 'hidden',
    },
    stepperText: {
        flex: 1,
        borderWidth: 0,
        backgroundColor: 'transparent',
        textAlign: 'center',
        minHeight: 42,
        paddingHorizontal: 4,
    },
    stepButton: {
        width: 36,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mergeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    mergeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 9,
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    chip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    thumbnailRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
    },
    thumbnailPreview: {
        width: 96,
        height: 96,
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: '#000',
    },
    thumbnailEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmented: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: 999,
        overflow: 'hidden',
    },
    segment: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 40,
        alignItems: 'center',
    },
})
