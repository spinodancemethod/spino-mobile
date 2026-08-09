import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Dimensions, Modal, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { RoadmapCanvas } from 'Components/roadmap/RoadmapCanvas'
import { RoadmapPosition, RoadmapVideo } from 'Components/roadmap/types'
import { styles } from './your-roadmap'
import { useRoadmapGestures } from 'lib/hooks/useRoadmapGestures'
import { useDeleteUserRoadmap, useUpdateUserRoadmap, useUserRoadmaps } from 'lib/hooks/useUserRoadmaps'
import { useRoadmapSegments } from 'lib/hooks/useRoadmapSegments'
import { useCreateVideoCategory, useDeleteVideoCategory, useUpdateVideoCategory, useVideoCategories } from 'lib/hooks/useVideoSegments'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { VideoCategoryRecord } from 'lib/models'
import { useCompletedSegmentIdsByUser } from 'lib/hooks/useCompletedSegmentIdsByUser'
import { useToggleSegmentCompletion } from 'lib/hooks/useToggleSegmentCompletion'

const SURFACE_WIDTH = 1800
const VIDEO_W = 170
const VIDEO_H = 214
const VIDEO_MARGIN = 10
const VIDEO_GAP = 12
const POSITION_COLUMN_WIDTH = 180
const ICON_SIZE = 18
const ROW_GAP = 18
const DEFAULT_SCALE = 0.5
const INITIAL_VIEWPORT_WIDTH = Dimensions.get('window').width
const SAMPLE_PLACEHOLDER_URL = 'https://placehold.co/240x135/e2e8f0/475569?text=Local+Video'
const SAMPLE_POSITION_PLACEHOLDER_URL = 'https://placehold.co/320x180/fef3c7/92400e?text=Roadmap'

