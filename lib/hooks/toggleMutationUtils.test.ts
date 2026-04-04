import { computeNextToggledIds } from './toggleMutationUtils';

describe('computeNextToggledIds', () => {
    it('adds item when not present', () => {
        const { exists, next } = computeNextToggledIds(['a', 'b'], 'c');
        expect(exists).toBe(false);
        expect(next).toEqual(['a', 'b', 'c']);
    });

    it('removes item when present', () => {
        const { exists, next } = computeNextToggledIds(['a', 'b', 'c'], 'b');
        expect(exists).toBe(true);
        expect(next).toEqual(['a', 'c']);
    });
});
