import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { useEffect } from 'react'
import ThemedFilter from 'Components/ThemedFilter'
import { usePositions } from '@/lib/hooks/usePositions'
import { LEVELS } from 'constants/Levels'
import { View } from 'react-native'
import { FlatList } from 'react-native'
import VideoTile from 'Components/VideoTile'
import { router, useLocalSearchParams } from 'expo-router'
import { useVideos } from '@/lib/hooks/useVideos'
import { useFavouritesByUser } from 'lib/hooks/useFavouritesByUser'
import { useDeckByUser } from '@/lib/hooks/useDeckByUser'
import { useState } from 'react'
import { useRef } from 'react'

const Library = () => {
    const params = useLocalSearchParams<{ positionId?: string | string[]; positionName?: string | string[] }>()
    const { data: positions = [] } = usePositions(undefined);
    const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
    const hasAppliedRoutePosition = useRef(false)

    const selectedPositionIdFromRoute = Array.isArray(params.positionId) ? params.positionId[0] : params.positionId
    const selectedPositionNameFromRoute = Array.isArray(params.positionName) ? params.positionName[0] : params.positionName

    const { data: videosData = [] } = useVideos(selected ? { positionId: selected.id } : undefined);
    const { data: favouriteIds = [] } = useFavouritesByUser();
    const { data: deckIds = [] } = useDeckByUser();

    const videos = videosData;

    // Level filter (client-side). 5 levels
    // using shared LEVELS constant
    const [selectedLevel, setSelectedLevel] = useState<{ id: string; name: string; value: number } | null>(null);

    useEffect(() => {
        if (hasAppliedRoutePosition.current) return

        if (!selectedPositionIdFromRoute) {
            hasAppliedRoutePosition.current = true
            return
        }

        if (!positions.length) return

        const matchedPosition = positions.find((position: any) => position.id === selectedPositionIdFromRoute)

        if (matchedPosition) {
            // Prefill the position filter when navigating from roadmap empty cards.
            setSelected({
                id: matchedPosition.id,
                name: matchedPosition.name || matchedPosition.title || selectedPositionNameFromRoute || 'Position',
            })
        }

        hasAppliedRoutePosition.current = true
    }, [positions, selectedPositionIdFromRoute, selectedPositionNameFromRoute]);


    const getPosition = (id: string) => {
        return positions.find((position: any) => position.id === id) || null;
    };

    const numColumns = 1;

    const renderTile = ({ item }: { item: any }) => (
        <VideoTile
            item={item}
            positionName={getPosition(item.position_id)?.name}
            liked={favouriteIds.includes(item.id)}
            decked={deckIds.includes(item.id)}
            onPress={() => router.push(`/video/${item.id}`)}
        />
    );

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
            ) : (
                <FlatList
                    style={{ flex: 1, width: '100%' }}
                    data={videos.filter((v: any) => !selectedLevel || v.level === selectedLevel.value || selectedLevel.id === 'all')}
                    keyExtractor={(i) => i.id}
                    renderItem={renderTile}
                    // Add explicit vertical separation so each tile reads as its own card.
                    ItemSeparatorComponent={() => <View style={{ height: 30 }} />}
                    numColumns={numColumns}
                    contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </ThemedView>
    );
};

export default Library;