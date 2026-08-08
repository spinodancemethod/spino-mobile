import * as SQLite from 'expo-sqlite'

export type LocalVideoStatus = 'AVAILABLE' | 'MISSING' | 'ACCESS_DENIED' | 'UNKNOWN'

export type LocalVideoUpload = {
    id: string
    assetId: string | null
    uri: string
    fileName: string | null
    mimeType: string | null
    duration: number | null
    fileSize: number | null
    width: number | null
    height: number | null
    creationTime: number | null
    rangeStart: number
    rangeEnd: number
    status: LocalVideoStatus
    updatedAt: string
}

type LocalVideoRow = {
    id: string
    asset_id: string | null
    uri: string
    file_name: string | null
    mime_type: string | null
    duration: number | null
    file_size: number | null
    width: number | null
    height: number | null
    creation_time: number | null
    range_start: number
    range_end: number
    status: LocalVideoStatus
    updated_at: string
}

const databasePromise = SQLite.openDatabaseAsync('spino-local-media.db')

async function getDatabase() {
    const database = await databasePromise
    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS local_video_uploads (
            id TEXT PRIMARY KEY NOT NULL,
            asset_id TEXT,
            uri TEXT NOT NULL,
            file_name TEXT,
            mime_type TEXT,
            duration REAL,
            file_size INTEGER,
            width INTEGER,
            height INTEGER,
            creation_time INTEGER,
            range_start REAL NOT NULL DEFAULT 0,
            range_end REAL NOT NULL DEFAULT 10,
            status TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    `)
    const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(local_video_uploads)')
    if (!columns.some((column) => column.name === 'range_start')) {
        await database.execAsync('ALTER TABLE local_video_uploads ADD COLUMN range_start REAL NOT NULL DEFAULT 0')
    }
    if (!columns.some((column) => column.name === 'range_end')) {
        await database.execAsync('ALTER TABLE local_video_uploads ADD COLUMN range_end REAL NOT NULL DEFAULT 10')
    }
    return database
}

function mapRow(row: LocalVideoRow): LocalVideoUpload {
    return {
        id: row.id,
        assetId: row.asset_id,
        uri: row.uri,
        fileName: row.file_name,
        mimeType: row.mime_type,
        duration: row.duration,
        fileSize: row.file_size,
        width: row.width,
        height: row.height,
        creationTime: row.creation_time,
        rangeStart: row.range_start,
        rangeEnd: row.range_end,
        status: row.status,
        updatedAt: row.updated_at,
    }
}

export async function listLocalVideoUploads(): Promise<LocalVideoUpload[]> {
    const database = await getDatabase()
    const rows = await database.getAllAsync<LocalVideoRow>(
        'SELECT * FROM local_video_uploads ORDER BY updated_at DESC',
    )
    return rows.map(mapRow)
}

export async function saveLocalVideoUpload(video: LocalVideoUpload): Promise<void> {
    const database = await getDatabase()
    await database.runAsync(
        `
            INSERT OR REPLACE INTO local_video_uploads (
                id, asset_id, uri, file_name, mime_type, duration, file_size,
                width, height, creation_time, range_start, range_end, status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        video.id,
        video.assetId,
        video.uri,
        video.fileName,
        video.mimeType,
        video.duration,
        video.fileSize,
        video.width,
        video.height,
        video.creationTime,
        video.rangeStart,
        video.rangeEnd,
        video.status,
        video.updatedAt,
    )
}

export async function deleteLocalVideoUpload(id: string): Promise<void> {
    const database = await getDatabase()
    await database.runAsync('DELETE FROM local_video_uploads WHERE id = ?', id)
}
