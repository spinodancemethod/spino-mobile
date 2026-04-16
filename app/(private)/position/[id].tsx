import React from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import { useTheme } from 'constants/useTheme'
import { usePositionById } from 'lib/hooks/usePositionById'

const PLACEHOLDER_POSITION_IMAGE = 'https://placehold.co/1200x675/e2e8f0/475569?text=Position+Image'

export default function PositionDetailScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>()
    const { colors } = useTheme()
    const { data: position, isLoading, error } = usePositionById(id)

    if (isLoading) {
        return (
            <ThemedView style={styles.centered}>
                <ActivityIndicator />
                <ThemedText style={styles.loadingText}>Loading position...</ThemedText>
            </ThemedView>
        )
    }

    if (error) {
        return (
            <ThemedView style={styles.centered}>
                <ThemedText variant="subheader">Could not load this position.</ThemedText>
            </ThemedView>
        )
    }

    if (!position) {
        return (
            <ThemedView style={styles.centered}>
                <ThemedText variant="subheader">Position not found.</ThemedText>
            </ThemedView>
        )
    }

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Placeholder for now; swap to position.roadmap_preview_url when ready. */}
                <Image source={{ uri: PLACEHOLDER_POSITION_IMAGE }} style={styles.heroImage} resizeMode="cover" />

                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <ThemedText variant="title">{position.name}</ThemedText>
                    <ThemedText variant="subheader" style={styles.descriptionText}>
                        {position.description || 'No description available for this position yet.'}
                    </ThemedText>
                </View>
            </ScrollView>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 28,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    loadingText: {
        marginTop: 10,
    },
    heroImage: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        backgroundColor: '#e2e8f0',
    },
    card: {
        marginTop: 14,
        borderRadius: 12,
        padding: 14,
    },
    descriptionText: {
        marginTop: 10,
        lineHeight: 22,
    },
})
