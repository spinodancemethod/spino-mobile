import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image as ExpoImage } from 'expo-image'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import LocalSegmentPlayer from 'Components/LocalSegmentPlayer'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { useVideoSegments } from 'lib/hooks/useVideoSegments'
import { useUpsertVideoUploadNote, useVideoUploadById, useVideoUploadNote } from 'lib/hooks/useVideoUploadDetails'
import { useUserRoadmaps } from 'lib/hooks/useUserRoadmaps'

export default function VideoUploadDetailScreen() {
    const { id, segmentId, startTime, endTime, category, title, description } = useLocalSearchParams<{ id?: string; segmentId?: string; startTime?: string; endTime?: string; category?: string; title?: string; description?: string }>()
    const { colors } = useTheme()
    const uploadQuery = useVideoUploadById(id)
    const noteQuery = useVideoUploadNote(id)
    const noteMutation = useUpsertVideoUploadNote()
    const segmentsQuery = useVideoSegments(id ?? null)
    const roadmapsQuery = useUserRoadmaps()
    const [noteText, setNoteText] = useState('')

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
    const roadmap = roadmapsQuery.data?.find((item) => item.id === upload.roadmap_id)
    const segmentStart = Number(startTime)
    const segmentEnd = Number(endTime)
    const hasSegmentRange = !!segmentId && Number.isFinite(segmentStart) && Number.isFinite(segmentEnd) && segmentStart < segmentEnd
    const segmentTitle = (title ?? '').trim() || (category ?? 'Movement segment')
    const segmentDescription = (description ?? '').trim()

    async function saveNote() {
        try {
            await noteMutation.mutateAsync({ videoUploadId: upload.id, noteText })
            showSnack('Note saved.')
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not save note.')
        }
    }

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container}>
                <ThemedText variant="title">{segmentTitle}</ThemedText>
                {segmentDescription ? <ThemedText variant="small">{segmentDescription}</ThemedText> : null}
                <View style={styles.metadata}>
                    <ThemedText variant="small">Source ID: {upload.media_identifier ?? upload.local_reference_key}</ThemedText>
                    <ThemedText variant="small">Source file: {upload.filename ?? upload.name ?? 'Video reference'}</ThemedText>
                    <ThemedText variant="small">Roadmap: {roadmap?.name ?? 'Unknown'}</ThemedText>
                    {hasSegmentRange ? <ThemedText variant="small">Segment: {segmentStart}s → {segmentEnd}s</ThemedText> : null}
                    <ThemedText variant="small">Duration: {upload.duration_seconds == null ? 'Unknown' : `${Math.round(upload.duration_seconds)} seconds`}</ThemedText>
                    <ThemedText variant="small">Status: {upload.status}</ThemedText>
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
                    <ThemedText variant="subheader">Segments</ThemedText>
                    {segmentsQuery.data?.length ? segmentsQuery.data.map((segment) => (
                        <View key={segment.id} style={styles.segmentRow}>
                            <ThemedText variant="small">{(segment.title ?? '').trim() || 'Untitled segment'}</ThemedText>
                            <ThemedText variant="small">{segment.start_time}s → {segment.end_time}s</ThemedText>
                            {segment.description ? <ThemedText variant="small">{segment.description}</ThemedText> : null}
                        </View>
                    )) : <ThemedText variant="small">No saved segments yet.</ThemedText>}
                </View>

                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <ThemedText variant="subheader">Your Notes</ThemedText>
                    <TextInput
                        value={noteText}
                        onChangeText={setNoteText}
                        multiline
                        placeholder="What do you want to remember?"
                        placeholderTextColor={colors.border}
                        style={[styles.notesInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    />
                    <ThemedButton title="Save note" onPress={() => void saveNote()} loading={noteMutation.isPending} style={styles.fullButton} />
                </View>
            </ScrollView>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    container: { padding: 16, paddingBottom: 40, gap: 12 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    metadata: { gap: 4 },
    player: { aspectRatio: 16 / 9 },
    unavailable: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
    thumbnail: { width: '100%', aspectRatio: 16 / 9, borderRadius: 6 },
    section: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 },
    segmentRow: { gap: 2, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
    notesInput: { minHeight: 120, borderWidth: 1, borderRadius: 6, padding: 10, textAlignVertical: 'top' },
    fullButton: { width: '100%' },
})
