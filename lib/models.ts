export type AccessTier = 'free' | 'paid' | string;

export type VideoRecord = {
    id: string;
    position_id?: string | null;
    is_position?: boolean | null;
    title?: string | null;
    description?: string | null;
    thumbnail_url?: string | null;
    access_tier?: AccessTier | null;
    roadmap_preview_url?: string | null;
    roadmap_gif_url?: string | null;
    created_at?: string | null;
    [key: string]: unknown;
};

export type PositionRecord = {
    id: string;
    order?: number | null;
    name: string;
    title?: string | null;
    description?: string | null;
    has_videos?: boolean | null;
    category?: string | null;
    access_tier?: AccessTier | null;
    roadmap_preview_url?: string | null;
    created_at?: string | null;
    [key: string]: unknown;
};

export type VideoIdRow = {
    video_id: string;
};

export type VideoUploadRecord = {
    id: string;
    user_id: string;
    local_reference_key: string;
    roadmap_id: string;
    platform: string;
    media_identifier?: string | null;
    fallback_uri?: string | null;
    name?: string | null;
    filename?: string | null;
    duration_seconds?: number | null;
    mime_type?: string | null;
    file_size_bytes?: number | null;
    width?: number | null;
    height?: number | null;
    creation_time?: string | null;
    thumbnail_reference?: string | null;
    status: 'AVAILABLE' | 'MISSING' | 'ACCESS_DENIED' | 'UNKNOWN';
    replacement_review_pending: boolean;
    created_at: string;
    updated_at: string;
};

export type LocalVideoStatus = 'AVAILABLE' | 'MISSING' | 'ACCESS_DENIED' | 'UNKNOWN';

export type LocalVideoUpload = {
    id: string;
    assetId: string | null;
    uri: string;
    fileName: string | null;
    mimeType: string | null;
    duration: number | null;
    fileSize: number | null;
    width: number | null;
    height: number | null;
    creationTime: number | null;
    rangeStart: number;
    rangeEnd: number;
    thumbnailReference: string | null;
    status: LocalVideoStatus;
    updatedAt: string;
};

export type VideoCategoryRecord = {
    id: string;
    user_id: string | null;
    roadmap_id: string;
    name: string;
    description: string | null;
    system_category: boolean;
    created_at: string;
    updated_at: string;
};

export type SegmentRecord = {
    id: string;
    user_id: string;
    video_upload_id: string;
    sequence: number | null;
    start_time: number;
    end_time: number;
    count_start: number | null;
    count_end: number | null;
    category_id: string;
    title: string | null;
    description: string | null;
    thumbnail_reference: string | null;
    user_notes: string | null;
    ai_confidence: number | null;
    ai_generated: boolean;
    user_confirmed: boolean;
    created_at: string;
    updated_at: string;
};

export type CreateVideoPayload = {
    title: string;
    description?: string | null;
    position_id: string;
    user_id: string;
    dance_type?: 'salsa' | 'bachata' | null;
    dance_style?: string | null;
    level?: number | null;
    access_tier: AccessTier;
    is_position?: boolean;
    file_path?: string | null;
    url?: string | null;
    thumbnail_url?: string | null;
    roadmap_preview_url?: string | null;
    roadmap_gif_url?: string | null;
};
