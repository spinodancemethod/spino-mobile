import { describe, expect, it, jest } from '@jest/globals'
import { retryTransientAuthNetworkFailure } from './authNetworkRetry'

describe('retryTransientAuthNetworkFailure', () => {
    it('retries a transient native network failure', async () => {
        const operation = jest
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(new TypeError('Network request failed'))
            .mockResolvedValueOnce('signed-in')

        await expect(retryTransientAuthNetworkFailure(operation)).resolves.toBe('signed-in')
        expect(operation).toHaveBeenCalledTimes(2)
    })

    it('does not retry an authentication error', async () => {
        const operation = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('Invalid login credentials'))

        await expect(retryTransientAuthNetworkFailure(operation)).rejects.toThrow('Invalid login credentials')
        expect(operation).toHaveBeenCalledTimes(1)
    })
})