import * as SQLite from 'expo-sqlite'

export type LocalCategory = {
    id: string
    cloudCategoryId: string | null
    name: string
    systemCategory: boolean
    syncStatus: 'PENDING' | 'SYNCED'
    updatedAt: string
}

type LocalCategoryRow = {
    id: string
    cloud_category_id: string | null
    name: string
    system_category: number
    sync_status: 'PENDING' | 'SYNCED'
    updated_at: string
}

const databasePromise = SQLite.openDatabaseAsync('spino-local-media.db')

async function getDatabase() {
    const database = await databasePromise
    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS local_categories (
            id TEXT PRIMARY KEY NOT NULL,
            cloud_category_id TEXT,
            name TEXT NOT NULL,
            system_category INTEGER NOT NULL DEFAULT 0,
            sync_status TEXT NOT NULL DEFAULT 'PENDING',
            updated_at TEXT NOT NULL
        );
    `)
    return database
}

function mapRow(row: LocalCategoryRow): LocalCategory {
    return {
        id: row.id,
        cloudCategoryId: row.cloud_category_id,
        name: row.name,
        systemCategory: row.system_category === 1,
        syncStatus: row.sync_status,
        updatedAt: row.updated_at,
    }
}

export async function listLocalCategories(): Promise<LocalCategory[]> {
    const database = await getDatabase()
    const rows = await database.getAllAsync<LocalCategoryRow>('SELECT * FROM local_categories ORDER BY system_category DESC, name')
    return rows.map(mapRow)
}

export async function saveLocalCategory(category: LocalCategory): Promise<void> {
    const database = await getDatabase()
    await database.runAsync(
        `
            INSERT OR REPLACE INTO local_categories (
                id, cloud_category_id, name, system_category, sync_status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        category.id,
        category.cloudCategoryId,
        category.name,
        category.systemCategory ? 1 : 0,
        category.syncStatus,
        category.updatedAt,
    )
}
