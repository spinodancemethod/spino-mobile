#!/bin/bash
set -e

echo "Running prebuild..."
npx expo prebuild --no-install --platform android

echo "Cleaning manifest..."
node scripts/clean-manifest.js

echo "Prebuild complete."