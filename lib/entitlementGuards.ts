export function shouldRedirectForEntitlement(params: {
    isLoading: boolean;
    hasAccess: boolean;
}) {
    return !params.isLoading && !params.hasAccess;
}

export function shouldShowEntitlementPendingState(params: {
    isLoading: boolean;
    hasAccess: boolean;
}) {
    return params.isLoading || !params.hasAccess;
}
