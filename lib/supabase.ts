import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/*
    Supabase client wrapper for React Native / Expo.

    Notes:
    - We install the expo-sqlite localStorage implementation so the Supabase JS client
        can persist auth sessions on React Native.
    - Environment variables (EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
        should be provided via your Expo environment configuration.
    - The auth options enable automatic token refresh and persistent sessions.
*/
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const authStorageKey = 'spino-mobile.supabase.auth-token';
const SECURE_STORE_CHUNK_SIZE = 1900;
const CHUNK_PREFIX = '__spino_chunked_v1__:';

type ChunkMarker = {
    chunkCount: number;
};

function getChunkKey(key: string, index: number) {
    return `${key}.chunk.${index}`;
}

function toChunkMarker(chunkCount: number) {
    return `${CHUNK_PREFIX}${JSON.stringify({ chunkCount } satisfies ChunkMarker)}`;
}

function parseChunkMarker(value: string | null) {
    if (!value || !value.startsWith(CHUNK_PREFIX)) {
        return null;
    }

    try {
        const parsed = JSON.parse(value.slice(CHUNK_PREFIX.length)) as ChunkMarker;
        if (!Number.isInteger(parsed.chunkCount) || parsed.chunkCount < 1) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

async function removeSecureStoreChunks(key: string, chunkCount: number) {
    const deletes: Promise<void>[] = [];
    for (let i = 0; i < chunkCount; i += 1) {
        deletes.push(SecureStore.deleteItemAsync(getChunkKey(key, i)));
    }

    await Promise.all(deletes);
}

const secureStoreStorage = {
    // Supabase calls these methods to persist/restore the auth session.
    getItem: async (key: string) => {
        const storedValue = await SecureStore.getItemAsync(key);
        const chunkMarker = parseChunkMarker(storedValue);
        if (!chunkMarker) {
            return storedValue;
        }

        const chunkReads: Promise<string | null>[] = [];
        for (let i = 0; i < chunkMarker.chunkCount; i += 1) {
            chunkReads.push(SecureStore.getItemAsync(getChunkKey(key, i)));
        }

        const chunks = await Promise.all(chunkReads);
        if (chunks.some((chunk) => chunk == null)) {
            // Corrupted chunk state: clear all keys and let Supabase re-auth cleanly.
            await removeSecureStoreChunks(key, chunkMarker.chunkCount);
            await SecureStore.deleteItemAsync(key);
            return null;
        }

        return chunks.join('');
    },
    setItem: async (key: string, value: string) => {
        const existingMarker = parseChunkMarker(await SecureStore.getItemAsync(key));
        if (existingMarker) {
            await removeSecureStoreChunks(key, existingMarker.chunkCount);
        }

        if (value.length <= SECURE_STORE_CHUNK_SIZE) {
            await SecureStore.setItemAsync(key, value);
            return;
        }

        const chunkCount = Math.ceil(value.length / SECURE_STORE_CHUNK_SIZE);
        const writes: Promise<void>[] = [];

        for (let i = 0; i < chunkCount; i += 1) {
            const start = i * SECURE_STORE_CHUNK_SIZE;
            const end = start + SECURE_STORE_CHUNK_SIZE;
            writes.push(SecureStore.setItemAsync(getChunkKey(key, i), value.slice(start, end)));
        }

        await Promise.all(writes);
        await SecureStore.setItemAsync(key, toChunkMarker(chunkCount));
    },
    removeItem: async (key: string) => {
        const chunkMarker = parseChunkMarker(await SecureStore.getItemAsync(key));
        if (chunkMarker) {
            await removeSecureStoreChunks(key, chunkMarker.chunkCount);
        }

        await SecureStore.deleteItemAsync(key);
    },
};

const webStorage = {
    // Web builds should use browser storage; Expo SecureStore can be unavailable
    // depending on runtime and throws native-module shape errors.
    getItem: async (key: string) => {
        if (typeof globalThis.localStorage === 'undefined') {
            return null;
        }

        return globalThis.localStorage.getItem(key);
    },
    setItem: async (key: string, value: string) => {
        if (typeof globalThis.localStorage === 'undefined') {
            return;
        }

        globalThis.localStorage.setItem(key, value);
    },
    removeItem: async (key: string) => {
        if (typeof globalThis.localStorage === 'undefined') {
            return;
        }

        globalThis.localStorage.removeItem(key);
    },
};

const authStorage = Platform.OS === 'web' ? webStorage : secureStoreStorage;

if (!supabaseUrl || !supabaseAnonKey) {
    // helpful dev-time warning; harmless in production if you set envs properly
    // eslint-disable-next-line no-console
    console.warn('[supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: authStorage,
        storageKey: authStorageKey,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})