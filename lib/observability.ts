import { supabase } from 'lib/supabase';

type ReportAppErrorInput = {
    context: string;
    error: unknown;
    userId?: string | null;
    metadata?: Record<string, unknown>;
};

type ReportAppEventInput = {
    event: string;
    userId?: string | null;
    metadata?: Record<string, unknown>;
};

function toErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return 'Unknown error';
}

export async function reportAppError(input: ReportAppErrorInput) {
    const message = toErrorMessage(input.error);

    // Keep local logs for immediate debugging in development and in native logs.
    console.error('[app-error]', {
        context: input.context,
        message,
        metadata: input.metadata ?? null,
    });

    // Best-effort centralized error log in Supabase.
    if (!input.userId) {
        return;
    }

    try {
        await supabase.from('client_error_logs').insert({
            user_id: input.userId,
            context: input.context,
            message,
            metadata: input.metadata ?? {},
        });
    } catch {
        // Never block UX on telemetry failures.
    }
}

export async function reportAppEvent(input: ReportAppEventInput) {
    // Keep local logs for immediate visibility while developing.
    console.log('[app-event]', {
        event: input.event,
        metadata: input.metadata ?? null,
    });

    // Best-effort centralized event log. Reuses the client_error_logs table
    // with an event-prefixed context so operational queries can distinguish it.
    if (!input.userId) {
        return;
    }

    try {
        await supabase.from('client_error_logs').insert({
            user_id: input.userId,
            context: `event.${input.event}`,
            message: input.event,
            metadata: input.metadata ?? {},
        });
    } catch {
        // Never block UX on telemetry failures.
    }
}
