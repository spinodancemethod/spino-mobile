import Constants from 'expo-constants'

type RuntimeExtra = {
    supabaseUrl?: unknown
    supabasePublishableKey?: unknown
}

type ConstantsWithLegacyManifest = typeof Constants & {
    manifest?: { extra?: RuntimeExtra } | null
    manifest2?: { extra?: RuntimeExtra } | null
}

function getRuntimeExtra(): RuntimeExtra {
    const constants = Constants as ConstantsWithLegacyManifest
    return constants.expoConfig?.extra
        ?? constants.manifest2?.extra
        ?? constants.manifest?.extra
        ?? {}
}

export function getSupabaseRuntimeConfig() {
    const extra = getRuntimeExtra()
    const environmentUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? ''
    const environmentKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
    const runtimeUrl = typeof extra.supabaseUrl === 'string' ? extra.supabaseUrl.trim() : ''
    const runtimeKey = typeof extra.supabasePublishableKey === 'string' ? extra.supabasePublishableKey.trim() : ''
    return {
        url: environmentUrl || runtimeUrl,
        publishableKey: environmentKey || runtimeKey,
        urlSource: environmentUrl ? 'environment' : runtimeUrl ? 'expo-runtime-extra' : 'missing',
        keySource: environmentKey ? 'environment' : runtimeKey ? 'expo-runtime-extra' : 'missing',
    }
}
