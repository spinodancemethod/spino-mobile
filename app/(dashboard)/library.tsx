import ThemedButton from 'Components/ThemedButton'
import ThemedText from 'Components/ThemedText'
import ThemedView from 'Components/ThemedView'
import { router } from 'expo-router/build/exports'
import { useEffect, useState } from 'react'
import ThemedFilter from 'Components/ThemedFilter'
import { usePositions } from '@/lib/hooks/usePositions'
import { View, FlatList, TouchableOpacity } from 'react-native'
import { useTheme } from 'constants/useTheme'
import ThemedPill from 'Components/ThemedPill'
import ThemedLike from 'Components/ThemedLike'
import ThemedStar from 'Components/ThemedStar'
import { useVideos } from '@/lib/hooks/useVideos'

const Library = () => {
    const { data: positions = [], isLoading } = usePositions(undefined);
    const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

    const { data: videosData = [], isLoading: videosLoading } = useVideos(selected ? { positionId: selected.id } : undefined);
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
    const GAP = 12;
    const HORIZONTAL_PADDING = 10;

    const { colors } = useTheme();

    const renderTile = ({ item, index }: { item: any; index: number }) => (
        <TouchableOpacity
            style={{ width: '100%', marginBottom: GAP, borderRadius: 8, overflow: 'hidden' }}
            activeOpacity={1}
            onPress={() => console.log('Tapped', item.id)}
        >
            <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.uiBackground }} />

            <View style={{ paddingVertical: 8, paddingHorizontal: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ThemedPill color="primary" size="small">{getPosition(item.position_id)?.name}</ThemedPill>

                    <ThemedLike liked={false} />
                    <ThemedStar starred={true} />

                </View>

                <ThemedText variant="subheader" style={{ marginTop: 8 }}>{item.title}</ThemedText>
            </View>
        </TouchableOpacity>
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
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ThemedText variant="large">Please select a position</ThemedText>
                </View>
            ) : (
                <FlatList
                    style={{ flex: 1 }}
                    data={videos}
                    keyExtractor={(i) => i.id}
                    renderItem={renderTile}
                    numColumns={numColumns}
                    contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 12, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={true}
                />
            )}
        </ThemedView>
    );
};

export default Library;