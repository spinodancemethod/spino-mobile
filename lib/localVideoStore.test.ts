import { describe, expect, it, jest } from '@jest/globals'
import { persistPickedVideo, removePersistedVideo, toPortableUri, toRuntimeUri } from './localVideoStore'

const docs = 'file:///container-A/Documents/'

describe('portable document URIs', () => {
    it('round-trips a documents path across container changes', () => {
        const portable = toPortableUri(`${docs}local-videos/x.mp4`, docs)
        expect(portable).toBe('appdocs://local-videos/x.mp4')
        expect(toRuntimeUri(portable, 'file:///container-B/Documents/')).toBe('file:///container-B/Documents/local-videos/x.mp4')
    })

    it('leaves cache and media-library URIs untouched', () => {
        expect(toPortableUri('file:///cache/ImagePicker/x.mov', docs)).toBe('file:///cache/ImagePicker/x.mov')
        expect(toRuntimeUri('file:///cache/ImagePicker/x.mov', docs)).toBe('file:///cache/ImagePicker/x.mov')
    })
})

function fakeFs() {
    return {
        documentDirectory: docs,
        getInfoAsync: jest.fn(async (_uri: string) => ({ exists: false })),
        makeDirectoryAsync: jest.fn(async (_uri: string, _options?: { intermediates?: boolean }) => undefined),
        copyAsync: jest.fn(async (_options: { from: string; to: string }) => undefined),
        deleteAsync: jest.fn(async (_uri: string, _options?: { idempotent?: boolean }) => undefined),
    }
}

describe('persistPickedVideo', () => {
    it('does not copy when a media-library asset id is available', async () => {
        const fs = fakeFs()
        const result = await persistPickedVideo({ uri: 'file:///cache/a.mov', assetId: 'asset-1', fileName: 'a.mov' }, fs)
        expect(result.runtimeUri).toBe('file:///cache/a.mov')
        expect(fs.copyAsync).not.toHaveBeenCalled()
    })

    it('copies into documents when no asset id is available', async () => {
        const fs = fakeFs()
        const result = await persistPickedVideo({ uri: 'file:///cache/a.mov', assetId: null, fileName: 'My Clip.MOV', key: 'k1' }, fs)
        expect(result.runtimeUri).toBe(`${docs}local-videos/k1.mov`)
        expect(fs.makeDirectoryAsync).toHaveBeenCalled()
        expect(fs.copyAsync).toHaveBeenCalledWith({ from: 'file:///cache/a.mov', to: `${docs}local-videos/k1.mov` })
        expect(toPortableUri(result.runtimeUri, docs)).toBe('appdocs://local-videos/k1.mov')
    })
})

describe('removePersistedVideo', () => {
    it('only deletes documents copies', async () => {
        const fs = fakeFs()
        await removePersistedVideo('file:///cache/a.mov', fs)
        expect(fs.deleteAsync).not.toHaveBeenCalled()
        await removePersistedVideo('appdocs://local-videos/k1.mov', fs)
        expect(fs.deleteAsync).toHaveBeenCalledWith(`${docs}local-videos/k1.mov`, { idempotent: true })
    })
})
