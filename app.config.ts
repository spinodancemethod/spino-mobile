import appJson from './app.json';

const expoConfig: any = appJson.expo;
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? process.env.EAS_PROJECT_ID;

// Keep app.json source-of-truth while injecting a real EAS updates URL at build time.
if (easProjectId) {
    expoConfig.updates = {
        ...(expoConfig.updates ?? {}),
        url: `https://u.expo.dev/${easProjectId}`,
    };
}

export default {
    expo: expoConfig,
};
