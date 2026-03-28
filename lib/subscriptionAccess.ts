export function hasActiveSubscription(
    status: string | null,
    currentPeriodEnd: string | null,
    nowMs = Date.now(),
): boolean {
    if (!status || !['active', 'trialing', 'grace_period'].includes(status)) {
        return false;
    }

    if (!currentPeriodEnd) {
        return true;
    }

    return new Date(currentPeriodEnd).getTime() > nowMs;
}
