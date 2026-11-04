import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { Image as ExpoImage } from 'expo-image'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import ThemedInput from 'Components/ThemedInput'
import LocalSegmentPlayer from '../../../Components/LocalSegmentPlayer'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { useVideoUploadById } from 'lib/hooks/useVideoUploadDetails'
import { useVideoAsset } from 'lib/hooks/useVideoAsset'
import { useVideoCategories, useCreateVideoCategory } from 'lib/hooks/useVideoCategories'
import { useCreateVideoSegment, useDeleteVideoSegment, useVideoSegments } from 'lib/hooks/useSegments'
import { useUpdateCountGridPhase } from 'lib/hooks/useVideoAnalysis'
import { buildChunks, formatClock, nearestBeat, type Chunk, type ChunkSize } from 'lib/analysis/chunks'
import type { SegmentRecord } from 'lib/models'

/**
 * Snippet builder (Fable v2 spec §5.2). Portrait, one-handed:
 * filmstrip of chunk thumbnails -> tap first, tap last -> pick a category -> Save.
 * Everything comes from the count grid the worker stored on the video; the video
 * file itself is read only from the phone.
 */
export default function SnippetBuilderScreen() {
    const { id } = useLocalSearchParams<{ id: string }>()
    const { colors } = useTheme()
    const videoQuery = useVideoUploadById(id ?? null)
    const video = videoQuery.data ?? null
    const assetQuery = useVideoAsset(video)
    const localUri = assetQuery.data?.status === 'AVAILABLE' ? assetQuery.data.uri : null
    const categoriesQuery = useVideoCategories(video?.roadmap_id ?? null)
    const createCategory = useCreateVideoCategory()
    const segmentsQuery = useVideoSegments(video?.id ?? null)
    const createSegment = useCreateVideoSegment()
    const deleteSegment = useDeleteVideoSegment()
    const updatePhase = useUpdateCountGridPhase()

    const grid = video?.count_grid ?? null
    const [chunkSize, setChunkSize] = useState<ChunkSize>(8)
    // Music mode: which bar parity is "1" (null until the user taps). Persisted on the grid.
    const [phase, setPhase] = useState<number | null>(grid && !grid.ambiguous_1_vs_5 ? 0 : null)
    const chunks = useMemo(() => (grid ? buildChunks(grid, chunkSize, phase ?? 0) : []), [grid, chunkSize, phase])

    // Selection = inclusive chunk index range, plus optional fine-tuned edges in seconds.
    const [sel, setSel] = useState<{ a: number; b: number } | null>(null)
    const [edges, setEdges] = useState<{ start: number; end: number } | null>(null)
    const [categoryId, setCategoryId] = useState<string | null>(null)
    const [title, setTitle] = useState('')
    const [newCategory, setNewCategory] = useState('')
    const [thumbs, setThumbs] = useState<Record<number, string>>({})
    const [lastSaved, setLastSaved] = useState<SegmentRecord | null>(null)
    const stripRef = useRef<React.ComponentRef<typeof ScrollView>>(null)

    const range = useMemo(() => {
        if (!sel || !chunks.length) return null
        const a = Math.min(sel.a, sel.b), b = Math.max(sel.a, sel.b)
        return edges ?? { start: chunks[a].start, end: chunks[b].end }
    }, [sel, chunks, edges])

    // Thumbnails: one per chunk, generated on the phone from the local file, lazily.
    useEffect(() => {
        if (!localUri || !chunks.length) return
        let cancelled = false
        ;(async () => {
            for (const c of chunks) {
                if (cancelled) return
                if (thumbs[c.index]) continue
                try {
                    const r = await VideoThumbnails.getThumbnailAsync(localUri, { time: Math.round((c.start + 0.2) * 1000), quality: 0.4 })
                    if (!cancelled) setThumbs((t) => ({ ...t, [c.index]: r.uri }))
                } catch { /* a missing thumbnail is cosmetic */ }
            }
        })()
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localUri, chunks.length, chunkSize])

    useEffect(() => { setThumbs({}); setSel(null); setEdges(null) }, [chunkSize])

    const savedCover = useMemo(() => {
        // chunk index -> true when any saved segment overlaps most of it
        const segs = segmentsQuery.data ?? []
        const m: Record<number, boolean> = {}
        for (const c of chunks) {
            m[c.index] = segs.some((s) => Math.min(s.end_time, c.end) - Math.max(s.start_time, c.start) > (c.end - c.start) * 0.5)
        }
        return m
    }, [segmentsQuery.data, chunks])

    function tapChunk(i: number) {
        setEdges(null)
        if (!sel) { setSel({ a: i, b: i }); return }
        if (sel.a === sel.b && i !== sel.a) { setSel({ a: sel.a, b: i }); return }
        setSel({ a: i, b: i }) // third tap starts over
    }

    function nudge(edge: 'start' | 'end', dir: -1 | 1) {
        if (!range || !grid) return
        const beats = grid.beat_times
        const cur = edge === 'start' ? range.start : range.end
        const snapped = nearestBeat(grid, cur)
        const idx = beats.indexOf(snapped)
        const next = idx >= 0 && beats[idx + dir] != null ? beats[idx + dir] : Math.max(0, Math.min(grid.duration_s, cur + dir * (grid.count_period_s ?? 0.5)))
        const start = edge === 'start' ? next : range.start
        const end = edge === 'end' ? next : range.end
        if (end - start < 0.2) return
        setEdges({ start, end })
    }

    function selectNextUnsaved() {
        const next = chunks.find((c) => !savedCover[c.index] && (!sel || c.index > Math.max(sel.a, sel.b)))
        setEdges(null)
        setSel(next ? { a: next.index, b: next.index } : null)
        if (next) stripRef.current?.scrollTo({ x: Math.max(0, next.index * 92 - 120), animated: true })
    }

    async function save() {
        if (!video || !range) return
        if (!categoryId) { showSnack('Pick a category first.'); return }
        try {
            const seg = await createSegment.mutateAsync({
                videoUploadId: video.id, startTime: Number(range.start.toFixed(3)), endTime: Number(range.end.toFixed(3)),
                durationSeconds: grid?.duration_s ?? video.duration_seconds ?? null, categoryId, title: title.trim() || null,
                thumbnailReference: sel ? thumbs[Math.min(sel.a, sel.b)] ?? null : null,
            })
            setLastSaved(seg as SegmentRecord)
            setTitle('')
            showSnack('Snippet saved', { actionTitle: 'Undo', onAction: () => void undoSave(seg as SegmentRecord) })
            selectNextUnsaved()
        } catch (e) {
            showSnack(e instanceof Error ? e.message : 'Could not save snippet.')
        }
    }

    async function undoSave(seg: SegmentRecord) {
        try { await deleteSegment.mutateAsync({ id: seg.id, video_upload_id: seg.video_upload_id }); setLastSaved(null) } catch { /* ignore */ }
    }

    async function addCategory() {
        const name = newCategory.trim()
        if (!name || !video) return
        try {
            const c = await createCategory.mutateAsync({ roadmapId: video.roadmap_id, name })
            setCategoryId((c as { id: string }).id)
            setNewCategory('')
        } catch (e) { showSnack(e instanceof Error ? e.message : 'Could not add category.') }
    }

    async function setOneAt(chunk: Chunk) {
        if (!grid || !video) return
        const bi = grid.bar_times.indexOf(chunk.start)
        if (bi < 0) return
        const parity = bi % 2
        setPhase(parity)
        try { await updatePhase.mutateAsync({ videoId: video.id, grid, phaseOffsetBars: parity }) } catch { /* local state still applied */ }
    }

    // ----- render -------------------------------------------------------------
    if (videoQuery.isLoading || assetQuery.isLoading) {
        return <ThemedView style={styles.center}><ActivityIndicator /></ThemedView>
    }
    if (!video) return <ThemedView style={styles.center}><ThemedText>Video not found.</ThemedText></ThemedView>
    if (!localUri) return <ThemedView style={styles.center}><ThemedText>This video is not on this device. Relink it first.</ThemedText></ThemedView>
    if (!grid || video.analysis_status !== 'ready') {
        return (
            <ThemedView style={styles.center}>
                <ThemedText>Counts not found yet.</ThemedText>
                <ThemedText variant="small">Use “Find counts” on the video first.</ThemedText>
                <ThemedButton title="Back" variant="ghost" onPress={() => router.back()} />
            </ThemedView>
        )
    }

    const needsTap = grid.mode === 'music' && phase == null
    const selA = sel ? Math.min(sel.a, sel.b) : -1, selB = sel ? Math.max(sel.a, sel.b) : -1
    // Library positions first (by sort_order), then the user's own categories by name.
    const categories = [...(categoriesQuery.data ?? [])].sort((x, y) =>
        (x.sort_order ?? 1e9) - (y.sort_order ?? 1e9) || x.name.localeCompare(y.name))

    return (
        <ThemedView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <LocalSegmentPlayer
                    key={range ? `${range.start}-${range.end}` : 'all'}
                    source={localUri}
                    startTime={range?.start ?? 0}
                    endTime={range?.end ?? null}
                    enableFullscreen={false}
                />
                <View style={styles.row}>
                    <ThemedText variant="small">{formatClock(grid.duration_s)} · {grid.mode === 'counting' ? 'spoken counts' : grid.mode === 'music' ? 'music' : 'no audio'} · {chunks.length} chunks</ThemedText>
                </View>

                {needsTap ? (
                    <View style={[styles.banner, { backgroundColor: colors.uiBackground, borderColor: colors.primary }]}>
                        <ThemedText variant="small">Which chunk starts on a “1”? Tap it, then press “This is 1”.</ThemedText>
                    </View>
                ) : null}

                <View style={styles.segmented}>
                    {([4, 8] as ChunkSize[]).map((n) => (
                        <Pressable key={n} onPress={() => setChunkSize(n)} style={[styles.segment, { borderColor: colors.border, backgroundColor: chunkSize === n ? colors.primary : colors.card }]}>
                            <ThemedText style={{ color: chunkSize === n ? colors.onPrimary : colors.text }}>{n} counts</ThemedText>
                        </Pressable>
                    ))}
                </View>

                <ScrollView ref={stripRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                    {chunks.map((c) => {
                        const selected = c.index >= selA && c.index <= selB
                        const saved = savedCover[c.index]
                        return (
                            <Pressable key={c.index} onPress={() => tapChunk(c.index)} style={[styles.chunk, { borderColor: selected ? colors.primary : colors.border, backgroundColor: saved ? colors.uiBackground : colors.card, opacity: c.talking && !selected ? 0.75 : 1 }]}>
                                <ThemedText variant="small" style={styles.chunkLabel}>{c.countLabel ?? (needsTap ? '?' : '')}</ThemedText>
                                {thumbs[c.index] ? <ExpoImage source={{ uri: thumbs[c.index] }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, { backgroundColor: colors.border }]} />}
                                <ThemedText variant="small">{formatClock(c.start)}</ThemedText>
                                {saved ? <ThemedText variant="small" style={{ color: colors.primary }}>saved</ThemedText> : c.talking ? <ThemedText variant="small" style={{ color: colors.placeholder }}>talk</ThemedText> : null}
                            </Pressable>
                        )
                    })}
                </ScrollView>

                {needsTap && sel ? (
                    <ThemedButton title="This is 1" onPress={() => void setOneAt(chunks[selA])} style={styles.fullButton} />
                ) : null}

                {range ? (
                    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <ThemedText>Selected {formatClock(range.start)} – {formatClock(range.end)} ({(range.end - range.start).toFixed(1)} s)</ThemedText>
                        <View style={styles.nudges}>
                            <ThemedButton title="◀ start" variant="ghost" onPress={() => nudge('start', -1)} style={styles.nudge} />
                            <ThemedButton title="start ▶" variant="ghost" onPress={() => nudge('start', 1)} style={styles.nudge} />
                            <ThemedButton title="◀ end" variant="ghost" onPress={() => nudge('end', -1)} style={styles.nudge} />
                            <ThemedButton title="end ▶" variant="ghost" onPress={() => nudge('end', 1)} style={styles.nudge} />
                        </View>
                        <ThemedText variant="small" style={styles.label}>Category</ThemedText>
                        <View style={styles.chips}>
                            {categories.map((cat) => (
                                <Pressable key={cat.id} onPress={() => setCategoryId(cat.id)} style={[styles.chip, { borderColor: colors.border, backgroundColor: categoryId === cat.id ? colors.primary : colors.uiBackground }]}>
                                    <ThemedText variant="small" style={{ color: categoryId === cat.id ? colors.onPrimary : colors.text }}>{cat.name}</ThemedText>
                                </Pressable>
                            ))}
                        </View>
                        <View style={styles.row}>
                            <ThemedInput value={newCategory} onChangeText={setNewCategory} placeholder="New category" style={styles.grow} />
                            <ThemedButton title="Add" variant="ghost" onPress={() => void addCategory()} loading={createCategory.isPending} />
                        </View>
                        <ThemedInput value={title} onChangeText={setTitle} placeholder="Title (optional)" />
                        <ThemedButton title="Save snippet" onPress={() => void save()} loading={createSegment.isPending} disabled={!categoryId} style={styles.fullButton} />
                    </View>
                ) : (
                    <ThemedText variant="small" style={styles.hint}>Tap the first chunk, then the last, to select a range.</ThemedText>
                )}

                <ThemedText variant="small" style={styles.label}>Saved snippets ({segmentsQuery.data?.length ?? 0})</ThemedText>
                {(segmentsQuery.data ?? []).map((s) => (
                    <View key={s.id} style={[styles.saved, { borderColor: colors.border }]}>
                        <Pressable style={styles.grow} onPress={() => { setEdges({ start: s.start_time, end: s.end_time }); setSel({ a: 0, b: 0 }) }}>
                            <ThemedText>{categories.find((c) => c.id === s.category_id)?.name ?? 'Snippet'}{s.title ? ` · ${s.title}` : ''}</ThemedText>
                            <ThemedText variant="small">{formatClock(s.start_time)} – {formatClock(s.end_time)}</ThemedText>
                        </Pressable>
                        <ThemedButton title="Delete" variant="warning" onPress={() => void deleteSegment.mutateAsync({ id: s.id, video_upload_id: s.video_upload_id })} />
                    </View>
                ))}
                {lastSaved ? null : null}
            </ScrollView>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
    content: { padding: 12, gap: 10, paddingBottom: 40 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    grow: { flex: 1 },
    banner: { borderWidth: 1, borderRadius: 10, padding: 10 },
    segmented: { flexDirection: 'row', gap: 8 },
    segment: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    strip: { gap: 8, paddingVertical: 4 },
    chunk: { width: 84, borderWidth: 2, borderRadius: 10, padding: 4, alignItems: 'center', gap: 2 },
    chunkLabel: { fontWeight: '700', minHeight: 16 },
    thumb: { width: 72, height: 128, borderRadius: 6 },
    panel: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
    nudges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    nudge: { flexGrow: 1, minWidth: 70 },
    label: { marginTop: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
    fullButton: { alignSelf: 'stretch' },
    hint: { textAlign: 'center', marginVertical: 8 },
    saved: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
})
