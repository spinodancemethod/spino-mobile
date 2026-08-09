import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { Image as ExpoImage } from 'expo-image'
import { router } from 'expo-router'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import LocalSegmentPlayer from 'Components/LocalSegmentPlayer'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { useDeleteVideoUpload, useSyncVideoUpload, useVideoUploads } from 'lib/hooks/useVideoUploads'
import { useCreateVideoCategory, useCreateVideoSegment, useDeleteVideoSegment, useUpdateVideoSegment, useVideoCategories, useVideoSegments } from 'lib/hooks/useVideoSegments'
import { useUserRoadmaps } from 'lib/hooks/useUserRoadmaps'
import type { LocalVideoStatus, LocalVideoUpload, SegmentRecord, VideoUploadRecord } from 'lib/models'

function cloudRecordToLocal(record: VideoUploadRecord, runtimeUri?: string): LocalVideoUpload {
    return {
        id: record.local_reference_key,
        assetId: record.media_identifier ?? null,
        uri: runtimeUri ?? record.fallback_uri ?? '',
        fileName: record.filename ?? record.name ?? null,
        mimeType: record.mime_type ?? null,
        duration: record.duration_seconds ?? null,
        fileSize: record.file_size_bytes ?? null,
        width: record.width ?? null,
        height: record.height ?? null,
        creationTime: record.creation_time ? new Date(record.creation_time).getTime() : null,
        rangeStart: 0,
        rangeEnd: Math.min(record.duration_seconds ?? 10, 10),
        thumbnailReference: record.thumbnail_reference ?? null,
        status: record.status,
        updatedAt: record.updated_at,
    }
}

async function resolveStatus(uri: string): Promise<LocalVideoStatus> {
    try {
        const info = await FileSystem.getInfoAsync(uri)
        return info.exists ? 'AVAILABLE' : 'MISSING'
    } catch {
        return 'UNKNOWN'
    }
}

