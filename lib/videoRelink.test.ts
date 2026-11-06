import { describe, expect, it } from '@jest/globals'
import { createVideoRelinkUpdate } from './videoRelink'

describe('createVideoRelinkUpdate', () => {
    it('changes only mutable local-reference fields', () => {
        const update = createVideoRelinkUpdate({
            uri: 'file:///new-device/renamed-source.mp4',
            assetId: 'new-device-asset-id',
        })

        expect(update).toEqual(expect.objectContaining({
            fallback_uri: 'file:///new-device/renamed-source.mp4',
            media_identifier: 'new-device-asset-id',
            status: 'AVAILABLE',
        }))
        expect(update).not.toHaveProperty('id')
        expect(update).not.toHaveProperty('original_filename')
        expect(update).not.toHaveProperty('content_hash')
    })
})