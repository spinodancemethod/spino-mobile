import Spacer from 'Components/Spacer'
import ThemedButton from 'Components/ThemedButton'
import ThemedPill from 'Components/ThemedPill'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { router } from 'expo-router'
import { useDeckByUser } from 'lib/hooks/useDeckByUser'
import { useVideosByIds } from 'lib/hooks/useVideosByIds'
import VideoTile from 'Components/VideoTile'
import { FlatList, ActivityIndicator } from 'react-native'
import { usePositions } from 'lib/hooks/usePositions'
import { useEffect, useState } from 'react'

const InProgress = () => {
    // deck ids for current (or dev) user
    const { data: deckIds = [], isLoading: isDeckLoading } = useDeckByUser();

    // preload positions for name resolution
    const { data: positions = [] } = usePositions(undefined);

    const getPosition = (id: string) => {
        return positions.find((p: any) => p.id === id) || null;
    };

    // fetch videos that are in the deck
    const { data: videos = [], isLoading: isVideosLoading } = useVideosByIds(deckIds);

    // Keep a local copy of the last non-empty videos list so we can avoid
    // showing a blank/loader during background refetches. When the videos
    // result becomes empty (e.g. optimistic deletion), we filter the last
    // cached videos by the current deckIds so removed items disappear but
    // the page doesn't flash away.
    const [lastVideos, setLastVideos] = useState<any[]>([]);
    useEffect(() => {
        if (videos && videos.length > 0) setLastVideos(videos);
    }, [videos]);

    const displayedVideos = (videos && videos.length > 0)
        ? videos
        : lastVideos.filter((v) => deckIds.includes(v.id));

    // Only treat as a full loading screen when there is no data yet. This
    // prevents brief full-screen flashes when toggling deck entries which
    // trigger background refetches but we still have previous data to display.
    const loading = (isDeckLoading || isVideosLoading) && displayedVideos.length === 0;

    return (
        <ThemedView style={{ flex: 1 }}>
            <ThemedText variant="title" style={{ padding: 12 }}>
                In Progress
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
                            showDeckToggle={true}
                            decked={deckIds.includes(item.id)}
                            showFavouriteToggle={false}
                        />
                    )}
                    contentContainerStyle={{ padding: 12 }}
                    ListEmptyComponent={() => (
                        <ThemedView style={{ padding: 12 }}>
                            <ThemedText>No classes saved yet. Add some to your deck.</ThemedText>
                        </ThemedView>
                    )}
                />
            )}

            <Spacer />
            <ThemedText>
                There will be a maximum of 3 saved classes for free users.
            </ThemedText>
            <ThemedButton
                title="Home"
                onPress={() => {
                    router.push('/');
                }}
                style={{ width: "100%" }}
            />

        </ThemedView>
    )
}

export default InProgress