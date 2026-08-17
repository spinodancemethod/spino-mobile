// Compatibility exports for callers that have not migrated to resource-specific hooks yet.
export {
    useVideoCategories,
    useCreateVideoCategory,
    useUpdateVideoCategory,
    useDeleteVideoCategory,
} from './useVideoCategories'
export type { CreateVideoCategoryInput } from './useVideoCategories'

export {
    useVideoSegments,
    useCreateVideoSegment,
    useUpdateVideoSegment,
    useDeleteVideoSegment,
    validateSegmentRange,
} from './useSegments'
export type { CreateSegmentInput, UpdateSegmentInput } from './useSegments'
