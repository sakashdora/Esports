import assert from 'node:assert/strict';
import test from 'node:test';
import { createCheckInQr } from './email.js';
import { registrationEmailParams } from './notifications.js';
import { decideRegistrationPayment } from './store.js';

test('Supabase approval keeps the roster and free-event amounts for its QR email', async (t) => {
  const settings = { SUPABASE_URL: 'https://approval-fixture.example.test', SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service' };
  for (const [key, value] of Object.entries(settings)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }

  const registration = {
    id: '11111111-1111-4111-8111-111111111111', event_id: '22222222-2222-4222-8222-222222222222',
    team_code: 'TEST26-003', team_name: 'Test Squad', status: 'pending', igl_email: 'captain@example.test',
    base_fee: 0, total_fee: 0, last_email_status: 'sent',
  };
  const event = {
    id: registration.event_id, slug: 'test-tournament', title: 'Test Tournament', game_title: 'BGMI',
    base_fee: 0, lunch_fee: 0, prize_pool_total: 0, max_teams: 24, event_date_label: '13 December 2026 · Entry 9:30 AM IST',
  };
  const roster = ['P2', 'IGL'].map((slot_role) => ({
    slot_role, full_name: `Test ${slot_role}`, in_game_name: slot_role, character_id: slot_role,
    registration_id: registration.id, event_id: event.id, academic_level: 'UG',
    id: slot_role, diet_type: 'NONE', wants_lunch: false,
  }));
  const proof = { id: 'sample-proof', registration_id: registration.id, review_status: 'pending', utr_number: '123456789012' };

  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert.equal(url.origin, settings.SUPABASE_URL);
    const table = url.pathname.split('/').at(-1);
    if (request.method === 'GET' && table === 'registrations') {
      if (url.searchParams.get('id') !== `eq.${registration.id}`) return Response.json([]);
      assert.match(url.searchParams.get('select') ?? '', /team_members\(\*\)/);
      return Response.json([{ ...registration, events: event, team_members: roster }]);
    }
    if (request.method === 'GET' && table === 'payment_proofs') return Response.json([proof]);
    if (request.method === 'PATCH' && table === 'registrations') return Response.json({ ...registration, ...await request.json() });
    if (request.method === 'PATCH' && table === 'payment_proofs') return Response.json({ ...proof, ...await request.json() });
    if (request.method === 'POST' && table === 'payment_audit_logs') return Response.json({ ...await request.json(), id: 'audit' });
    throw new Error(`Unexpected Supabase request for ${table}.`);
  });

  const result = await decideRegistrationPayment({ registrationId: registration.id, decision: 'approve', actorEmail: 'admin@example.test' });
  assert.equal(result.registration.status, 'verified');
  assert.equal(result.registration.slotNumber, 'A1');
  assert.equal(result.registration.lastEmailStatus, 'pending_send');
  assert.equal(result.registration.totalFee, 0);
  assert.equal(result.event.baseFee, 0);
  assert.equal(result.event.lunchFee, 0);
  assert.equal(result.event.prizePoolTotal, 0);
  assert.deepEqual(result.members.map(({ slotRole }) => slotRole), ['IGL', 'P2']);
  const pass = await createCheckInQr(registrationEmailParams(result), 'https://app.example.test');
  assert.ok(pass?.encoded.includes('Test IGL'));
  assert.ok(pass?.encoded.includes('Test P2'));
});
