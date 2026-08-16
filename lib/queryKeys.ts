import { QueryKey } from '@tanstack/react-query';

export const queryKeys = {
    completedSegmentIds: (userId?: string | null) => ['completedSegmentIds', userId ?? 'current'] as const,
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
