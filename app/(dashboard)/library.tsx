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

const Library = () => {
    const { data: positions = [], isLoading } = usePositions(undefined);
    const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

    // Mock videos to test scrolling and layout (enough items)
    const mockVideos = Array.from({ length: 24 }).map((_, i) => ({
        id: `video-${i + 1}`,
        title: `Video ${i + 1}`,
        duration: `${Math.floor(Math.random() * 10) + 1}:${(Math.floor(Math.random() * 60)).toString().padStart(2, '0')}`,
    }));

    useEffect(() => {
        if (selected) {
            console.log('Selected position:', selected);
        }
    }, [selected]);

    const numColumns = 1;
    const GAP = 12;
    const HORIZONTAL_PADDING = 10;

    const { colors } = useTheme();

    const renderTile = ({ item, index }: { item: typeof mockVideos[number]; index: number }) => (
        <TouchableOpacity
            style={{ width: '100%', marginBottom: GAP, borderRadius: 8, overflow: 'hidden' }}
            activeOpacity={0.8}
            onPress={() => console.log('Tapped', item.id)}
        >
            <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.uiBackground }} />

            <View style={{ paddingVertical: 8, paddingHorizontal: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ThemedPill color="primary" size="small">In Progress</ThemedPill>
                    <ThemedText variant="small">{item.duration}</ThemedText>
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

            {/* Grid of mock videos. Placed after header so it scrolls independently. */}
            <FlatList
                style={{ flex: 1 }}
                data={mockVideos}
                keyExtractor={(i) => i.id}
                renderItem={renderTile}
                numColumns={numColumns}
                contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 12, paddingBottom: 32 }}
                showsVerticalScrollIndicator={true}
            />
        </ThemedView>
    );
};

export default Library;