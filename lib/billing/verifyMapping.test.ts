import {
  extractInvokeErrorMessage,
  normalizeVerifyGooglePlayResponse,
} from './verifyMapping';

describe('verifyMapping', () => {
  it('normalizes successful payload', () => {
    const result = normalizeVerifyGooglePlayResponse({
      ok: true,
      status: 'active',
      hasAccess: true,
      productId: 'monthly',
      basePlanId: 'base',
      orderId: 'order_1',
      currentPeriodEnd: '2026-04-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('active');
    expect(result.hasAccess).toBe(true);
    expect(result.productId).toBe('monthly');
  });

  it('throws when payload is not ok', () => {
    expect(() => normalizeVerifyGooglePlayResponse({ ok: false, error: 'bad token' })).toThrow('bad token');
  });

  it('extracts server message from invoke error context', async () => {
    const message = await extractInvokeErrorMessage({
      message: 'fallback',
      context: {
        json: async () => ({ error: 'from-server' }),
      },
    });

    expect(message).toBe('from-server');
  });
});
