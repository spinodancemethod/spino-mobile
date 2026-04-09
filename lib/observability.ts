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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function pickStringField(record: UnknownRecord, field: string) {
    const value = record[field];
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toErrorDetails(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        return {
            name: error.name,
            stack: error.stack ?? null,
        };
    }

    if (!isRecord(error)) {
        return {};
    }

    const details: Record<string, unknown> = {};
    const fields = [
        'code',
        'domain',
        'readableErrorCode',
        'underlyingErrorMessage',
        'userCancelled',
    ];

    for (const field of fields) {
        if (error[field] !== undefined) {
            details[field] = error[field];
        }
    }

    const nestedFieldCandidates = ['cause', 'underlyingError', 'details', 'userInfo'];
    for (const field of nestedFieldCandidates) {
        const nested = error[field];
        if (isRecord(nested)) {
            const nestedMessage = pickStringField(nested, 'message');
            if (nestedMessage) {
                details[`${field}Message`] = nestedMessage;
            }

            if (nested.code !== undefined) {
                details[`${field}Code`] = nested.code;
            }
        }
    }

    return details;
}

function toErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    if (isRecord(error)) {
        const directMessageFields = ['message', 'localizedDescription', 'debugMessage', 'description'];
        for (const field of directMessageFields) {
            const message = pickStringField(error, field);
            if (message) {
                return message;
            }
        }

        const nestedError = error.error;
        if (isRecord(nestedError)) {
            const nestedMessage = pickStringField(nestedError, 'message');
            if (nestedMessage) {
                return nestedMessage;
            }
        }
    }

    return 'Unknown error';
}

export async function reportAppError(input: ReportAppErrorInput) {
    const message = toErrorMessage(input.error);
    const errorDetails = toErrorDetails(input.error);
    const metadata = {
        ...(input.metadata ?? {}),
        ...(Object.keys(errorDetails).length ? { errorDetails } : {}),
    };

    // Keep local logs for immediate debugging in development and in native logs.
    console.error('[app-error]', {
        context: input.context,
        message,
        metadata: Object.keys(metadata).length ? metadata : null,
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
            metadata,
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
