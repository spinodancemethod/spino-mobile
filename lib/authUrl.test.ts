import { shouldHandleAuthUrl } from './authUrl';

describe('shouldHandleAuthUrl', () => {
    it('returns true when access token is present', () => {
        expect(shouldHandleAuthUrl('spino://login#access_token=abc&refresh_token=def')).toBe(true);
    });

    it('returns true when type query param is present', () => {
        expect(shouldHandleAuthUrl('spino://login?type=recovery')).toBe(true);
    });

    it('returns false for unrelated urls', () => {
        expect(shouldHandleAuthUrl('https://example.com/help')).toBe(false);
    });

    // Bare login/reset links are handled on purpose (since 4991bb2): the auth handler
    // runs for them and simply finds no tokens to apply.
    it('returns true for login and reset-password app links even with no auth params', () => {
        expect(shouldHandleAuthUrl('spino://login')).toBe(true);
        expect(shouldHandleAuthUrl('spino://reset-password')).toBe(true);
    });

    it('returns false for other app links with no auth params', () => {
        expect(shouldHandleAuthUrl('spino://roadmap')).toBe(false);
    });
});
