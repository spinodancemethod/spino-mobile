import React, { useRef, useState, useEffect } from 'react'
import { View, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import ThemedPill from 'Components/ThemedPill'
import { getLevelLabel, getLevelInfo } from 'constants/Levels'
import { useVideoById } from 'lib/hooks/useVideoById'
import { useTheme } from 'constants/useTheme'
import { usePositions } from 'lib/hooks/usePositions'
import { Ionicons } from '@expo/vector-icons'


export default function VideoDetailScreen() {
    const { id } = useLocalSearchParams() as { id?: string }
    const { colors, mode } = useTheme()

    // Skeleton colors that contrast the page background
    const skelBase = mode === 'dark' ? '#111827' : '#E9E5FF'
    const skelVideoBase = mode === 'dark' ? '#0b1220' : '#e6eefc'

    const { data: video, isLoading, error } = useVideoById(id as string)
    const { data: positions = [] } = usePositions(undefined)
    const position = positions.find((p: any) => p.id === video?.position_id) || null

    const videoRef = useRef<any | null>(null)
    const [VideoComponent, setVideoComponent] = useState<any | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [playerLoading, setPlayerLoading] = useState(false)
    const [note, setNote] = useState<string>(() => `Here's an extended sample note to demonstrate the scrolling behaviour and to act as a place where you can store longer practice notes.

Overview
- Purpose: use this space to capture observations, corrections, and practice plans for the video above.
- How to use: jot down short items, then expand them into drills. Revisit weekly and add timestamps.

Practice checklist
1. Warm-up (5-8 minutes): mobility, ankle rolls, hip openers.
2. Slow walkthrough (3x): perform the full sequence at 40% speed, emphasise foot placement.
3. Focus drills (3 minutes each):
   - Drill A: weight transfer between feet.
   - Drill B: posture during pivot.
   - Drill C: rhythm counting 1-2-3.

Detailed notes
- On rep 4 at 0:45 there is a small wobble — work on keeping the supporting knee soft.
- Use a marker on the floor to keep your axis consistent when rotating.
- Breathe on the count, exhale on the change of weight.

Progress log
- Day 1: felt awkward on transitions, landed on heel too often.
- Day 3: transitions smoother after isolation drills.

Ideas for next session
- Film from two angles and compare slow-mo playback.
- Add a metronome to keep tempo at 90bpm for the middle section.

Reminders
- Keep notes short and actionable.
- If something consistently fails, reduce speed and repeat the micro-drill 50 times.

This editor is scrollable and editable — keep typing to see how it behaves with a larger body of text. You can paste or type any notes here.`)

    // notes are read-only in this view

    useEffect(() => {
        setIsPlaying(false)
        videoRef.current?.stopAsync?.().catch(() => { /* ignore */ })

        let mounted = true
        const load = async () => {
            // no playable resource
            if (!video?.id && !video?.url && !video?.file_path) {
                if (mounted) {
                    setVideoComponent(null)
                    setPlayerLoading(false)
                }
                return
            }

            // start player load indicator
            if (mounted) setPlayerLoading(true)

            try {
                const mod = await import('expo-av')
                if (mounted) setVideoComponent(() => mod.Video)
            } catch (e) {
                if (mounted) setVideoComponent(null)
            } finally {
                // clear the loading flag after attempting to load the player module
                if (mounted) setPlayerLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [video?.id, video?.url, video?.file_path])

    // Render a thumbnail or a themed placeholder with a play icon
    const renderPoster = () => {
        if (video?.thumbnail_url) {
            return <Image source={{ uri: video.thumbnail_url }} style={styles.thumb} />
        }

        const bg = mode === 'dark' ? '#0f172a' : '#eef2ff'
        return (
            <View style={[styles.thumb, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="play-circle" size={72} color={colors.primary} />
            </View>
        )
    }

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container}>
                {isLoading ? (
                    <View style={{ width: '100%', marginTop: 12 }}>
                        {/* Title skeleton */}
                        <View style={[styles.skelTitle, { backgroundColor: skelBase }]} />

                        {/* Video skeleton */}
                        <View style={[styles.skelVideo, { backgroundColor: skelVideoBase }]} />

                        {/* Pills skeleton */}
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}>
                            <View style={[styles.skelPill, { backgroundColor: skelBase }]} />
                            <View style={[styles.skelPill, { width: 80, backgroundColor: skelBase }]} />
                        </View>

                        {/* Description lines skeleton */}
                        <View style={{ marginTop: 8 }}>
                            <View style={[styles.skelLine, { width: '90%', backgroundColor: skelBase }]} />
                            <View style={[styles.skelLine, { width: '70%', backgroundColor: skelBase }]} />
                            <View style={[styles.skelLine, { width: '95%', backgroundColor: skelBase }]} />
                        </View>
                    </View>
                ) : null}
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <ThemedText variant="title">{video?.title || 'Video'}</ThemedText>

                    {/* playable video if URL or file_path exists */}
                    {(video?.url || video?.file_path) ? (
                        <View style={{ width: '100%', marginTop: 12, position: 'relative' }}>
                            {VideoComponent ? (
                                <View>
                                    {React.createElement(VideoComponent, {
                                        ref: videoRef,
                                        source: { uri: video?.url || video?.file_path },
                                        style: styles.thumb,
                                        useNativeControls: false,
                                        resizeMode: 'cover',
                                        isLooping: false,
                                        onPlaybackStatusUpdate: (status: any) => {
                                            if (status?.isLoaded) setPlayerLoading(false)
                                            setIsPlaying(Boolean(status?.isPlaying))
                                        }
                                    })}
                                    {playerLoading ? (
                                        <View style={[styles.playerOverlay]}>
                                            <View style={[styles.skelVideoOverlay, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />
                                        </View>
                                    ) : null}
                                </View>
                            ) : (
                                <View>
                                    {renderPoster()}
                                    {playerLoading ? (
                                        <View style={[styles.playerOverlay]}>
                                            <View style={[styles.skelVideoOverlay, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />
                                        </View>
                                    ) : null}
                                </View>
                            )}
                        </View>
                    ) : (
                        // thumbnail fallback / placeholder
                        renderPoster()
                    )}

                    {/* Metadata */}
                    <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        {position ? <ThemedPill size="small" color="primary">{position.name}</ThemedPill> : null}
                        {typeof video?.level === 'number' ? (
                            (() => {
                                const info = getLevelInfo(video.level);
                                return <ThemedPill size="small" color={info?.color ?? '#e5e7eb'}>{getLevelLabel(video.level)}</ThemedPill>
                            })()
                        ) : null}
                    </View>

                    {/* Description (moved below pills) */}
                    <ThemedText variant="subheader" style={{ marginTop: 8 }}>{video?.description || 'No description available.'}</ThemedText>
                </View>

                {/* Single read-only note area */}
                <View style={{ marginTop: 16, width: '100%' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <ThemedText variant="title" style={styles.notesTitle}>Your Notes</ThemedText>
                        <TouchableOpacity onPress={() => { }} accessibilityLabel="Create note">
                            <Ionicons name="create-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.noteBox, { backgroundColor: colors.uiBackground }]}>
                        <ScrollView style={styles.noteScroll} nestedScrollEnabled>
                            <ThemedText style={{ color: colors.text }}>{note}</ThemedText>
                        </ScrollView>
                    </View>
                </View>
            </ScrollView>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    card: { padding: 16, borderRadius: 12, alignItems: 'flex-start' },
    thumb: { width: '100%', aspectRatio: 16 / 9, marginTop: 12, borderRadius: 8, backgroundColor: '#eee' },
    notesTitle: { marginBottom: 8, fontSize: 16 },
    noteBubble: { padding: 12, borderRadius: 8, marginBottom: 8 },
    noteBox: { borderRadius: 8, padding: 8, maxHeight: 320 },
    noteScroll: { maxHeight: 300 },
    playerOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8 },
    skelTitle: { height: 20, width: '60%', borderRadius: 6, marginBottom: 8 },
    skelVideo: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, marginTop: 8 },
    skelPill: { height: 28, width: 100, borderRadius: 16 },
    skelLine: { height: 12, borderRadius: 6, marginTop: 8 },
    skelVideoOverlay: { width: '100%', height: '100%', borderRadius: 8 },
})
