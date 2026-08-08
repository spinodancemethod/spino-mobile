import * as SQLite from 'expo-sqlite'

export type LocalSegment = {
    id: string
    videoUploadKey: string
    startTime: number
    endTime: number
    categoryId: string | null
    categoryName: string
    cloudSegmentId: string | null
    syncStatus: 'PENDING' | 'SYNCED'
    updatedAt: string
}

type LocalSegmentRow = {
    id: string
    video_upload_key: string
    start_time: number
    end_time: number
    category_id: string | null
    category_name: string
    cloud_segment_id: string | null
    sync_status: 'PENDING' | 'SYNCED'
    updated_at: string
}

const databasePromise = SQLite.openDatabaseAsync('spino-local-media.db')

async function getDatabase() {
    const database = await databasePromise
    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS local_segments (
            id TEXT PRIMARY KEY NOT NULL,
            video_upload_key TEXT NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            category_id TEXT,
            category_name TEXT NOT NULL DEFAULT 'Misc',
            cloud_segment_id TEXT,
            sync_status TEXT NOT NULL DEFAULT 'PENDING',
            updated_at TEXT NOT NULL
        );
    `)
    return database
}

function mapRow(row: LocalSegmentRow): LocalSegment {
    return {
        id: row.id,
        videoUploadKey: row.video_upload_key,
        startTime: row.start_time,
        endTime: row.end_time,
        categoryId: row.category_id,
        categoryName: row.category_name,
        cloudSegmentId: row.cloud_segment_id,
        syncStatus: row.sync_status,
        updatedAt: row.updated_at,
    }
}

export async function listLocalSegments(videoUploadKey: string): Promise<LocalSegment[]> {
    const database = await getDatabase()
    const rows = await database.getAllAsync<LocalSegmentRow>(
        'SELECT * FROM local_segments WHERE video_upload_key = ? ORDER BY start_time, updated_at',
        videoUploadKey,
    )
    return rows.map(mapRow)
}

export async function saveLocalSegment(segment: LocalSegment): Promise<void> {
    const database = await getDatabase()
    await database.runAsync(
        `
            INSERT OR REPLACE INTO local_segments (
                id, video_upload_key, start_time, end_time, category_id,
                category_name, cloud_segment_id, sync_status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        segment.id,
        segment.videoUploadKey,
        segment.startTime,
        segment.endTime,
        segment.categoryId,
        segment.categoryName,
        segment.cloudSegmentId,
        segment.syncStatus,
        segment.updatedAt,
    )
}

export async function deleteLocalSegment(id: string): Promise<void> {
    const database = await getDatabase()
    await database.runAsync('DELETE FROM local_segments WHERE id = ?', id)
}
