import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { useFavouritesByUser } from 'lib/hooks/useFavouritesByUser'
import { usePositions } from 'lib/hooks/usePositions'
import { useVideosByIds } from 'lib/hooks/useVideosByIds'
import VideoTile from 'Components/VideoTile'
import { FlatList } from 'react-native'


const Favourites = () => {
    // Get favourite ids for current (or dev) user
    const { data: favIds = [] } = useFavouritesByUser();

    // Load positions cache so we can resolve position names for each video
    const { data: positions = [] } = usePositions(undefined);

    const getPosition = (id: string) => {
        return positions.find((p: any) => p.id === id) || null;
    };

    // Fetch videos that match those ids using the new hook
    const { data: videos = [], isLoading } = useVideosByIds(favIds);

    return (
        <ThemedView style={{ flex: 1 }}>
            <ThemedText variant="title" style={{ padding: 12 }}>
                Favourites
            </ThemedText>

            <FlatList
                data={videos}
                keyExtractor={(i: any) => i.id}
                renderItem={({ item }) => (
                    <VideoTile
                        item={item}
                        positionName={getPosition(item.position_id)?.name}
                        liked={true}
                    />
                )}
                contentContainerStyle={{ padding: 12 }}
            />
        </ThemedView>
    )
}

export default Favourites