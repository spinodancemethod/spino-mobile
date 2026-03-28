export function shouldHandleAuthUrl(url: string) {
  const hashIdx = url.indexOf('#');
  const rawParams = hashIdx >= 0 ? url.slice(hashIdx + 1) : (url.split('?')[1] ?? '');
  const params = new URLSearchParams(rawParams);
  const normalizedUrl = url.toLowerCase();

  return (
    normalizedUrl.includes('access_token=') ||
    normalizedUrl.includes('refresh_token=') ||
    params.has('access_token') ||
    params.has('refresh_token') ||
    params.has('type') ||
    normalizedUrl.includes('://login')
  );
}
