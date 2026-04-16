import { QueryKey } from '@tanstack/react-query';

export type PositionsParams = {
    position?: string | null;
    search?: string;
};

export type VideosParams = {
    positionId?: string | null;
    isPosition?: boolean;
};

export const queryKeys = {
    videosByIdsRoot: () => ['videosByIds'] as const,
    videosByIds: (ids?: string[] | null) => ['videosByIds', ids ?? []] as const,
    positions: (params?: PositionsParams) => ['positions', params ?? null] as const,
    position: (id?: string | null) => ['position', id ?? null] as const,
    videos: (params?: VideosParams) => ['videos', params ?? null] as const,
    freeTierVideos: () => ['videos', 'free-tier'] as const,
    visibleVideos: () => ['videos', 'visible'] as const,
    favourites: (userId?: string | null) => ['favourites', userId ?? null] as const,
    deck: (userId?: string | null) => ['deck', userId ?? null] as const,
    video: (id?: string | null) => ['video', id ?? null] as const,
    completedVideoIds: (userId?: string | null) => ['completedVideoIds', userId ?? 'current'] as const,
    note: (userId?: string | null, videoId?: string | null) => ['note', userId ?? null, videoId ?? null] as const,
};

export function isQueryKeyEqual(a: QueryKey, b: QueryKey) {
    return JSON.stringify(a) === JSON.stringify(b);
}
