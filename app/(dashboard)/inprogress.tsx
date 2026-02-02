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

    const loading = isDeckLoading || isVideosLoading;

    return (
        <ThemedView style={{ flex: 1 }}>
            <ThemedText variant="title" style={{ padding: 12 }}>
                In Progress
            </ThemedText>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 24 }} />
            ) : (
                <FlatList
                    data={videos}
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
                    extraData={{ deckIds }}
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