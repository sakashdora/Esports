import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EVENTS } from './defaultEvents';
import {
  buildGroupSlotGrid,
  computeLiveBoardSummary,
  filterLiveTeams,
  sanitizePublicTeam,
  type PublicRegisteredTeam,
} from './liveBoard';

function makeSampleTeam(overrides: Partial<PublicRegisteredTeam> = {}): PublicRegisteredTeam {
  return {
    id: 'reg-1',
    teamCode: 'KW26-001',
    eventId: DEFAULT_EVENTS[0].id,
    eventTitle: DEFAULT_EVENTS[0].title,
    gameTitle: DEFAULT_EVENTS[0].gameTitle,
    teamName: 'Kalinga Phantoms',
    collegeName: 'Srusti Academy of Management and Technology',
    status: 'verified',
    groupName: 'Group A',
    slotNumber: 'A1',
    playerCount: 4,
    hasSubstitute: false,
    rosterIgns: [
      { slotRole: 'IGL', inGameName: 'PhantomIGL' },
      { slotRole: 'P2', inGameName: 'PhantomAssaulter' },
      { slotRole: 'P3', inGameName: 'PhantomSupport' },
      { slotRole: 'P4', inGameName: 'PhantomSniper' },
    ],
    createdAt: '2026-11-16T10:00:00.000Z',
    updatedAt: '2026-11-16T10:05:00.000Z',
    ...overrides,
  };
}

test('sanitizePublicTeam strips private IGL contact, payment proof, and real player full names', () => {
  const sanitized = sanitizePublicTeam({
    registration: {
      id: 'reg-secret-1',
      teamCode: 'KW26-001',
      eventId: DEFAULT_EVENTS[0].id,
      teamName: 'Odisha Titans',
      collegeName: 'SAMT Bhubaneswar',
      hasSubstitute: false,
      status: 'pending',
      groupName: null,
      slotNumber: null,
      createdAt: '2026-11-16T10:00:00.000Z',
      updatedAt: '2026-11-16T10:00:00.000Z',
      iglPhone: '9876543210',
      iglEmail: 'secret@example.com',
      totalFee: 499,
    } as never,
    event: DEFAULT_EVENTS[0],
    members: [
      {
        slotRole: 'IGL',
        inGameName: 'TitanLead',
        fullName: 'Aarav Pattnaik',
        characterId: '511223344',
      } as never,
    ],
  });

  const serialized = JSON.stringify(sanitized);
  assert.equal(serialized.includes('9876543210'), false);
  assert.equal(serialized.includes('secret@example.com'), false);
  assert.equal(serialized.includes('Aarav Pattnaik'), false);
  assert.equal(serialized.includes('511223344'), false);
  assert.equal(sanitized.teamCode, 'KW26-001');
  assert.equal(sanitized.rosterIgns[0].inGameName, 'TitanLead');
});

test('computeLiveBoardSummary totals active, verified, pending, waitlisted, and remaining slots accurately', () => {
  const teams = [
    makeSampleTeam({ id: '1', eventId: DEFAULT_EVENTS[0].id, status: 'verified' }),
    makeSampleTeam({
      id: '2',
      eventId: DEFAULT_EVENTS[0].id,
      teamCode: 'KW26-002',
      status: 'pending',
      slotNumber: null,
      groupName: null,
    }),
    makeSampleTeam({
      id: '3',
      eventId: DEFAULT_EVENTS[1].id,
      teamCode: 'FF26-001',
      status: 'waitlisted',
      slotNumber: null,
      groupName: null,
    }),
    makeSampleTeam({
      id: '4',
      eventId: DEFAULT_EVENTS[1].id,
      teamCode: 'FF26-002',
      status: 'rejected',
      slotNumber: null,
      groupName: null,
    }),
  ];

  const summary = computeLiveBoardSummary(DEFAULT_EVENTS, teams);
  assert.equal(summary.totalActive, 3);
  assert.equal(summary.verifiedCount, 1);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.waitlistedCount, 1);
  assert.equal(summary.totalCapacity, 48);
  assert.equal(summary.remainingSlots, 45);
  assert.equal(summary.perEvent[0].verifiedCount, 1);
  assert.equal(summary.perEvent[0].pendingCount, 1);
  assert.equal(summary.perEvent[0].remainingSlots, 22);
});

test('filterLiveTeams matches by event, status bucket, college, team code, and player IGN', () => {
  const teams = [
    makeSampleTeam({
      id: '1',
      eventId: DEFAULT_EVENTS[0].id,
      teamCode: 'KW26-001',
      teamName: 'Kalinga Phantoms',
      status: 'verified',
    }),
    makeSampleTeam({
      id: '2',
      eventId: DEFAULT_EVENTS[1].id,
      teamCode: 'FF26-001',
      teamName: 'Cuttack Ninjas',
      status: 'reupload_required',
      rosterIgns: [{ slotRole: 'IGL', inGameName: 'BooyahMaster' }],
    }),
  ];

  assert.equal(filterLiveTeams(teams, { status: 'pending' }).length, 1);
  assert.equal(filterLiveTeams(teams, { eventId: DEFAULT_EVENTS[1].id }).length, 1);
  assert.equal(filterLiveTeams(teams, { search: 'booyahmaster' })[0].teamCode, 'FF26-001');
  assert.equal(filterLiveTeams(teams, { search: 'KW26-001' }).length, 1);
});

test('buildGroupSlotGrid maps verified squads to Group A and Group B LAN seats', () => {
  const teams = [
    makeSampleTeam({ id: '1', eventId: DEFAULT_EVENTS[0].id, slotNumber: 'A1', status: 'verified' }),
    makeSampleTeam({
      id: '2',
      eventId: DEFAULT_EVENTS[0].id,
      teamCode: 'KW26-002',
      teamName: 'Konark Squad',
      slotNumber: 'B3',
      groupName: 'Group B',
      status: 'verified',
    }),
  ];

  const grid = buildGroupSlotGrid(teams, DEFAULT_EVENTS[0].id, 24);
  assert.equal(grid.groupA.length, 12);
  assert.equal(grid.groupB.length, 12);
  assert.equal(grid.groupA[0].slotNumber, 'A1');
  assert.equal(grid.groupA[0].team?.teamCode, 'KW26-001');
  assert.equal(grid.groupA[1].team, null);
  assert.equal(grid.groupB[2].slotNumber, 'B3');
  assert.equal(grid.groupB[2].team?.teamName, 'Konark Squad');
});
