import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import 'expo-sqlite/localStorage/install';

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

if (!supabaseUrl || !supabaseAnonKey) {
    // helpful dev-time warning; harmless in production if you set envs properly
    // eslint-disable-next-line no-console
    console.warn('[supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})