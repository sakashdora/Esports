/** Keep HTTP failures out of success-only admin workflows. */
export async function adminRequest(
  url: string,
  token: string,
  init: RequestInit = {},
  onUnauthorized: () => void = () => {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, cache: 'no-store' });
  } catch {
    throw new Error('Unable to connect. Check your connection and try again.');
  }
  if (response.status === 401 || response.status === 403) {
    onUnauthorized();
    throw new Error('Your session is no longer authorized. Please sign in again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.error === 'string' ? body.error : 'Request failed. Please try again.');
  }
  return response;
}
