import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import ThemedText from 'Components/ThemedText';
import ThemedPill from 'Components/ThemedPill';
import { getLevelInfo } from 'constants/Levels';
import ThemedLike from 'Components/ThemedLike';
import ThemedStar from 'Components/ThemedStar';
import { useTheme } from 'constants/useTheme';
import { useQueryClient } from '@tanstack/react-query';
import { DECK_LIMIT } from 'constants/Config';
import { showSnack } from 'lib/snackbarService';
import { useToggleFavourite } from 'lib/hooks/useToggleFavourite';
import { useToggleDeck } from '../lib/hooks/useToggleDeck';
import { useAuth } from 'lib/auth';

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
    const { user } = useAuth();
    const toggleFav = useToggleFavourite();
    const toggleDeck = useToggleDeck();
    const qc = useQueryClient();
    const deckKey = ['deck', user?.id ?? null];
    const FREE_LIMIT = DECK_LIMIT;

    // render inner content, wrapper chosen based on whether an onPress was provided
    const content = (
        <>
            {/* thumbnail placeholder */}
            <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.uiBackground }} />

            <View style={{ paddingVertical: 8, paddingHorizontal: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* level pill (left) */}
                        {typeof item?.level === 'number' ? (
                            (() => {
                                const lvl = item.level as number;
                                const info = getLevelInfo(lvl) || { label: String(lvl), color: '#8B5CF6' };
                                return <ThemedPill color={info.color} size="small">{info.label}</ThemedPill>;
                            })()
                        ) : null}

                        <ThemedPill color="primary" size="small">{positionName}</ThemedPill>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        {showFavouriteToggle ? (
                            <ThemedLike liked={liked} onPress={async () => {
                                try {
                                    const res = await toggleFav.mutateAsync(item.id);
                                    // show undo snack
                                    showSnack(res?.action === 'deleted' ? 'Removed from favourites' : 'Added to favourites', {
                                        actionTitle: 'Undo',
                                        onAction: async () => {
                                            try { await toggleFav.mutateAsync(item.id); } catch (e) { /* ignore */ }
                                        }
                                    });
                                } catch (e) {
                                    console.warn('Toggle favourite failed', e);
                                }
                            }} />
                        ) : null}

                        {showDeckToggle ? (
                            <ThemedStar starred={decked} onPress={async () => {
                                try {
                                    // client-side pre-check for free limit
                                    const currentDeck: string[] = qc.getQueryData(deckKey) || [];
                                    const isAlready = currentDeck.includes(item.id);
                                    if (!isAlready && currentDeck.length >= FREE_LIMIT) {
                                        showSnack('The deck is full. Focus on mastering those.', { duration: 3000 });
                                        return;
                                    }

                                    const res = await toggleDeck.mutateAsync(item.id);
                                    showSnack(res?.action === 'deleted' ? 'Removed from deck' : 'Added to deck', {
                                        actionTitle: 'Undo',
                                        onAction: async () => {
                                            try { await toggleDeck.mutateAsync(item.id); } catch (e) { /* ignore */ }
                                        }
                                    });
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
