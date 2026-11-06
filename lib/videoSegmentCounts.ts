type VideoSegmentReference = {
    video_upload_id: string
}

export function countSegmentsByVideoUpload(rows: VideoSegmentReference[]): Record<string, number> {
    return rows.reduce<Record<string, number>>((counts, row) => {
        counts[row.video_upload_id] = (counts[row.video_upload_id] ?? 0) + 1
        return counts
    }, {})
}