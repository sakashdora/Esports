import test from 'node:test';
import assert from 'node:assert/strict';
import { readAdminLoginResponse } from './adminLogin';

test('plain-text hosting failures show a safe availability error, not a JSON parse error', async () => {
  await assert.rejects(readAdminLoginResponse(new Response('A server error has occurred\nFUNCTION_INVOCATION_FAILED', { status: 500 })), /sign-in server is unavailable/);
  await assert.rejects(readAdminLoginResponse(new Response('<html>Error</html>')), /sign-in server is unavailable/);
});
test('login rejects malformed successes and preserves normal authentication errors', async () => {
  await assert.rejects(readAdminLoginResponse(Response.json({})), /invalid sign-in response/);
  await assert.rejects(readAdminLoginResponse(Response.json({ error: 'Invalid credentials.' }, { status: 401 })), /Invalid credentials/);
  assert.deepEqual(await readAdminLoginResponse(Response.json({ token: 'test-session', email: 'test@example.test' })), { token: 'test-session', email: 'test@example.test' });
});
