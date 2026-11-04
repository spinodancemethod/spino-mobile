import { describe, expect, it } from '@jest/globals'
import { resolveVideoAsset } from './videoAssetResolver'

describe('resolveVideoAsset', () => {
    it('returns the local URI when the stored reference is accessible', async () => {
        await expect(resolveVideoAsset(
            { fallback_uri: 'file:///videos/original.mp4' },
            async () => ({ exists: true }),
        )).resolves.toEqual({ status: 'AVAILABLE', uri: 'file:///videos/original.mp4' })
    })

    it('requires relinking when no local reference is stored', async () => {
        await expect(resolveVideoAsset(
            { fallback_uri: null },
            async () => ({ exists: true }),
        )).resolves.toEqual({ status: 'NEEDS_RELINK', uri: null })
    })

    it('requires relinking when the local file has disappeared', async () => {
        await expect(resolveVideoAsset(
            { fallback_uri: 'file:///videos/missing.mp4' },
            async () => ({ exists: false }),
        )).resolves.toEqual({ status: 'NEEDS_RELINK', uri: null })
    })

    it('requires relinking instead of throwing when the local file cannot be accessed', async () => {
        await expect(resolveVideoAsset(
            { fallback_uri: 'file:///videos/restricted.mp4' },
            async () => { throw new Error('Access denied') },
        )).resolves.toEqual({ status: 'NEEDS_RELINK', uri: null })
    })
})
describe('resolveVideoAsset with media-library asset ids', () => {
    const exists = (available: string[]) => async (uri: string) => ({ exists: available.includes(uri) })

    it('prefers the current media-library location over a purged cache path', async () => {
        await expect(resolveVideoAsset(
            { media_identifier: 'asset-1', fallback_uri: 'file:///cache/ImagePicker/old.mov' },
            {
                getFileInfo: exists(['file:///var/mobile/Media/DCIM/100APPLE/IMG_0001.MOV']),
                getAssetLocalUri: async () => 'file:///var/mobile/Media/DCIM/100APPLE/IMG_0001.MOV',
            },
        )).resolves.toEqual({ status: 'AVAILABLE', uri: 'file:///var/mobile/Media/DCIM/100APPLE/IMG_0001.MOV' })
    })

    it('falls back to the stored path when the asset lookup fails', async () => {
        await expect(resolveVideoAsset(
            { media_identifier: 'asset-1', fallback_uri: 'file:///cache/ImagePicker/still-there.mov' },
            {
                getFileInfo: exists(['file:///cache/ImagePicker/still-there.mov']),
                getAssetLocalUri: async () => { throw new Error('asset deleted') },
            },
        )).resolves.toEqual({ status: 'AVAILABLE', uri: 'file:///cache/ImagePicker/still-there.mov' })
    })

    it('rewrites a portable documents path to the current container', async () => {
        await expect(resolveVideoAsset(
            { media_identifier: null, fallback_uri: 'appdocs://local-videos/abc.mp4' },
            {
                getFileInfo: exists(['file:///new-container/Documents/local-videos/abc.mp4']),
                documentDirectory: 'file:///new-container/Documents/',
            },
        )).resolves.toEqual({ status: 'AVAILABLE', uri: 'file:///new-container/Documents/local-videos/abc.mp4' })
    })

    it('needs relink when neither the asset nor the stored path is accessible', async () => {
        await expect(resolveVideoAsset(
            { media_identifier: 'asset-1', fallback_uri: 'appdocs://local-videos/abc.mp4' },
            {
                getFileInfo: exists([]),
                getAssetLocalUri: async () => null,
                documentDirectory: 'file:///docs/',
            },
        )).resolves.toEqual({ status: 'NEEDS_RELINK', uri: null })
    })
})
