import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { router } from 'expo-router'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import LocalSegmentPlayer from 'Components/LocalSegmentPlayer'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { useDeleteVideoUpload, useSyncVideoUpload, useVideoUploads } from 'lib/hooks/useVideoUploads'
import { useCreateVideoCategory, useCreateVideoSegment, useDeleteVideoSegment, useUpdateVideoSegment, useVideoCategories, useVideoSegments } from 'lib/hooks/useVideoSegments'
import type { LocalVideoStatus, LocalVideoUpload, VideoUploadRecord } from 'lib/models'

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
    const categoriesQuery = useVideoCategories()
    const createCategory = useCreateVideoCategory()
    const { mutateAsync: saveCloudSegment, isPending: isCreatingSegment } = useCreateVideoSegment()
    const updateSegment = useUpdateVideoSegment()
    const deleteSegment = useDeleteVideoSegment()
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
    const [newCategoryName, setNewCategoryName] = useState('')
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
                status: 'AVAILABLE',
                updatedAt: new Date().toISOString(),
            }
            try {
                await syncVideoUpload(video)
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
        const miscCategory = categoriesQuery.data?.find((category) => category.system_category && category.name.toLowerCase() === 'misc')
        setSelectedCategoryId(miscCategory?.id ?? categoriesQuery.data?.[0]?.id ?? null)
        setSelectedVideoId(video.id)
    }

    async function addCategory() {
        const name = newCategoryName.trim()
        if (!name) {
            showSnack('Enter a category name.')
            return
        }
        try {
            const category = await createCategory.mutateAsync(name)
            setSelectedCategoryId(category.id)
            setNewCategoryName('')
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
            })
            showSnack('Segment saved.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not save segment.')
        }
    }

    function editSegment(segment: { start_time: number; end_time: number; category_id: string }) {
        setRangeStart(String(segment.start_time))
        setRangeEnd(String(segment.end_time))
        setSelectedCategoryId(segment.category_id)
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
            })
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
                    Phase 1 test area. Videos stay on this device; only their local reference metadata is stored.
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
                                {video.fileName ?? 'Unnamed video'}
                            </ThemedText>
                            <ThemedText variant="small">Status: {video.status}</ThemedText>
                            <ThemedText variant="small">Asset ID: {video.assetId ?? 'Unavailable; URI fallback'}</ThemedText>
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
                                                {segment.start_time}s → {segment.end_time}s · {(categoriesQuery.data ?? []).find((category) => category.id === segment.category_id)?.name ?? 'Misc'} · synced
                                            </ThemedText>
                                            <View style={styles.segmentActions}>
                                                <ThemedButton title="Edit" variant="ghost" onPress={() => editSegment(segment)} style={styles.segmentActionButton} />
                                                <ThemedButton title="Update" onPress={() => void updateSelectedSegment(segment)} loading={updateSegment.isPending} style={styles.segmentActionButton} />
                                                <ThemedButton title="Delete" variant="warning" onPress={() => void removeSegment(segment)} loading={deleteSegment.isPending} style={styles.segmentActionButton} />
                                            </View>
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
