import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { useEffect } from 'react'
import ThemedFilter from 'Components/ThemedFilter'
import { usePositions } from '@/lib/hooks/usePositions'
import { View } from 'react-native'
import { FlatList } from 'react-native'
import VideoTile from 'Components/VideoTile'
import { router } from 'expo-router'
import { useVideos } from '@/lib/hooks/useVideos'
import { useFavouritesByUser } from 'lib/hooks/useFavouritesByUser'
import { useDeckByUser } from '@/lib/hooks/useDeckByUser'
import { useState } from 'react'

const Library = () => {
    const { data: positions = [] } = usePositions(undefined);
    const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

    const { data: videosData = [] } = useVideos(selected ? { positionId: selected.id } : undefined);
    const { data: favouriteIds = [] } = useFavouritesByUser();
    const { data: deckIds = [] } = useDeckByUser();

    const videos = videosData;

    // Level filter (client-side). 5 levels
    const LEVELS = [
        { id: 'all', name: 'All levels', value: 0 },
        { id: 'beginner', name: 'Beginner', value: 1 },
        { id: 'improver', name: 'Improver', value: 2 },
        { id: 'improver_plus', name: 'Improver +', value: 3 },
        { id: 'intermediate', name: 'Intermediate', value: 4 },
        { id: 'advance', name: 'Advance', value: 5 },
    ];
    const [selectedLevel, setSelectedLevel] = useState<{ id: string; name: string; value: number } | null>(null);


    const getPosition = (id: string) => {
        return positions.find((position: any) => position.id === id) || null;
    };

    useEffect(() => {
        if (selected) {
            console.log('Selected position:', selected);
        }
    }, [selected]);

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
                    numColumns={numColumns}
                    contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </ThemedView>
    );
};

export default Library;