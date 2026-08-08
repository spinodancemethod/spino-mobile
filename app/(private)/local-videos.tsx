import React, { useCallback, useEffect, useState } from 'react'
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
import { deleteLocalSegment, listLocalSegments, LocalSegment, saveLocalSegment } from 'lib/localSegmentStore'
import { listLocalCategories, LocalCategory, saveLocalCategory } from 'lib/localCategoryStore'
import {
    deleteLocalVideoUpload,
    listLocalVideoUploads,
    LocalVideoStatus,
    LocalVideoUpload,
    saveLocalVideoUpload,
} from 'lib/localVideoStore'

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
    const { mutateAsync: syncCategory } = useCreateVideoCategory()
    const { mutateAsync: syncSegment, isPending: isCreatingSegment } = useCreateVideoSegment()
    const updateSegment = useUpdateVideoSegment()
    const deleteSegment = useDeleteVideoSegment()
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [localSegments, setLocalSegments] = useState<LocalSegment[]>([])
    const [localCategories, setLocalCategories] = useState<LocalCategory[]>([])
    const selectedCloudVideoId = cloudUploadsQuery.data?.find((item) => item.local_reference_key === selectedVideoId)?.id ?? null
    const segmentsQuery = useVideoSegments(selectedCloudVideoId)

    useEffect(() => {
        void listLocalCategories().then(async (categories) => {
            if (categories.length > 0) {
                setLocalCategories(categories)
                return
            }
            const misc: LocalCategory = {
                id: 'local-system-misc',
                cloudCategoryId: null,
                name: 'Misc',
                systemCategory: true,
                syncStatus: 'PENDING',
                updatedAt: new Date().toISOString(),
            }
            await saveLocalCategory(misc)
            setLocalCategories([misc])
        })
    }, [])

    useEffect(() => {
        if (!selectedVideoId) {
            setLocalSegments([])
            return
        }
        void listLocalSegments(selectedVideoId).then(setLocalSegments)
    }, [selectedVideoId])

    useEffect(() => {
        if (!categoriesQuery.data) return
        void (async () => {
            const storedCategories = await listLocalCategories()
            const nextCategories = [...storedCategories]
            const cloudMisc = categoriesQuery.data.find((category) => category.system_category && category.name.toLowerCase() === 'misc')
            let localMisc = nextCategories.find((category) => category.systemCategory && category.name.toLowerCase() === 'misc')
            if (!localMisc) {
                localMisc = {
                    id: 'local-system-misc',
                    cloudCategoryId: cloudMisc?.id ?? null,
                    name: 'Misc',
                    systemCategory: true,
                    syncStatus: cloudMisc ? 'SYNCED' : 'PENDING',
                    updatedAt: new Date().toISOString(),
                }
                nextCategories.push(localMisc)
            } else if (cloudMisc && localMisc.cloudCategoryId !== cloudMisc.id) {
                localMisc = { ...localMisc, cloudCategoryId: cloudMisc.id, syncStatus: 'SYNCED', updatedAt: new Date().toISOString() }
                const index = nextCategories.findIndex((category) => category.id === localMisc!.id)
                nextCategories[index] = localMisc
            }

            for (const cloudCategory of categoriesQuery.data) {
                if (cloudCategory.name.toLowerCase() === 'misc') continue
                const existing = nextCategories.find((category) => category.cloudCategoryId === cloudCategory.id || category.name.toLowerCase() === cloudCategory.name.toLowerCase())
                const category = existing
                    ? { ...existing, cloudCategoryId: cloudCategory.id, name: cloudCategory.name, syncStatus: 'SYNCED' as const, updatedAt: new Date().toISOString() }
                    : { id: `local-category-${cloudCategory.id}`, cloudCategoryId: cloudCategory.id, name: cloudCategory.name, systemCategory: cloudCategory.system_category, syncStatus: 'SYNCED' as const, updatedAt: new Date().toISOString() }
                const index = nextCategories.findIndex((item) => item.id === category.id)
                if (index >= 0) nextCategories[index] = category
                else nextCategories.push(category)
            }

            for (const category of nextCategories) {
                if (category.syncStatus !== 'PENDING' || category.systemCategory || category.name.toLowerCase() === 'misc') {
                    await saveLocalCategory(category)
                    continue
                }
                try {
                    const cloudCategory = await syncCategory(category.name)
                    const syncedCategory = { ...category, cloudCategoryId: cloudCategory.id, syncStatus: 'SYNCED' as const, updatedAt: new Date().toISOString() }
                    const index = nextCategories.findIndex((item) => item.id === category.id)
                    nextCategories[index] = syncedCategory
                    await saveLocalCategory(syncedCategory)
                } catch {
                    await saveLocalCategory(category)
                }
            }
            setLocalCategories(nextCategories)
        })()
    }, [categoriesQuery.data, syncCategory])

    useEffect(() => {
        if (!selectedCloudVideoId || localSegments.length === 0) return
        const pendingSegments = localSegments.filter((segment) => segment.syncStatus === 'PENDING' && segment.categoryId)
        if (pendingSegments.length === 0) return

        void Promise.all(pendingSegments.map(async (segment) => {
            try {
                const cloudSegment = await syncSegment({
                    videoUploadId: selectedCloudVideoId,
                    startTime: segment.startTime,
                    endTime: segment.endTime,
                    categoryId: segment.categoryId!,
                })
                const syncedSegment = { ...segment, cloudSegmentId: cloudSegment.id, syncStatus: 'SYNCED' as const, updatedAt: new Date().toISOString() }
                await saveLocalSegment(syncedSegment)
                setLocalSegments((currentSegments) => currentSegments.map((item) => item.id === segment.id ? syncedSegment : item))
            } catch {
                // Keep the segment local and retry when the screen is loaded again.
            }
        }))
    }, [localSegments, selectedCloudVideoId, syncSegment])

    const loadVideos = useCallback(async () => {
        const storedVideos = await listLocalVideoUploads()
        const refreshedVideos = await Promise.all(
            storedVideos.map(async (video) => {
                const status = await resolveStatus(video.uri)
                if (status !== video.status) {
                    const refreshed = { ...video, status, updatedAt: new Date().toISOString() }
                    await saveLocalVideoUpload(refreshed)
                    return refreshed
                }
                return video
            }),
        )
        setVideos(refreshedVideos)

        // Backfill local references created before Supabase migrations were applied.
        // Local playback remains available if the account or network is unavailable.
        await Promise.all(refreshedVideos.map(async (video) => {
            try {
                await syncVideoUpload(video)
            } catch {
                // The screen already exposes cloud sync status; do not block local use.
            }
        }))
        setLoading(false)
    }, [syncVideoUpload])

    useEffect(() => {
        void loadVideos()
    }, [loadVideos])

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
            const now = new Date().toISOString()
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
                updatedAt: now,
            }
            await saveLocalVideoUpload(video)
            try {
                await syncVideoUpload(video)
            } catch {
                // Local playback must continue even if cloud metadata sync is unavailable.
                showSnack('Saved on this device. Cloud metadata sync will need another attempt.')
            }
            await loadVideos()
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

        const updatedVideo = {
            ...video,
            rangeStart: start,
            rangeEnd: end,
            updatedAt: new Date().toISOString(),
        }
        await saveLocalVideoUpload(updatedVideo)
        try {
            await syncVideoUpload(updatedVideo)
        } catch {
            showSnack('Range saved on this device. Cloud sync will need another attempt.')
        }
        setVideos((currentVideos) => currentVideos.map((item) => item.id === video.id ? updatedVideo : item))
        showSnack('Timestamp range saved.')
    }

    function openPreview(video: LocalVideoUpload) {
        setRangeStart(String(video.rangeStart))
        setRangeEnd(String(video.rangeEnd))
        const miscCategory = localCategories.find((category) => category.systemCategory && category.name.toLowerCase() === 'misc')
        setSelectedCategoryId(miscCategory?.id ?? localCategories[0]?.id ?? null)
        setSelectedVideoId(video.id)
    }

    async function addCategory() {
        const name = newCategoryName.trim()
        if (!name) {
            showSnack('Enter a category name.')
            return
        }
        try {
            const localCategory: LocalCategory = {
                id: `local-category-${Date.now()}`,
                cloudCategoryId: null,
                name,
                systemCategory: false,
                syncStatus: 'PENDING',
                updatedAt: new Date().toISOString(),
            }
            await saveLocalCategory(localCategory)
            setLocalCategories((currentCategories) => [...currentCategories, localCategory])
            try {
                const category = await syncCategory(name)
                const syncedCategory = { ...localCategory, cloudCategoryId: category.id, syncStatus: 'SYNCED' as const, updatedAt: new Date().toISOString() }
                await saveLocalCategory(syncedCategory)
                setLocalCategories((currentCategories) => currentCategories.map((item) => item.id === localCategory.id ? syncedCategory : item))
                setSelectedCategoryId(syncedCategory.id)
            } catch {
                setSelectedCategoryId(localCategory.id)
            }
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
        const selectedCategory = localCategories.find((category) => category.id === selectedCategoryId)
        const categoryName = selectedCategory?.name ?? 'Misc'
        const localSegment: LocalSegment = {
            id: `local-segment-${video.id}-${Date.now()}`,
            videoUploadKey: video.id,
            startTime: start,
            endTime: end,
            categoryId: selectedCategoryId,
            categoryName,
            cloudSegmentId: null,
            syncStatus: 'PENDING',
            updatedAt: new Date().toISOString(),
        }
        await saveLocalSegment(localSegment)
        setLocalSegments((currentSegments) => [...currentSegments, localSegment].sort((a, b) => a.startTime - b.startTime))
        try {
            if (!selectedCategory?.cloudCategoryId) {
                showSnack('Saved locally. Category will sync before the segment.')
                return
            }
            const cloudSegment = await syncSegment({
                videoUploadId: cloudVideo.id,
                startTime: start,
                endTime: end,
                categoryId: selectedCategory.cloudCategoryId,
            })
            const syncedSegment = { ...localSegment, cloudSegmentId: cloudSegment.id, syncStatus: 'SYNCED' as const, updatedAt: new Date().toISOString() }
            await saveLocalSegment(syncedSegment)
            setLocalSegments((currentSegments) => currentSegments.map((item) => item.id === localSegment.id ? syncedSegment : item))
            showSnack('Segment saved.')
        } catch (error) {
            showSnack('Saved locally. Cloud sync will retry later.')
        }
    }

    function editSegment(segment: { start_time: number; end_time: number; category_id: string }) {
        setRangeStart(String(segment.start_time))
        setRangeEnd(String(segment.end_time))
        setSelectedCategoryId(segment.category_id)
    }

    async function removeSegment(segment: { id: string; video_upload_id: string }) {
        try {
            const localSegment = localSegments.find((item) => item.cloudSegmentId === segment.id)
            if (localSegment) {
                await deleteLocalSegment(localSegment.id)
                setLocalSegments((currentSegments) => currentSegments.filter((item) => item.id !== localSegment.id))
            }
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
        const selectedCategory = localCategories.find((category) => category.id === selectedCategoryId)
        if (!selectedCategory?.cloudCategoryId) {
            showSnack('Category saved locally. It must sync before this segment can update in Supabase.')
            return
        }
        try {
            const updatedAt = new Date().toISOString()
            await updateSegment.mutateAsync({
                id: segment.id,
                videoUploadId: segment.video_upload_id,
                startTime: start,
                endTime: end,
                categoryId: selectedCategory.cloudCategoryId,
            })
            const localSegment = localSegments.find((item) => item.cloudSegmentId === segment.id)
            if (localSegment) {
                const updatedLocalSegment = { ...localSegment, startTime: start, endTime: end, categoryId: selectedCategory.id, categoryName: selectedCategory.name, syncStatus: 'SYNCED' as const, updatedAt }
                await saveLocalSegment(updatedLocalSegment)
                setLocalSegments((currentSegments) => currentSegments.map((item) => item.id === localSegment.id ? updatedLocalSegment : item))
            }
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
                        await deleteLocalVideoUpload(video.id)
                        if (selectedVideoId === video.id) setSelectedVideoId(null)
                        await loadVideos()
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
                                        {localCategories.map((category) => (
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
                                    {segmentsQuery.isError && localSegments.length === 0 ? (
                                        <ThemedText variant="small">Apply the segments migration to load saved segments.</ThemedText>
                                    ) : localSegments.map((segment) => (
                                        <View key={segment.id} style={styles.savedSegment}>
                                            <ThemedText variant="small">
                                                {segment.startTime}s → {segment.endTime}s · {segment.categoryName} · {segment.syncStatus === 'SYNCED' ? 'synced' : 'local'}
                                            </ThemedText>
                                            <View style={styles.segmentActions}>
                                                <ThemedButton title="Edit" variant="ghost" onPress={() => editSegment({ start_time: segment.startTime, end_time: segment.endTime, category_id: segment.categoryId ?? '' })} style={styles.segmentActionButton} />
                                                {segment.cloudSegmentId ? <ThemedButton title="Update" onPress={() => void updateSelectedSegment({ id: segment.cloudSegmentId!, video_upload_id: selectedCloudVideoId! })} loading={updateSegment.isPending} style={styles.segmentActionButton} /> : null}
                                                <ThemedButton title="Delete" variant="warning" onPress={() => void (segment.cloudSegmentId ? removeSegment({ id: segment.cloudSegmentId, video_upload_id: selectedCloudVideoId! }) : deleteLocalSegment(segment.id).then(() => setLocalSegments((items) => items.filter((item) => item.id !== segment.id))))} loading={deleteSegment.isPending} style={styles.segmentActionButton} />
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
