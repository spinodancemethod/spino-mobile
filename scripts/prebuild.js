#!/usr/bin/env node
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const platformIndex = args.indexOf('--platform');
const platform = platformIndex !== -1 ? args[platformIndex + 1] : null;

const platformFlag = platform ? `--platform ${platform}` : '';

execSync(`npx expo prebuild --no-install ${platformFlag}`, { stdio: 'inherit' });

if (!platform || platform === 'android') {
    execSync('node scripts/clean-manifest.js', { stdio: 'inherit' });
}
