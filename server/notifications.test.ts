import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverConfirmation, scheduleConfirmation } from './notifications.js';
import type { RegistrationBundle } from './store.js';

const bundle = {
  registration: { id: 'test-id', status: 'verified', iglEmail: 'test@example.test' },
  event: {}, proofs: [],
} as unknown as RegistrationBundle;

test('slow delivery does not block scheduling and is registered with the Vercel lifecycle', async () => {
  const key = Symbol.for('@vercel/request-context');
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const previous = globals[key];
  let finish!: () => void;
  let tracked: Promise<void> | undefined;
  let completed = false;
  globals[key] = { get: () => ({ waitUntil: (promise: Promise<void>) => { tracked = promise; } }) };
  try {
    const result = scheduleConfirmation(bundle, () => new Promise<void>((resolve) => {
      finish = () => { completed = true; resolve(); };
    }));
    assert.equal(result, undefined);
    assert.ok(tracked);
    assert.equal(completed, false);
    finish();
    await tracked;
    assert.equal(completed, true);
  } finally {
    if (previous === undefined) delete globals[key]; else globals[key] = previous;
  }
});

test('email success and failure are audited without recording raw SMTP errors', async () => {
  const entries: unknown[][] = [];
  const audit = async (...args: Parameters<typeof import('./store.js').recordEmailAudit>) => { entries.push(args); };
  await deliverConfirmation(bundle, async () => ({ sent: true, mode: 'smtp' }), audit);
  assert.equal(entries[0][1], true);
  await deliverConfirmation(bundle, async () => ({ sent: false, mode: 'smtp', error: 'sensitive SMTP response' }), audit);
  assert.equal(entries[1][1], false);
  await assert.rejects(deliverConfirmation(bundle, async () => { throw new Error('transport failed'); }, audit));
  assert.equal(entries[2][1], false);
  assert.equal(JSON.stringify(entries).includes('sensitive SMTP response'), false);
});
