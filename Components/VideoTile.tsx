import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import ThemedText from 'Components/ThemedText';
import ThemedPill from 'Components/ThemedPill';
import ThemedLike from 'Components/ThemedLike';
import ThemedStar from 'Components/ThemedStar';
import { useTheme } from 'constants/useTheme';
import { useToggleFavourite } from 'lib/hooks/useToggleFavourite';

interface Props {
    item: any;
    positionName?: string | null;
    liked?: boolean;
    onPress?: () => void;
}

const VideoTile: React.FC<Props> = ({ item, positionName, liked = false, onPress }) => {
    const { colors } = useTheme();
    const toggleFav = useToggleFavourite();

    return (
        <TouchableOpacity
            style={{ width: '100%', marginBottom: 12, borderRadius: 8, overflow: 'hidden' }}
            activeOpacity={1}
            onPress={onPress}
        >
            {/* thumbnail placeholder */}
            <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.uiBackground }} />

            <View style={{ paddingVertical: 8, paddingHorizontal: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ThemedPill color="primary" size="small">{positionName}</ThemedPill>

                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <ThemedLike liked={liked} onPress={async () => {
                            try {
                                await toggleFav.mutateAsync(item.id);
                            } catch (e) {
                                console.warn('Toggle favourite failed', e);
                            }
                        }} />
                        <ThemedStar starred={true} />
                    </View>

                </View>

                <ThemedText variant="subheader" style={{ marginTop: 8 }}>{item.title}</ThemedText>
            </View>
        </TouchableOpacity>
    );
};

export default VideoTile;
