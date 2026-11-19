import test from 'node:test';
import assert from 'node:assert/strict';
import { adminRequest } from './adminRequest';

test('admin requests preserve successful bodies and send bearer credentials without caching', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer test-token');
    assert.equal(init.cache, 'no-store');
    return Response.json({ events: [] });
  });
  const response = await adminRequest('/api/admin/overview', 'test-token');
  assert.deepEqual(await response.json(), { events: [] });
});

test('admin errors never become successful empty dashboard data', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Save failed.' }, { status: 500 }));
  await assert.rejects(adminRequest('/api/admin/events', 'test-token'), /Save failed/);
});

test('expired and revoked admin sessions trigger logout', async (t) => {
  for (const status of [401, 403]) {
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status }));
    let loggedOut = false;
    await assert.rejects(adminRequest('/api/admin/overview', 'test-token', {}, () => { loggedOut = true; }), /sign in again/);
    assert.equal(loggedOut, true);
  }
});

test('network failures and non-JSON server failures have actionable messages', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(adminRequest('/api/admin/events', 'test-token'), /Check your connection/);
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Bad gateway</html>', { status: 502 }));
  await assert.rejects(adminRequest('/api/admin/events', 'test-token'), /Please try again/);
});
