import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import ThemedButton from 'Components/ThemedButton'
import { useEffect, useState } from 'react'
import ThemedFilter from 'Components/ThemedFilter'
import { usePositions } from '@/lib/hooks/usePositions'
import { LEVELS } from 'constants/Levels'
import { View, FlatList, Modal, TouchableOpacity, StyleSheet } from 'react-native'
import VideoTile from 'Components/VideoTile'
import { router, useLocalSearchParams } from 'expo-router'
import { useVideos } from '@/lib/hooks/useVideos'
import { useFavouritesByUser } from 'lib/hooks/useFavouritesByUser'
import { useDeckByUser } from '@/lib/hooks/useDeckByUser'
import { useEntitlement } from 'lib/hooks/useEntitlement'
import { useAuth } from 'lib/auth'
import { useTheme } from 'constants/useTheme'
import { Ionicons } from '@expo/vector-icons'
import { reportAppEvent } from 'lib/observability'

const Library = () => {
    const params = useLocalSearchParams<{ positionId?: string | string[]; positionName?: string | string[] }>()
    const { isSubscribed } = useEntitlement()
    const { user } = useAuth()
    const { colors } = useTheme()
    // Controls the subscribe prompt shown when a free user taps a locked tile.
    const [lockModalVisible, setLockModalVisible] = useState(false)
    const { data: positions = [] } = usePositions(undefined);
    const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

    const selectedPositionIdFromRoute = Array.isArray(params.positionId) ? params.positionId[0] : params.positionId
    const selectedPositionNameFromRoute = Array.isArray(params.positionName) ? params.positionName[0] : params.positionName

    // Library shows regular videos only; position videos live in the Positions tab.
    const { data: videosData = [] } = useVideos(selected ? { positionId: selected.id, isPosition: false } : undefined);
    const { data: favouriteIds = [] } = useFavouritesByUser();
    const { data: deckIds = [] } = useDeckByUser();

    // Defense in depth: even if stale client cache still contains premium rows,
    // free users only render free-tier videos.
    const videos = isSubscribed
        ? videosData
        : videosData.filter((video: any) => video?.access_tier === 'free');

    // Level filter (client-side). 5 levels
    // using shared LEVELS constant
    const [selectedLevel, setSelectedLevel] = useState<{ id: string; name: string; value: number } | null>(null);
    const filteredVideos = videos.filter((v: any) => !selectedLevel || v.level === selectedLevel.value || selectedLevel.id === 'all')

    useEffect(() => {
        if (!selectedPositionIdFromRoute) return
        if (!positions.length) return

        const matchedPosition = positions.find((position: any) => String(position.id) === String(selectedPositionIdFromRoute))

        if (matchedPosition) {
            const nextSelected = {
                id: String(matchedPosition.id),
                name: matchedPosition.name || matchedPosition.title || selectedPositionNameFromRoute || 'Position',
            }

            // Tab screens stay mounted, so re-apply when route params change.
            if (!selected || selected.id !== nextSelected.id) {
                setSelected(nextSelected)
            }
        }
    }, [positions, selectedPositionIdFromRoute, selectedPositionNameFromRoute, selected]);


    const getPosition = (id: string) => {
        return positions.find((position: any) => position.id === id) || null;
    };

    const numColumns = 1;

    const renderTile = ({ item }: { item: any }) => {
        // Free-tier users cannot play paid videos — show a lock overlay instead.
        const isLocked = !isSubscribed && item.access_tier === 'paid'
        return (
            <View style={{ position: 'relative' }}>
                <VideoTile
                    item={item}
                    positionName={getPosition(item.position_id)?.name}
                    liked={favouriteIds.includes(item.id)}
                    decked={deckIds.includes(item.id)}
                    // Tapping a locked tile is handled by the overlay below, not this handler.
                    onPress={isLocked ? undefined : () => router.push(`/video/${item.id}`)}
                />
                {isLocked && (
                    // Absolute overlay covers the entire tile and intercepts taps.
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                            void reportAppEvent({
                                event: 'locked_content_tap',
                                userId: user?.id,
                                metadata: {
                                    screen: 'library',
                                    videoId: item?.id ?? null,
                                    positionId: item?.position_id ?? null,
                                },
                            })
                            setLockModalVisible(true)
                        }}
                        style={tileStyles.lockOverlay}
                    >
                        <View style={tileStyles.lockBadge}>
                            <Ionicons name="lock-closed" size={16} color="#fff" />
                            <ThemedText style={tileStyles.lockLabel}>Premium</ThemedText>
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        )
    };

    return (
        <ThemedView>
            {/* Fixed header area: Back, Title, spacer */}
            <ThemedText variant="title" style={{ padding: 12 }}>
                Library
            </ThemedText>

            {/* Filter row: Position selector + Level selector */}
            <View style={{ paddingHorizontal: 8, paddingTop: 12, flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                    <ThemedFilter placeholder="Select a position" selected={selected} setSelected={setSelected} items={positions} />
                </View>
                <View style={{ width: 140 }}>
                    <ThemedFilter placeholder="Filter by level" selected={selectedLevel as any} setSelected={setSelectedLevel as any} items={LEVELS as any} />
                </View>
            </View>

            {/* Grid of videos from the DB. Placed after header so it scrolls independently. */}
            {!selected ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
                    <ThemedText variant="large">We have categorized videos based on position. This allows you to build optionality when dancing so you can remember variations easily and use them to express yourself in the moment rather than being limited by a prescribed routine.</ThemedText>
                </View>
            ) : filteredVideos.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
                    <Ionicons name="videocam-off-outline" size={34} color={colors.primary} style={{ marginBottom: 10 }} />
                    <ThemedText variant="subheader" style={{ textAlign: 'center' }}>No videos found for this selection.</ThemedText>
                </View>
            ) : (
                <FlatList
                    style={{ flex: 1, width: '100%' }}
                    data={filteredVideos}
                    keyExtractor={(i) => i.id}
                    renderItem={renderTile}
                    // Add explicit vertical separation so each tile reads as its own card.
                    ItemSeparatorComponent={() => <View style={{ height: 30 }} />}
                    numColumns={numColumns}
                    contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
            {/* Upsell modal shown when a free user taps a locked video tile. */}
            <Modal visible={lockModalVisible} transparent animationType="fade">
                <View style={tileStyles.modalBackdrop}>
                    <View style={[tileStyles.modalCard, { backgroundColor: colors.card }]}>
                        <Ionicons name="lock-closed" size={40} color={colors.primary} style={{ marginBottom: 16 }} />
                        <ThemedText variant="title" style={{ textAlign: 'center', marginBottom: 10 }}>
                            Premium Content
                        </ThemedText>
                        <ThemedText style={{ textAlign: 'center', marginBottom: 24, opacity: 0.65 }}>
                            Subscribe to unlock all videos and build your full roadmap.
                        </ThemedText>
                        <ThemedButton
                            title="Subscribe to unlock"
                            onPress={() => {
                                void reportAppEvent({
                                    event: 'locked_screen_subscribe_cta_press',
                                    userId: user?.id,
                                    metadata: {
                                        screen: 'library_locked_modal',
                                    },
                                })
                                setLockModalVisible(false)
                                router.push('/subscribe')
                            }}
                            style={{ width: '100%', marginBottom: 10 }}
                        />
                        <ThemedButton
                            title="Maybe later"
                            variant="ghost"
                            onPress={() => setLockModalVisible(false)}
                            style={{ width: '100%' }}
                        />
                    </View>
                </View>
            </Modal>
        </ThemedView>
    );
};

const tileStyles = StyleSheet.create({
    lockOverlay: {
        // Covers the full tile so the entire area is tappable.
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        padding: 10,
    },
    lockBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    lockLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    modalCard: {
        width: '100%',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
})

export default Library;