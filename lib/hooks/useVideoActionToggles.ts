import { useCallback, useMemo } from 'react'
import { useDeckByUser } from './useDeckByUser'
import { useFavouritesByUser } from './useFavouritesByUser'
import { useCompletedVideoIdsByUser } from './useCompletedVideoIdsByUser'
import { useToggleDeck } from './useToggleDeck'
import { useToggleFavourite } from './useToggleFavourite'
import { useToggleVideoCompletion } from './useToggleVideoCompletion'
import { showSnack } from 'lib/snackbarService'

export function useVideoActionToggles() {
    const { data: favouriteIds = [] } = useFavouritesByUser()
    const { data: deckIds = [] } = useDeckByUser()
    const { data: completedVideoIds = [] } = useCompletedVideoIdsByUser()
    const toggleFavourite = useToggleFavourite()
    const toggleDeck = useToggleDeck()
    const toggleVideoCompletion = useToggleVideoCompletion()

    const favouriteIdSet = useMemo(() => new Set(favouriteIds), [favouriteIds])
    const deckIdSet = useMemo(() => new Set(deckIds), [deckIds])
    const completedVideoIdSet = useMemo(() => new Set(completedVideoIds), [completedVideoIds])

    const toggleFavouriteWithFeedback = useCallback(async (videoId: string) => {
        try {
            const result = await toggleFavourite.mutateAsync(videoId)
            showSnack(result?.action === 'deleted' ? 'Removed from favourites' : 'Added to favourites', {
                actionTitle: 'Undo',
                onAction: async () => {
                    try {
                        await toggleFavourite.mutateAsync(videoId)
                    } catch (_error) {
                        // ignore undo failures in the snackbar callback
                    }
                },
            })
        } catch (error) {
            console.warn('Toggle favourite failed', error)
            showSnack('Failed to update favourites.')
        }
    }, [toggleFavourite])

    const toggleDeckWithFeedback = useCallback(async (videoId: string) => {
        try {
            const result = await toggleDeck.mutateAsync(videoId)
            showSnack(result?.action === 'deleted' ? 'Removed from deck' : 'Added to deck', {
                actionTitle: 'Undo',
                onAction: async () => {
                    try {
                        await toggleDeck.mutateAsync(videoId)
                    } catch (_error) {
                        // ignore undo failures in the snackbar callback
                    }
                },
            })
        } catch (error) {
            console.warn('Toggle deck failed', error)
            showSnack('Failed to update deck.')
        }
    }, [toggleDeck])

    const toggleCompletionWithFeedback = useCallback(async (videoId: string, isComplete: boolean) => {
        try {
            await toggleVideoCompletion.mutateAsync({ videoId, isComplete })
            showSnack(isComplete ? 'Marked as in progress.' : 'Marked as complete.')
        } catch (error) {
            console.warn('Failed to update video completion', error)
            showSnack('Failed to update video progress.')
        }
    }, [toggleVideoCompletion])

    return {
        favouriteIdSet,
        deckIdSet,
        completedVideoIdSet,
        isFavouritePending: toggleFavourite.isPending,
        isDeckPending: toggleDeck.isPending,
        isCompletionPending: toggleVideoCompletion.isPending,
        toggleFavouriteWithFeedback,
        toggleDeckWithFeedback,
        toggleCompletionWithFeedback,
    }
}