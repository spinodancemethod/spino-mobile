import React, { useCallback, useState } from 'react'
import { persistThumbnail } from 'lib/localVideoStore'
import { thumbnailDisplayUri } from 'lib/thumbnailUri'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { Image as ExpoImage } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { queryClient } from 'lib/queryClient'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import ThemedInput from 'Components/ThemedInput'
import LocalSegmentPlayer from '../../Components/LocalSegmentPlayer'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { useCreateVideoCategory, useVideoCategories } from 'lib/hooks/useVideoCategories'
import { useCreateVideoSegment, useDeleteVideoSegment, useUpdateVideoSegment, useVideoSegments } from 'lib/hooks/useSegments'
import { useLocalVideoLibrary } from 'lib/hooks/useLocalVideoLibrary'
import { useRelinkVideoUpload } from 'lib/hooks/useRelinkVideoUpload'
import { describeRelinkScan, useVideoRelinkRecommendations } from 'lib/hooks/useVideoRelinkRecommendations'
import type { LocalVideoUpload, SegmentRecord } from 'lib/models'

function formatTimestamp(value: number) {
    return value.toFixed(2)
}

export default function LocalVideosScreen() {
    const { colors } = useTheme()
    const {
        videos,
        cloudUploadsQuery,
        roadmapsQuery,
        selectedVideoId,
        setSelectedVideoId,
        picking,
        pickVideo,
        confirmRemove,
        loading,
    } = useLocalVideoLibrary()
    const relinkVideoUpload = useRelinkVideoUpload()
    const recommendationsMutation = useVideoRelinkRecommendations()
    const [refreshing, setRefreshing] = useState(false)
    // Recovery page: only records whose file can no longer be found belong here.
    // Available videos are managed from the roadmap, not listed as history.
    const missingVideos = videos.filter((video) => video.status === 'NEEDS_RELINK')
    const checkingVideos = videos.some((video) => video.status === 'UNKNOWN')

    // This is a recovery screen, so it must show the real state of every record rather than
    // the minute-old persisted cache: refetch the records and re-check every file on the device
    // each time the screen is opened, and forget any previous scan result.
    const refreshLocalVideos = useCallback(async () => {
        recommendationsMutation.reset()
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['videoUploads'] }),
            queryClient.invalidateQueries({ queryKey: ['videoAsset'] }),
        ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    useFocusEffect(useCallback(() => { void refreshLocalVideos() }, [refreshLocalVideos]))

    async function pullToRefresh() {
        setRefreshing(true)
        try { await refreshLocalVideos() } finally { setRefreshing(false) }
    }
    const [rangeStart, setRangeStart] = useState('0.00')
    const [rangeEnd, setRangeEnd] = useState('10.00')
    const activeRoadmapId = selectedVideoId
        ? (cloudUploadsQuery.data?.find((item) => item.local_reference_key === selectedVideoId)?.roadmap_id ?? null)
        : (roadmapsQuery.data?.[0]?.id ?? null)
    const categoriesQuery = useVideoCategories(activeRoadmapId)
    const createCategory = useCreateVideoCategory()
    const { mutateAsync: saveCloudSegment, isPending: isCreatingSegment } = useCreateVideoSegment()
    const updateSegment = useUpdateVideoSegment()
    const deleteSegment = useDeleteVideoSegment()
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryDescription, setNewCategoryDescription] = useState('')
    const [segmentTitle, setSegmentTitle] = useState('')
    const [segmentThumbnailTime, setSegmentThumbnailTime] = useState('0.00')
    const [segmentThumbnailReference, setSegmentThumbnailReference] = useState<string | null>(null)
    const [segmentThumbnailLoading, setSegmentThumbnailLoading] = useState(false)
    const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
    const selectedCloudVideoId = selectedVideoId
        ? cloudUploadsQuery.data?.find((item) => item.local_reference_key === selectedVideoId)?.id ?? null
        : null
    const segmentsQuery = useVideoSegments(selectedCloudVideoId)
    const missingUploadRecords = (cloudUploadsQuery.data ?? []).filter((record) => (
        videos.find((video) => video.id === record.local_reference_key)?.status === 'NEEDS_RELINK'
    ))

    async function findRecommendedVideos() {
        try {
            const { matchCount, diagnostics, byUploadId } = await recommendationsMutation.mutateAsync(missingUploadRecords)
            // Full breakdown in the Metro console (copy/paste friendly); the snackbar only fits a summary.
            console.log('[relink-scan]', JSON.stringify({
                uploads: missingUploadRecords.map((u) => ({
                    id: u.id, hash: u.content_hash, size: u.file_size_bytes, duration: u.duration_seconds,
                })),
                diagnostics,
                matchesByUploadId: byUploadId,
            }, null, 2))
            // The scan breakdown is shown on a miss so a release build can be debugged without logs.
            showSnack(matchCount > 0
                ? `${matchCount} matching local ${matchCount === 1 ? 'video was' : 'videos were'} found.`
                : `No matching videos were found. ${describeRelinkScan(diagnostics)}`)
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not scan this device for matching videos.')
        }
    }

    async function restoreRecommendedVideo(video: LocalVideoUpload, candidateIndex: number) {
        const videoUpload = cloudUploadsQuery.data?.find((record) => record.local_reference_key === video.id)
        const candidate = videoUpload ? recommendationsMutation.data?.byUploadId[videoUpload.id]?.[candidateIndex] : null
        if (!videoUpload || !candidate) return
        try {
            await relinkVideoUpload.mutateAsync({ videoUpload, candidate })
            const segmentCount = video.segmentCount ?? 0
            showSnack(`${video.originalFilename ?? video.fileName ?? 'Video'} restored. ${segmentCount} ${segmentCount === 1 ? 'segment is' : 'segments are'} available again.`)
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not restore this video.')
        }
    }

    // Records whose scan produced exactly one verified match. Ambiguous ones (several device
    // files with the same fingerprint) are left for the user to pick by hand.
    const unambiguousMatches = missingUploadRecords.flatMap((videoUpload) => {
        const matches = recommendationsMutation.data?.byUploadId[videoUpload.id] ?? []
        return matches.length === 1 ? [{ videoUpload, candidate: matches[0] }] : []
    })
    const [restoringAll, setRestoringAll] = useState(false)

    /**
     * Restore every unambiguous match in one go. On a replacement phone there can be
     * hundreds of records, so a per-card tap does not scale. Runs sequentially: each
     * restore re-hashes the candidate, and parallel reads of large files stall the UI.
     */
    async function restoreAllMatches() {
        if (unambiguousMatches.length === 0) return
        setRestoringAll(true)
        let restored = 0
        let failed = 0
        try {
            for (const { videoUpload, candidate } of unambiguousMatches) {
                try {
                    await relinkVideoUpload.mutateAsync({ videoUpload, candidate })
                    restored += 1
                } catch {
                    failed += 1
                }
            }
        } finally {
            setRestoringAll(false)
        }
        const skipped = missingUploadRecords.filter((r) => (recommendationsMutation.data?.byUploadId[r.id]?.length ?? 0) > 1).length
        showSnack(`${restored} ${restored === 1 ? 'video' : 'videos'} restored.`
            + (failed > 0 ? ` ${failed} failed.` : '')
            + (skipped > 0 ? ` ${skipped} with several matches need a manual choice.` : ''))
    }

    async function saveRange(video: LocalVideoUpload) {
        const start = Number(rangeStart)
        const end = Number(rangeEnd)
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= end) {
            showSnack('Enter a valid range where start is less than end.')
            return
        }

        setRangeStart(formatTimestamp(start))
        setRangeEnd(formatTimestamp(end))
        showSnack('Timestamp range ready to save as a segment.')
    }

    function openPreview(video: LocalVideoUpload) {
        setRangeStart(formatTimestamp(video.rangeStart))
        setRangeEnd(formatTimestamp(video.rangeEnd))
        setSegmentTitle('')
        setSegmentThumbnailReference(video.thumbnailReference ?? null)
        setEditingSegmentId(null)
        const miscCategory = categoriesQuery.data?.find((category) => category.system_category && category.name.toLowerCase() === 'misc')
        setSelectedCategoryId(miscCategory?.id ?? categoriesQuery.data?.[0]?.id ?? null)
        setSelectedVideoId(video.id)
    }

    async function generateSegmentThumbnail(video: LocalVideoUpload) {
        const seconds = Number(segmentThumbnailTime)
        const boundedSeconds = video.duration == null ? seconds : Math.max(0, Math.min(seconds, video.duration))
        if (!Number.isFinite(boundedSeconds) || boundedSeconds < 0) {
            showSnack('Enter a valid thumbnail timestamp.')
            return
        }

        setSegmentThumbnailLoading(true)
        try {
            const result = await VideoThumbnails.getThumbnailAsync(video.uri, { time: Math.round(boundedSeconds * 1000) })
            setSegmentThumbnailReference(await persistThumbnail(result.uri))
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not generate thumbnail for this segment.')
        } finally {
            setSegmentThumbnailLoading(false)
        }
    }

    async function addCategory() {
        if (!activeRoadmapId) {
            showSnack('Create or choose a roadmap before adding a category.')
            return
        }
        const name = newCategoryName.trim()
        if (!name) {
            showSnack('Enter a category name.')
            return
        }
        try {
            const category = await createCategory.mutateAsync({
                roadmapId: activeRoadmapId,
                name,
                description: newCategoryDescription,
            })
            setSelectedCategoryId(category.id)
            setNewCategoryName('')
            setNewCategoryDescription('')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not create category.')
        }
    }

    async function saveSegment(video: LocalVideoUpload) {
        const cloudVideo = cloudUploadsQuery.data?.find((item) => item.local_reference_key === video.id)
        const start = Number(rangeStart)
        const end = Number(rangeEnd)
        if (!cloudVideo) {
            showSnack('Sync this video to Supabase before saving a segment.')
            return
        }
        if (!selectedCategoryId) {
            showSnack('Choose a category before saving the segment.')
            return
        }
        try {
            await saveCloudSegment({
                videoUploadId: cloudVideo.id,
                startTime: start,
                endTime: end,
                durationSeconds: video.duration,
                categoryId: selectedCategoryId,
                title: segmentTitle,
                thumbnailReference: segmentThumbnailReference,
            })
            setEditingSegmentId(null)
            showSnack('Segment saved.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not save segment.')
        }
    }

    function editSegment(segment: SegmentRecord) {
        setRangeStart(formatTimestamp(segment.start_time))
        setRangeEnd(formatTimestamp(segment.end_time))
        setSelectedCategoryId(segment.category_id)
        setSegmentTitle(segment.title ?? '')
        setSegmentThumbnailReference(segment.thumbnail_reference ?? null)
        setEditingSegmentId(segment.id)
    }

    async function removeSegment(segment: { id: string; video_upload_id: string }) {
        try {
            await deleteSegment.mutateAsync(segment)
            showSnack('Segment deleted.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not delete segment.')
        }
    }

    async function updateSelectedSegment(segment: { id: string; video_upload_id: string }) {
        const start = Number(rangeStart)
        const end = Number(rangeEnd)
        if (!selectedCategoryId) {
            showSnack('Choose a category before updating the segment.')
            return
        }
        try {
            await updateSegment.mutateAsync({
                id: segment.id,
                videoUploadId: segment.video_upload_id,
                startTime: start,
                endTime: end,
                durationSeconds: videos.find((video) => video.id === selectedVideoId)?.duration,
                categoryId: selectedCategoryId,
                title: segmentTitle,
                thumbnailReference: segmentThumbnailReference,
            })
            setEditingSegmentId(segment.id)
            showSnack('Segment updated.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not update segment.')
        }
    }

    if (loading) {
        return (
            <ThemedView safe padded style={styles.centered}>
                <ActivityIndicator />
                <ThemedText style={{ marginTop: 12 }}>Loading local video references...</ThemedText>
            </ThemedView>
        )
    }

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pullToRefresh()} tintColor={colors.text} />}
            >
                <ThemedText variant="title">Missing videos</ThemedText>
                <ThemedText variant="subheader" style={styles.intro}>
                    Videos stay on your device. Any that can no longer be found are listed here so you can reconnect them.
                </ThemedText>

                {missingUploadRecords.length > 0 ? (
                    <ThemedButton
                        title={recommendationsMutation.isPending ? 'Scanning device videos...' : 'Find matching videos'}
                        variant="ghost"
                        onPress={() => void findRecommendedVideos()}
                        loading={recommendationsMutation.isPending}
                        disabled={picking || relinkVideoUpload.isPending}
                        style={styles.fullButton}
                    />
                ) : null}
                {unambiguousMatches.length > 0 ? (
                    <ThemedButton
                        title={restoringAll
                            ? 'Restoring videos...'
                            : `Restore all ${unambiguousMatches.length} ${unambiguousMatches.length === 1 ? 'match' : 'matches'}`}
                        onPress={() => void restoreAllMatches()}
                        loading={restoringAll}
                        disabled={picking || relinkVideoUpload.isPending}
                        style={styles.fullButton}
                    />
                ) : null}
                {missingVideos.length === 0 ? (
                    <View style={[styles.emptyState, { borderColor: colors.border }]}>
                        {checkingVideos ? (
                            <ThemedText variant="subheader">Checking your videos...</ThemedText>
                        ) : (
                            <>
                                <ThemedText variant="subheader">All your videos are available on this device.</ThemedText>
                                <ThemedText variant="small">Nothing needs reconnecting.</ThemedText>
                            </>
                        )}
                    </View>
                ) : missingVideos.map((video) => {
                    const selected = selectedVideoId === video.id
                    const cloudVideo = cloudUploadsQuery.data?.find((record) => record.local_reference_key === video.id)
                    const recommendations = cloudVideo ? recommendationsMutation.data?.byUploadId[cloudVideo.id] ?? [] : []
                    return (
                        <View key={video.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <ThemedText variant="subheader" numberOfLines={2} style={styles.videoName}>
                                {video.originalFilename ?? video.fileName ?? 'Untitled source video'}
                            </ThemedText>
                            <ThemedText variant="small">{video.segmentCount ?? 0} {(video.segmentCount ?? 0) === 1 ? 'segment' : 'segments'}</ThemedText>
                            <ThemedText variant="small">
                                {video.status === 'NEEDS_RELINK'
                                    ? 'Video not found on this device'
                                    : video.status === 'AVAILABLE'
                                        ? 'Available on this device'
                                        : 'Checking local video availability...'}
                            </ThemedText>
                            {video.status === 'NEEDS_RELINK' && recommendations.length > 0 ? (
                                <View style={[styles.recommendations, { borderColor: colors.border }]}>
                                    <ThemedText variant="small" style={styles.rangeLabel}>
                                        {recommendations.length === 1 ? 'Recommended match' : `${recommendations.length} matching videos`}
                                    </ThemedText>
                                    {recommendations.map((candidate, index) => (
                                        <View key={candidate.assetId} style={[styles.candidate, { borderColor: colors.border }]}>
                                            <ThemedText variant="small" numberOfLines={1}>{candidate.filename}</ThemedText>
                                            <ThemedText variant="small">
                                                {candidate.durationSeconds != null ? `${candidate.durationSeconds.toFixed(1)}s` : 'Unknown length'}
                                                {candidate.fileSize != null ? ` · ${(candidate.fileSize / (1024 * 1024)).toFixed(1)} MB` : ''}
                                            </ThemedText>
                                            {/* Play the device file in place so the user can confirm it is the right clip before restoring. */}
                                            <LocalSegmentPlayer source={candidate.uri} />
                                            <ThemedButton
                                                title={recommendations.length === 1 ? 'Restore this video' : `Restore ${candidate.filename}`}
                                                variant="ghost"
                                                onPress={() => void restoreRecommendedVideo(video, index)}
                                                disabled={relinkVideoUpload.isPending}
                                                style={styles.actionButton}
                                            />
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                            {video.status === 'AVAILABLE' && selected ? (
                                <View style={styles.playerBlock}>
                                    <ThemedText variant="small" style={styles.rangeLabel}>Preview timestamp range (seconds)</ThemedText>
                                    <View style={styles.rangeInputs}>
                                        <ThemedInput
                                            value={rangeStart}
                                            onChangeText={(value) => setRangeStart(value.replace(/[^0-9.]/g, ''))}
                                            keyboardType="decimal-pad"
                                            placeholder="Start"
                                            style={styles.rangeInput}
                                        />
                                        <ThemedText variant="small">to</ThemedText>
                                        <ThemedInput
                                            value={rangeEnd}
                                            onChangeText={(value) => setRangeEnd(value.replace(/[^0-9.]/g, ''))}
                                            keyboardType="decimal-pad"
                                            placeholder="End"
                                            style={styles.rangeInput}
                                        />
                                    </View>
                                    <LocalSegmentPlayer
                                        source={video.uri}
                                        startTime={Number(rangeStart) || 0}
                                        endTime={Number(rangeEnd) > Number(rangeStart) ? Number(rangeEnd) : null}
                                    />
                                    <ThemedButton
                                        title="Save timestamp range"
                                        onPress={() => void saveRange(video)}
                                        style={styles.fullButton}
                                    />
                                    <ThemedText variant="small" style={styles.rangeLabel}>Category</ThemedText>
                                    <View style={styles.categoryList}>
                                        {(categoriesQuery.data ?? []).map((category) => (
                                            <ThemedButton
                                                key={category.id}
                                                title={category.name}
                                                variant={selectedCategoryId === category.id ? 'primary' : 'ghost'}
                                                onPress={() => setSelectedCategoryId(category.id)}
                                                style={styles.categoryButton}
                                            />
                                        ))}
                                    </View>
                                    <View style={styles.rangeInputs}>
                                        <ThemedInput
                                            value={newCategoryName}
                                            onChangeText={setNewCategoryName}
                                            placeholder="New category"
                                            style={styles.rangeInput}
                                        />
                                        <ThemedButton title="Add" onPress={() => void addCategory()} style={styles.addCategoryButton} />
                                    </View>
                                    <ThemedInput
                                        value={newCategoryDescription}
                                        onChangeText={setNewCategoryDescription}
                                        placeholder="Optional category description"
                                        multiline
                                        style={[styles.rangeInput, styles.multilineInput]}
                                    />
                                    <ThemedText variant="small" style={styles.rangeLabel}>Learning item title</ThemedText>
                                    <ThemedInput
                                        value={segmentTitle}
                                        onChangeText={setSegmentTitle}
                                        placeholder="Optional custom segment title"
                                        style={styles.rangeInput}
                                    />
                                    <ThemedText variant="small" style={styles.rangeLabel}>Segment thumbnail</ThemedText>
                                    <View style={styles.rangeInputs}>
                                        <ThemedInput
                                            value={segmentThumbnailTime}
                                            onChangeText={(value) => setSegmentThumbnailTime(value.replace(/[^0-9.]/g, ''))}
                                            keyboardType="decimal-pad"
                                            placeholder="Frame time"
                                            style={styles.rangeInput}
                                        />
                                        <ThemedButton title={segmentThumbnailLoading ? 'Generating...' : 'Choose frame'} onPress={() => void generateSegmentThumbnail(video)} loading={segmentThumbnailLoading} style={styles.addCategoryButton} />
                                    </View>
                                    {segmentThumbnailReference ? <ExpoImage source={{ uri: thumbnailDisplayUri(segmentThumbnailReference) }} style={styles.segmentThumbnailPreview} contentFit="cover" /> : null}
                                    <ThemedButton
                                        title={isCreatingSegment ? 'Saving segment...' : 'Save segment'}
                                        onPress={() => void saveSegment(video)}
                                        loading={isCreatingSegment}
                                        style={styles.fullButton}
                                    />
                                    <ThemedText variant="small" style={styles.rangeLabel}>Saved segments</ThemedText>
                                    {segmentsQuery.isError ? (
                                        <ThemedText variant="small">Apply the segments migration to load saved segments.</ThemedText>
                                    ) : (segmentsQuery.data ?? []).map((segment) => (
                                        <View key={segment.id} style={styles.savedSegment}>
                                            <ThemedText variant="small">
                                                {(segment.title ?? '').trim() || ((categoriesQuery.data ?? []).find((category) => category.id === segment.category_id)?.name ?? 'Misc')} · {segment.start_time}s → {segment.end_time}s · synced
                                            </ThemedText>
                                            <View style={styles.segmentActions}>
                                                <ThemedButton title="Edit" variant="ghost" onPress={() => editSegment(segment)} style={styles.segmentActionButton} />
                                                <ThemedButton title="Update" onPress={() => void updateSelectedSegment(segment)} loading={updateSegment.isPending} style={styles.segmentActionButton} />
                                                <ThemedButton title="Delete" variant="warning" onPress={() => void removeSegment(segment)} loading={deleteSegment.isPending} style={styles.segmentActionButton} />
                                            </View>
                                            {editingSegmentId === segment.id ? <ThemedText variant="small">Editing this segment with the form above.</ThemedText> : null}
                                        </View>
                                    ))}
                                    <ThemedText variant="small" style={styles.previewHint}>
                                        The selected range is what Phase 1 will preserve as a segment timestamp.
                                    </ThemedText>
                                </View>
                            ) : null}

                            <View style={styles.actions}>
                                {video.status === 'AVAILABLE' ? (
                                    <ThemedButton
                                        title={selected ? 'Hide preview' : 'Preview video'}
                                        variant="ghost"
                                        onPress={() => selected ? setSelectedVideoId(null) : openPreview(video)}
                                        style={styles.actionButton}
                                    />
                                ) : null}
                                <ThemedButton
                                    // When the scan has a verified match, the manual picker is the secondary path.
                                    title={video.status === 'NEEDS_RELINK' && recommendations.length > 0 ? 'Choose a different file' : 'Relink video'}
                                    variant="ghost"
                                    onPress={() => void pickVideo(video)}
                                    disabled={picking}
                                    style={styles.actionButton}
                                />
                                <ThemedButton
                                    title="Remove reference"
                                    variant="warning"
                                    onPress={() => confirmRemove(video)}
                                    style={styles.actionButton}
                                />
                            </View>
                        </View>
                    )
                })}

                <ThemedButton title="Back to account" variant="ghost" onPress={() => router.back()} style={styles.fullButton} />
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
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    intro: {
        lineHeight: 24,
        marginBottom: 4,
    },
    fullButton: {
        width: '100%',
    },
    emptyState: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 16,
        gap: 6,
    },
    card: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        gap: 6,
    },
    videoName: {
        fontWeight: '700',
    },
    playerBlock: {
        marginTop: 8,
        gap: 6,
    },
    rangeLabel: {
        fontWeight: '700',
    },
    rangeInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rangeInput: {
        borderWidth: 1,
        borderRadius: 6,
        flex: 1,
        minHeight: 40,
        paddingHorizontal: 10,
    },
    multilineInput: {
        minHeight: 84,
        textAlignVertical: 'top',
        paddingTop: 10,
    },
    categoryList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    categoryButton: {
        width: 'auto',
        minWidth: 80,
        margin: 0,
    },
    addCategoryButton: {
        minWidth: 70,
    },
    segmentThumbnailPreview: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 6,
        backgroundColor: '#000',
    },
    savedSegment: {
        gap: 6,
        paddingVertical: 6,
    },
    segmentActions: {
        flexDirection: 'row',
        gap: 6,
    },
    segmentActionButton: {
        flex: 1,
    },
    previewHint: {
        lineHeight: 20,
    },
    actions: {
        gap: 8,
        marginTop: 6,
    },
    recommendations: {
        borderTopWidth: 1,
        gap: 6,
        marginTop: 4,
        paddingTop: 8,
    },
    actionButton: {
        width: '100%',
    },
    candidate: {
        borderWidth: 1,
        borderRadius: 8,
        gap: 4,
        padding: 8,
        overflow: 'hidden',
    },
})