export default function UserRoadmapScreen() {
    const { colors } = useTheme()
    const { roadmapId, editRoadmap } = useLocalSearchParams<{ roadmapId?: string; editRoadmap?: string }>()
    const roadmapsQuery = useUserRoadmaps()
    const updateRoadmap = useUpdateUserRoadmap()
    const deleteRoadmap = useDeleteUserRoadmap()
    const createCategory = useCreateVideoCategory()
    const updateCategory = useUpdateVideoCategory()
    const deleteCategory = useDeleteVideoCategory()
    const roadmap = roadmapsQuery.data?.find((item) => item.id === roadmapId) ?? roadmapsQuery.data?.[0]
    const segmentsQuery = useRoadmapSegments(roadmap?.id)
    const categoriesQuery = useVideoCategories(roadmap?.id)
    const completedSegmentsQuery = useCompletedSegmentIdsByUser()
    const toggleSegmentCompletion = useToggleSegmentCompletion()
    const [manageModalOpen, setManageModalOpen] = useState(false)
    const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false)
    const [roadmapName, setRoadmapName] = useState('')
    const [roadmapDescription, setRoadmapDescription] = useState('')
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryDescription, setNewCategoryDescription] = useState('')
    const [manageCategoryModalOpen, setManageCategoryModalOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<VideoCategoryRecord | null>(null)
    const [editingCategoryName, setEditingCategoryName] = useState('')
    const [editingCategoryDescription, setEditingCategoryDescription] = useState('')
    const [hasHandledInitialRoadmapEditRequest, setHasHandledInitialRoadmapEditRequest] = useState(false)
    const [showEmptyCategories, setShowEmptyCategories] = useState(true)
    const [showCompleted, setShowCompleted] = useState(true)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const roadmapPosition = useMemo<RoadmapPosition[]>(() => {
        return (categoriesQuery.data ?? []).map((category) => ({
            id: category.id,
            name: category.name,
            description: category.description ?? (category.system_category ? 'System category' : 'Custom category'),
        }))
    }, [categoriesQuery.data])
    const videosByCategory = useMemo(() => {
        const grouped = new Map<string, RoadmapVideo[]>()
        for (const segment of segmentsQuery.data ?? []) {
            const categoryVideos = grouped.get(segment.category_id) ?? []
            categoryVideos.push({
                id: segment.id,
                // Segment title should represent the learning item, not the category bucket.
                title: segment.title ?? segment.video_name ?? null,
                description: segment.description,
                thumbnail_url: segment.video_thumbnail,
                video_upload_id: segment.video_upload_id,
                start_time: segment.start_time,
                end_time: segment.end_time,
                category_name: segment.category_name,
            })
            grouped.set(segment.category_id, categoryVideos)
        }
        return grouped
    }, [segmentsQuery.data])
    const completedSegmentIdSet = useMemo(
        () => new Set(completedSegmentsQuery.data ?? []),
        [completedSegmentsQuery.data]
    )
    const filteredVideosByCategory = useMemo(() => {
        if (showCompleted) return videosByCategory

        const filtered = new Map<string, RoadmapVideo[]>()
        for (const [categoryId, videos] of videosByCategory.entries()) {
            filtered.set(
                categoryId,
                videos.filter((video) => !video?.id || !completedSegmentIdSet.has(video.id))
            )
        }
        return filtered
    }, [videosByCategory, showCompleted, completedSegmentIdSet])
    const categoryRows = useMemo(() => {
        if (roadmapPosition.length > 0) {
            if (showEmptyCategories) return roadmapPosition
            return roadmapPosition.filter((category) => (filteredVideosByCategory.get(category.id)?.length ?? 0) > 0)
        }
        // Fallback for transitional states where categories are not loaded yet.
        return Array.from(filteredVideosByCategory.keys()).map((id) => ({ id, name: 'Category' }))
    }, [roadmapPosition, filteredVideosByCategory, showEmptyCategories])
    const emptyVideos = useMemo(() => new Map<string, RoadmapVideo[]>(), [])
    const [surfaceHeight, setSurfaceHeight] = useState(500)
    const defaultPanX = (INITIAL_VIEWPORT_WIDTH / 2) - ((SURFACE_WIDTH / 2) * DEFAULT_SCALE)
    const { canvasRef, onCanvasLayout, pan, panHandlers, scale, setSurfaceHeight: setGestureSurfaceHeight } = useRoadmapGestures({
        minScale: 0.2,
        maxScale: 3,
        defaultScale: DEFAULT_SCALE,
        surfaceWidth: SURFACE_WIDTH,
        defaultPanX,
        defaultPanY: -300,
    })

    useEffect(() => {
        setGestureSurfaceHeight(surfaceHeight)
    }, [setGestureSurfaceHeight, surfaceHeight])

    useEffect(() => {
        if (!roadmap) return
        setRoadmapName(roadmap.name)
        setRoadmapDescription(roadmap.description ?? '')
    }, [roadmap])

    useEffect(() => {
        if (!roadmap) return
        if (hasHandledInitialRoadmapEditRequest) return
        if (editRoadmap !== '1') return

        setRoadmapName(roadmap.name)
        setRoadmapDescription(roadmap.description ?? '')
        setManageModalOpen(true)
        setHasHandledInitialRoadmapEditRequest(true)
    }, [roadmap, editRoadmap, hasHandledInitialRoadmapEditRequest])

    function openManageModal() {
        if (!roadmap) return
        setRoadmapName(roadmap.name)
        setRoadmapDescription(roadmap.description ?? '')
        setManageModalOpen(true)
    }

    async function saveRoadmapChanges() {
        if (!roadmap) return
        const name = roadmapName.trim()
        if (!name) {
            showSnack('Enter a roadmap name.')
            return
        }

        try {
            await updateRoadmap.mutateAsync({ id: roadmap.id, name, description: roadmapDescription })
            showSnack('Roadmap updated.')
            setManageModalOpen(false)
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not update roadmap.')
        }
    }

    function confirmDeleteRoadmap() {
        if (!roadmap) return

        Alert.alert('Delete roadmap?', 'Videos and segments assigned to this roadmap will also be deleted.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    void deleteRoadmap
                        .mutateAsync(roadmap.id)
                        .then(() => {
                            showSnack('Roadmap deleted.')
                            setManageModalOpen(false)
                            router.replace('/(private)/(dashboard)/your-roadmaps')
                        })
                        .catch((error) => showSnack(error instanceof Error ? error.message : 'Could not delete roadmap.'))
                },
            },
        ])
    }

    async function addCategory() {
        if (!roadmap) return
        const name = newCategoryName.trim()
        if (!name) {
            showSnack('Enter a category name.')
            return
        }

        try {
            await createCategory.mutateAsync({
                roadmapId: roadmap.id,
                name,
                description: newCategoryDescription,
            })
            setNewCategoryName('')
            setNewCategoryDescription('')
            setAddCategoryModalOpen(false)
            // Force-refresh so the category column updates immediately.
            await categoriesQuery.refetch()
            showSnack('Category created.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not create category.')
        }
    }

    function openManageCategoryModal(position: RoadmapPosition) {
        const category = (categoriesQuery.data ?? []).find((item) => item.id === position.id)
        if (!category) return
        setSelectedCategory(category)
        setEditingCategoryName(category.name)
        setEditingCategoryDescription(category.description ?? '')
        setManageCategoryModalOpen(true)
    }

    async function saveCategoryChanges() {
        if (!selectedCategory || !roadmap) return

        const name = editingCategoryName.trim()
        if (!name) {
            showSnack('Enter a category name.')
            return
        }

        try {
            await updateCategory.mutateAsync({
                id: selectedCategory.id,
                roadmapId: roadmap.id,
                name,
                description: editingCategoryDescription,
            })
            showSnack('Category updated.')
            setManageCategoryModalOpen(false)
            setSelectedCategory(null)
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not update category.')
        }
    }

    function confirmDeleteCategory() {
        if (!selectedCategory || !roadmap) return

        Alert.alert(
            'Delete category?',
            'Deleting this category will also delete all associated learning segments. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        void deleteCategory
                            .mutateAsync({ id: selectedCategory.id, roadmapId: roadmap.id })
                            .then(() => {
                                showSnack('Category deleted.')
                                setManageCategoryModalOpen(false)
                                setSelectedCategory(null)
                            })
                            .catch((error) => {
                                showSnack(error instanceof Error ? error.message : 'Could not delete category.')
                            })
                    },
                },
            ]
        )
    }

    if (roadmapsQuery.isLoading || segmentsQuery.isLoading || categoriesQuery.isLoading || completedSegmentsQuery.isLoading) {
        return <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /><ThemedText variant="small">Loading roadmap...</ThemedText></ThemedView>
    }

    if (!roadmap) {
        return <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}><ThemedText variant="title">No roadmap selected</ThemedText><ThemedText variant="small">Return to Your Roadmaps and choose one to open.</ThemedText></ThemedView>
    }

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={screenStyles.headerRow}>
                <Pressable
                    onPress={() => router.push('/(private)/(dashboard)/your-roadmaps')}
                    style={screenStyles.editIconButton}
                    accessibilityRole="button"
                    accessibilityLabel="Go to your roadmaps"
                >
                    <Ionicons name="map-outline" size={20} color={colors.text} />
                </Pressable>
                <View style={screenStyles.headerTextWrap}>
                    <ThemedText variant="title">{roadmap.name}</ThemedText>
                </View>
            </View>
            <View style={screenStyles.subheaderRow}>
                <ThemedText variant="small">Segments are grouped by category. Source videos are references only.</ThemedText>
            </View>
            <View style={screenStyles.canvasWrap}>
                <RoadmapCanvas
                    styles={styles}
                    canvasRef={canvasRef}
                    onCanvasLayout={(event) => { onCanvasLayout(event); setSurfaceHeight(Math.max(500, event.nativeEvent.layout.height)) }}
                    panHandlers={panHandlers}
                    pan={pan}
                    scale={scale}
                    surfaceWidth={SURFACE_WIDTH}
                    estimatedSurfaceHeight={Math.max(surfaceHeight, 500)}
                    positionColumnWidth={POSITION_COLUMN_WIDTH}
                    videoWidth={VIDEO_W}
                    videoHeight={VIDEO_H}
                    videoMargin={VIDEO_MARGIN}
                    videoGap={VIDEO_GAP}
                    iconSize={ICON_SIZE}
                    roadmapPositions={categoryRows}
                    roadmapVideosByPosition={filteredVideosByCategory}
                    roadmapPositionVideosByPosition={emptyVideos}
                    freeTierVideosByPosition={emptyVideos}
                    availableVideosByPosition={filteredVideosByCategory}
                    availablePositionVideosByPosition={emptyVideos}
                    completedVideoIdSet={completedSegmentIdSet}
                    isSubscribed
                    showEmptyPositions={showEmptyCategories}
                    samplePositionPlaceholderUrl={SAMPLE_POSITION_PLACEHOLDER_URL}
                    sampleVideoPlaceholderUrl={SAMPLE_PLACEHOLDER_URL}
                    showLeftLane={false}
                    showConnectorStubs
                    centerHeaderText="Categories"
                    rightHeaderText="Segments"
                    showCenterAddButton
                    onCenterAddPress={() => setAddCategoryModalOpen(true)}
                    onNodePress={openManageCategoryModal}
                    onEmptyPositionPress={(position) => router.push({ pathname: '/(private)/(dashboard)/add-video', params: { roadmapId: roadmap.id, categoryId: position.id } })}
                    onEmptyPositionVideoPress={() => undefined}
                    onVideoPress={(_position, _index, video) => router.push({ pathname: `/video-upload/${video.video_upload_id}`, params: { segmentId: video.id, startTime: String(video.start_time ?? 0), endTime: String(video.end_time ?? 0), category: video.category_name ?? 'Misc', title: video.title ?? '', description: video.description ?? '' } })}
                    onLockedPositionPress={() => undefined}
                    onToggleCompletion={(segmentId, isComplete) => {
                        void toggleSegmentCompletion
                            .mutateAsync({ segmentId, isComplete })
                            .then(() => showSnack(isComplete ? 'Marked as in progress.' : 'Marked as complete.'))
                            .catch((error) => showSnack(error instanceof Error ? error.message : 'Could not update completion.'))
                    }}
                />
            </View>

            <Pressable
                onPress={() => setDrawerOpen((open) => !open)}
                style={screenStyles.settingsFabButton}
                accessibilityRole="button"
                accessibilityLabel={drawerOpen ? 'Close roadmap options' : 'Open roadmap options'}
            >
                <Ionicons name={drawerOpen ? 'close-outline' : 'options-outline'} size={24} color="#ffffff" />
            </Pressable>

            <Modal
                visible={drawerOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setDrawerOpen(false)}
            >
                <Pressable style={screenStyles.modalBackdrop} onPress={() => setDrawerOpen(false)}>
                    <View style={[screenStyles.drawerPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={screenStyles.toggleRow}>
                            <ThemedText variant="small" style={screenStyles.toggleLabel}>Show empty categories</ThemedText>
                            <Switch
                                value={showEmptyCategories}
                                onValueChange={setShowEmptyCategories}
                                trackColor={{ false: '#cbd5e1', true: colors.primary }}
                                thumbColor="#ffffff"
                            />
                        </View>
                        <View style={screenStyles.toggleRow}>
                            <ThemedText variant="small" style={screenStyles.toggleLabel}>Show completed</ThemedText>
                            <Switch
                                value={showCompleted}
                                onValueChange={setShowCompleted}
                                trackColor={{ false: '#cbd5e1', true: colors.primary }}
                                thumbColor="#ffffff"
                            />
                        </View>
                        <ThemedButton
                            title="Edit roadmap"
                            onPress={() => {
                                setDrawerOpen(false)
                                openManageModal()
                            }}
                            style={screenStyles.fullButton}
                        />
                    </View>
                </Pressable>
            </Modal>

            <Modal visible={manageModalOpen} transparent animationType="fade" onRequestClose={() => setManageModalOpen(false)}>
                <Pressable style={screenStyles.modalBackdrop} onPress={() => setManageModalOpen(false)}>
                    <View style={[screenStyles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <ThemedText variant="subheader" style={screenStyles.modalTitle}>Manage roadmap</ThemedText>
                        <TextInput
                            value={roadmapName}
                            onChangeText={setRoadmapName}
                            placeholder="Roadmap name"
                            placeholderTextColor={colors.border}
                            style={[screenStyles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <TextInput
                            value={roadmapDescription}
                            onChangeText={setRoadmapDescription}
                            placeholder="Optional description"
                            placeholderTextColor={colors.border}
                            multiline
                            style={[screenStyles.input, screenStyles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <ThemedButton
                            title={updateRoadmap.isPending ? 'Saving...' : 'Save changes'}
                            onPress={() => void saveRoadmapChanges()}
                            loading={updateRoadmap.isPending}
                            style={screenStyles.fullButton}
                        />
                        <ThemedButton
                            title="Add video reference"
                            onPress={() => router.push({ pathname: '/(private)/(dashboard)/add-video', params: { roadmapId: roadmap.id } })}
                            style={screenStyles.fullButton}
                        />
                        <ThemedButton
                            title="Delete roadmap"
                            variant="warning"
                            onPress={confirmDeleteRoadmap}
                            loading={deleteRoadmap.isPending}
                            style={screenStyles.fullButton}
                        />
                        <ThemedButton title="Close" variant="ghost" onPress={() => setManageModalOpen(false)} style={screenStyles.fullButton} />
                    </View>
                </Pressable>
            </Modal>

            <Modal visible={addCategoryModalOpen} transparent animationType="fade" onRequestClose={() => setAddCategoryModalOpen(false)}>
                <Pressable style={screenStyles.modalBackdrop} onPress={() => setAddCategoryModalOpen(false)}>
                    <View style={[screenStyles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <ThemedText variant="subheader" style={screenStyles.modalTitle}>Add category</ThemedText>
                        <TextInput
                            value={newCategoryName}
                            onChangeText={setNewCategoryName}
                            placeholder="Category name"
                            placeholderTextColor={colors.border}
                            style={[screenStyles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <TextInput
                            value={newCategoryDescription}
                            onChangeText={setNewCategoryDescription}
                            placeholder="Optional category description"
                            placeholderTextColor={colors.border}
                            multiline
                            style={[screenStyles.input, screenStyles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <ThemedButton
                            title={createCategory.isPending ? 'Creating...' : 'Create category'}
                            onPress={() => void addCategory()}
                            loading={createCategory.isPending}
                            style={screenStyles.fullButton}
                        />
                        <ThemedButton title="Cancel" variant="ghost" onPress={() => setAddCategoryModalOpen(false)} style={screenStyles.fullButton} />
                    </View>
                </Pressable>
            </Modal>

            <Modal
                visible={manageCategoryModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setManageCategoryModalOpen(false)}
            >
                <Pressable style={screenStyles.modalBackdrop} onPress={() => setManageCategoryModalOpen(false)}>
                    <View style={[screenStyles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <ThemedText variant="subheader" style={screenStyles.modalTitle}>Manage category</ThemedText>
                        <TextInput
                            value={editingCategoryName}
                            onChangeText={setEditingCategoryName}
                            placeholder="Category name"
                            placeholderTextColor={colors.border}
                            style={[screenStyles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <TextInput
                            value={editingCategoryDescription}
                            onChangeText={setEditingCategoryDescription}
                            placeholder="Optional category description"
                            placeholderTextColor={colors.border}
                            multiline
                            style={[screenStyles.input, screenStyles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <ThemedButton
                            title={updateCategory.isPending ? 'Saving...' : 'Save category'}
                            onPress={() => void saveCategoryChanges()}
                            loading={updateCategory.isPending}
                            style={screenStyles.fullButton}
                        />
                        <ThemedButton
                            title="Delete category"
                            variant="warning"
                            onPress={confirmDeleteCategory}
                            loading={deleteCategory.isPending}
                            style={screenStyles.fullButton}
                        />
                        <ThemedButton title="Cancel" variant="ghost" onPress={() => setManageCategoryModalOpen(false)} style={screenStyles.fullButton} />
                    </View>
                </Pressable>
            </Modal>
        </ThemedView>
    )
}

const screenStyles = StyleSheet.create({
    headerRow: {
        paddingTop: 12,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 8,
    },
    subheaderRow: {
        paddingHorizontal: 12,
        paddingBottom: 2,
    },
    drawerPanel: {
        marginHorizontal: 24,
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        gap: 8,
        alignSelf: 'stretch',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleLabel: {
        color: '#475569',
        fontWeight: '600',
    },
    canvasWrap: {
        flex: 1,
    },
    headerTextWrap: {
        flex: 1,
    },
    editIconButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 2,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: 24,
    },
    modalCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        gap: 8,
    },
    modalTitle: {
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderRadius: 6,
        minHeight: 44,
        paddingHorizontal: 10,
    },
    multiline: {
        minHeight: 76,
        paddingTop: 10,
        textAlignVertical: 'top',
    },
    fullButton: {
        width: '100%',
    },
    settingsFabButton: {
        position: 'absolute',
        right: 18,
        bottom: 22,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#16a34a',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
})
