import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { Image as ExpoImage } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { useDeleteVideoUpload, useSyncVideoUpload } from 'lib/hooks/useVideoUploads'
import { useUserRoadmaps } from 'lib/hooks/useUserRoadmaps'
import { useCreateVideoCategory, useCreateVideoSegment, useVideoCategories } from 'lib/hooks/useVideoSegments'
import type { LocalVideoUpload } from 'lib/models'
import { useLocalSearchParams } from 'expo-router'

function formatDuration(duration: number | null) {
    if (duration == null) return 'Unknown duration'
    return `${Math.round(duration)} seconds`
}

export default function AddVideoScreen() {
    const { colors } = useTheme()
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
    const [thumbnailTime, setThumbnailTime] = useState('0')
    const [thumbnailLoading, setThumbnailLoading] = useState(false)
    const [picking, setPicking] = useState(false)
    const [segmentStart, setSegmentStart] = useState('0')
    const [segmentEnd, setSegmentEnd] = useState('10')
    const [categoryId, setCategoryId] = useState('')
    const [segmentTitle, setSegmentTitle] = useState('')
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryDescription, setNewCategoryDescription] = useState('')

    useEffect(() => {
        if (params.roadmapId) setRoadmapId(params.roadmapId)
        else if (!roadmapId && roadmapsQuery.data?.[0]) setRoadmapId(roadmapsQuery.data[0].id)
    }, [params.roadmapId, roadmapId, roadmapsQuery.data])

    useEffect(() => {
        if (params.categoryId) {
            setCategoryId(params.categoryId)
            return
        }
        if (!categoryId && categoriesQuery.data?.length) {
            const miscCategory = categoriesQuery.data.find((category) => category.system_category && category.name.toLowerCase() === 'misc')
            setCategoryId(miscCategory?.id ?? categoriesQuery.data[0].id)
        }
    }, [params.categoryId, categoryId, categoriesQuery.data])

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
            const nextVideo: LocalVideoUpload = {
                id: `${asset.assetId ?? asset.uri}-${Date.now()}`,
                assetId: asset.assetId ?? null,
                uri: asset.uri,
                fileName: asset.fileName ?? asset.uri.split('/').pop() ?? null,
                mimeType: asset.mimeType ?? 'video/*',
                duration: asset.duration ?? null,
                fileSize: asset.fileSize ?? null,
                width: asset.width ?? null,
                height: asset.height ?? null,
                creationTime: null,
                rangeStart: 0,
                rangeEnd: Math.min(asset.duration ?? 10, 10),
                thumbnailReference: null,
                status: 'AVAILABLE',
                updatedAt: new Date().toISOString(),
            }
            setSelectedVideo(nextVideo)
            setSegmentStart('0')
            setSegmentEnd(String(Math.min(asset.duration ?? 10, 10)))
            setSegmentTitle('')
            if (!params.categoryId) {
                setCategoryId(categoriesQuery.data?.find((category) => category.system_category && category.name.toLowerCase() === 'misc')?.id ?? '')
            }
            await generateThumbnail(nextVideo)
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not choose that video.')
        } finally {
            setPicking(false)
        }
    }

    async function generateThumbnail(video = selectedVideo) {
        if (!video) return
        const seconds = Number(thumbnailTime)
        const maxSeconds = video.duration == null ? seconds : Math.max(0, Math.min(seconds, video.duration))
        if (!Number.isFinite(maxSeconds) || maxSeconds < 0) {
            showSnack('Enter a valid thumbnail timestamp.')
            return
        }

        setThumbnailLoading(true)
        try {
            const result = await VideoThumbnails.getThumbnailAsync(video.uri, { time: Math.round(maxSeconds * 1000) })
            setSelectedVideo({ ...video, thumbnailReference: result.uri })
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not generate a thumbnail from this video.')
        } finally {
            setThumbnailLoading(false)
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
        const start = Number(segmentStart)
        const end = Number(segmentEnd)
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= end) {
            showSnack('Enter a valid segment range where start is less than end.')
            return
        }
        if (!categoryId) {
            showSnack('Choose a category for this segment.')
            return
        }
        if (!selectedVideo.thumbnailReference) {
            showSnack('Choose a thumbnail frame for this segment.')
            return
        }

        let savedUploadId: string | null = null
        try {
            const savedUpload = await syncVideoUpload.mutateAsync({
                ...selectedVideo,
                roadmapId,
            })
            savedUploadId = savedUpload.id
            await createSegment.mutateAsync({
                videoUploadId: savedUpload.id,
                startTime: start,
                endTime: end,
                categoryId,
                title: segmentTitle,
                thumbnailReference: selectedVideo.thumbnailReference,
            })
            showSnack('Video segment added.')
            setSelectedVideo(null)
            setSegmentTitle('')
        } catch (error) {
            if (savedUploadId) {
                await deleteVideoUpload.mutateAsync(savedUploadId).catch(() => undefined)
            }
            showSnack(error instanceof Error ? error.message : 'Could not save the video reference.')
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
            setCategoryId(category.id)
            setNewCategoryName('')
            setNewCategoryDescription('')
            showSnack('Category created.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not create category.')
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

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
                    Add a segment from a video already on your device. The video is only a source reference and is not uploaded.
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

                    <ThemedButton
                        title={picking ? 'Opening media library...' : selectedVideo ? 'Choose a different video' : 'Choose local video'}
                        onPress={() => void chooseVideo()}
                        loading={picking}
                        style={styles.fullButton}
                    />

                    {selectedVideo ? (
                        <View style={[styles.selectedVideo, { borderColor: colors.border }]}>
                            <ThemedText variant="subheader" numberOfLines={2}>Source video selected</ThemedText>
                            <ThemedText variant="small">Duration: {formatDuration(selectedVideo.duration)}</ThemedText>
                            <ThemedText variant="small">Source ID: {selectedVideo.assetId ?? selectedVideo.id}</ThemedText>
                            <ThemedText variant="small">File: {selectedVideo.fileName ?? 'Unknown file name'}</ThemedText>
                            <ThemedText variant="small" style={styles.label}>Segment range (seconds)</ThemedText>
                            <View style={styles.thumbnailControls}>
                                <TextInput value={segmentStart} onChangeText={(value) => setSegmentStart(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" style={[styles.thumbnailInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]} />
                                <ThemedText variant="small">to</ThemedText>
                                <TextInput value={segmentEnd} onChangeText={(value) => setSegmentEnd(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" style={[styles.thumbnailInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]} />
                            </View>
                            <ThemedText variant="small" style={styles.label}>Segment title</ThemedText>
                            <TextInput
                                value={segmentTitle}
                                onChangeText={setSegmentTitle}
                                placeholder="Optional learning item title"
                                placeholderTextColor={colors.placeholder}
                                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                            />
                            <ThemedText variant="small" style={styles.label}>Segment category</ThemedText>
                            <View style={styles.styleList}>
                                {(categoriesQuery.data ?? []).map((category) => (
                                    <ThemedButton key={category.id} title={category.name} variant={categoryId === category.id ? 'primary' : 'ghost'} onPress={() => setCategoryId(category.id)} style={styles.styleButton} />
                                ))}
                            </View>
                            <View style={styles.thumbnailControls}>
                                <TextInput
                                    value={newCategoryName}
                                    onChangeText={setNewCategoryName}
                                    placeholder="Add category"
                                    placeholderTextColor={colors.placeholder}
                                    style={[styles.thumbnailInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                                />
                                <ThemedButton
                                    title={createCategory.isPending ? 'Adding...' : 'Add'}
                                    onPress={() => void addCategory()}
                                    loading={createCategory.isPending}
                                    style={styles.thumbnailButton}
                                />
                            </View>
                            <TextInput
                                value={newCategoryDescription}
                                onChangeText={setNewCategoryDescription}
                                placeholder="Optional category description"
                                placeholderTextColor={colors.placeholder}
                                multiline
                                style={[styles.input, styles.multilineInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                            />
                            <ThemedText variant="small" style={styles.label}>Choose thumbnail frame</ThemedText>
                            <ThemedText variant="small">Enter the video time in seconds, then choose the frame to show on your roadmap tile.</ThemedText>
                            <View style={styles.thumbnailControls}>
                                <TextInput
                                    value={thumbnailTime}
                                    onChangeText={(value) => setThumbnailTime(value.replace(/[^0-9.]/g, ''))}
                                    keyboardType="decimal-pad"
                                    style={[styles.thumbnailInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                                />
                                <ThemedButton title={thumbnailLoading ? 'Generating...' : 'Choose frame'} onPress={() => void generateThumbnail()} loading={thumbnailLoading} style={styles.thumbnailButton} />
                            </View>
                            {selectedVideo.thumbnailReference ? <ExpoImage source={{ uri: selectedVideo.thumbnailReference }} style={styles.thumbnailPreview} contentFit="cover" /> : null}
                        </View>
                    ) : <ThemedText variant="small" style={styles.thumbnailPrompt}>Select a video above to choose a thumbnail frame from it.</ThemedText>}

                    <ThemedButton
                        title={syncVideoUpload.isPending || createSegment.isPending ? 'Saving segment...' : 'Add video segment'}
                        onPress={() => void saveVideoReference()}
                        loading={syncVideoUpload.isPending}
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
    styleList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    styleButton: {
        minWidth: 88,
        borderWidth: 1,
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
    fullButton: {
        width: '100%',
        marginTop: 6,
    },
    selectedVideo: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        gap: 4,
    },
    thumbnailControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    thumbnailInput: {
        borderWidth: 1,
        borderRadius: 6,
        minHeight: 40,
        flex: 1,
        paddingHorizontal: 10,
    },
    thumbnailButton: {
        minWidth: 110,
    },
    thumbnailPreview: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 6,
        backgroundColor: '#000',
        marginTop: 6,
    },
    thumbnailPrompt: {
        marginTop: 4,
    },
})
