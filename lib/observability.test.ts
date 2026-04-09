import { supabase } from 'lib/supabase';
import { reportAppError, reportAppEvent } from './observability';

jest.mock('lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

describe('reportAppEvent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('writes an analytics event to client_error_logs when userId is present', async () => {
        const insert = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockReturnValue({ insert });

        await reportAppEvent({
            event: 'locked_content_tap',
            userId: 'user-123',
            metadata: { screen: 'library', videoId: 'video-1' },
        });

        expect(supabase.from).toHaveBeenCalledWith('client_error_logs');
        expect(insert).toHaveBeenCalledWith({
            user_id: 'user-123',
            context: 'event.locked_content_tap',
            message: 'locked_content_tap',
            metadata: { screen: 'library', videoId: 'video-1' },
        });
    });

    it('does not write to Supabase when userId is missing', async () => {
        await reportAppEvent({
            event: 'free_content_impression',
            metadata: { screen: 'your_roadmap' },
        });

        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('swallows Supabase insert errors so UX is not blocked', async () => {
        const insert = jest.fn().mockRejectedValue(new Error('db down'));
        (supabase.from as jest.Mock).mockReturnValue({ insert });

        await expect(
            reportAppEvent({
                event: 'locked_screen_subscribe_cta_press',
                userId: 'user-456',
                metadata: { screen: 'video_locked_screen' },
            })
        ).resolves.toBeUndefined();
    });
});

describe('reportAppError', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('extracts object-shaped SDK error messages and includes diagnostics in metadata', async () => {
        const insert = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockReturnValue({ insert });

        await reportAppError({
            context: 'billing.checkout',
            userId: 'user-123',
            error: {
                message: 'Google Play authentication failed',
                code: 'SERVICE_UNAVAILABLE',
                readableErrorCode: 'NetworkError',
            },
            metadata: {
                platform: 'android',
                step: 'purchase',
            },
        });

        expect(insert).toHaveBeenCalledWith({
            user_id: 'user-123',
            context: 'billing.checkout',
            message: 'Google Play authentication failed',
            metadata: {
                platform: 'android',
                step: 'purchase',
                errorDetails: {
                    code: 'SERVICE_UNAVAILABLE',
                    readableErrorCode: 'NetworkError',
                },
            },
        });
    });

    it('falls back to Unknown error when shape is not supported', async () => {
        const insert = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockReturnValue({ insert });

        await reportAppError({
            context: 'billing.checkout',
            userId: 'user-123',
            error: { foo: 'bar' },
        });

        expect(insert).toHaveBeenCalledWith({
            user_id: 'user-123',
            context: 'billing.checkout',
            message: 'Unknown error',
            metadata: {},
        });
    });
});
