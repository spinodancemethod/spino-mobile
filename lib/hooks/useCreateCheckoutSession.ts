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

    if (error) {
        // Supabase wraps non-2xx responses in a FunctionsHttpError with a generic message.
        // Try to pull the human-readable message out of the response body instead.
        let message: string = error.message;
        try {
            const body = await (error as any).context?.json?.();
            if (body?.error && typeof body.error === 'string') {
                message = body.error;
            }
        } catch {
            // fall back to the original error message if body parsing fails
        }
        throw new Error(message);
    }

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
