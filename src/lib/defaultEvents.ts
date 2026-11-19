export interface PrizeTier {
  position: string;
  cashPrize: number;
  award: string;
}

export interface PlacementPointRow {
  rank: string;
  points: number;
}

export interface TournamentStage {
  stageNumber: string;
  name: string;
  formatAndTeams: string;
  advancement: string;
}

export interface FixtureRow {
  stage: string;
  matchId: string;
  participants: string;
  scoring: string;
}

export interface EventRulesConfig {
  teamSizeLabel: string;
  eligibilitySummary: string;
  mapPool: string[];
  killPoints: number;
  placementPoints: PlacementPointRow[];
  stages: TournamentStage[];
  fixtures: FixtureRow[];
  specialRules: string[];
  tieBreaker: string[];
  codePrefix: string;
}

export interface CampusEvent {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  gameTitle: string;
  eventType: 'esports_squad' | 'team' | 'solo';
  maxTeams: number;
  baseFee: number;
  lunchFee: number;
  prizePoolTotal: number;
  prizeBreakdown: PrizeTier[];
  qrImageUrl: string;
  upiVpa: string;
  upiPayeeName: string;
  eventDateLabel: string;
  registrationDeadline: string;
  venueLabel: string;
  isOpen: boolean;
  rulesJson: EventRulesConfig;
  registeredCount?: number;
  verifiedCount?: number;
  pendingCount?: number;
}

export const EVENT_ENTRY_ISO = '2026-12-13T09:30:00+05:30';
export const EVENT_DATE_LABEL = '13 December 2026 · Entry 9:30 AM IST';

