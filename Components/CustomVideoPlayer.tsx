import React from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'

interface CustomVideoPlayerProps {
    source: string
    style?: StyleProp<ViewStyle>
}

export default function CustomVideoPlayer({ source, style }: CustomVideoPlayerProps) {
    const player = useVideoPlayer(source, (p) => {
        p.loop = false
        p.muted = false
    })

    return (
        <View style={[styles.container, style]}>
            <VideoView
                player={player}
                style={styles.video}
                nativeControls={true}
                contentFit="contain"
                allowsPictureInPicture={false}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#000',
        borderRadius: 8,
        overflow: 'hidden',
    },
    video: {
        width: '100%',
        height: '100%',
    },
})