function formatBytes(size: number | null) {
    if (!size) return 'Unknown size'
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(duration: number | null) {
    if (duration == null) return 'Unknown duration'
    return `${Math.round(duration)} seconds`
}

export default function LocalVideosScreen() {
    const { colors } = useTheme()
    const [videos, setVideos] = useState<LocalVideoUpload[]>([])
    const [loading, setLoading] = useState(true)
    const [picking, setPicking] = useState(false)
    const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
    const [rangeStart, setRangeStart] = useState('0')
    const [rangeEnd, setRangeEnd] = useState('10')
    const { mutateAsync: syncVideoUpload } = useSyncVideoUpload()
    const { mutateAsync: deleteCloudVideoUpload } = useDeleteVideoUpload()
    const cloudUploadsQuery = useVideoUploads()
    const roadmapsQuery = useUserRoadmaps()
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
    const [segmentThumbnailTime, setSegmentThumbnailTime] = useState('0')
    const [segmentThumbnailReference, setSegmentThumbnailReference] = useState<string | null>(null)
    const [segmentThumbnailLoading, setSegmentThumbnailLoading] = useState(false)
    const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
    const [runtimeUris, setRuntimeUris] = useState<Record<string, string>>({})
    const selectedCloudVideoId = selectedVideoId
        ? cloudUploadsQuery.data?.find((item) => item.local_reference_key === selectedVideoId)?.id ?? null
        : null
    const segmentsQuery = useVideoSegments(selectedCloudVideoId)
    useEffect(() => {
        if (!cloudUploadsQuery.data) return
        setVideos(cloudUploadsQuery.data.map((record) => cloudRecordToLocal(record, runtimeUris[record.local_reference_key])))
        setLoading(false)
    }, [cloudUploadsQuery.data, runtimeUris])

    async function pickVideo(replacementFor?: LocalVideoUpload) {
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
            const video: LocalVideoUpload = {
                id: replacementFor?.id ?? `${asset.assetId ?? asset.uri}-${Date.now()}`,
                assetId: asset.assetId ?? null,
                uri: asset.uri,
                fileName: asset.fileName ?? asset.uri.split('/').pop() ?? null,
                mimeType: asset.mimeType ?? 'video/*',
                duration: asset.duration ?? null,
                fileSize: asset.fileSize ?? null,
                width: asset.width ?? null,
                height: asset.height ?? null,
                creationTime: null,
                rangeStart: replacementFor?.rangeStart ?? 0,
                rangeEnd: replacementFor?.rangeEnd ?? Math.min(asset.duration ?? 10, 10),
                thumbnailReference: replacementFor?.thumbnailReference ?? null,
                status: 'AVAILABLE',
                updatedAt: new Date().toISOString(),
            }
            try {
                const roadmapId = replacementFor?.id
                    ? cloudUploadsQuery.data?.find((item) => item.local_reference_key === replacementFor.id)?.roadmap_id
                    : roadmapsQuery.data?.[0]?.id
                if (!roadmapId) throw new Error('Create a roadmap before adding a video reference.')
                await syncVideoUpload({ ...video, roadmapId })
                setRuntimeUris((currentUris) => ({ ...currentUris, [video.id]: video.uri }))
            } catch {
                showSnack('Could not save the video reference to Supabase.')
                return
            }
            setSelectedVideoId(video.id)
            showSnack(replacementFor ? 'Replacement video saved. Review its segments.' : 'Local video reference saved.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not choose that video.')
        } finally {
            setPicking(false)
        }
    }

    async function saveRange(video: LocalVideoUpload) {
        const start = Number(rangeStart)
        const end = Number(rangeEnd)
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= end) {
            showSnack('Enter a valid range where start is less than end.')
            return
        }

        setRangeStart(String(start))
        setRangeEnd(String(end))
        showSnack('Timestamp range ready to save as a segment.')
    }

    function openPreview(video: LocalVideoUpload) {
        setRangeStart(String(video.rangeStart))
        setRangeEnd(String(video.rangeEnd))
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
        setRangeStart(String(segment.start_time))
        setRangeEnd(String(segment.end_time))
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

    function confirmRemove(video: LocalVideoUpload) {
        Alert.alert('Remove video reference?', 'This removes the local and cloud reference. Saved segments will also be deleted. The original video remains on your device.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                    void (async () => {
                        const cloudVideo = cloudUploadsQuery.data?.find((item) => item.local_reference_key === video.id)
                        try {
                            if (cloudVideo) {
                                await deleteCloudVideoUpload(cloudVideo.id)
                            }
                        } catch (error) {
                            showSnack(error instanceof Error ? error.message : 'Could not remove the cloud reference.')
                            return
                        }
                        if (selectedVideoId === video.id) setSelectedVideoId(null)
                        setRuntimeUris((currentUris) => {
                            const nextUris = { ...currentUris }
                            delete nextUris[video.id]
                            return nextUris
                        })
                    })()
                },
            },
        ])
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
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
                            <ThemedText variant="small">Source ID: {video.assetId ?? video.id}</ThemedText>
                            <ThemedText variant="small">File: {video.fileName ?? 'Unknown file name'}</ThemedText>
                            <ThemedText variant="small">Duration: {formatDuration(video.duration)} · Size: {formatBytes(video.fileSize)}</ThemedText>

                            {video.status === 'AVAILABLE' && selected ? (
                                <View style={styles.playerBlock}>
                                    <ThemedText variant="small" style={styles.rangeLabel}>Preview timestamp range (seconds)</ThemedText>
                                    <View style={styles.rangeInputs}>
                                        <TextInput
                                            value={rangeStart}
                                            onChangeText={(value) => setRangeStart(value.replace(/[^0-9.]/g, ''))}
                                            keyboardType="decimal-pad"
                                            placeholder="Start"
                                            placeholderTextColor={colors.border}
                                            style={[styles.rangeInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                                        />
                                        <ThemedText variant="small">to</ThemedText>
                                        <TextInput
                                            value={rangeEnd}
                                            onChangeText={(value) => setRangeEnd(value.replace(/[^0-9.]/g, ''))}
                                            keyboardType="decimal-pad"
                                            placeholder="End"
                                            placeholderTextColor={colors.border}
                                            style={[styles.rangeInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
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
                                        <TextInput
                                            value={newCategoryName}
                                            onChangeText={setNewCategoryName}
                                            placeholder="New category"
                                            placeholderTextColor={colors.border}
                                            style={[styles.rangeInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                                        />
                                        <ThemedButton title="Add" onPress={() => void addCategory()} style={styles.addCategoryButton} />
                                    </View>
                                    <TextInput
                                        value={newCategoryDescription}
                                        onChangeText={setNewCategoryDescription}
                                        placeholder="Optional category description"
                                        placeholderTextColor={colors.border}
                                        multiline
                                        style={[styles.rangeInput, styles.multilineInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                                    />
                                    <ThemedText variant="small" style={styles.rangeLabel}>Learning item title</ThemedText>
                                    <TextInput
                                        value={segmentTitle}
                                        onChangeText={setSegmentTitle}
                                        placeholder="Optional custom segment title"
                                        placeholderTextColor={colors.border}
                                        style={[styles.rangeInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                                    />
                                    <ThemedText variant="small" style={styles.rangeLabel}>Segment thumbnail</ThemedText>
                                    <View style={styles.rangeInputs}>
                                        <TextInput
                                            value={segmentThumbnailTime}
                                            onChangeText={(value) => setSegmentThumbnailTime(value.replace(/[^0-9.]/g, ''))}
                                            keyboardType="decimal-pad"
                                            placeholder="Frame time"
                                            placeholderTextColor={colors.border}
                                            style={[styles.rangeInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
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
        aspectRatio: 16 / 9,
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