export const DEFAULT_EVENTS: CampusEvent[] = [
  {
    id: 'evt-kalinga-warriors-bgmi',
    slug: 'kalinga-warriors-bgmi',
    title: 'Kalinga Warriors (2026)',
    subtitle: 'Campus LAN Battle Royale Championship',
    gameTitle: 'BGMI',
    eventType: 'esports_squad',
    maxTeams: 24,
    baseFee: 299,
    lunchFee: 100,
    prizePoolTotal: 10000,
    prizeBreakdown: [
      { position: '1st Position (Champion)', cashPrize: 5500, award: 'Championship Trophy' },
      { position: '2nd Position (Runner-Up)', cashPrize: 3500, award: 'Runner-Up Trophy' },
      {
        position: 'Final Match MVP',
        cashPrize: 1000,
        award: 'Highest verified kills in the final match',
      },
    ],
    qrImageUrl: '',
    upiVpa: '',
    upiPayeeName: 'Srusti Academy of Management and Technology',
    eventDateLabel: EVENT_DATE_LABEL,
    registrationDeadline: 'Open until 24 squad slots fill',
    venueLabel: 'SAMT Campus LAN Arena',
    isOpen: true,
    rulesJson: {
      codePrefix: 'KW26',
      teamSizeLabel: '4 Active Players (Player 1 = IGL) + 1 Optional Substitute',
      eligibilitySummary:
        'Inter-college participation. Ages 16–22 OR enrolled from 11th Class to Undergraduate (UG). Valid College/Institution ID card mandatory at check-in.',
      mapPool: ['Erangel', 'Miramar', 'Rondo'],
      killPoints: 1,
      placementPoints: [
        { rank: '1st Place (WWCD)', points: 10 },
        { rank: '2nd Place', points: 6 },
        { rank: '3rd Place', points: 5 },
        { rank: '4th Place', points: 4 },
        { rank: '5th Place', points: 3 },
        { rank: '6th Place', points: 2 },
        { rank: '7th – 8th Place', points: 1 },
        { rank: '9th – 12th Place', points: 0 },
      ],
      stages: [
        {
          stageNumber: '01',
          name: 'Group Stage (Qualifiers)',
          formatAndTeams: '24 Teams split into Group A (12) & Group B (12)',
          advancement:
            'Each group plays 3 Battle Royale (BR) matches. Top 6 teams from each group (12 teams total) qualify for the Grand Final.',
        },
        {
          stageNumber: '02',
          name: 'Grand Final',
          formatAndTeams: '12 Qualified Teams (6 Group A + 6 Group B)',
          advancement:
            'All 12 finalists compete together across 4 Battle Royale matches to crown the Winner, Runners-Up, and Final Match MVP.',
        },
      ],
      fixtures: [
        {
          stage: 'Group A (12 Teams)',
          matchId: 'A-Match 1, 2, 3',
          participants: 'Slots A1 – A12',
          scoring: 'Cumulative Placement + Kill Points. Top 6 advance to Grand Final.',
        },
        {
          stage: 'Group B (12 Teams)',
          matchId: 'B-Match 1, 2, 3',
          participants: 'Slots B1 – B12',
          scoring: 'Cumulative Placement + Kill Points. Top 6 advance to Grand Final.',
        },
        {
          stage: 'Grand Final',
          matchId: 'Finals 1 – 4',
          participants: 'Top 6 Group A + Top 6 Group B (12 Teams)',
          scoring: '4 Battles; determines Champion, Runner-Up & Final Match MVP.',
        },
      ],
      specialRules: [
        'Mobile devices only: Emulators, PC clients, triggers/unauthorized peripherals are strictly prohibited.',
        'Maps (Erangel, Miramar, Rondo) are selected randomly per match under default tournament custom-room zone settings.',
        'Teams must join using only their registered Character ID and In-Game Name within 10 minutes of scheduled match start.',
        'No-show after 10 minutes results in match forfeit. Only authorized referees may enter spectator mode.',
      ],
      tieBreaker: [
        'Total cumulative kills across the stage',
        'Best single-match placement in that stage',
        'Official tournament referee decision',
      ],
    },
  },
  {
    id: 'evt-kurukshetra-free-fire',
    slug: 'kurukshetra-free-fire',
    title: 'Kurukshetra — Free Fire',
    subtitle: 'Battle Royale + Clash Squad 4v4 Playoffs',
    gameTitle: 'Free Fire',
    eventType: 'esports_squad',
    maxTeams: 24,
    baseFee: 299,
    lunchFee: 100,
    prizePoolTotal: 10000,
    prizeBreakdown: [
      { position: '1st Position (Champion)', cashPrize: 5500, award: 'Championship Trophy' },
      { position: '2nd Position (Runner-Up)', cashPrize: 3500, award: 'Runner-Up Trophy' },
      {
        position: 'Final Match MVP',
        cashPrize: 1000,
        award: 'Highest verified kills in the final match',
      },
    ],
    qrImageUrl: '',
    upiVpa: '',
    upiPayeeName: 'Srusti Academy of Management and Technology',
    eventDateLabel: EVENT_DATE_LABEL,
    registrationDeadline: 'Open until 24 squad slots fill',
    venueLabel: 'SAMT Campus LAN Arena',
    isOpen: true,
    rulesJson: {
      codePrefix: 'FF26',
      teamSizeLabel: '4 Active Players (Player 1 = IGL) + 1 Optional Substitute',
      eligibilitySummary:
        'Inter-college participation. Ages 16–22 OR enrolled from 11th Class to Undergraduate (UG). Valid College/Institution ID card mandatory at check-in.',
      mapPool: ['Bermuda', 'Kalahari', 'Purgatory'],
      killPoints: 1,
      placementPoints: [
        { rank: '1st Place (Booyah!)', points: 12 },
        { rank: '2nd Place', points: 9 },
        { rank: '3rd Place', points: 8 },
        { rank: '4th Place', points: 7 },
        { rank: '5th Place', points: 6 },
        { rank: '6th Place', points: 5 },
        { rank: '7th Place', points: 4 },
        { rank: '8th Place', points: 3 },
        { rank: '9th Place', points: 2 },
        { rank: '10th Place', points: 1 },
        { rank: '11th – 12th Place', points: 0 },
      ],
      stages: [
        {
          stageNumber: '01',
          name: 'Group Stage (Battle Royale)',
          formatAndTeams: '24 Teams: Group A (12) & Group B (12)',
          advancement:
            'Each group plays 3 Battle Royale matches. Top 6 teams from each group (12 teams total) qualify for the BR Final Round.',
        },
        {
          stageNumber: '02',
          name: 'BR Final Round',
          formatAndTeams: '12 Qualified Teams (Battle Royale)',
          advancement:
            'All 12 qualified teams play 4 Battle Royale matches. Top 4 teams on cumulative points advance to CS Playoffs.',
        },
        {
          stageNumber: '03',
          name: 'CS Playoffs',
          formatAndTeams: 'Top 4 Teams — Clash Squad 4v4 BO3',
          advancement:
            'Semifinal 1 (Seed #1 vs Seed #4) and Semifinal 2 (Seed #2 vs Seed #3) in Best-of-Three (BO3) format. Winners advance.',
        },
        {
          stageNumber: '04',
          name: 'Grand Final',
          formatAndTeams: '2 Finalist Teams — Clash Squad 4v4 BO3',
          advancement:
            'Semifinal Winner 1 vs Semifinal Winner 2 in a 4v4 BO3 series to crown the Kurukshetra Champion.',
        },
      ],
      fixtures: [
        {
          stage: 'Group A (12 Teams)',
          matchId: 'A-Match 1, 2, 3',
          participants: 'Slots A1 – A12',
          scoring: '3 BR Matches; Top 6 advance to BR Final Round.',
        },
        {
          stage: 'Group B (12 Teams)',
          matchId: 'B-Match 1, 2, 3',
          participants: 'Slots B1 – B12',
          scoring: '3 BR Matches; Top 6 advance to BR Final Round.',
        },
        {
          stage: 'BR Final Round',
          matchId: 'BR Final 1, 2, 3, 4',
          participants: 'Qualified Teams 1 – 12',
          scoring: '4 BR Matches; Top 4 cumulative teams advance to CS Playoffs.',
        },
        {
          stage: 'CS Semifinal 1 & 2',
          matchId: 'Playoff Match 1 & 2',
          participants: 'Seed #1 vs #4 · Seed #2 vs #3',
          scoring: '4v4 Clash Squad Best-of-Three (BO3); Winners advance.',
        },
        {
          stage: 'CS Grand Final',
          matchId: 'Championship Match',
          participants: 'Semifinal Winner 1 vs Semifinal Winner 2',
          scoring: '4v4 Clash Squad Best-of-Three (BO3); Crowns Champion.',
        },
      ],
      specialRules: [
        'Active Character Skill Rule: Each player on a team MUST equip a different active skill; duplicating the same active skill across multiple players on the same squad is strictly prohibited.',
        'Mobile devices only: Emulators, PC clients, scripts, or unauthorized peripherals face immediate disqualification.',
        'Maps (Bermuda, Kalahari, Purgatory) are selected randomly per Battle Royale match.',
        '10-minute punctuality forfeiture rule applies; all players must join using registered Character ID and In-Game Name.',
      ],
      tieBreaker: [
        'Total cumulative kills across the stage',
        'Best single-match placement in that stage',
        'Official tournament referee decision',
      ],
    },
  },
];
