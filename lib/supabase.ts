import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
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

const secureStoreStorage = {
    // Supabase calls these methods to persist/restore the auth session.
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

if (!supabaseUrl || !supabaseAnonKey) {
    // helpful dev-time warning; harmless in production if you set envs properly
    // eslint-disable-next-line no-console
    console.warn('[supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: secureStoreStorage,
        storageKey: authStorageKey,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})