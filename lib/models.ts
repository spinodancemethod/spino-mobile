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
    // Captured once at import; relinking must not overwrite it with a renamed local file.
    original_filename?: string | null;
    // SHA-256 of the source video, unavailable for pre-recovery legacy records.
    content_hash?: string | null;
    custom_title?: string | null;
    duration_seconds?: number | null;
    mime_type?: string | null;
    file_size_bytes?: number | null;
    width?: number | null;
    height?: number | null;
    creation_time?: string | null;
    thumbnail_reference?: string | null;
    status: 'AVAILABLE' | 'MISSING' | 'ACCESS_DENIED' | 'UNKNOWN';
    replacement_review_pending: boolean;
    // Fable v2: audio-only analysis result. The video itself never leaves the phone.
    analysis_status?: AnalysisStatus;
    analysis_mode?: AnalysisMode | null;
    count_grid?: CountGrid | null;
    analysed_at?: string | null;
    created_at: string;
    updated_at: string;
};

export type AnalysisStatus = 'none' | 'queued' | 'processing' | 'ready' | 'failed';
export type AnalysisMode = 'counting' | 'music' | 'none';

/** Count grid produced by the worker (Fable_Master_Spec_v2.md §3). All times in seconds. */
export type CountGrid = {
    mode: AnalysisMode;
    confidence: number;
    count_period_s: number | null;
    /** Start of each 8-count. Detected in counting mode; a guess in music mode. */
    count1_times: number[];
    /** Every 4 counts. */
    bar_times: number[];
    /** Every count. */
    beat_times: number[];
    /** Instructor talking rather than counting; shaded in the builder, still selectable. */
    speech_spans: [number, number][];
    /** Music mode: which bar is "1" is unknown until the user taps one. */
    ambiguous_1_vs_5: boolean;
    duration_s: number;
};

export type AnalysisJobRecord = {
    id: string;
    user_id: string;
    video_upload_id: string;
    audio_path: string;
    duration_seconds: number | null;
    status: 'queued' | 'processing' | 'done' | 'failed';
    attempts: number;
    error: string | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
};
export type LocalVideoStatus = 'AVAILABLE' | 'MISSING' | 'ACCESS_DENIED' | 'NEEDS_RELINK' | 'UNKNOWN';

export type LocalVideoUpload = {
    id: string;
    assetId: string | null;
    uri: string;
    fileName: string | null;
    originalFilename?: string | null;
    contentHash?: string | null;
    segmentCount?: number;
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
    // Fable v2: set when the category was created from the position library (stable id across renames)
    position_slug?: string | null;
    sort_order?: number | null;
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
    thumbnail_reference: string | null;
    user_notes: string | null;
    ai_confidence: number | null;
    ai_generated: boolean;
    user_confirmed: boolean;
    created_at: string;
    updated_at: string;
};
