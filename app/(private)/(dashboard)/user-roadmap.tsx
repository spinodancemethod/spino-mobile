import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Dimensions, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'
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
import { useCreateVideoCategory, useVideoCategories } from 'lib/hooks/useVideoSegments'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'

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
    const { roadmapId } = useLocalSearchParams<{ roadmapId?: string }>()
    const roadmapsQuery = useUserRoadmaps()
    const updateRoadmap = useUpdateUserRoadmap()
    const deleteRoadmap = useDeleteUserRoadmap()
    const createCategory = useCreateVideoCategory()
    const roadmap = roadmapsQuery.data?.find((item) => item.id === roadmapId) ?? roadmapsQuery.data?.[0]
    const segmentsQuery = useRoadmapSegments(roadmap?.id)
    const categoriesQuery = useVideoCategories()
    const [manageModalOpen, setManageModalOpen] = useState(false)
    const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false)
    const [roadmapName, setRoadmapName] = useState('')
    const [roadmapDescription, setRoadmapDescription] = useState('')
    const [newCategoryName, setNewCategoryName] = useState('')
    const roadmapPosition = useMemo<RoadmapPosition[]>(() => {
        return (categoriesQuery.data ?? []).map((category) => ({
            id: category.id,
            name: category.name,
            description: category.system_category ? 'System category' : 'Custom category',
        }))
    }, [categoriesQuery.data])
    const videosByCategory = useMemo(() => {
        const grouped = new Map<string, RoadmapVideo[]>()
        for (const segment of segmentsQuery.data ?? []) {
            const categoryVideos = grouped.get(segment.category_id) ?? []
            categoryVideos.push({
                id: segment.id,
                title: segment.title ?? segment.category_name,
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
    const categoryRows = useMemo(() => {
        if (roadmapPosition.length > 0) return roadmapPosition
        // Fallback for transitional states where categories are not loaded yet.
        return Array.from(videosByCategory.keys()).map((id) => ({ id, name: 'Category' }))
    }, [roadmapPosition, videosByCategory])
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
        const name = newCategoryName.trim()
        if (!name) {
            showSnack('Enter a category name.')
            return
        }

        try {
            await createCategory.mutateAsync(name)
            setNewCategoryName('')
            setAddCategoryModalOpen(false)
            // Force-refresh so the category column updates immediately.
            await categoriesQuery.refetch()
            showSnack('Category created.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not create category.')
        }
    }

    if (roadmapsQuery.isLoading || segmentsQuery.isLoading || categoriesQuery.isLoading) {
        return <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /><ThemedText variant="small">Loading roadmap...</ThemedText></ThemedView>
    }

    if (!roadmap) {
        return <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}><ThemedText variant="title">No roadmap selected</ThemedText><ThemedText variant="small">Return to Your Roadmaps and choose one to open.</ThemedText></ThemedView>
    }

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={screenStyles.headerRow}>
                <Pressable onPress={openManageModal} style={screenStyles.editIconButton} accessibilityRole="button" accessibilityLabel="Edit roadmap">
                    <Ionicons name="create-outline" size={20} color={colors.text} />
                </Pressable>
                <View style={screenStyles.headerTextWrap}>
                    <ThemedText variant="title">{roadmap.name}</ThemedText>
                </View>
            </View>
            <View style={screenStyles.subheaderRow}>
                <ThemedText variant="small">Segments are grouped by category. Source videos are references only.</ThemedText>
            </View>
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
                roadmapVideosByPosition={videosByCategory}
                roadmapPositionVideosByPosition={emptyVideos}
                freeTierVideosByPosition={emptyVideos}
                availableVideosByPosition={videosByCategory}
                availablePositionVideosByPosition={emptyVideos}
                completedVideoIdSet={new Set()}
                isSubscribed
                showEmptyPositions
                samplePositionPlaceholderUrl={SAMPLE_POSITION_PLACEHOLDER_URL}
                sampleVideoPlaceholderUrl={SAMPLE_PLACEHOLDER_URL}
                showLeftLane={false}
                showConnectorStubs
                centerHeaderText="Categories"
                rightHeaderText="Segments"
                showCenterAddButton
                onCenterAddPress={() => setAddCategoryModalOpen(true)}
                onNodePress={() => undefined}
                onEmptyPositionPress={(position) => router.push({ pathname: '/(private)/(dashboard)/add-video', params: { roadmapId: roadmap.id, categoryId: position.id } })}
                onEmptyPositionVideoPress={() => undefined}
                onVideoPress={(_position, _index, video) => router.push({ pathname: `/video-upload/${video.video_upload_id}`, params: { segmentId: video.id, startTime: String(video.start_time ?? 0), endTime: String(video.end_time ?? 0), category: video.category_name ?? 'Misc', title: video.title ?? '', description: video.description ?? '' } })}
                onLockedPositionPress={() => undefined}
                onToggleCompletion={() => undefined}
            />

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
        paddingBottom: 4,
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
})
