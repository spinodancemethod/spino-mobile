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