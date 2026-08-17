import { useMemo, useState } from 'react'
import { Alert } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { useDeleteVideoUpload, useSyncVideoUpload, useVideoUploads } from './useVideoUploads'
import { useUserRoadmaps } from './useUserRoadmaps'
import { showSnack } from 'lib/snackbarService'
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
        rangeEnd: record.duration_seconds ?? 10,
        thumbnailReference: record.thumbnail_reference ?? null,
        status: record.status,
        updatedAt: record.updated_at,
    }
}

export function useLocalVideoLibrary() {
    const [picking, setPicking] = useState(false)
    const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
    const [runtimeUris, setRuntimeUris] = useState<Record<string, string>>({})
    const cloudUploadsQuery = useVideoUploads()
    const roadmapsQuery = useUserRoadmaps()
    const { mutateAsync: syncVideoUpload } = useSyncVideoUpload()
    const { mutateAsync: deleteCloudVideoUpload } = useDeleteVideoUpload()
    const videos = useMemo(
        () => (cloudUploadsQuery.data ?? []).map((record) => cloudRecordToLocal(record, runtimeUris[record.local_reference_key])),
        [cloudUploadsQuery.data, runtimeUris]
    )

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
            const durationSeconds = asset.duration == null ? null : asset.duration / 1000
            const video: LocalVideoUpload = {
                id: replacementFor?.id ?? `${asset.assetId ?? asset.uri}-${Date.now()}`,
                assetId: asset.assetId ?? null,
                uri: asset.uri,
                fileName: asset.fileName ?? asset.uri.split('/').pop() ?? null,
                mimeType: asset.mimeType ?? 'video/*',
                duration: durationSeconds,
                fileSize: asset.fileSize ?? null,
                width: asset.width ?? null,
                height: asset.height ?? null,
                creationTime: null,
                rangeStart: replacementFor?.rangeStart ?? 0,
                rangeEnd: replacementFor?.rangeEnd ?? durationSeconds ?? 10,
                thumbnailReference: replacementFor?.thumbnailReference ?? null,
                status: 'AVAILABLE',
                updatedAt: new Date().toISOString(),
            }
            const roadmapId = replacementFor?.id
                ? cloudUploadsQuery.data?.find((item) => item.local_reference_key === replacementFor.id)?.roadmap_id
                : roadmapsQuery.data?.[0]?.id
            if (!roadmapId) throw new Error('Create a roadmap before adding a video reference.')
            await syncVideoUpload({ ...video, roadmapId })
            setRuntimeUris((currentUris) => ({ ...currentUris, [video.id]: video.uri }))
            setSelectedVideoId(video.id)
            showSnack(replacementFor ? 'Replacement video saved. Review its segments.' : 'Local video reference saved.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not choose that video.')
        } finally {
            setPicking(false)
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
                            if (cloudVideo) await deleteCloudVideoUpload(cloudVideo.id)
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

    return {
        videos,
        cloudUploadsQuery,
        roadmapsQuery,
        selectedVideoId,
        setSelectedVideoId,
        picking,
        pickVideo,
        confirmRemove,
        loading: cloudUploadsQuery.isLoading,
    }
}

export async function resolveLocalVideoStatus(uri: string): Promise<LocalVideoStatus> {
    try {
        const info = await FileSystem.getInfoAsync(uri)
        return info.exists ? 'AVAILABLE' : 'MISSING'
    } catch {
        return 'UNKNOWN'
    }
}
