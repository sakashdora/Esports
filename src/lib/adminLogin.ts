export async function readAdminLoginResponse(response: Response): Promise<{ token: string; email: string; role: 'admin' | 'volunteer' }> {
  const body = await response.json().catch(() => null);
  if (response.status >= 500 || !body) {
    throw new Error('The sign-in server is unavailable. Please try again later or contact the site administrator.');
  }
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Sign-in failed. Please check your credentials.');
  if (typeof body.token !== 'string' || !body.token || typeof body.email !== 'string') {
    throw new Error('The server returned an invalid sign-in response. Please try again later.');
  }
  return { token: body.token, email: body.email, role: body.role === 'volunteer' ? 'volunteer' : 'admin' };
}
