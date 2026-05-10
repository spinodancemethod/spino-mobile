const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS_TO_REMOVE = [
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
];

module.exports = function withRemovedPermissions(config) {
    return withAndroidManifest(config, (mod) => {
        const manifest = mod.modResults.manifest;
        const before = (manifest['uses-permission'] ?? []).map(p => p.$['android:name']);
        manifest['uses-permission'] = (manifest['uses-permission'] ?? []).filter(
            (p) => !PERMISSIONS_TO_REMOVE.includes(p.$['android:name'])
        );
        const after = (manifest['uses-permission'] ?? []).map(p => p.$['android:name']);
        console.log('PLUGIN before:', before);
        console.log('PLUGIN after:', after);
        return mod;
    });
};
