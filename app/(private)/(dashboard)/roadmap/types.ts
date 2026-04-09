export type RoadmapPosition = {
    id: string;
    name?: string | null;
    title?: string | null;
    description?: string | null;
    roadmap_preview_url?: string | null;
}

export type RoadmapVideo = {
    id?: string | null;
    title?: string | null;
    position_id?: string | null;
    roadmap_preview_url?: string | null;
    roadmap_gif_url?: string | null;
}

export type SelectedRoadmapVideo = {
    pos: RoadmapPosition;
    index: number;
    video: RoadmapVideo;
}