import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'lib/auth';
import { supabase } from 'lib/supabase';

type SubscriptionRow = {
    status: string | null;
    current_period_end: string | null;
    stripe_price_id: string | null;
    cancel_at_period_end: boolean | null;
};

type BillingCustomerRow = {
    stripe_customer_id: string | null;
};

export type AccountDetails = {
    userId: string;
    email: string | null;
    createdAt: string | null;
    stripeCustomerId: string | null;
    subscriptionStatus: string | null;
    subscriptionPriceId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    hasActiveSubscription: boolean;
};

export function accountDetailsQueryKey(userId?: string | null) {
    return ['accountDetails', userId ?? 'anonymous'];
}

function hasActiveSubscription(status: string | null, currentPeriodEnd: string | null) {
    if (!status || !['active', 'trialing'].includes(status)) {
        return false;
    }

    if (!currentPeriodEnd) {
        return true;
    }

    return new Date(currentPeriodEnd).getTime() > Date.now();
}

async function fetchAccountDetails(userId: string, email: string | null, createdAt: string | null): Promise<AccountDetails> {
    const [{ data: subscriptionRow, error: subscriptionError }, { data: billingCustomerRow, error: billingCustomerError }] = await Promise.all([
        supabase
            .from('subscriptions')
            .select('status,current_period_end,stripe_price_id,cancel_at_period_end')
            .eq('user_id', userId)
            .order('current_period_end', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle<SubscriptionRow>(),
        supabase
            .from('billing_customers')
            .select('stripe_customer_id')
            .eq('user_id', userId)
            .maybeSingle<BillingCustomerRow>(),
    ]);

    if (subscriptionError) {
        throw subscriptionError;
    }

    if (billingCustomerError) {
        throw billingCustomerError;
    }

    return {
        userId,
        email,
        createdAt,
        stripeCustomerId: billingCustomerRow?.stripe_customer_id ?? null,
        subscriptionStatus: subscriptionRow?.status ?? null,
        subscriptionPriceId: subscriptionRow?.stripe_price_id ?? null,
        currentPeriodEnd: subscriptionRow?.current_period_end ?? null,
        cancelAtPeriodEnd: Boolean(subscriptionRow?.cancel_at_period_end),
        hasActiveSubscription: hasActiveSubscription(
            subscriptionRow?.status ?? null,
            subscriptionRow?.current_period_end ?? null,
        ),
    };
}

export function useAccountDetails() {
    const { user } = useAuth();

    return useQuery({
        queryKey: accountDetailsQueryKey(user?.id),
        queryFn: () => fetchAccountDetails(user!.id, user?.email ?? null, (user as any)?.created_at ?? null),
        enabled: Boolean(user?.id),
        staleTime: 1000 * 30,
    });
}
