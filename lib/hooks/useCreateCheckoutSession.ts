import { useMutation } from '@tanstack/react-query';
import { supabase } from 'lib/supabase';

type CreateCheckoutSessionInput = {
    priceId: string;
};

type CreateCheckoutSessionResult = {
    url: string;
};

/**
 * Creates a Stripe checkout session via Supabase Edge Functions.
 * The function requires an authenticated user and returns a hosted checkout URL.
 */
async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: input,
    });

    if (error) throw error;

    const url = (data as any)?.url;
    if (!url || typeof url !== 'string') {
        throw new Error('No checkout URL returned by server');
    }

    return { url };
}

export function useCreateCheckoutSession() {
    return useMutation({
        mutationFn: createCheckoutSession,
    });
}
