import { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

// Regression: `roadmapSegments()` with no args yields ['roadmapSegments', null, null], which does
// NOT prefix-match a real roadmap query key. Invalidation must use `roadmapSegmentsRoot()`.
describe('roadmap segment query keys', () => {
    it('roadmapSegmentsRoot invalidates every roadmap segments query', async () => {
        const client = new QueryClient()
        client.setQueryData(queryKeys.roadmapSegments('r1', 'u1'), [])
        await client.invalidateQueries({ queryKey: queryKeys.roadmapSegmentsRoot() })
        expect(client.getQueryState(queryKeys.roadmapSegments('r1', 'u1'))?.isInvalidated).toBe(true)
    })

    it('roadmapSegments() with no args is not a usable prefix', async () => {
        const client = new QueryClient()
        client.setQueryData(queryKeys.roadmapSegments('r1', 'u1'), [])
        await client.invalidateQueries({ queryKey: queryKeys.roadmapSegments() })
        expect(client.getQueryState(queryKeys.roadmapSegments('r1', 'u1'))?.isInvalidated).toBe(false)
    })
})
