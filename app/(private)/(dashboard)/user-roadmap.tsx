import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { RoadmapCanvas } from 'Components/roadmap/RoadmapCanvas'
import { RoadmapPosition } from 'Components/roadmap/types'
import { useRoadmapGestures } from 'lib/hooks/useRoadmapGestures'
import { useDeleteUserRoadmap, useUpdateUserRoadmap, useUserRoadmaps } from 'lib/hooks/useUserRoadmaps'
import { useCreateVideoCategory, useDeleteVideoCategory, useUpdateVideoCategory } from 'lib/hooks/useVideoCategories'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { VideoCategoryRecord } from 'lib/models'
import { useToggleSegmentCompletion } from 'lib/hooks/useToggleSegmentCompletion'
import { useUserRoadmapViewModel } from 'lib/hooks/useUserRoadmapViewModel'

const SURFACE_WIDTH = 1800
const VIDEO_W = 170
const VIDEO_H = 244
const VIDEO_MARGIN = 10
const VIDEO_GAP = 12
const POSITION_COLUMN_WIDTH = 180
const ICON_SIZE = 18
const ROW_GAP = 18
const DEFAULT_SCALE = 0.45
const SURFACE_HORIZONTAL_PADDING = 24
const DEFAULT_PAN_Y = 0
const CATEGORIES_ANCHOR_VIEWPORT_X = 240
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
    const [showEmptyCategories, setShowEmptyCategories] = useState(true)
    const [showCompleted, setShowCompleted] = useState(true)
    const {
        segmentsQuery,
        categoriesQuery,
        completedSegmentsQuery,
        categoryRows,
        filteredVideosByCategory,
        completedSegmentIdSet,
        emptyVideos,
    } = useUserRoadmapViewModel(roadmap?.id, showEmptyCategories, showCompleted)
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
    const [drawerOpen, setDrawerOpen] = useState(false)
    const lastAnchoredRoadmapId = useRef<string | null>(null)
    const [surfaceHeight, setSurfaceHeight] = useState(500)
    const activeRoadmapId = roadmap?.id ?? null
    // Anchor against the Categories card itself (root card in the middle lane).
    // In this layout, that card starts at the surface's left padding and top edge.
    const categoriesCardAnchorX = SURFACE_HORIZONTAL_PADDING
    const defaultPanX = CATEGORIES_ANCHOR_VIEWPORT_X - (categoriesCardAnchorX * DEFAULT_SCALE)
    const { canvasRef, onCanvasLayout, pan, panHandlers, scale, setSurfaceHeight: setGestureSurfaceHeight, resetViewport } = useRoadmapGestures({
        minScale: 0.2,
        maxScale: 3,
        defaultScale: DEFAULT_SCALE,
        surfaceWidth: SURFACE_WIDTH,
        defaultPanX,
        defaultPanY: DEFAULT_PAN_Y,
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

    useEffect(() => {
        if (!activeRoadmapId) return
        if (categoriesQuery.isLoading || segmentsQuery.isLoading) return
        if (lastAnchoredRoadmapId.current === activeRoadmapId) return

        // Anchor after data resolves so each roadmap starts from the same
        // Categories-card reference point regardless of item counts.
        const frame = requestAnimationFrame(() => {
            resetViewport(defaultPanX, DEFAULT_PAN_Y, DEFAULT_SCALE)
            lastAnchoredRoadmapId.current = activeRoadmapId
        })

        return () => cancelAnimationFrame(frame)
    }, [
        activeRoadmapId,
        categoriesQuery.isLoading,
        segmentsQuery.isLoading,
        defaultPanX,
        resetViewport,
    ])

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
            <View style={screenStyles.canvasWrap}>
                <RoadmapCanvas
                    styles={screenStyles}
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
                    showPositionDescription
                    onCenterAddPress={() => setAddCategoryModalOpen(true)}
                    onNodePress={openManageCategoryModal}
                    onEmptyPositionPress={(position) => router.push({ pathname: '/(private)/(dashboard)/add-video', params: { roadmapId: roadmap.id, categoryId: position.id } })}
                    onEmptyPositionVideoPress={() => undefined}
                    onVideoPress={(_position, _index, video) => router.push({ pathname: `/video-upload/${video.video_upload_id}`, params: { segmentId: video.id, startTime: String(video.start_time ?? 0), endTime: String(video.end_time ?? 0), category: video.category_name ?? 'Misc', title: video.title ?? '' } })}
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
                            placeholderTextColor={colors.placeholder}
                            style={[screenStyles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <TextInput
                            value={roadmapDescription}
                            onChangeText={setRoadmapDescription}
                            placeholder="Optional description"
                            placeholderTextColor={colors.placeholder}
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
                            placeholderTextColor={colors.placeholder}
                            style={[screenStyles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <TextInput
                            value={newCategoryDescription}
                            onChangeText={setNewCategoryDescription}
                            placeholder="Optional category description"
                            placeholderTextColor={colors.placeholder}
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
                            placeholderTextColor={colors.placeholder}
                            style={[screenStyles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <TextInput
                            value={editingCategoryDescription}
                            onChangeText={setEditingCategoryDescription}
                            placeholder="Optional category description"
                            placeholderTextColor={colors.placeholder}
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
    canvasOuter: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    canvasInner: {
        alignSelf: 'flex-start',
    },
    surface: {
        width: SURFACE_WIDTH,
        backgroundColor: 'transparent',
        paddingHorizontal: 24,
        paddingBottom: 48,
    },
    surfaceHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
    },
    selectedVideosHeaderLeft: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignItems: 'flex-end',
    },
    selectedVideosHeaderRight: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignItems: 'flex-start',
    },
    selectedVideosHeaderText: {
        color: '#475569',
        fontWeight: '700',
        paddingHorizontal: 40,
    },
    roadmapRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: ROW_GAP,
    },
    leftVideosColumn: {
        flex: 1,
        alignItems: 'flex-end',
    },
    positionColumn: {
        width: POSITION_COLUMN_WIDTH,
    },
    rightVideosColumn: {
        flex: 1,
    },
    connectorStub: {
        width: 22,
        height: 2,
        marginHorizontal: 12,
        backgroundColor: '#cbd5e1',
    },
    videoRow: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'flex-start',
    },
    nodeText: {
        color: '#0f172a',
        fontWeight: '600',
    },
    leafBox: {
        backgroundColor: '#f2f7e7',
        borderRadius: 6,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        elevation: 1,
    },
    lockedLeafBox: {
        backgroundColor: '#e5e7eb',
        borderWidth: 1,
        borderColor: '#9ca3af',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyLeafButtonSlot: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyLeafButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#64748b',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyLeafActionWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyLeafText: {
        marginTop: 6,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: '600',
    },
    videoTileHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    videoTitleText: {
        flex: 1,
        fontWeight: '700',
    },
    videoGif: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 6,
        backgroundColor: '#dbe4ee',
    },
    videoNoteText: {
        marginTop: 6,
        color: '#334155',
        lineHeight: 15,
    },
    positionDescriptionText: {
        marginTop: 0,
        marginBottom: 6,
    },
    rootBox: {
        borderRadius: 6,
        backgroundColor: '#e6dfd6',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        paddingHorizontal: 18,
        paddingVertical: 16,
    },
    rootBoxStatic: {
        width: POSITION_COLUMN_WIDTH,
    },
    rootText: {
        color: '#111827',
        fontWeight: '700',
    },
    positionBox: {
        backgroundColor: '#fff7f9',
        borderRadius: 8,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        elevation: 2,
    },
    positionBoxStatic: {
        height: VIDEO_H,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    positionTitleText: {
        fontWeight: '700',
        marginBottom: 6,
        textAlign: 'left',
    },
    positionPlaceholderImage: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 6,
        backgroundColor: '#fde68a',
    },
    emptyRoadmapState: {
        marginTop: 24,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        paddingHorizontal: 16,
    },
    emptyRoadmapTitle: {
        marginBottom: 8,
        color: '#0f172a',
        fontWeight: '700',
    },
    emptyRoadmapText: {
        color: '#64748b',
        textAlign: 'center',
        maxWidth: 420,
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
