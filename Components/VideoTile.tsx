import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import ThemedText from 'Components/ThemedText';
import ThemedPill from 'Components/ThemedPill';
import ThemedLike from 'Components/ThemedLike';
import ThemedStar from 'Components/ThemedStar';
import { useTheme } from 'constants/useTheme';
import { useToggleFavourite } from 'lib/hooks/useToggleFavourite';
import { useToggleDeck } from '../lib/hooks/useToggleDeck';

interface Props {
    // core data
    item: any;

    // action handler
    onPress?: () => void;

    // metadata
    positionName?: string | null;

    // state
    liked?: boolean;
    decked?: boolean;

    // display toggles
    showFavouriteToggle?: boolean;
    showDeckToggle?: boolean;
}

const VideoTile: React.FC<Props> = ({ item, onPress, positionName, liked = false, decked = false, showFavouriteToggle = true, showDeckToggle = true }) => {
    const { colors } = useTheme();
    const toggleFav = useToggleFavourite();
    const toggleDeck = useToggleDeck();

    // render inner content, wrapper chosen based on whether an onPress was provided
    const content = (
        <>
            {/* thumbnail placeholder */}
            <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.uiBackground }} />

            <View style={{ paddingVertical: 8, paddingHorizontal: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ThemedPill color="primary" size="small">{positionName}</ThemedPill>

                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        {showFavouriteToggle ? (
                            <ThemedLike liked={liked} onPress={async () => {
                                try {
                                    await toggleFav.mutateAsync(item.id);
                                } catch (e) {
                                    console.warn('Toggle favourite failed', e);
                                }
                            }} />
                        ) : null}

                        {showDeckToggle ? (
                            <ThemedStar starred={decked} onPress={async () => {
                                try {
                                    await toggleDeck.mutateAsync(item.id);
                                } catch (e) {
                                    console.warn('Toggle deck failed', e);
                                }
                            }} />
                        ) : null}
                    </View>

                </View>

                <ThemedText variant="subheader" style={{ marginTop: 8 }}>{item.title}</ThemedText>
            </View>
        </>
    );

    if (onPress) {
        return (
            <TouchableOpacity
                style={{ width: '100%', marginBottom: 12, borderRadius: 8, overflow: 'hidden' }}
                activeOpacity={1}
                onPress={onPress}
            >
                {content}
            </TouchableOpacity>
        );
    }

    return (
        <View style={{ width: '100%', marginBottom: 12, borderRadius: 8, overflow: 'hidden' }}>
            {content}
        </View>
    );
};

export default VideoTile;
