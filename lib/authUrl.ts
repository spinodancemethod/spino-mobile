export function getAuthUrlParams(url: string) {
    const hashIdx = url.indexOf('#');
    const rawParams = hashIdx >= 0 ? url.slice(hashIdx + 1) : (url.split('?')[1] ?? '');
    return new URLSearchParams(rawParams);
}

export function isRecoveryAuthUrl(url: string) {
    const params = getAuthUrlParams(url);
    return params.get('type') === 'recovery' || url.toLowerCase().includes('type=recovery');
}

export function shouldHandleAuthUrl(url: string) {
    const params = getAuthUrlParams(url);
    const normalizedUrl = url.toLowerCase();

    return (
        normalizedUrl.includes('access_token=') ||
        normalizedUrl.includes('refresh_token=') ||
        params.has('access_token') ||
        params.has('refresh_token') ||
        params.has('type') ||
        normalizedUrl.includes('://login') ||
        normalizedUrl.includes('://reset-password')
    );
}
