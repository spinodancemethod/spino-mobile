import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { useFavouritesByUser } from 'lib/hooks/useFavouritesByUser'
import { usePositions } from 'lib/hooks/usePositions'
import { useVideosByIds } from 'lib/hooks/useVideosByIds'
import VideoTile from 'Components/VideoTile'
import { FlatList, ActivityIndicator } from 'react-native'
import { useDeckByUser } from '@/lib/hooks/useDeckByUser'
import { useEffect, useState } from 'react'


const Favourites = () => {
    // Get favourite ids for current (or dev) user
    const { data: favIds = [] } = useFavouritesByUser();
    const { data: deckIds = [] } = useDeckByUser();

    // Load positions cache so we can resolve position names for each video
    const { data: positions = [] } = usePositions(undefined);

    const getPosition = (id: string) => {
        return positions.find((p: any) => p.id === id) || null;
    };

    // Fetch videos that match those ids using the new hook
    const { data: videos = [], isLoading } = useVideosByIds(favIds);

    // Keep a local copy of the last non-empty videos list so we avoid
    // showing an empty list while React Query refetches. When the videos
    // result becomes empty (e.g. optimistic deletion), filter the last
    // cached videos by the current favIds so removed items disappear but
    // the page doesn't flash away.
    const [lastVideos, setLastVideos] = useState<any[]>([]);
    useEffect(() => {
        if (videos && videos.length > 0) setLastVideos(videos);
    }, [videos]);

    const displayedVideos = (videos && videos.length > 0)
        ? videos
        : lastVideos.filter((v) => favIds.includes(v.id));

    const loading = isLoading && displayedVideos.length === 0;

    return (
        <ThemedView style={{ flex: 1 }}>
            <ThemedText variant="title" style={{ padding: 12 }}>
                Favourites
            </ThemedText>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 24 }} />
            ) : (
                <FlatList
                    data={displayedVideos}
                    keyExtractor={(i: any) => i.id}
                    renderItem={({ item }) => (
                        <VideoTile
                            item={item}
                            positionName={getPosition(item.position_id)?.name}
                            liked={favIds.includes(item.id)}
                            decked={deckIds.includes(item.id)}
                        />
                    )}
                    extraData={{ favIds, deckIds, displayedVideos }}
                    contentContainerStyle={{ padding: 12 }}
                    ListEmptyComponent={() => (
                        <ThemedView style={{ padding: 12 }}>
                            <ThemedText>No favourites yet.</ThemedText>
                        </ThemedView>
                    )}
                />
            )}
        </ThemedView>
    )
}

export default Favourites