import React, { useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { useCreateUserRoadmap, useDeleteUserRoadmap, useUpdateUserRoadmap, useUserRoadmaps, UserRoadmap } from 'lib/hooks/useUserRoadmaps'
import { router } from 'expo-router'

export default function YourRoadmapsScreen() {
    const { colors } = useTheme()
    const roadmapsQuery = useUserRoadmaps()
    const createRoadmap = useCreateUserRoadmap()
    const updateRoadmap = useUpdateUserRoadmap()
    const deleteRoadmap = useDeleteUserRoadmap()
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)

    function resetForm() {
        setName('')
        setDescription('')
        setEditingId(null)
    }

    async function saveRoadmap() {
        if (!name.trim()) {
            showSnack('Enter a roadmap name.')
            return
        }
        try {
            if (editingId) {
                await updateRoadmap.mutateAsync({ id: editingId, name, description })
                showSnack('Roadmap updated.')
            } else {
                await createRoadmap.mutateAsync({ name, description })
                showSnack('Roadmap created.')
            }
            resetForm()
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not save roadmap.')
        }
    }

    function beginEdit(roadmap: UserRoadmap) {
        setEditingId(roadmap.id)
        setName(roadmap.name)
        setDescription(roadmap.description ?? '')
    }

    function confirmDelete(roadmap: UserRoadmap) {
        Alert.alert('Delete roadmap?', 'Videos and segments assigned to this roadmap will also be deleted.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => void deleteRoadmap.mutateAsync(roadmap.id).then(() => showSnack('Roadmap deleted.')).catch((error) => showSnack(error instanceof Error ? error.message : 'Could not delete roadmap.')),
            },
        ])
    }

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container}>
                <ThemedText variant="title">Your Roadmaps</ThemedText>
                <ThemedText variant="subheader" style={styles.intro}>
                    Create your own Salsa, Bachata, Dominican, or completely custom learning paths.
                </ThemedText>

                <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <ThemedText variant="small" style={styles.label}>{editingId ? 'Edit roadmap' : 'New roadmap'}</ThemedText>
                    <TextInput value={name} onChangeText={setName} placeholder="e.g. Bachata foundations" placeholderTextColor={colors.border} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
                    <TextInput value={description} onChangeText={setDescription} placeholder="Optional description" placeholderTextColor={colors.border} style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} multiline />
                    <ThemedButton title={editingId ? 'Update roadmap' : 'Create roadmap'} onPress={() => void saveRoadmap()} loading={createRoadmap.isPending || updateRoadmap.isPending} style={styles.fullButton} />
                    {editingId ? <ThemedButton title="Cancel edit" variant="ghost" onPress={resetForm} style={styles.fullButton} /> : null}
                </View>

                {roadmapsQuery.isLoading ? (
                    <View style={[styles.message, { borderColor: colors.border }]}>
                        <ActivityIndicator />
                        <ThemedText variant="small">Loading your roadmaps...</ThemedText>
                    </View>
                ) : roadmapsQuery.error ? (
                    <View style={[styles.message, { borderColor: colors.border }]}>
                        <ThemedText variant="subheader">Your roadmaps are unavailable</ThemedText>
                        <ThemedText variant="small">Apply the user roadmaps migration, then reload this screen.</ThemedText>
                    </View>
                ) : roadmapsQuery.data?.length === 0 ? (
                    <View style={[styles.message, { borderColor: colors.border }]}>
                        <ThemedText variant="subheader">You have no roadmaps yet</ThemedText>
                        <ThemedText variant="small">Create a roadmap above to begin organizing your Salsa, Bachata, Dominican, or custom videos.</ThemedText>
                    </View>
                ) : roadmapsQuery.data?.map((roadmap) => (
                    <View key={roadmap.id} style={[styles.roadmap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <ThemedText variant="subheader">{roadmap.name}</ThemedText>
                        {roadmap.description ? <ThemedText variant="small">{roadmap.description}</ThemedText> : null}
                        <ThemedButton title="Open roadmap" onPress={() => router.push({ pathname: '/(private)/(dashboard)/user-roadmap', params: { roadmapId: roadmap.id } })} style={styles.fullButton} />
                        <ThemedButton title="Add video reference" onPress={() => router.push({ pathname: '/(private)/(dashboard)/add-video', params: { roadmapId: roadmap.id } })} style={styles.fullButton} />
                        <View style={styles.actions}>
                            <ThemedButton title="Edit" variant="ghost" onPress={() => beginEdit(roadmap)} style={styles.actionButton} />
                            <ThemedButton title="Delete" variant="warning" onPress={() => confirmDelete(roadmap)} style={styles.actionButton} />
                        </View>
                    </View>
                ))}
            </ScrollView>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    container: { padding: 16, paddingBottom: 40, gap: 12 },
    intro: { lineHeight: 24, marginBottom: 4 },
    form: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 10 },
    roadmap: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 },
    label: { fontWeight: '700' },
    input: { borderWidth: 1, borderRadius: 6, minHeight: 44, paddingHorizontal: 10 },
    multiline: { minHeight: 76, paddingTop: 10, textAlignVertical: 'top' },
    fullButton: { width: '100%' },
    actions: { flexDirection: 'row', gap: 8 },
    actionButton: { flex: 1 },
    message: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 8 },
})
