import React, { useCallback, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { consumeOpenDefaultRoadmap } from 'lib/defaultRoadmapIntent'
import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import ThemedInput from 'Components/ThemedInput'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from 'constants/useTheme'
import { showSnack } from 'lib/snackbarService'
import { errorMessage } from 'lib/errorMessage'
import {
    useCreateUserRoadmap,
    useSetDefaultRoadmap,
    useUserRoadmaps,
    UserRoadmap,
} from 'lib/hooks/useUserRoadmaps'
import { useApplyPositionLibrary } from 'lib/hooks/useVideoCategories'

export default function YourRoadmapsScreen() {
    const { colors } = useTheme()
    const roadmapsQuery = useUserRoadmaps()
    const createRoadmap = useCreateUserRoadmap()
    // Fable v2: copy the Bachata position list into a roadmap's categories (idempotent).
    const applyLibrary = useApplyPositionLibrary()
    const setDefault = useSetDefaultRoadmap()
    async function toggleDefault(roadmap: UserRoadmap) {
        try {
            await setDefault.mutateAsync({ id: roadmap.id, isDefault: !roadmap.is_default })
            showSnack(roadmap.is_default ? 'Default roadmap cleared.' : `${roadmap.name} opens by default from the Your Roadmaps tab.`)
        } catch (error) {
            showSnack(errorMessage(error, 'Could not update the default roadmap.'))
        }
    }
    async function addPositions(roadmapId: string) {
        try {
            const added = await applyLibrary.mutateAsync({ roadmapId, danceStyle: 'bachata' })
            showSnack(added > 0 ? `Added ${added} default categories` : 'All default categories are already in this roadmap')
        } catch (error) {
            showSnack(errorMessage(error, 'Could not add default categories.'))
        }
    }

    // Open the starred roadmap when this screen was reached via the tab bar or app entry
    // (not via Back). The callback re-runs while focused when the data arrives, so a cold
    // start that is still loading the list still opens the default once it is known.
    const roadmaps = roadmapsQuery.data
    useFocusEffect(
        useCallback(() => {
            if (!roadmaps) return
            if (!consumeOpenDefaultRoadmap()) return
            const defaultRoadmap = roadmaps.find((roadmap) => roadmap.is_default)
            if (defaultRoadmap) {
                router.push({ pathname: '/(private)/user-roadmap', params: { roadmapId: defaultRoadmap.id } })
            }
        }, [roadmaps]),
    )

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
        // user-roadmap is a Stack screen (not a tab), so a plain push gives
        // correct back behavior to the roadmap list.
        router.push({ pathname: '/(private)/user-roadmap', params: { roadmapId: roadmap.id } })
    }

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.headerRow}>
                    <View>
                        <ThemedText variant="title">Your Roadmaps</ThemedText>
                        <ThemedText variant="small" style={styles.intro}>Choose/create a roadmap to continue. Tap the star to open one by default.</ThemedText>
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
                        {/* Default toggle: the starred roadmap opens straight from the Your Roadmaps tab. */}
                        <Pressable
                            onPress={() => void toggleDefault(roadmap)}
                            disabled={setDefault.isPending}
                            hitSlop={8}
                            style={styles.defaultToggle}
                            accessibilityRole="button"
                            accessibilityState={{ selected: roadmap.is_default }}
                            accessibilityLabel={roadmap.is_default ? `${roadmap.name} is your default roadmap` : `Make ${roadmap.name} your default roadmap`}
                        >
                            <Ionicons name={roadmap.is_default ? 'star' : 'star-outline'} size={22} color={roadmap.is_default ? '#f59e0b' : colors.text} />
                        </Pressable>
                        <ThemedButton
                            title="Add default categories"
                            variant="ghost"
                            onPress={() => void addPositions(roadmap.id)}
                            loading={applyLibrary.isPending && applyLibrary.variables?.roadmapId === roadmap.id}
                        />
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
                        <ThemedInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Roadmap name"
                            style={styles.input}
                        />
                        <ThemedInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Optional description"
                            style={[styles.input, styles.multiline]}
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
    defaultToggle: { position: 'absolute', top: 12, right: 12, padding: 4 },
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
