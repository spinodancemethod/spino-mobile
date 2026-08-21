import Constants from 'expo-constants'
import { Platform } from 'react-native'

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

export function getSupabaseConfigDiagnostics() {
    const config = getSupabaseRuntimeConfig()
    let host: string | null = null
    try {
        host = config.url ? new URL(config.url).host : null
    } catch {
        host = 'invalid-url'
    }

    return {
        urlSource: config.urlSource,
        keySource: config.keySource,
        urlPresent: Boolean(config.url),
        keyPresent: Boolean(config.publishableKey),
        keyLength: config.publishableKey.length,
        host,
        platform: Platform.OS,
        appOwnership: Constants.appOwnership ?? Constants.executionEnvironment ?? 'unknown',
        runtimeVersion: typeof Constants.expoConfig?.runtimeVersion === 'string'
            ? Constants.expoConfig.runtimeVersion
            : Constants.expoConfig?.runtimeVersion
                ? JSON.stringify(Constants.expoConfig.runtimeVersion)
                : null,
    }
}