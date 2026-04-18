import React from 'react'
import { Modal, Pressable, StyleSheet, TextStyle, View } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import ThemedLike from 'Components/ThemedLike'
import ThemedText from 'Components/ThemedText'
import { RoadmapPosition, SelectedRoadmapVideo } from './types'

type RoadmapModalsProps = {
    styles: any;
    mode: 'dark' | 'light';
    colors: {
        card: string;
        title: string;
        text: string;
        primary: string;
    };
    selectedPos: RoadmapPosition | null;
    selectedVideo: SelectedRoadmapVideo | null;
    selectedVideoIsFavourite: boolean;
    selectedVideoIsComplete: boolean;
    isFavouritePending: boolean;
    isCompletionPending: boolean;
    videoNavColor: string;
    sampleGifUrl: string;
    onClosePositionModal: () => void;
    onCloseVideoModal: () => void;
    onToggleFavourite: (videoId: string) => void;
    onToggleCompletion: (videoId: string, isComplete: boolean) => void;
    onOpenVideo: (videoId: string) => void;
}

export function RoadmapModals({
    styles,
    mode,
    colors,
    selectedPos,
    selectedVideo,
    selectedVideoIsFavourite,
    selectedVideoIsComplete,
    isFavouritePending,
    isCompletionPending,
    videoNavColor,
    sampleGifUrl,
    onClosePositionModal,
    onCloseVideoModal,
    onToggleFavourite,
    onToggleCompletion,
    onOpenVideo,
}: RoadmapModalsProps) {
    const modalTitleTextStyle = StyleSheet.flatten(styles.modalTitleText) as TextStyle
    const modalBodyTextStyle = StyleSheet.flatten(styles.modalBodyText) as TextStyle
    const modalPositionTextStyle = StyleSheet.flatten(styles.modalPositionText) as TextStyle

    return (
        <>
            <Modal visible={selectedPos != null} transparent animationType="fade" onRequestClose={onClosePositionModal}>
                <Pressable style={styles.modalBackdrop} onPress={onClosePositionModal}>
                    <View style={[styles.modalContainer, { backgroundColor: mode === 'dark' ? colors.card : styles.modalContainer.backgroundColor }]}>
                        <ThemedText
                            variant="title"
                            style={{ ...modalTitleTextStyle, marginBottom: 8, color: mode === 'dark' ? colors.title : modalTitleTextStyle.color }}
                        >
                            {selectedPos?.name || selectedPos?.title || 'Position'}
                        </ThemedText>
                        <ThemedText
                            variant="subheader"
                            style={{ ...modalBodyTextStyle, marginBottom: 16, color: mode === 'dark' ? colors.text : modalBodyTextStyle.color }}
                        >
                            {selectedPos?.description || 'No description available.'}
                        </ThemedText>
                        <Pressable
                            onPress={onClosePositionModal}
                            style={[styles.modalCloseBtn, { backgroundColor: mode === 'dark' ? colors.primary : styles.modalCloseBtn.backgroundColor }]}
                        >
                            <ThemedText style={{ color: '#fff' }}>Close</ThemedText>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            <Modal visible={selectedVideo != null} transparent animationType="fade" onRequestClose={onCloseVideoModal}>
                <Pressable style={styles.modalBackdrop} onPress={onCloseVideoModal}>
                    <View style={[styles.modalContainer, { backgroundColor: mode === 'dark' ? colors.card : styles.modalContainer.backgroundColor }]}>
                        <Pressable
                            onPress={onCloseVideoModal}
                            hitSlop={8}
                            style={styles.modalDismissIcon}
                        >
                            <Ionicons name="close-circle" size={22} color={mode === 'dark' ? colors.text : '#111827'} />
                        </Pressable>

                        <ThemedText
                            variant="title"
                            style={{ ...modalTitleTextStyle, marginBottom: 8, color: mode === 'dark' ? colors.title : modalTitleTextStyle.color }}
                        >
                            {selectedVideo?.video?.title || (selectedVideo ? `Video ${selectedVideo.index + 1}` : '')}
                        </ThemedText>
                        <ThemedText
                            variant="subheader"
                            style={{
                                ...modalBodyTextStyle,
                                ...modalPositionTextStyle,
                                marginBottom: 16,
                                color: mode === 'dark' ? colors.text : modalBodyTextStyle.color,
                            }}
                        >
                            {selectedVideo?.pos?.name || 'No position'}
                        </ThemedText>

                        <ExpoImage
                            source={{ uri: selectedVideo?.video?.roadmap_gif_url ?? sampleGifUrl }}
                            style={styles.modalGifPreview}
                            contentFit="cover"
                            autoplay
                        />

                        <View style={styles.modalActionRow}>
                            <View style={styles.modalActionGroup}>
                                <ThemedLike
                                    liked={selectedVideoIsFavourite}
                                    size={22}
                                    onPress={() => {
                                        if (!selectedVideo?.video?.id || isFavouritePending) return
                                        onToggleFavourite(selectedVideo.video.id)
                                    }}
                                />
                                <Pressable
                                    onPress={() => {
                                        if (!selectedVideo?.video?.id || isCompletionPending) return
                                        onToggleCompletion(selectedVideo.video.id, selectedVideoIsComplete)
                                    }}
                                    disabled={!selectedVideo?.video?.id || isCompletionPending}
                                    hitSlop={8}
                                    style={[
                                        styles.modalCompletionIcon,
                                        {
                                            backgroundColor: selectedVideoIsComplete ? '#16a34a' : '#94a3b8',
                                            opacity: (!selectedVideo?.video?.id || isCompletionPending) ? 0.6 : 1,
                                        },
                                    ]}
                                >
                                    <ThemedText style={styles.modalCompletionText}>✓</ThemedText>
                                </Pressable>
                            </View>
                            <Pressable
                                onPress={() => {
                                    if (!selectedVideo?.video?.id) return
                                    onOpenVideo(selectedVideo.video.id)
                                }}
                                disabled={!selectedVideo?.video?.id}
                                hitSlop={8}
                                style={[
                                    styles.modalVideoLink,
                                    { opacity: selectedVideo?.video?.id ? 1 : 0.6 },
                                ]}
                            >
                                <Ionicons name="videocam" size={22} color={videoNavColor} />
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </>
    )
}
