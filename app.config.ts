import type { ConfigContext, ExpoConfig } from 'expo/config';
import appJson from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => {
    const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? process.env.EAS_PROJECT_ID;
    const staticExpoConfig = appJson.expo as ExpoConfig;

    // Merge static app.json values so app.json remains the source of truth.
    const mergedConfig: ExpoConfig = {
        ...config,
        ...staticExpoConfig,
    };

    // Inject a real EAS updates URL at build time when a project id is provided.
    if (easProjectId) {
        mergedConfig.updates = {
            ...(mergedConfig.updates ?? {}),
            url: `https://u.expo.dev/${easProjectId}`,
        };
    }

    return mergedConfig;
};
