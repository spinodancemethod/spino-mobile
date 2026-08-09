import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image as ExpoImage } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import LocalSegmentPlayer from 'Components/LocalSegmentPlayer'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { useUpsertVideoUploadNote, useVideoUploadById, useVideoUploadNote } from 'lib/hooks/useVideoUploadDetails'
import { useCompletedSegmentIdsByUser } from 'lib/hooks/useCompletedSegmentIdsByUser'
import { useToggleSegmentCompletion } from 'lib/hooks/useToggleSegmentCompletion'

export default function VideoUploadDetailScreen() {
    const { id, segmentId, startTime, endTime, category, title } = useLocalSearchParams<{ id?: string; segmentId?: string; startTime?: string; endTime?: string; category?: string; title?: string }>()
    const { colors } = useTheme()
    const uploadQuery = useVideoUploadById(id)
    const noteQuery = useVideoUploadNote(id)
    const noteMutation = useUpsertVideoUploadNote()
    const completedSegmentsQuery = useCompletedSegmentIdsByUser()
    const toggleSegmentCompletion = useToggleSegmentCompletion()
    const [noteText, setNoteText] = useState('')
    const [noteEditorOpen, setNoteEditorOpen] = useState(false)

    useEffect(() => {
        setNoteText(noteQuery.data?.note_text ?? '')
    }, [noteQuery.data?.note_text])

    if (uploadQuery.isLoading) {
        return <ThemedView style={styles.centered}><ActivityIndicator /><ThemedText>Loading video...</ThemedText></ThemedView>
    }

    if (uploadQuery.error || !uploadQuery.data) {
        return <ThemedView style={styles.centered}><ThemedText variant="title">Video unavailable</ThemedText><ThemedButton title="Go back" variant="ghost" onPress={() => router.back()} /></ThemedView>
    }

    const upload = uploadQuery.data
    const segmentStart = Number(startTime)
    const segmentEnd = Number(endTime)
    const hasSegmentRange = !!segmentId && Number.isFinite(segmentStart) && Number.isFinite(segmentEnd) && segmentStart < segmentEnd
    const activeSegmentId = typeof segmentId === 'string' && segmentId.length > 0 ? segmentId : null
    const isComplete = activeSegmentId ? (completedSegmentsQuery.data ?? []).includes(activeSegmentId) : false
    const segmentTitle = (title ?? '').trim() || (category ?? 'Movement segment')
    const completionColor = isComplete ? '#16a34a' : '#94a3b8'

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
                            placeholderTextColor={colors.border}
                            style={[styles.notesInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <View style={styles.modalActions}>
                            <ThemedButton title="Cancel" variant="ghost" onPress={closeNoteEditor} style={styles.modalActionButton} />
                            <ThemedButton title="Save" onPress={() => void saveNote()} loading={noteMutation.isPending} style={styles.modalActionButton} />
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
    fullButton: { width: '100%' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'center', padding: 16 },
    modalCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
    modalActions: { flexDirection: 'row', gap: 8 },
    modalActionButton: { flex: 1 },
})
