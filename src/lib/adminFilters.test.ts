import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAdminRegistrations } from './adminFilters';

const rows = [
  { registration: { teamCode: 'T1', teamName: 'Alpha', collegeName: 'Srusti', iglPhone: '00123', iglEmail: 'captain@example.test', eventId: 'bgmi', status: 'verified', lunchCount: 4, createdAt: '2026-11-18T19:00:00Z' }, proofs: [{ utrNumber: '000123456789' }] },
  { registration: { teamCode: 'T2', teamName: 'Beta', collegeName: 'Other', iglPhone: '00456', iglEmail: 'other@example.test', eventId: 'ff', status: 'pending', lunchCount: 0, createdAt: '2026-11-17T19:00:00Z' }, proofs: [] },
];
test('admin filters combine event, status, lunch, search and inclusive IST dates', () => {
  assert.deepEqual(filterAdminRegistrations(rows, { event: 'bgmi', status: 'verified', lunch: 'yes', search: 'CAPTAIN@', from: '2026-11-19', to: '2026-11-19' }), [rows[0]]);
  assert.deepEqual(filterAdminRegistrations(rows, { search: '000123' }), [rows[0]]);
  assert.deepEqual(filterAdminRegistrations(rows, { lunch: 'no' }), [rows[1]]);
  assert.equal(filterAdminRegistrations(rows, { from: '2026-11-20' }).length, 0);
  assert.equal(filterAdminRegistrations(rows, { sort: 'oldest' })[0], rows[1]);
  assert.equal(rows[0].registration.teamCode, 'T1');
});
