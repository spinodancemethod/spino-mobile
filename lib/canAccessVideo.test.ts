// Mirrors SQL helper logic from public.can_access_video(p_user_id, p_video_id):
// access is granted when the video is free-tier OR the user has an active subscription.
function canAccessVideo(params: { isFreeTierVideo: boolean; hasActiveSubscription: boolean }) {
    return params.isFreeTierVideo || params.hasActiveSubscription;
}

describe('can_access_video logic mirror', () => {
    it('returns true for paid video when user has active subscription', () => {
        const result = canAccessVideo({ isFreeTierVideo: false, hasActiveSubscription: true });
        expect(result).toBe(true);
    });

    it('returns true for free-tier video when user has no subscription', () => {
        const result = canAccessVideo({ isFreeTierVideo: true, hasActiveSubscription: false });
        expect(result).toBe(true);
    });

    it('returns false for paid video when user has no subscription', () => {
        const result = canAccessVideo({ isFreeTierVideo: false, hasActiveSubscription: false });
        expect(result).toBe(false);
    });

    it('returns true when both free-tier and subscribed are true', () => {
        const result = canAccessVideo({ isFreeTierVideo: true, hasActiveSubscription: true });
        expect(result).toBe(true);
    });
});