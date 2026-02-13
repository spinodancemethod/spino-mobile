import React, { useRef, useState, useEffect } from 'react'
import { View, StyleSheet, Image } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import ThemedButton from 'Components/ThemedButton'
import { useVideoById } from 'lib/hooks/useVideoById'
import { useTheme } from 'constants/useTheme'
import { usePositions } from 'lib/hooks/usePositions'


export default function VideoDetailScreen() {
    const { id } = useLocalSearchParams() as { id?: string }
    const { colors } = useTheme()

    const { data: video, isLoading, error } = useVideoById(id as string)
    const { data: positions = [] } = usePositions(undefined)
    const position = positions.find((p: any) => p.id === video?.position_id) || null

    const videoRef = useRef<any | null>(null)
    const [VideoComponent, setVideoComponent] = useState<any | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)

    useEffect(() => {
        setIsPlaying(false)
        videoRef.current?.stopAsync?.().catch(() => { /* ignore */ })

        let mounted = true
        const load = async () => {
            try {
                const mod = await import('expo-av')
                if (mounted) setVideoComponent(() => mod.Video)
            } catch (e) {
                if (mounted) setVideoComponent(null)
            }
        }
        load()
        return () => { mounted = false }
    }, [video?.id])

    return (
        <ThemedView style={styles.container}>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
                <ThemedText variant="title">{video?.title || 'Video'}</ThemedText>
                <ThemedText variant="subheader" style={{ marginTop: 8 }}>{video?.description || 'No description available.'}</ThemedText>

                {/* playable video if URL or file_path exists */}
                {(video?.url || video?.file_path) ? (
                    <View style={{ width: '100%', marginTop: 12 }}>
                        {VideoComponent ? (
                            React.createElement(VideoComponent, {
                                ref: videoRef,
                                source: { uri: video?.url || video?.file_path },
                                style: styles.thumb,
                                useNativeControls: false,
                                resizeMode: 'contain',
                                isLooping: false,
                            })
                        ) : (
                            <Image source={{ uri: video?.thumbnail_url }} style={styles.thumb} />
                        )}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <ThemedButton
                                title={isPlaying ? 'Pause' : (isLoading ? 'Loading...' : 'Play')}
                                onPress={async () => {
                                    try {
                                        if (!videoRef.current) return
                                        if (isPlaying) {
                                            await videoRef.current.pauseAsync()
                                            setIsPlaying(false)
                                        } else {
                                            await videoRef.current.playAsync()
                                            setIsPlaying(true)
                                        }
                                    } catch (e) {
                                        console.warn('Playback error', e)
                                    }
                                }}
                            />
                        </View>
                    </View>
                ) : (
                    // thumbnail fallback
                    video?.thumbnail_url ? (
                        <Image source={{ uri: video.thumbnail_url }} style={styles.thumb} />
                    ) : null
                )}

                {/* Metadata */}
                <View style={{ marginTop: 12 }}>
                    {position ? <ThemedText>Position: {position.name}</ThemedText> : null}
                    {typeof video?.level === 'number' ? <ThemedText>Level: {video.level}</ThemedText> : null}
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
