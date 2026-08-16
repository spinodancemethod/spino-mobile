import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image as ExpoImage } from 'expo-image'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { Ionicons } from '@expo/vector-icons'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import LocalSegmentPlayer from '../../../Components/LocalSegmentPlayer'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { useUpdateVideoUploadTitle, useUpsertVideoUploadNote, useVideoUploadById, useVideoUploadNote } from 'lib/hooks/useVideoUploadDetails'
import { useCompletedSegmentIdsByUser } from 'lib/hooks/useCompletedSegmentIdsByUser'
import { useToggleSegmentCompletion } from 'lib/hooks/useToggleSegmentCompletion'
import { useCreateVideoSegment, useDeleteVideoSegment, useUpdateVideoSegment, useVideoCategories, useVideoSegments, validateSegmentRange } from 'lib/hooks/useVideoSegments'

export default function VideoUploadDetailScreen() {
    const { id, segmentId, startTime, endTime, category, title } = useLocalSearchParams<{ id?: string; segmentId?: string; startTime?: string; endTime?: string; category?: string; title?: string }>()
    const { colors } = useTheme()
    const uploadQuery = useVideoUploadById(id)
    const noteQuery = useVideoUploadNote(id)
    const noteMutation = useUpsertVideoUploadNote()
    const titleMutation = useUpdateVideoUploadTitle()
    const updateSegment = useUpdateVideoSegment()
    const createSegment = useCreateVideoSegment()
    const deleteSegment = useDeleteVideoSegment()
    const segmentsQuery = useVideoSegments(id ?? null)
    const categoriesQuery = useVideoCategories(uploadQuery.data?.roadmap_id)
    const completedSegmentsQuery = useCompletedSegmentIdsByUser()
    const toggleSegmentCompletion = useToggleSegmentCompletion()
    const [noteText, setNoteText] = useState('')
    const [noteEditorOpen, setNoteEditorOpen] = useState(false)
    const [titleText, setTitleText] = useState('')
    const [titleEditorOpen, setTitleEditorOpen] = useState(false)
    const [segmentStartText, setSegmentStartText] = useState(startTime ?? '')
    const [segmentEndText, setSegmentEndText] = useState(endTime ?? '')
    const [segmentStartDraft, setSegmentStartDraft] = useState(startTime ?? '')
    const [segmentEndDraft, setSegmentEndDraft] = useState(endTime ?? '')
    const [segmentEditorOpen, setSegmentEditorOpen] = useState(false)
    const [categoryEditorOpen, setCategoryEditorOpen] = useState(false)
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
    const [thumbnailEditorOpen, setThumbnailEditorOpen] = useState(false)
    const [thumbnailTime, setThumbnailTime] = useState(startTime ?? '0')
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
    const [thumbnailLoading, setThumbnailLoading] = useState(false)
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)

    useEffect(() => {
        setNoteText(noteQuery.data?.note_text ?? '')
    }, [noteQuery.data?.note_text])

    useEffect(() => {
        setTitleText(uploadQuery.data?.custom_title ?? '')
    }, [uploadQuery.data?.custom_title])

    useEffect(() => {
        setSegmentStartText(startTime ?? '')
        setSegmentEndText(endTime ?? '')
        setSegmentStartDraft(startTime ?? '')
        setSegmentEndDraft(endTime ?? '')
    }, [endTime, startTime])

    const activeSegment = segmentsQuery.data?.find((segment) => segment.id === segmentId) ?? null
    const currentCategoryId = activeSegment?.category_id ?? null
    const currentCategoryName = categoriesQuery.data?.find((item) => item.id === currentCategoryId)?.name ?? category ?? 'Uncategorized'

    useEffect(() => {
        setSelectedCategoryId(currentCategoryId)
    }, [currentCategoryId])

    useEffect(() => {
        setThumbnailTime(startTime ?? '0')
        setThumbnailPreview(activeSegment?.thumbnail_reference ?? null)
    }, [activeSegment?.thumbnail_reference, startTime])

    if (uploadQuery.isLoading) {
        return <ThemedView style={styles.centered}><ActivityIndicator /><ThemedText>Loading video...</ThemedText></ThemedView>
    }

    if (uploadQuery.error || !uploadQuery.data) {
        return <ThemedView style={styles.centered}><ThemedText variant="title">Video unavailable</ThemedText><ThemedButton title="Go back" variant="ghost" onPress={() => router.back()} /></ThemedView>
    }

    const upload = uploadQuery.data
    const segmentStart = Number(segmentStartText)
    const segmentEnd = Number(segmentEndText)
    const hasSegmentRange = !!segmentId && Number.isFinite(segmentStart) && Number.isFinite(segmentEnd) && segmentStart < segmentEnd
    const activeSegmentId = typeof segmentId === 'string' && segmentId.length > 0 ? segmentId : null
    const isComplete = activeSegmentId ? (completedSegmentsQuery.data ?? []).includes(activeSegmentId) : false
    const segmentTitle = (title ?? '').trim() || (category ?? 'Movement segment')
    const completionColor = isComplete ? '#16a34a' : '#94a3b8'
    const videoTitle = upload.custom_title ?? upload.name ?? upload.filename ?? 'Untitled video'

    async function saveVideoTitle() {
        try {
            await titleMutation.mutateAsync({ videoUploadId: upload.id, customTitle: titleText })
            showSnack('Video title saved.')
            setTitleEditorOpen(false)
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not save video title.')
        }
    }

    function openTitleEditor() {
        setTitleText(upload.custom_title ?? '')
        setTitleEditorOpen(true)
    }

    function closeTitleEditor() {
        if (titleMutation.isPending) return
        setTitleEditorOpen(false)
    }

    function openSegmentEditor() {
        setSegmentStartDraft(segmentStartText)
        setSegmentEndDraft(segmentEndText)
        setSegmentEditorOpen(true)
    }

    function closeSegmentEditor() {
        if (updateSegment.isPending) return
        setSegmentEditorOpen(false)
    }

    function openCategoryEditor() {
        setSelectedCategoryId(currentCategoryId)
        setCategoryEditorOpen(true)
    }

    function closeCategoryEditor() {
        if (updateSegment.isPending || createSegment.isPending) return
        setCategoryEditorOpen(false)
    }

    function openThumbnailEditor() {
        setThumbnailTime(String(activeSegment?.start_time ?? segmentStart))
        setThumbnailPreview(activeSegment?.thumbnail_reference ?? null)
        setThumbnailEditorOpen(true)
    }

    function closeThumbnailEditor() {
        if (thumbnailLoading || updateSegment.isPending) return
        setThumbnailEditorOpen(false)
    }

    function closeDeleteConfirmation() {
        if (deleteSegment.isPending) return
        setDeleteConfirmationOpen(false)
    }

    async function deleteCurrentSegment() {
        if (!activeSegmentId) {
            showSnack('No segment selected to delete.')
            return
        }
        try {
            await deleteSegment.mutateAsync({ id: activeSegmentId, video_upload_id: upload.id })
            setDeleteConfirmationOpen(false)
            showSnack('Segment deleted from the roadmap.')
            router.back()
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not delete the segment.')
        }
    }

    async function generateSegmentThumbnail() {
        if (!upload.fallback_uri) {
            showSnack('The local video is unavailable for thumbnail generation.')
            return
        }
        const seconds = Number(thumbnailTime)
        const rangeStart = activeSegment?.start_time ?? segmentStart
        const rangeEnd = activeSegment?.end_time ?? segmentEnd
        if (!Number.isFinite(seconds) || seconds < rangeStart || seconds > rangeEnd) {
            showSnack(`Enter a thumbnail time between ${rangeStart} and ${rangeEnd} seconds.`)
            return
        }

        setThumbnailLoading(true)
        try {
            const result = await VideoThumbnails.getThumbnailAsync(upload.fallback_uri, { time: Math.round(seconds * 1000) })
            setThumbnailPreview(result.uri)
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not generate a thumbnail from this video.')
        } finally {
            setThumbnailLoading(false)
        }
    }

    async function saveSegmentThumbnail() {
        if (!activeSegment || !thumbnailPreview) {
            showSnack('Choose a thumbnail frame first.')
            return
        }
        try {
            await updateSegment.mutateAsync({
                id: activeSegment.id,
                videoUploadId: upload.id,
                startTime: activeSegment.start_time,
                endTime: activeSegment.end_time,
                durationSeconds: upload.duration_seconds,
                thumbnailReference: thumbnailPreview,
            })
            setThumbnailEditorOpen(false)
            showSnack('Segment thumbnail updated.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not update segment thumbnail.')
        }
    }

    async function changeSegmentCategory() {
        if (!activeSegmentId || !selectedCategoryId || selectedCategoryId === currentCategoryId) {
            showSnack('Choose a different category to move this segment.')
            return
        }
        try {
            await updateSegment.mutateAsync({
                id: activeSegmentId,
                videoUploadId: upload.id,
                startTime: activeSegment?.start_time ?? segmentStart,
                endTime: activeSegment?.end_time ?? segmentEnd,
                categoryId: selectedCategoryId,
                durationSeconds: upload.duration_seconds,
            })
            setCategoryEditorOpen(false)
            showSnack('Segment category updated.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not update segment category.')
        }
    }

    async function duplicateSegmentToCategory() {
        if (!selectedCategoryId) {
            showSnack('Choose a category for the duplicate.')
            return
        }
        if (selectedCategoryId === currentCategoryId) {
            showSnack('Choose a different category for the duplicate.')
            return
        }
        if (!activeSegment) {
            showSnack('Segment details are still loading.')
            return
        }
        try {
            await createSegment.mutateAsync({
                videoUploadId: upload.id,
                startTime: activeSegment.start_time,
                endTime: activeSegment.end_time,
                durationSeconds: upload.duration_seconds,
                categoryId: selectedCategoryId,
                title: activeSegment.title,
                thumbnailReference: activeSegment.thumbnail_reference,
            })
            setCategoryEditorOpen(false)
            showSnack('Segment duplicated.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not duplicate segment.')
        }
    }

    async function saveSegmentRange() {
        const nextStart = Number(segmentStartDraft)
        const nextEnd = Number(segmentEndDraft)
        if (!activeSegmentId) {
            showSnack('Segment details are unavailable for editing.')
            return
        }
        if (!Number.isFinite(nextStart) || !Number.isFinite(nextEnd) || nextStart < 0 || nextStart >= nextEnd) {
            showSnack('Enter a valid range where start is less than end.')
            return
        }
        const validationError = validateSegmentRange(nextStart, nextEnd, upload.duration_seconds)
        if (validationError) {
            showSnack(validationError)
            return
        }
        try {
            await updateSegment.mutateAsync({
                id: activeSegmentId,
                videoUploadId: upload.id,
                startTime: nextStart,
                endTime: nextEnd,
                durationSeconds: upload.duration_seconds,
            })
            setSegmentStartText(String(nextStart))
            setSegmentEndText(String(nextEnd))
            setSegmentEditorOpen(false)
            showSnack('Segment range updated.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not update segment range.')
        }
    }

    async function saveNote() {
        try {
            await noteMutation.mutateAsync({ videoUploadId: upload.id, noteText })
            showSnack('Note saved.')
            setNoteEditorOpen(false)
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not save note.')
        }
    }

    function openNoteEditor() {
        setNoteText(noteQuery.data?.note_text ?? '')
        setNoteEditorOpen(true)
    }

    function closeNoteEditor() {
        if (noteMutation.isPending) return
        setNoteEditorOpen(false)
    }

    async function toggleCurrentSegmentCompletion() {
        if (!activeSegmentId) {
            showSnack('No segment selected for completion.')
            return
        }
        try {
            await toggleSegmentCompletion.mutateAsync({ segmentId: activeSegmentId, isComplete })
            showSnack(isComplete ? 'Marked as in progress.' : 'Marked as complete.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not update completion.')
        }
    }

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.titleRow}>
                    <ThemedText variant="title" style={styles.titleText}>{segmentTitle}</ThemedText>
                    {activeSegmentId ? (
                        <Pressable
                            onPress={() => void toggleCurrentSegmentCompletion()}
                            disabled={toggleSegmentCompletion.isPending}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={isComplete ? 'Mark as in progress' : 'Mark segment complete'}
                            style={[styles.completeIconButton, { backgroundColor: completionColor }]}
                        >
                            <ThemedText style={styles.completeIconText}>✓</ThemedText>
                        </Pressable>
                    ) : null}
                </View>

                {upload.fallback_uri && upload.status === 'AVAILABLE' && hasSegmentRange ? (
                    <LocalSegmentPlayer source={upload.fallback_uri} startTime={segmentStart} endTime={segmentEnd} />
                ) : (
                    <View style={[styles.unavailable, { borderColor: colors.border }]}>
                        {upload.thumbnail_reference ? <ExpoImage source={{ uri: upload.thumbnail_reference }} style={styles.thumbnail} contentFit="cover" /> : null}
                        <ThemedText variant="subheader">Video unavailable on this device</ThemedText>
                        <ThemedButton title="Choose replacement video" onPress={() => router.push('/local-videos')} style={styles.fullButton} />
                    </View>
                )}

                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.sectionHeaderRow}>
                        <ThemedText variant="subheader">Display Title</ThemedText>
                        <Pressable
                            onPress={openTitleEditor}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Edit video title"
                            style={[styles.editIconButton, { borderColor: colors.border }]}
                        >
                            <Ionicons name="create-outline" size={18} color={colors.text} />
                        </Pressable>
                    </View>
                    <ThemedText style={styles.noteBody}>{videoTitle}</ThemedText>
                </View>

                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.sectionHeaderRow}>
                        <ThemedText variant="subheader">Your Notes</ThemedText>
                        <Pressable
                            onPress={openNoteEditor}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={(noteQuery.data?.note_text ?? '').trim().length > 0 ? 'Edit note' : 'Add note'}
                            style={[styles.editIconButton, { borderColor: colors.border }]}
                        >
                            <Ionicons name="create-outline" size={18} color={colors.text} />
                        </Pressable>
                    </View>
                    {(noteQuery.data?.note_text ?? '').trim().length > 0 ? (
                        <ThemedText style={styles.noteBody}>{noteQuery.data?.note_text}</ThemedText>
                    ) : (
                        <ThemedText variant="small" style={{ color: colors.border }}>No notes yet.</ThemedText>
                    )}
                </View>

                {activeSegmentId ? (
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.sectionHeaderRow}>
                            <ThemedText variant="subheader">Category</ThemedText>
                            <Pressable
                                onPress={openCategoryEditor}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Change or duplicate segment category"
                                style={[styles.editIconButton, { borderColor: colors.border }]}
                            >
                                <Ionicons name="create-outline" size={18} color={colors.text} />
                            </Pressable>
                        </View>
                        <ThemedText style={styles.noteBody}>{currentCategoryName}</ThemedText>
                    </View>
                ) : null}

                {activeSegmentId ? (
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.sectionHeaderRow}>
                            <ThemedText variant="subheader">Segment Range</ThemedText>
                            <Pressable
                                onPress={openSegmentEditor}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Edit segment range"
                                style={[styles.editIconButton, { borderColor: colors.border }]}
                            >
                                <Ionicons name="create-outline" size={18} color={colors.text} />
                            </Pressable>
                        </View>
                        <ThemedText style={styles.noteBody}>{segmentStartText}s to {segmentEndText}s</ThemedText>
                    </View>
                ) : null}

                {activeSegmentId ? (
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.sectionHeaderRow}>
                            <ThemedText variant="subheader">Thumbnail</ThemedText>
                            <Pressable
                                onPress={openThumbnailEditor}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Change segment thumbnail"
                                style={[styles.editIconButton, { borderColor: colors.border }]}
                            >
                                <Ionicons name="create-outline" size={18} color={colors.text} />
                            </Pressable>
                        </View>
                        {activeSegment?.thumbnail_reference ? (
                            <ExpoImage source={{ uri: activeSegment.thumbnail_reference }} style={styles.segmentThumbnail} contentFit="cover" />
                        ) : (
                            <ThemedText variant="small" style={{ color: colors.border }}>No thumbnail selected.</ThemedText>
                        )}
                    </View>
                ) : null}

                {activeSegmentId ? (
                    <ThemedButton
                        title="Delete segment from roadmap"
                        variant="warning"
                        onPress={() => setDeleteConfirmationOpen(true)}
                        style={styles.fullButton}
                    />
                ) : null}
            </ScrollView>

            <Modal visible={noteEditorOpen} transparent animationType="fade" onRequestClose={closeNoteEditor}>
                <Pressable style={styles.modalOverlay} onPress={closeNoteEditor}>
                    <Pressable
                        style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={(event) => event.stopPropagation()}
                    >
                        <ThemedText variant="subheader">Edit Note</ThemedText>
                        <TextInput
                            value={noteText}
                            onChangeText={setNoteText}
                            multiline
                            placeholder="What do you want to remember?"
                            placeholderTextColor={colors.placeholder}
                            style={[styles.notesInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <View style={styles.modalActions}>
                            <ThemedButton title="Cancel" variant="ghost" onPress={closeNoteEditor} style={styles.modalActionButton} />
                            <ThemedButton title="Save" onPress={() => void saveNote()} loading={noteMutation.isPending} style={styles.modalActionButton} />
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={titleEditorOpen} transparent animationType="fade" onRequestClose={closeTitleEditor}>
                <Pressable style={styles.modalOverlay} onPress={closeTitleEditor}>
                    <Pressable
                        style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={(event) => event.stopPropagation()}
                    >
                        <ThemedText variant="subheader">Edit Video Title</ThemedText>
                        <TextInput
                            value={titleText}
                            onChangeText={setTitleText}
                            placeholder="Name this video"
                            placeholderTextColor={colors.placeholder}
                            style={[styles.titleInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <View style={styles.modalActions}>
                            <ThemedButton title="Cancel" variant="ghost" onPress={closeTitleEditor} style={styles.modalActionButton} />
                            <ThemedButton title="Save" onPress={() => void saveVideoTitle()} loading={titleMutation.isPending} style={styles.modalActionButton} />
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={segmentEditorOpen} transparent animationType="fade" onRequestClose={closeSegmentEditor}>
                <Pressable style={styles.modalOverlay} onPress={closeSegmentEditor}>
                    <Pressable
                        style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={(event) => event.stopPropagation()}
                    >
                        <ThemedText variant="subheader">Edit Segment Range</ThemedText>
                        <View style={styles.rangeInputs}>
                            <TextInput
                                value={segmentStartDraft}
                                onChangeText={(value) => setSegmentStartDraft(value.replace(/[^0-9.]/g, ''))}
                                keyboardType="decimal-pad"
                                placeholder="Start"
                                placeholderTextColor={colors.placeholder}
                                style={[styles.rangeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            />
                            <ThemedText variant="small">to</ThemedText>
                            <TextInput
                                value={segmentEndDraft}
                                onChangeText={(value) => setSegmentEndDraft(value.replace(/[^0-9.]/g, ''))}
                                keyboardType="decimal-pad"
                                placeholder="End"
                                placeholderTextColor={colors.placeholder}
                                style={[styles.rangeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            />
                        </View>
                        <View style={styles.modalActions}>
                            <ThemedButton title="Cancel" variant="ghost" onPress={closeSegmentEditor} style={styles.modalActionButton} />
                            <ThemedButton title="Save" onPress={() => void saveSegmentRange()} loading={updateSegment.isPending} style={styles.modalActionButton} />
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={categoryEditorOpen} transparent animationType="fade" onRequestClose={closeCategoryEditor}>
                <Pressable style={styles.modalOverlay} onPress={closeCategoryEditor}>
                    <Pressable
                        style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={(event) => event.stopPropagation()}
                    >
                        <ThemedText variant="subheader">Manage Category</ThemedText>
                        <ThemedText variant="small">Current category: {currentCategoryName}</ThemedText>
                        <View style={styles.categoryOptions}>
                            {(categoriesQuery.data ?? []).map((item) => (
                                <Pressable
                                    key={item.id}
                                    onPress={() => setSelectedCategoryId(item.id)}
                                    style={[
                                        styles.categoryOption,
                                        { borderColor: selectedCategoryId === item.id ? colors.primary : colors.border, backgroundColor: selectedCategoryId === item.id ? colors.background : colors.card },
                                    ]}
                                >
                                    <ThemedText>{item.name}</ThemedText>
                                </Pressable>
                            ))}
                        </View>
                        <View style={styles.modalActions}>
                            <ThemedButton title="Cancel" variant="ghost" onPress={closeCategoryEditor} style={styles.modalActionButton} />
                            <ThemedButton title="Move here" onPress={() => void changeSegmentCategory()} loading={updateSegment.isPending} style={styles.modalActionButton} />
                        </View>
                        <ThemedButton title="Duplicate here" variant="ghost" onPress={() => void duplicateSegmentToCategory()} loading={createSegment.isPending} style={styles.fullButton} />
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={thumbnailEditorOpen} transparent animationType="fade" onRequestClose={closeThumbnailEditor}>
                <Pressable style={styles.modalOverlay} onPress={closeThumbnailEditor}>
                    <Pressable
                        style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={(event) => event.stopPropagation()}
                    >
                        <ThemedText variant="subheader">Edit Thumbnail</ThemedText>
                        {thumbnailPreview ? <ExpoImage source={{ uri: thumbnailPreview }} style={styles.segmentThumbnail} contentFit="cover" /> : null}
                        <ThemedText variant="small">Choose a frame between {activeSegment?.start_time ?? segmentStart} and {activeSegment?.end_time ?? segmentEnd} seconds.</ThemedText>
                        <View style={styles.thumbnailControls}>
                            <TextInput
                                value={thumbnailTime}
                                onChangeText={(value) => setThumbnailTime(value.replace(/[^0-9.]/g, ''))}
                                keyboardType="decimal-pad"
                                placeholder="Frame time"
                                placeholderTextColor={colors.placeholder}
                                style={[styles.rangeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            />
                            <ThemedButton title={thumbnailLoading ? 'Generating...' : 'Choose frame'} onPress={() => void generateSegmentThumbnail()} loading={thumbnailLoading} style={styles.thumbnailButton} />
                        </View>
                        <View style={styles.modalActions}>
                            <ThemedButton title="Cancel" variant="ghost" onPress={closeThumbnailEditor} style={styles.modalActionButton} />
                            <ThemedButton title="Save" onPress={() => void saveSegmentThumbnail()} loading={updateSegment.isPending} style={styles.modalActionButton} />
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={deleteConfirmationOpen} transparent animationType="fade" onRequestClose={closeDeleteConfirmation}>
                <Pressable style={styles.modalOverlay} onPress={closeDeleteConfirmation}>
                    <Pressable
                        style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={(event) => event.stopPropagation()}
                    >
                        <ThemedText variant="subheader">Delete segment?</ThemedText>
                        <ThemedText>This removes this segment from the roadmap. The source video and other segments will remain.</ThemedText>
                        <View style={styles.modalActions}>
                            <ThemedButton title="Cancel" variant="ghost" onPress={closeDeleteConfirmation} style={styles.modalActionButton} />
                            <ThemedButton title="Delete" variant="warning" onPress={() => void deleteCurrentSegment()} loading={deleteSegment.isPending} style={styles.modalActionButton} />
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    container: { padding: 16, paddingBottom: 40, gap: 12 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    titleText: { flex: 1 },
    player: { aspectRatio: 16 / 9 },
    unavailable: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
    thumbnail: { width: '100%', aspectRatio: 16 / 9, borderRadius: 6 },
    section: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    completeIconButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    completeIconText: { color: '#fff', fontSize: 12, lineHeight: 12 },
    editIconButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noteBody: { lineHeight: 20 },
    notesInput: { minHeight: 120, borderWidth: 1, borderRadius: 6, padding: 10, textAlignVertical: 'top' },
    titleInput: { borderWidth: 1, borderRadius: 6, padding: 10 },
    rangeInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rangeInput: { flex: 1, borderWidth: 1, borderRadius: 6, padding: 10 },
    thumbnailControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    thumbnailButton: { minWidth: 120 },
    segmentThumbnail: { width: '100%', aspectRatio: 1, borderRadius: 6, backgroundColor: '#000' },
    categoryOptions: { gap: 8 },
    categoryOption: { borderWidth: 1, borderRadius: 6, padding: 10 },
    fullButton: { width: '100%' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'center', padding: 16 },
    modalCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
    modalActions: { flexDirection: 'row', gap: 8 },
    modalActionButton: { flex: 1 },
})
