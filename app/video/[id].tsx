import React from 'react'
import { View, StyleSheet, Image } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import ThemedButton from 'Components/ThemedButton'
import { useVideoById } from 'lib/hooks/useVideoById'
import { useTheme } from 'constants/useTheme'


export default function VideoDetailScreen() {
    const { id } = useLocalSearchParams() as { id?: string }
    const { colors } = useTheme()

    const { data: video, isLoading, error } = useVideoById(id as string)

    return (
        <ThemedView style={styles.container}>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
                <ThemedText variant="title">{video?.title || 'Video'}</ThemedText>
                <ThemedText variant="subheader" style={{ marginTop: 8 }}>{video?.description || 'No description available.'}</ThemedText>

                {/* thumbnail if present */}
                {video?.thumbnail_url ? (
                    <Image source={{ uri: video.thumbnail_url }} style={styles.thumb} />
                ) : null}

                <View style={{ marginTop: 12 }}>
                    <ThemedButton title={isLoading ? 'Loading...' : 'Play'} onPress={() => { /* integrate player as needed */ }} />
                </View>
            </View>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    card: { padding: 16, borderRadius: 12, alignItems: 'flex-start' },
    thumb: { width: '100%', height: 200, marginTop: 12, borderRadius: 8, backgroundColor: '#eee' },
})
