#!/usr/bin/env node
/**
 * Runs after expo prebuild and strips permissions that require a privacy policy
 * but are not actually used by this app.
 */
const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');

console.log('clean-manifest: MANIFEST_PATH =', MANIFEST_PATH);

const PERMISSIONS_TO_REMOVE = [
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
];

try {
    if (!fs.existsSync(MANIFEST_PATH)) {
        console.error('clean-manifest: AndroidManifest.xml not found at', MANIFEST_PATH);
        process.exit(1);
    }

    let xml = fs.readFileSync(MANIFEST_PATH, 'utf8');

    for (const permission of PERMISSIONS_TO_REMOVE) {
        // Matches the full uses-permission line regardless of attribute order or self-closing style
        const pattern = new RegExp(
            `\\s*<uses-permission[^>]*android:name="${permission.replace(/\./g, '\\.')}[^>]*/?>\\s*`,
            'g'
        );
        xml = xml.replace(pattern, '\n');
    }

    // Collapse multiple blank lines left by removals
    xml = xml.replace(/\n{3,}/g, '\n\n');

    fs.writeFileSync(MANIFEST_PATH, xml, 'utf8');

    console.log('clean-manifest: removed sensitive permissions from AndroidManifest.xml');
} catch (error) {
    console.error('clean-manifest: error:', error.message);
    process.exit(1);
}
