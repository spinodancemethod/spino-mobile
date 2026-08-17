import React, { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { Image as ExpoImage } from 'expo-image'
import { router } from 'expo-router'
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
            setSegmentThumbnailReference(result.uri)
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
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                <ThemedText variant="title">Local Videos</ThemedText>
                <ThemedText variant="subheader" style={styles.intro}>
                    Segment workspace. Videos stay on this device and act only as source references for segment playback.
                </ThemedText>
                <ThemedText variant="small">
                    Cloud metadata: {cloudUploadsQuery.isLoading ? 'checking...' : cloudUploadsQuery.error ? 'migration required' : `${cloudUploadsQuery.data?.length ?? 0} reference(s) synced`}
                </ThemedText>

                <ThemedButton
                    title={picking ? 'Opening media library...' : 'Choose local video'}
                    onPress={() => void pickVideo()}
                    loading={picking}
                    style={styles.fullButton}
                />

                {videos.length === 0 ? (
                    <View style={[styles.emptyState, { borderColor: colors.border }]}>
                        <ThemedText variant="subheader">No local video references yet.</ThemedText>
                        <ThemedText variant="small">Choose a video to test persistence and segment playback.</ThemedText>
                    </View>
                ) : videos.map((video) => {
                    const selected = selectedVideoId === video.id
                    return (
                        <View key={video.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <ThemedText variant="subheader" numberOfLines={2} style={styles.videoName}>
                                Source reference
                            </ThemedText>
                            <ThemedText variant="small">Status: {video.status}</ThemedText>
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
                                    {segmentThumbnailReference ? <ExpoImage source={{ uri: segmentThumbnailReference }} style={styles.segmentThumbnailPreview} contentFit="cover" /> : null}
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
                                    title="Replace video"
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
    actionButton: {
        width: '100%',
    },
})
