import React from 'react';
import ThemedView from 'Components/ThemedView';
import ThemedText from 'Components/ThemedText';
import VideoTile from 'Components/VideoTile';
import { FlatList, ActivityIndicator } from 'react-native';
import { usePositions } from 'lib/hooks/usePositions';

const PositionList = () => {
    const { data: positions = [], isLoading } = usePositions(undefined);

    if (isLoading && positions.length === 0) {
        return (
            <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator />
            </ThemedView>
        );
    }

    return (
        <ThemedView>
            <ThemedText variant="title" style={{ padding: 12 }}>Position List</ThemedText>

            <FlatList
                style={{ flex: 1, width: '100%' }}
                data={positions}
                keyExtractor={(p: any) => p.id}
                renderItem={({ item }: { item: any }) => (
                    // This screen lists available positions as lightweight rows.
                    <VideoTile
                        item={{ id: `pos-${item.id}`, title: item.name }}
                        positionName={item.name}
                        showFavouriteToggle={false}
                        showDeckToggle={false}
                    />
                )}
                contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            />
        </ThemedView>
    );
};

export default PositionList;
