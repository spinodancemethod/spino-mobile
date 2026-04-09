export type AccessTier = 'free' | 'paid' | string;

export type VideoRecord = {
    id: string;
    position_id?: string | null;
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
    name: string;
    title?: string | null;
    description?: string | null;
    category?: string | null;
    access_tier?: AccessTier | null;
    roadmap_preview_url?: string | null;
    created_at?: string | null;
    [key: string]: unknown;
};

export type VideoIdRow = {
    video_id: string;
};
