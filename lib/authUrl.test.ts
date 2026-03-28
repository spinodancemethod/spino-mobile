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
});
