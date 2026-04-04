import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'lib/auth';
import { supabase } from 'lib/supabase';
import { entitlementQueryKey, useEntitlement } from './useEntitlement';

jest.mock('@tanstack/react-query', () => ({
    useQuery: jest.fn(),
}));

jest.mock('lib/auth', () => ({
    useAuth: jest.fn(),
}));

jest.mock('lib/supabase', () => ({
    supabase: {
        rpc: jest.fn(),
    },
}));

describe('useEntitlement', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns paid plan tier when subscription RPC resolves true', async () => {
        const mockUseAuth = useAuth as jest.Mock;
        const mockUseQuery = useQuery as jest.Mock;
        const mockRpc = supabase.rpc as jest.Mock;

        mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });

        let capturedQueryOptions: any;
        mockUseQuery.mockImplementation((options: any) => {
            capturedQueryOptions = options;
            return { data: true, isLoading: false };
        });

        mockRpc.mockResolvedValue({ data: true, error: null });

        const result = useEntitlement();

        expect(capturedQueryOptions.queryKey).toEqual(entitlementQueryKey('user-1'));
        expect(capturedQueryOptions.enabled).toBe(true);
        await expect(capturedQueryOptions.queryFn()).resolves.toBe(true);
        expect(mockRpc).toHaveBeenCalledWith('has_active_subscription', { p_user_id: 'user-1' });

        expect(result).toEqual({
            isSubscribed: true,
            planTier: 'paid',
            isLoading: false,
        });
    });

    it('returns free plan tier when subscription RPC resolves false', () => {
        const mockUseAuth = useAuth as jest.Mock;
        const mockUseQuery = useQuery as jest.Mock;

        mockUseAuth.mockReturnValue({ user: { id: 'user-2' }, loading: false });
        mockUseQuery.mockReturnValue({ data: false, isLoading: false });

        const result = useEntitlement();

        expect(result).toEqual({
            isSubscribed: false,
            planTier: 'free',
            isLoading: false,
        });
    });

    it('reports loading when auth is still loading', () => {
        const mockUseAuth = useAuth as jest.Mock;
        const mockUseQuery = useQuery as jest.Mock;

        mockUseAuth.mockReturnValue({ user: null, loading: true });
        mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

        const result = useEntitlement();

        expect(result.isLoading).toBe(true);
        expect(result.planTier).toBe('free');
        expect(result.isSubscribed).toBe(false);
    });
});