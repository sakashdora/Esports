import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EVENTS } from './defaultEvents';
import { computeLiveBoardSummary } from './liveBoard';

test('computeLiveBoardSummary reports aggregate counts and capacity by title', () => {
  const summary = computeLiveBoardSummary([
    { ...DEFAULT_EVENTS[0], registeredCount: 2, verifiedCount: 1, pendingCount: 1 },
    { ...DEFAULT_EVENTS[1], registeredCount: 1, verifiedCount: 0, pendingCount: 0 },
  ]);

  assert.equal(summary.totalActive, 3);
  assert.equal(summary.verifiedCount, 1);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.waitlistedCount, 1);
  assert.equal(summary.totalCapacity, 48);
  assert.equal(summary.remainingSlots, 45);
  assert.equal(summary.perEvent[0].pendingCount, 1);
  assert.equal(summary.perEvent[0].remainingSlots, 22);
  assert.equal(summary.perEvent[1].waitlistedCount, 1);
});

test('computeLiveBoardSummary can initialize with event details before totals arrive', () => {
  const summary = computeLiveBoardSummary(DEFAULT_EVENTS);
  assert.equal(summary.totalActive, 0);
  assert.equal(summary.remainingSlots, 48);
});
