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
    completedSegmentIds: (userId?: string | null) => ['completedSegmentIds', userId ?? 'current'] as const,
    note: (userId?: string | null, videoId?: string | null) => ['note', userId ?? null, videoId ?? null] as const,
    signedVideoUrl: (filePath?: string | null) => ['signedVideoUrl', filePath ?? null] as const,
    videoUploads: (userId?: string | null) => ['videoUploads', userId ?? null] as const,
    videoCategories: (userId?: string | null, roadmapId?: string | null) => ['videoCategories', userId ?? null, roadmapId ?? null] as const,
    segments: (userId?: string | null, videoUploadId?: string | null) => ['segments', userId ?? null, videoUploadId ?? null] as const,
    userRoadmaps: (userId?: string | null) => ['userRoadmaps', userId ?? null] as const,
    videoUpload: (id?: string | null, userId?: string | null) => ['videoUpload', id ?? null, userId ?? null] as const,
    videoUploadNote: (id?: string | null, userId?: string | null) => ['videoUploadNote', id ?? null, userId ?? null] as const,
    roadmapSegments: (roadmapId?: string | null, userId?: string | null) => ['roadmapSegments', roadmapId ?? null, userId ?? null] as const,
};

export function isQueryKeyEqual(a: QueryKey, b: QueryKey) {
    return JSON.stringify(a) === JSON.stringify(b);
}
