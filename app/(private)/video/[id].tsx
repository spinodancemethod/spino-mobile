import React, { useRef, useState, useEffect } from 'react'
import { View, StyleSheet, Image, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import ThemedPill from 'Components/ThemedPill'
import ThemedLike from 'Components/ThemedLike'
import { getLevelInfo } from 'constants/Levels'
import { useVideoById } from 'lib/hooks/useVideoById'
import { useTheme } from 'constants/useTheme'
import { usePositions } from 'lib/hooks/usePositions'
import { useNoteByUserAndVideo } from 'lib/hooks/useNoteByUserAndVideo'
import { Ionicons } from '@expo/vector-icons'
import ThemedButton from 'Components/ThemedButton'
import { useUpsertNote } from 'lib/hooks/useUpsertNote'
import { showSnack } from 'lib/snackbarService'
import { useEntitlement } from 'lib/hooks/useEntitlement'
import { useVideoActionToggles } from 'lib/hooks/useVideoActionToggles'
import { useAuth } from 'lib/auth'
import { reportAppEvent } from 'lib/observability'


export default function VideoDetailScreen() {
    const { id } = useLocalSearchParams() as { id?: string }
    const { colors, mode } = useTheme()
    const { user } = useAuth()
    const { isSubscribed, isLoading: entitlementLoading } = useEntitlement()

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
    // notes are read-only in this view; fetch from DB for current user + video
    const { data: noteRow, isLoading: noteLoading } = useNoteByUserAndVideo(undefined, id as string)
    const noteText = noteRow?.note_text ?? null

    const [editorOpen, setEditorOpen] = useState(false)
    const [editorText, setEditorText] = useState<string | null>(null)
    const upsert = useUpsertNote()
    const [saving, setSaving] = useState(false)
    const {
        favouriteIdSet,
        completedVideoIdSet,
        isFavouritePending,
        isCompletionPending,
        toggleFavouriteWithFeedback,
        toggleCompletionWithFeedback,
    } = useVideoActionToggles()
    const isFavourite = !!video?.id && favouriteIdSet.has(video.id)
    const isComplete = !!video?.id && completedVideoIdSet.has(video.id)

    const onToggleCompletion = async () => {
        if (!video?.id) {
            showSnack('Unable to determine video id');
            return;
        }

        await toggleCompletionWithFeedback(video.id, isComplete)
    }

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

    // Show loading spinner while entitlement or video data is still resolving.
    if (entitlementLoading || isLoading) {
        return (
            <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ThemedText>Loading...</ThemedText>
            </ThemedView>
        )
    }

    // Free users trying to view a paid video see an upsell screen instead of the content.
    if (!isSubscribed && video?.access_tier === 'paid') {
        return (
            <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                <Ionicons name="lock-closed" size={56} color={colors.primary} style={{ marginBottom: 20 }} />
                <ThemedText variant="title" style={{ textAlign: 'center', marginBottom: 12 }}>
                    Premium Content
                </ThemedText>
                <ThemedText style={{ textAlign: 'center', marginBottom: 32, opacity: 0.65 }}>
                    This video is part of the premium library. Subscribe to unlock all videos and build your full roadmap.
                </ThemedText>
                <ThemedButton
                    title="Subscribe to unlock"
                    onPress={() => {
                        void reportAppEvent({
                            event: 'locked_screen_subscribe_cta_press',
                            userId: user?.id,
                            metadata: {
                                screen: 'video_locked_screen',
                                videoId: video?.id ?? null,
                            },
                        })
                        router.replace('/subscribe')
                    }}
                    style={{ width: '100%', marginBottom: 12 }}
                />
                <ThemedButton
                    title="Go back"
                    variant="ghost"
                    onPress={() => router.back()}
                    style={{ width: '100%' }}
                />
            </ThemedView>
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

                    {/* Metadata */}
                    <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        {position ? <ThemedPill size="small" color="primary">{position.name}</ThemedPill> : null}
                        {typeof video?.level === 'number' ? (
                            (() => {
                                const info = getLevelInfo(video.level);
                                return <ThemedPill size="small" color={info?.color ?? '#e5e7eb'}>{info?.label ?? String(video.level)}</ThemedPill>
                            })()
                        ) : null}
                    </View>

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

                    <View style={styles.actionRow}>
                        <ThemedLike
                            liked={isFavourite}
                            size={22}
                            onPress={() => {
                                if (!video?.id || isFavouritePending) return
                                toggleFavouriteWithFeedback(video.id)
                            }}
                        />
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={onToggleCompletion}
                            disabled={!video?.id || isCompletionPending}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={[
                                styles.completionIcon,
                                {
                                    backgroundColor: isComplete ? '#16a34a' : '#94a3b8',
                                    opacity: (!video?.id || isCompletionPending) ? 0.6 : 1,
                                },
                            ]}
                        >
                            <ThemedText style={styles.completionIconText}>✓</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {/* Description */}
                    <ThemedText variant="subheader" style={{ marginTop: 12 }}>{video?.description || 'No description available.'}</ThemedText>
                </View>

                {/* Single read-only note area */}
                <View style={{ marginTop: 16, width: '100%' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <ThemedText variant="title" style={styles.notesTitle}>Your Notes</ThemedText>
                        <TouchableOpacity onPress={() => {
                            // open editor; preload existing note if available
                            setEditorText(noteText ?? '')
                            setEditorOpen(true)
                        }} accessibilityLabel="Create note">
                            <Ionicons name="create-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.noteBox, { backgroundColor: colors.uiBackground }]}>
                        <ScrollView style={styles.noteScroll} nestedScrollEnabled>
                            <ThemedText style={{ color: colors.text }}>
                                {noteLoading ? 'Loading notes…' : (noteText ?? 'Add notes to aid your progress.')}
                            </ThemedText>
                        </ScrollView>
                    </View>
                </View>
                {/* Editor modal */}
                <Modal visible={editorOpen} animationType="slide" transparent>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', padding: 24, justifyContent: 'center' }}>
                        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16 }}>
                            <TextInput
                                placeholder="Add notes here"
                                placeholderTextColor={mode === 'dark' ? '#BDB6FF' : '#6B7280'}
                                multiline
                                value={editorText ?? ''}
                                onChangeText={setEditorText as any}
                                style={{ minHeight: 120, maxHeight: 400, textAlignVertical: 'top', color: colors.text, backgroundColor: colors.uiBackground, borderRadius: 8, padding: 8 }}
                            />
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                <ThemedButton title="Cancel" variant="ghost" onPress={() => setEditorOpen(false)} />
                                <ThemedButton title={saving ? 'Saving…' : 'Save'} onPress={async () => {
                                    if (!id) {
                                        showSnack('Unable to determine video id');
                                        return;
                                    }
                                    setSaving(true)
                                    try {
                                        // convert empty string -> null so DB stores NULL rather than blank
                                        const text = (editorText ?? '').trim() || null
                                        await upsert.mutateAsync({ video_id: id as string, note_text: text })
                                        setEditorOpen(false)
                                        showSnack('Notes saved')
                                    } catch (e) {
                                        console.warn('Failed to save note', e)
                                        showSnack('Failed to save note')
                                    } finally {
                                        setSaving(false)
                                    }
                                }} loading={saving} />
                            </View>
                        </View>
                    </View>
                </Modal>
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
    actionRow: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    completionIcon: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    completionIconText: {
        color: '#fff',
        fontSize: 12,
        lineHeight: 12,
    },
    playerOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8 },
    skelTitle: { height: 20, width: '60%', borderRadius: 6, marginBottom: 8 },
    skelVideo: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, marginTop: 8 },
    skelPill: { height: 28, width: 100, borderRadius: 16 },
    skelLine: { height: 12, borderRadius: 6, marginTop: 8 },
    skelVideoOverlay: { width: '100%', height: '100%', borderRadius: 8 },
})
