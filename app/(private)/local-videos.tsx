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
import { useSyncVideoUpload, useVideoUploads } from 'lib/hooks/useVideoUploads'
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
    const syncVideoUpload = useSyncVideoUpload()
    const cloudUploadsQuery = useVideoUploads()

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
        setLoading(false)
    }, [])

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
                await syncVideoUpload.mutateAsync(video)
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
            await syncVideoUpload.mutateAsync(updatedVideo)
        } catch {
            showSnack('Range saved on this device. Cloud sync will need another attempt.')
        }
        setVideos((currentVideos) => currentVideos.map((item) => item.id === video.id ? updatedVideo : item))
        showSnack('Timestamp range saved.')
    }

    function openPreview(video: LocalVideoUpload) {
        setRangeStart(String(video.rangeStart))
        setRangeEnd(String(video.rangeEnd))
        setSelectedVideoId(video.id)
    }

    function confirmRemove(video: LocalVideoUpload) {
        Alert.alert('Remove video reference?', 'This removes only the saved reference. The video remains on your device.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                    void (async () => {
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
