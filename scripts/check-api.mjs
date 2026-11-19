import assert from 'node:assert/strict';

// Import the emitted entry with native Node ESM, without a bundler or TS loader.
// Health and rejected-auth probes never read or mutate registration records.
const { default: app } = await import('../build/api-check/api/index.js');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.match(health.headers.get('content-type'), /application\/json/);
  await health.json();
  const protectedRoute = await fetch(`${base}/api/admin/overview`);
  assert.equal(protectedRoute.status, 401);
  console.log('Native Node API entry loads; health returns JSON; admin authorization is enforced.');
} finally {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
