import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { router } from 'expo-router/build/exports'
import { useEffect, useState } from 'react'
import ThemedFilter from 'Components/ThemedFilter'
import { usePositions } from '@/lib/hooks/usePositions'
import { View, FlatList } from 'react-native'
import VideoTile from 'Components/VideoTile'
import { useVideos } from '@/lib/hooks/useVideos'
import { useFavouritesByUser } from 'lib/hooks/useFavouritesByUser'
import { useDeckByUser } from '@/lib/hooks/useDeckByUser'

const Library = () => {
    const { data: positions = [] } = usePositions(undefined);
    const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

    const { data: videosData = [] } = useVideos(selected ? { positionId: selected.id } : undefined);
    const { data: favouriteIds = [] } = useFavouritesByUser();
    const { data: deckIds = [] } = useDeckByUser();

    const videos = videosData;


    const getPosition = (id: string) => {
        return positions.find((position: any) => position.id === id) || null;
    };

    useEffect(() => {
        if (selected) {
            console.log('Selected position:', selected);
        }
    }, [selected]);

    const numColumns = 1;
    const HORIZONTAL_PADDING = 10;

    const renderTile = ({ item }: { item: any }) => (
        <VideoTile
            item={item}
            positionName={getPosition(item.position_id)?.name}
            liked={favouriteIds.includes(item.id)}
            decked={deckIds.includes(item.id)}
            onPress={() => console.log('Tapped', item.id)}
        />
    );

    return (
        <ThemedView style={{ flex: 1, alignItems: 'stretch' }}>
            {/* Fixed header area: Back, Title, spacer */}
            <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 8 }}>
                <ThemedButton title="Back" onPress={() => router.push('/')} style={{ minWidth: 88 }} />
                <ThemedText variant="title">Library</ThemedText>
                <View style={{ width: 88 }} />
            </View>

            {/* Position selector stays below header and remains visible above list */}
            <View style={{ paddingHorizontal: 8, paddingTop: 12 }}>
                <ThemedFilter selected={selected} setSelected={setSelected} items={positions} />
            </View>

            {/* Grid of videos from the DB. Placed after header so it scrolls independently. */}
            {!selected ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
                    <ThemedText variant="large">We have categorized videos based on position. This allows you to build optionality when dancing so you can remember variations easily and use them to express yourself in the moment rather than being limited by a prescribed routine.</ThemedText>
                </View>
            ) : (
                <FlatList
                    style={{ flex: 1 }}
                    data={videos}
                    keyExtractor={(i) => i.id}
                    renderItem={renderTile}
                    extraData={{ favouriteIds, deckIds }}
                    numColumns={numColumns}
                    contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 12, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={true}
                />
            )}
        </ThemedView>
    );
};

export default Library;