import React, { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import {
    useCreateUserRoadmap,
    useUserRoadmaps,
    UserRoadmap,
} from 'lib/hooks/useUserRoadmaps'

export default function YourRoadmapsScreen() {
    const { colors } = useTheme()
    const roadmapsQuery = useUserRoadmaps()
    const createRoadmap = useCreateUserRoadmap()

    const [createModalOpen, setCreateModalOpen] = useState(false)

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')

    function resetForm() {
        setName('')
        setDescription('')
    }

    function openCreateModal() {
        resetForm()
        setCreateModalOpen(true)
    }

    async function saveNewRoadmap() {
        if (!name.trim()) {
            showSnack('Enter a roadmap name.')
            return
        }

        try {
            await createRoadmap.mutateAsync({ name, description })
            showSnack('Roadmap created.')
            setCreateModalOpen(false)
            resetForm()
        } catch (error) {
            showSnack(error instanceof Error ? error.message : 'Could not create roadmap.')
        }
    }

    function openRoadmap(roadmap: UserRoadmap) {
        router.push({ pathname: '/(private)/(dashboard)/user-roadmap', params: { roadmapId: roadmap.id } })
    }

    function editRoadmap(roadmap: UserRoadmap) {
        router.push({
            pathname: '/(private)/(dashboard)/user-roadmap',
            params: { roadmapId: roadmap.id, editRoadmap: '1' },
        })
    }

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.headerRow}>
                    <View>
                        <ThemedText variant="title">Your Roadmaps</ThemedText>
                        <ThemedText variant="small" style={styles.intro}>Choose a roadmap to continue.</ThemedText>
                    </View>
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
                        <ThemedText variant="small">Tap Create to add your first roadmap.</ThemedText>
                    </View>
                ) : roadmapsQuery.data?.map((roadmap) => (
                    <View
                        key={roadmap.id}
                        style={[styles.roadmap, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                        <Pressable
                            style={styles.roadmapContentPressable}
                            onPress={() => openRoadmap(roadmap)}
                            accessibilityRole="button"
                            accessibilityLabel={`Open roadmap ${roadmap.name}`}
                        >
                            <ThemedText variant="subheader" style={styles.roadmapTitle}>{roadmap.name}</ThemedText>
                            {roadmap.description ? <ThemedText variant="small">{roadmap.description}</ThemedText> : null}
                        </Pressable>
                    </View>
                ))}
            </ScrollView>

            <Pressable
                onPress={openCreateModal}
                style={styles.fabButton}
                accessibilityRole="button"
                accessibilityLabel="Create roadmap"
            >
                <ThemedText style={styles.fabPlus}>+</ThemedText>
            </Pressable>

            <Modal visible={createModalOpen} transparent animationType="fade" onRequestClose={() => setCreateModalOpen(false)}>
                <Pressable style={styles.modalBackdrop} onPress={() => setCreateModalOpen(false)}>
                    <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <ThemedText variant="subheader" style={styles.modalTitle}>Create roadmap</ThemedText>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Roadmap name"
                            placeholderTextColor={colors.border}
                            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        />
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Optional description"
                            placeholderTextColor={colors.border}
                            style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                            multiline
                        />
                        <ThemedButton
                            title={createRoadmap.isPending ? 'Creating...' : 'Create roadmap'}
                            onPress={() => void saveNewRoadmap()}
                            loading={createRoadmap.isPending}
                            style={styles.fullButton}
                        />
                        <ThemedButton title="Cancel" variant="ghost" onPress={() => setCreateModalOpen(false)} style={styles.fullButton} />
                    </View>
                </Pressable>
            </Modal>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    container: { padding: 16, paddingBottom: 120, gap: 10 },
    headerRow: { marginBottom: 6 },
    intro: { color: '#64748b', marginTop: 2 },
    roadmap: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6, position: 'relative' },
    roadmapContentPressable: { gap: 6, paddingRight: 44, minHeight: 32, justifyContent: 'center' },
    roadmapTitle: { flex: 1 },
    editRoadmapIconButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    editRoadmapIconButtonOverlay: { position: 'absolute', top: 10, right: 10, zIndex: 2, elevation: 2 },
    input: { borderWidth: 1, borderRadius: 6, minHeight: 44, paddingHorizontal: 10 },
    multiline: { minHeight: 76, paddingTop: 10, textAlignVertical: 'top' },
    fullButton: { width: '100%' },
    message: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 8 },
    fabButton: {
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
    fabPlus: { color: '#ffffff', fontSize: 30, lineHeight: 32, fontWeight: '700', marginTop: -2 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
    modalCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
    modalTitle: { marginBottom: 4 },
})
