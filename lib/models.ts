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
