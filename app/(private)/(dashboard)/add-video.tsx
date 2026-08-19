import React, { useEffect, useState } from 'react'
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
import { showSnack } from 'lib/snackbarService'
import { useDeleteVideoUpload, useSyncVideoUpload } from 'lib/hooks/useVideoUploads'
import { useUserRoadmaps } from 'lib/hooks/useUserRoadmaps'
import { useCreateVideoCategory, useVideoCategories } from 'lib/hooks/useVideoCategories'
import { useCreateVideoSegment } from 'lib/hooks/useSegments'
import type { LocalVideoUpload } from 'lib/models'
import { calculateVideoContentHash } from 'lib/videoHash'
import { useLocalSearchParams } from 'expo-router'

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
    const [picking, setPicking] = useState(false)
    const [segmentDrafts, setSegmentDrafts] = useState<SegmentDraft[]>([])
    const [activeSegmentIndex, setActiveSegmentIndex] = useState(0)
    const [categoryModalOpen, setCategoryModalOpen] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryDescription, setNewCategoryDescription] = useState('')

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
            const miscCategoryId = categoriesQuery.data?.find((category) => category.system_category && category.name.toLowerCase() === 'misc')?.id ?? ''
            const initialDraft = createSegmentDraft(durationSeconds, params.categoryId ?? miscCategoryId)
            setSegmentDrafts([initialDraft])
            setActiveSegmentIndex(0)
            await generateSegmentThumbnail(nextVideo, initialDraft.id, initialDraft.start)
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not choose that video.')
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
            showSnack(error instanceof Error ? error.message : 'Could not generate a thumbnail from this video.')
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
            updateSegmentDraft(segmentDrafts[activeSegmentIndex]?.id ?? '', { categoryId: category.id })
            setNewCategoryName('')
            setNewCategoryDescription('')
            setCategoryModalOpen(false)
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
                        <View style={[styles.selectedVideo, { borderColor: colors.border }]}>
                            <ThemedText variant="subheader" numberOfLines={2}>Source video selected</ThemedText>
                            <View style={[styles.segmentSummary, { borderColor: colors.border, backgroundColor: colors.background }]}>
                                <View style={styles.segmentNavigationHeader}>
                                    <ThemedText variant="small">Segments</ThemedText>
                                    <View style={styles.segmentNavigationActions}>
                                        <Pressable
                                            onPress={() => setActiveSegmentIndex((index) => Math.max(0, index - 1))}
                                            disabled={activeSegmentIndex === 0}
                                            accessibilityRole="button"
                                            accessibilityLabel="Previous segment"
                                            style={styles.segmentArrowButton}
                                        >
                                            <Ionicons name="chevron-back" size={20} color={activeSegmentIndex === 0 ? colors.border : colors.text} />
                                        </Pressable>
                                        <ThemedText variant="small">{segmentDrafts.length ? `${activeSegmentIndex + 1} of ${segmentDrafts.length}` : '0 segments'}</ThemedText>
                                        <Pressable
                                            onPress={() => setActiveSegmentIndex((index) => Math.min(segmentDrafts.length - 1, index + 1))}
                                            disabled={activeSegmentIndex >= segmentDrafts.length - 1}
                                            accessibilityRole="button"
                                            accessibilityLabel="Next segment"
                                            style={styles.segmentArrowButton}
                                        >
                                            <Ionicons name="chevron-forward" size={20} color={activeSegmentIndex >= segmentDrafts.length - 1 ? colors.border : colors.text} />
                                        </Pressable>
                                    </View>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentTabs}>
                                    {segmentDrafts.map((draft, index) => (
                                        <Pressable
                                            key={draft.id}
                                            onPress={() => setActiveSegmentIndex(index)}
                                            accessibilityRole="tab"
                                            accessibilityState={{ selected: index === activeSegmentIndex }}
                                            style={[styles.segmentTab, { borderColor: index === activeSegmentIndex ? colors.primary : colors.border, backgroundColor: index === activeSegmentIndex ? colors.card : colors.background }]}
                                        >
                                            <ThemedText variant="small">{index + 1}</ThemedText>
                                            <ThemedText variant="small">{draft.start}s - {draft.end}s</ThemedText>
                                        </Pressable>
                                    ))}
                                    <Pressable onPress={addSegmentDraft} accessibilityRole="button" accessibilityLabel="Add another segment" style={[styles.addSegmentTab, { borderColor: colors.primary }]}>
                                        <Ionicons name="add" size={18} color={colors.primary} />
                                    </Pressable>
                                </ScrollView>
                            </View>
                            {activeDraft ? (
                                <View
                                    style={[styles.segmentDraftCard, { borderColor: colors.border }]}
                                >
                                    <View style={styles.segmentHeader}>
                                        <ThemedText variant="subheader">Segment {activeSegmentIndex + 1} details</ThemedText>
                                        {segmentDrafts.length > 1 ? (
                                            <Pressable onPress={() => removeSegmentDraft(activeDraft.id)} accessibilityRole="button" accessibilityLabel={`Remove segment ${activeSegmentIndex + 1}`}>
                                                <Ionicons name="trash-outline" size={20} color={colors.warning} />
                                            </Pressable>
                                        ) : null}
                                    </View>
                                    <ThemedText variant="small" style={styles.label}>Range (seconds)</ThemedText>
                                    <View style={styles.thumbnailControls}>
                                        <ThemedInput value={activeDraft.start} onChangeText={(value) => updateSegmentDraft(activeDraft.id, { start: value.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" style={styles.thumbnailInput} />
                                        <ThemedText variant="small">to</ThemedText>
                                        <ThemedInput value={activeDraft.end} onChangeText={(value) => updateSegmentDraft(activeDraft.id, { end: value.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" style={styles.thumbnailInput} />
                                    </View>
                                    {activeDraftHasRange ? (
                                        <LocalSegmentPlayer
                                            source={selectedVideo.uri}
                                            startTime={activeDraftStart}
                                            endTime={activeDraftEnd}
                                            editableRange
                                            enableFullscreen={false}
                                            onRangeChange={(nextStart, nextEnd) => updateSegmentDraft(activeDraft.id, { start: formatTimestamp(nextStart), end: formatTimestamp(nextEnd) })}
                                        />
                                    ) : null}
                                    <ThemedText variant="small" style={styles.label}>Display Title</ThemedText>
                                    <ThemedInput value={activeDraft.title} onChangeText={(value) => updateSegmentDraft(activeDraft.id, { title: value })} placeholder="Optional display title" style={styles.input} />
                                    <ThemedText variant="small" style={styles.label}>Description</ThemedText>
                                    <ThemedInput value={activeDraft.description} onChangeText={(value) => updateSegmentDraft(activeDraft.id, { description: value })} placeholder="Optional description" multiline style={[styles.input, styles.multilineInput]} />
                                    <View style={styles.sectionHeader}>
                                        <ThemedText variant="small" style={styles.label}>Category</ThemedText>
                                        <Pressable
                                            onPress={() => setCategoryModalOpen(true)}
                                            accessibilityRole="button"
                                            accessibilityLabel="Create a new category"
                                            style={[styles.inlineAction, { borderColor: colors.primary }]}
                                        >
                                            <Ionicons name="add" size={16} color={colors.primary} />
                                            <ThemedText variant="small" style={{ color: colors.primary }}>New category</ThemedText>
                                        </Pressable>
                                    </View>
                                    <View style={styles.styleList}>
                                        {(categoriesQuery.data ?? []).map((category) => (
                                            <ThemedButton key={category.id} title={category.name} variant={activeDraft.categoryId === category.id ? 'primary' : 'ghost'} onPress={() => updateSegmentDraft(activeDraft.id, { categoryId: category.id })} style={styles.styleButton} />
                                        ))}
                                    </View>
                                    <View
                                        style={[styles.thumbnailSection, { borderColor: colors.border }]}
                                    >
                                        <ThemedText variant="small" style={styles.label}>Thumbnail (optional)</ThemedText>
                                        <ThemedText variant="small">Select a snapshot from the segment to remind you of this move.</ThemedText>
                                        <View style={styles.thumbnailControls}>
                                            <ThemedInput value={activeDraft.thumbnailTime} onChangeText={(value) => updateSegmentDraft(activeDraft.id, { thumbnailTime: value.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" placeholder="Frame time" style={styles.thumbnailInput} />
                                            <ThemedButton title={activeDraft.thumbnailLoading ? 'Generating...' : 'Choose frame'} onPress={() => void generateSegmentThumbnail(selectedVideo, activeDraft.id)} loading={activeDraft.thumbnailLoading} style={styles.thumbnailButton} />
                                        </View>
                                        {activeDraft.thumbnailReference ? <ExpoImage source={{ uri: activeDraft.thumbnailReference }} style={styles.thumbnailPreview} contentFit="cover" /> : null}
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
    selectedVideo: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        gap: 4,
    },
    segmentDraftCard: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        gap: 6,
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
    inlineAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 5,
    },
    thumbnailSection: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        gap: 6,
        marginTop: 8,
    },
    segmentSummary: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 8,
        gap: 8,
    },
    segmentNavigationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    segmentNavigationActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    segmentArrowButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentTabs: {
        gap: 8,
        paddingVertical: 2,
    },
    segmentTab: {
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        minWidth: 92,
        gap: 2,
    },
    addSegmentTab: {
        width: 40,
        minHeight: 44,
        borderWidth: 1,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
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
