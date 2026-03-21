import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from 'lib/auth';
import { supabase } from 'lib/supabase';
import { accountDetailsQueryKey } from 'lib/hooks/useAccountDetails';
import { subscriptionStatusQueryKey } from 'lib/hooks/useSubscriptionStatus';

type CancelSubscriptionResult = {
    ok: boolean;
    alreadyScheduled?: boolean;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
};

async function cancelSubscription(): Promise<CancelSubscriptionResult> {
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: {},
    });

    if (error) {
        throw error;
    }

    if (!(data as any)?.ok) {
        throw new Error((data as any)?.error ?? 'Failed to cancel subscription');
    }

    return data as CancelSubscriptionResult;
}

export function useCancelSubscription() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: cancelSubscription,
        onSuccess: async () => {
            // Refresh both account and entitlement-facing views after cancellation.
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: accountDetailsQueryKey(user?.id) }),
                queryClient.invalidateQueries({ queryKey: subscriptionStatusQueryKey(user?.id) }),
            ]);
        },
    });
}
