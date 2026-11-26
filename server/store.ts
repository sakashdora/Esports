import { ClientInputError } from './errors.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CHECK_IN_PAGE_SIZE, confirmedSeat, isWaitlistSlot, type AttendanceEntry, type AttendanceMark, type CheckInSquad, type VolunteerAccount } from '../src/lib/checkIn.js';
import { DEFAULT_EVENTS, EVENT_DATE_LABEL, type CampusEvent } from '../src/lib/defaultEvents.js';
import {
  assignFirstFreeTournamentSlot,
  calculateRegistrationFee,
  formatTeamCode,
  isValidEmail,
  isValidIndianPhone,
  isValidUpiVpa,
  isValidUtr,
  normalizePhone,
  normalizeUtr,
  OTHER_ACADEMIC_LEVEL,
  validateSquadSubmission,
  type PlayerInput,
  type RegistrationStatus,
} from '../src/lib/tournamentRules.js';

export interface StoredTeamMember extends Omit<PlayerInput, 'otherAcademicLevel'> {
  id: string;
  registrationId: string;
  eventId: string;
}

export interface StoredPaymentProof {
  id: string;
  registrationId: string;
  utrNumber: string;
  upiApp: string;
  paidAmount: number;
  screenshotPath: string;
  fileSha256: string;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'reupload_required';
  rejectionReason: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface StoredRegistration {
  id: string;
  teamCode: string;
  eventId: string;
  teamName: string;
  collegeName: string;
  iglPhone: string;
  iglEmail: string;
  hasSubstitute: boolean;
  lunchCount: number;
  vegCount: number;
  nonVegCount: number;
  baseFee: number;
  lunchTotal: number;
  totalFee: number;
  status: RegistrationStatus;
  slotNumber: string | null;
  groupName: string | null;
  eligibilityConfirmed: boolean;
  fairPlayConfirmed: boolean;
  activeSkillConfirmed: boolean;
  rejectionReason: string | null;
  lastEmailStatus: string;
  lastEmailAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredAuditLog {
  id: string;
  registrationId: string;
  actorLabel: string;
  action:
    | 'SUBMIT'
    | 'REUPLOAD'
    | 'APPROVE'
    | 'REJECT'
    | 'REQUEST_REUPLOAD'
    | 'EMAIL_SENT'
    | 'EMAIL_FAIL'
    | 'REFUNDED';
  notes: string;
  createdAt: string;
}

export interface RegistrationBundle {
  registration: StoredRegistration;
  event: CampusEvent;
  members: StoredTeamMember[];
  proofs: StoredPaymentProof[];
  auditLogs: StoredAuditLog[];
  latestProofUrl?: string | null;
}

interface LocalStoreData {
  events: CampusEvent[];
  registrations: StoredRegistration[];
  members: StoredTeamMember[];
  proofs: StoredPaymentProof[];
  auditLogs: StoredAuditLog[];
  eventSequences: Record<string, number>;
  volunteers?: VolunteerCredentials[];
  attendance?: AttendanceMark[];
}

// EFEST_DATA_DIR lets tests and local previews use a throwaway store.
const DATA_DIR = process.env.EFEST_DATA_DIR
  ? path.resolve(process.env.EFEST_DATA_DIR)
  : process.env.VERCEL
    ? path.join('/tmp', '.data')
    : path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const QR_DIR = path.join(DATA_DIR, 'qr');

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_URL.includes('your-project-ref')
  );
}

let cachedServiceClient: SupabaseClient | null = null;
let cachedAnonClient: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedServiceClient) {
    cachedServiceClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return cachedServiceClient;
}

export function getSupabaseAnonClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedAnonClient) {
    cachedAnonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return cachedAnonClient;
}

function teamCodePrefix(event: CampusEvent): string {
  return formatTeamCode(event.rulesJson.codePrefix || 'SAMT26', 1).split('-')[0];
}

function highestTeamSequence(teamCodes: Iterable<string>, prefix: string): number {
  let highest = 0;
  for (const code of teamCodes) {
    if (!code.startsWith(`${prefix}-`)) continue;
    const sequence = Number(code.slice(prefix.length + 1));
    if (Number.isSafeInteger(sequence)) highest = Math.max(highest, sequence);
  }
  return highest;
}

function ensureLocalDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });
}

function readLocalStore(): LocalStoreData {
  ensureLocalDirs();
  if (!fs.existsSync(STORE_FILE)) {
    const initial: LocalStoreData = {
      events: DEFAULT_EVENTS,
      registrations: [],
      members: [],
      proofs: [],
      auditLogs: [],
      eventSequences: {
        'evt-kalinga-warriors-bgmi': 0,
        'evt-kurukshetra-free-fire': 0,
      },
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(STORE_FILE, 'utf-8');
  const store = JSON.parse(raw) as LocalStoreData;
  store.events = store.events.map(event => ({ ...event, eventDateLabel: DEFAULT_EVENTS.some(e => e.slug === event.slug) ? EVENT_DATE_LABEL : event.eventDateLabel }));
  return store;
}

function writeLocalStore(data: LocalStoreData) {
  ensureLocalDirs();
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

export function detectImageMimeFromMagicBytes(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function extFromMime(mime: 'image/jpeg' | 'image/png' | 'image/webp'): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function mapSupabaseEvent(row: Record<string, unknown>): CampusEvent {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subtitle: String(row.subtitle || ''),
    gameTitle: String(row.game_title),
    eventType: (row.event_type as CampusEvent['eventType']) || 'esports_squad',
    maxTeams: Number(row.max_teams || 24),
    baseFee: Number(row.base_fee ?? 299),
    lunchFee: Number(row.lunch_fee ?? 100),
    prizePoolTotal: Number(row.prize_pool_total ?? 10000),
    prizeBreakdown: (row.prize_breakdown as CampusEvent['prizeBreakdown']) || [],
    qrImageUrl: String(row.qr_image_url || ''),
    upiVpa: String(row.upi_vpa || ''),
    upiPayeeName: String(row.upi_payee_name || 'Srusti Academy of Management and Technology'),
    eventDateLabel: DEFAULT_EVENTS.some(e => e.slug === row.slug) ? EVENT_DATE_LABEL : String(row.event_date_label || 'Dates to be announced'),
    registrationDeadline: String(row.registration_deadline || 'Open until 24 slots fill'),
    venueLabel: String(row.venue_label || 'SAMT Campus LAN Arena'),
    isOpen: Boolean(row.is_open),
    rulesJson: row.rules_json as CampusEvent['rulesJson'],
  };
}

function mapSupabaseRegistration(row: Record<string, unknown>): StoredRegistration {
  return {
    id: String(row.id),
    teamCode: String(row.team_code),
    eventId: String(row.event_id),
    teamName: String(row.team_name),
    collegeName: String(row.college_name),
    iglPhone: String(row.igl_phone),
    iglEmail: String(row.igl_email),
    hasSubstitute: Boolean(row.has_substitute),
    lunchCount: Number(row.lunch_count || 0),
    vegCount: Number(row.veg_count || 0),
    nonVegCount: Number(row.non_veg_count || 0),
    baseFee: Number(row.base_fee ?? 299),
    lunchTotal: Number(row.lunch_total || 0),
    totalFee: Number(row.total_fee ?? 299),
    status: row.status as RegistrationStatus,
    slotNumber: row.slot_number ? String(row.slot_number) : null,
    groupName: row.group_name ? String(row.group_name) : null,
    eligibilityConfirmed: Boolean(row.eligibility_confirmed),
    fairPlayConfirmed: Boolean(row.fair_play_confirmed),
    activeSkillConfirmed: Boolean(row.active_skill_confirmed),
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
    lastEmailStatus: String(row.last_email_status || 'none'),
    lastEmailAt: row.last_email_at ? String(row.last_email_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// The database keeps character IDs unique per event, including rejected squads. A rejected
// squad's IDs are stored with this marker so its players can register again in a new squad.
const RELEASED_ID_MARKER = '~released~';

function releasedCharacterId(characterId: string, registrationId: string): string {
  return `${characterId}${RELEASED_ID_MARKER}${registrationId.slice(0, 8)}`;
}

function originalCharacterId(stored: string): string {
  return stored.split(RELEASED_ID_MARKER)[0];
}

const ROLE_ORDER = ['IGL', 'P2', 'P3', 'P4', 'SUB'];
function sortByRole<T extends { slotRole: string }>(members: T[]): T[] {
  return members.slice().sort((a, b) => ROLE_ORDER.indexOf(a.slotRole) - ROLE_ORDER.indexOf(b.slotRole));
}

function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505';
}

function mapSupabaseMember(row: Record<string, unknown>): StoredTeamMember {
  return {
    id: String(row.id),
    registrationId: String(row.registration_id),
    eventId: String(row.event_id),
    slotRole: row.slot_role as PlayerInput['slotRole'],
    fullName: String(row.full_name),
    inGameName: String(row.in_game_name),
    characterId: originalCharacterId(String(row.character_id)),
    academicLevel: String(row.academic_level || 'UG'),
    collegeOverride: row.college_override ? String(row.college_override) : undefined,
    wantsLunch: Boolean(row.wants_lunch),
    dietType: row.diet_type as PlayerInput['dietType'],
  };
}

function mapSupabaseProof(row: Record<string, unknown>): StoredPaymentProof {
  return {
    id: String(row.id),
    registrationId: String(row.registration_id),
    utrNumber: String(row.utr_number),
    upiApp: String(row.upi_app || 'UPI'),
    paidAmount: Number(row.paid_amount || 0),
    screenshotPath: String(row.screenshot_path),
    fileSha256: String(row.file_sha256),
    reviewStatus: row.review_status as StoredPaymentProof['reviewStatus'],
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
    verifiedBy: row.verified_by ? String(row.verified_by) : null,
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
    createdAt: String(row.created_at),
  };
}

function mapSupabaseAudit(row: Record<string, unknown>): StoredAuditLog {
  return {
    id: String(row.id),
    registrationId: String(row.registration_id),
    actorLabel: String(row.actor_label || 'SYSTEM'),
    action: row.action as StoredAuditLog['action'],
    notes: String(row.notes || ''),
    createdAt: String(row.created_at),
  };
}

// Seeding only needs to happen once per server instance; repeating it on every public
// request added a full database round trip to each page load.
let seedPromise: Promise<void> | null = null;

export async function ensureSeedEventsInSupabase(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedEventsInSupabase().catch((err) => {
      seedPromise = null;
      console.error('Supabase seed check warning:', err instanceof Error ? err.message : err);
    });
  }
  return seedPromise;
}

async function seedEventsInSupabase(): Promise<void> {
  const sb = getSupabaseServiceClient();
  if (!sb) return;
  const { data: existing, error } = await sb.from('events').select('slug');
  if (error) {
    seedPromise = null;
    console.error('Supabase seed check warning:', error.message);
    return;
  }
  const existingSlugs = new Set((existing || []).map((e) => String(e.slug)));
  for (const evt of DEFAULT_EVENTS) {
    if (!existingSlugs.has(evt.slug)) {
      await sb.from('events').insert({
        slug: evt.slug,
        title: evt.title,
        subtitle: evt.subtitle,
        game_title: evt.gameTitle,
        event_type: evt.eventType,
        max_teams: evt.maxTeams,
        base_fee: evt.baseFee,
        lunch_fee: evt.lunchFee,
        prize_pool_total: evt.prizePoolTotal,
        prize_breakdown: evt.prizeBreakdown,
        qr_image_url: evt.qrImageUrl,
        upi_vpa: evt.upiVpa || null,
        upi_payee_name: evt.upiPayeeName,
        event_date_label: evt.eventDateLabel,
        registration_deadline: evt.registrationDeadline,
        venue_label: evt.venueLabel,
        rules_json: evt.rulesJson,
        is_open: evt.isOpen,
      });
    }
  }
}

export async function listPublicEvents(): Promise<CampusEvent[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) {
    return readLocalStore().events;
  }

  // The seed check only matters on a brand-new database, so it runs alongside the reads
  // instead of in front of them (it used to add a full round trip to every cold start).
  const seeded = ensureSeedEventsInSupabase();
  const { data, error } = await sb.from('events').select('*').order('created_at', { ascending: true });
  let eventsData = data;
  if (error) throw new ClientInputError('Unable to complete the database request. Please try again.');
  if (!DEFAULT_EVENTS.every((d) => (eventsData || []).some((e) => e.slug === d.slug))) {
    await seeded;
    const retry = await sb.from('events').select('*').order('created_at', { ascending: true });
    if (!retry.error) eventsData = retry.data;
  }

  return (eventsData || []).map(mapSupabaseEvent);
}

/** One-row event lookup for registration. */
async function getEventForRegistration(slug: string): Promise<CampusEvent | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return getEventBySlug(slug);
  await ensureSeedEventsInSupabase();
  const { data, error } = await sb.from('events').select('*').eq('slug', slug).maybeSingle();
  if (error) throw new ClientInputError('Unable to complete the database request. Please try again.');
  return data ? mapSupabaseEvent(data as Record<string, unknown>) : null;
}

export async function getEventBySlug(slug: string): Promise<CampusEvent | null> {
  const all = await listPublicEvents();
  return all.find((e) => e.slug === slug) || null;
}

export async function createRegistrationWithProof(input: {
  eventSlug: string;
  teamName: string;
  collegeName: string;
  iglPhone: string;
  iglEmail: string;
  hasSubstitute: boolean;
  members: PlayerInput[];
  eligibilityConfirmed: boolean;
  fairPlayConfirmed: boolean;
  activeSkillConfirmed: boolean;
  utrNumber: string;
  upiApp: string;
  fileBuffer: Buffer;
}): Promise<RegistrationBundle> {
  const event = await getEventForRegistration(input.eventSlug);
  if (!event) {
    throw new ClientInputError('Selected event was not found.');
  }
  if (!event.isOpen) {
    throw new ClientInputError('Registrations for this event are currently closed.');
  }
  if (!event.qrImageUrl && !event.upiVpa) {
    throw new ClientInputError(
      'Payment details for this event are not published yet. Please try again later or contact the coordinators.'
    );
  }

  const squadValidation = validateSquadSubmission({
    eventSlug: event.slug,
    teamName: input.teamName,
    collegeName: input.collegeName,
    iglPhone: input.iglPhone,
    iglEmail: input.iglEmail,
    hasSubstitute: input.hasSubstitute,
    members: input.members,
    eligibilityConfirmed: input.eligibilityConfirmed,
    fairPlayConfirmed: input.fairPlayConfirmed,
    activeSkillConfirmed: input.activeSkillConfirmed,
  });

  if (!squadValidation.valid) {
    const firstMsg = Object.values(squadValidation.errors)[0] || 'Invalid squad details.';
    throw new ClientInputError(firstMsg);
  }

  const normalizedUtr = normalizeUtr(input.utrNumber);
  if (!isValidUtr(normalizedUtr)) {
    throw new ClientInputError('Enter a valid 12-digit UPI UTR / Transaction Reference Number.');
  }

  const mime = detectImageMimeFromMagicBytes(input.fileBuffer);
  if (!mime) {
    throw new ClientInputError('Payment screenshot must be a valid JPEG, PNG, or WebP image.');
  }
  if (input.fileBuffer.length > 5 * 1024 * 1024) {
    throw new ClientInputError('Payment screenshot exceeds the 5 MB upload limit.');
  }

  const fileSha256 = crypto.createHash('sha256').update(input.fileBuffer).digest('hex');
  const activeMembers = input.members
    .filter((member) => input.hasSubstitute || member.slotRole !== 'SUB')
    .map(({ otherAcademicLevel, ...member }) => ({
      ...member,
      academicLevel: member.academicLevel.trim() === OTHER_ACADEMIC_LEVEL
        ? otherAcademicLevel?.trim() ?? ''
        : member.academicLevel.trim(),
      collegeOverride: member.collegeOverride?.trim(),
    }));
  const fees = calculateRegistrationFee(activeMembers, event.baseFee, event.lunchFee);
  const cleanPhone = normalizePhone(input.iglPhone);
  const cleanEmail = input.iglEmail.trim().toLowerCase();
  const cleanTeamName = input.teamName.trim();
  const cleanCollege = input.collegeName.trim();

  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const activeEventRegs = store.registrations.filter(
      (r) => r.eventId === event.id && r.status !== 'rejected'
    );
    const isWaitlisted = activeEventRegs.length >= event.maxTeams;

    if (
      activeEventRegs.some((r) => r.teamName.toLowerCase() === cleanTeamName.toLowerCase())
    ) {
      throw new ClientInputError(`Team name "${cleanTeamName}" is already registered for ${event.title}.`);
    }

    const activeEventMemberIds = new Set(
      store.members
        .filter((m) => {
          const reg = store.registrations.find((r) => r.id === m.registrationId);
          return m.eventId === event.id && reg && reg.status !== 'rejected';
        })
        .map((m) => m.characterId.trim().toLowerCase())
    );
    for (const member of activeMembers) {
      if (activeEventMemberIds.has(member.characterId.trim().toLowerCase())) {
        throw new ClientInputError(
          `Character ID "${member.characterId}" is already registered in another squad for ${event.title}.`
        );
      }
    }

    const activeProofs = store.proofs.filter((p) => p.reviewStatus !== 'rejected');
    if (activeProofs.some((p) => p.utrNumber.toUpperCase() === normalizedUtr)) {
      throw new ClientInputError(
        `UTR / Reference "${normalizedUtr}" has already been used for another registration.`
      );
    }
    if (activeProofs.some((p) => p.fileSha256 === fileSha256)) {
      throw new ClientInputError('This exact payment screenshot file has already been submitted.');
    }

    const prefix = teamCodePrefix(event);
    // Older stores count by event. Use every counter for this prefix so codes stay
    // unique even when two events share a game or saved registrations are deleted.
    const priorSequences = store.events.filter((item) => teamCodePrefix(item) === prefix)
      .map((item) => store.eventSequences[item.id] || 0);
    const lastIssued = highestTeamSequence(store.registrations.map((registration) => registration.teamCode), prefix);
    const nextSeq = Math.max(lastIssued, ...priorSequences) + 1;
    store.eventSequences[event.id] = nextSeq;
    const teamCode = formatTeamCode(prefix, nextSeq);
    const now = new Date().toISOString();
    const regId = crypto.randomUUID();
    const ext = extFromMime(mime);
    const fileName = `${regId}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), input.fileBuffer);

    const registration: StoredRegistration = {
      id: regId,
      teamCode,
      eventId: event.id,
      teamName: cleanTeamName,
      collegeName: cleanCollege,
      iglPhone: cleanPhone,
      iglEmail: cleanEmail,
      hasSubstitute: input.hasSubstitute,
      lunchCount: fees.lunchCount,
      vegCount: fees.vegCount,
      nonVegCount: fees.nonVegCount,
      baseFee: fees.baseFee,
      lunchTotal: fees.lunchTotal,
      totalFee: fees.totalFee,
      status: isWaitlisted ? 'waitlisted' : 'pending',
      slotNumber: null,
      groupName: null,
      eligibilityConfirmed: input.eligibilityConfirmed,
      fairPlayConfirmed: input.fairPlayConfirmed,
      activeSkillConfirmed: input.activeSkillConfirmed,
      rejectionReason: null,
      lastEmailStatus: 'pending_send',
      lastEmailAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const storedMembers: StoredTeamMember[] = activeMembers.map((m) => ({
      ...m,
      id: crypto.randomUUID(),
      registrationId: regId,
      eventId: event.id,
      fullName: m.fullName.trim(),
      inGameName: m.inGameName.trim(),
      characterId: m.characterId.trim(),
      dietType: m.wantsLunch ? m.dietType : 'NONE',
    }));

    const proof: StoredPaymentProof = {
      id: crypto.randomUUID(),
      registrationId: regId,
      utrNumber: normalizedUtr,
      upiApp: input.upiApp.trim() || 'UPI',
      paidAmount: fees.totalFee,
      screenshotPath: fileName,
      fileSha256,
      reviewStatus: 'pending',
      rejectionReason: null,
      verifiedBy: null,
      verifiedAt: null,
      createdAt: now,
    };

    const audit: StoredAuditLog = {
      id: crypto.randomUUID(),
      registrationId: regId,
      actorLabel: `IGL (${cleanPhone})`,
      action: 'SUBMIT',
      notes: `Submitted squad (${storedMembers.length} players, Rs. ${fees.totalFee}, UTR ${normalizedUtr}).`,
      createdAt: now,
    };

    store.registrations.push(registration);
    store.members.push(...storedMembers);
    store.proofs.push(proof);
    store.auditLogs.push(audit);
    writeLocalStore(store);

    return {
      registration,
      event,
      members: storedMembers,
      proofs: [proof],
      auditLogs: [audit],
    };
  }

  // Supabase Free production path. Independent pre-checks run in parallel so a submission
  // costs one round trip instead of five before anything is written.
  const prefix = teamCodePrefix(event);
  const characterIds = activeMembers.map((m) => m.characterId.trim());
  const [activeCountRes, dupUtrRes, dupHashRes, recentCodesRes, activeTeamsRes, dupMembersRes] =
    await Promise.all([
      sb
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .neq('status', 'rejected'),
      sb
        .from('payment_proofs')
        .select('id')
        .eq('utr_number', normalizedUtr)
        .neq('review_status', 'rejected')
        .limit(1),
      sb
        .from('payment_proofs')
        .select('id')
        .eq('file_sha256', fileSha256)
        .neq('review_status', 'rejected')
        .limit(1),
      sb.from('registrations').select('team_code').like('team_code', `${prefix}-%`)
        .order('created_at', { ascending: false }).limit(12),
      sb
        .from('registrations')
        .select('id')
        .eq('event_id', event.id)
        .neq('status', 'rejected')
        .ilike('team_name', cleanTeamName.replace(/[\\%_]/g, (c) => `\\${c}`))
        .limit(1),
      sb
        .from('team_members')
        .select('character_id')
        .eq('event_id', event.id)
        .in('character_id', characterIds),
    ]);

  const firstError = [activeCountRes, dupUtrRes, dupHashRes, recentCodesRes, activeTeamsRes, dupMembersRes]
    .map((r) => r.error)
    .find(Boolean);
  if (firstError) {
    console.error('Registration pre-check failed:', firstError.message);
    throw new ClientInputError('Registration service is busy. Please try again in a moment.');
  }

  const isWaitlisted = (activeCountRes.count || 0) >= event.maxTeams;
  const highestTeamNumber = highestTeamSequence((recentCodesRes.data || []).map((row) => row.team_code), prefix);
  if (dupUtrRes.data && dupUtrRes.data.length > 0) {
    throw new ClientInputError(`UTR / Reference "${normalizedUtr}" has already been submitted.`);
  }
  if (dupHashRes.data && dupHashRes.data.length > 0) {
    throw new ClientInputError('This exact payment screenshot file has already been submitted.');
  }
  if (activeTeamsRes.data && activeTeamsRes.data.length > 0) {
    throw new ClientInputError(`Team name "${cleanTeamName}" is already registered for ${event.title}.`);
  }
  const takenId = (dupMembersRes.data || [])[0];
  if (takenId) {
    throw new ClientInputError(
      `Character ID "${takenId.character_id}" is already registered in another squad for ${event.title}.`
    );
  }

  const ext = extFromMime(mime);
  const storagePath = `${event.slug}/${crypto.randomUUID()}.${ext}`;

  // Team codes follow the highest existing number; two squads submitting at the same moment
  // get the same number, so retry with the next code instead of failing.
  const insertRegistration = async () => {
    let row: Record<string, unknown> | null = null;
    let err: { code?: string; message: string } | null = null;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      // The unique database constraint resolves concurrent claims and protects older codes.
      const sequence = attempt < 6 ? highestTeamNumber + attempt : crypto.randomInt(100_000_000, 1_000_000_000);
      const teamCode = formatTeamCode(prefix, sequence);
      const result = await sb
        .from('registrations')
        .insert({
          team_code: teamCode,
          event_id: event.id,
          team_name: cleanTeamName,
          college_name: cleanCollege,
          igl_phone: cleanPhone,
          igl_email: cleanEmail,
          has_substitute: input.hasSubstitute,
          lunch_count: fees.lunchCount,
          veg_count: fees.vegCount,
          non_veg_count: fees.nonVegCount,
          base_fee: fees.baseFee,
          lunch_total: fees.lunchTotal,
          total_fee: fees.totalFee,
          status: isWaitlisted ? 'waitlisted' : 'pending',
          last_email_status: 'pending_send',
          eligibility_confirmed: input.eligibilityConfirmed,
          fair_play_confirmed: input.fairPlayConfirmed,
          active_skill_confirmed: input.activeSkillConfirmed,
        })
        .select()
        .single();
      row = (result.data as Record<string, unknown> | null) ?? null;
      err = result.error;
      const codeClash = isUniqueViolation(err) && /team_code/i.test(err?.message || '');
      if (!codeClash) break;
    }
    return { row, err };
  };

  // The screenshot upload and the registration row do not depend on each other.
  const [uploadRes, regResult] = await Promise.all([
    sb.storage.from('payment-proofs').upload(storagePath, input.fileBuffer, { contentType: mime, upsert: false }),
    insertRegistration(),
  ]);
  const regRow = regResult.row;
  const regErr = regResult.err;

  if (uploadRes.error || regErr || !regRow) {
    if (regRow) await sb.from('registrations').delete().eq('id', String(regRow.id));
    if (!uploadRes.error) await sb.storage.from('payment-proofs').remove([storagePath]);
    if (uploadRes.error) {
      console.error('Payment proof upload failed:', uploadRes.error.message);
      throw new ClientInputError('Unable to save payment screenshot. Please try again.');
    }
    if (isUniqueViolation(regErr) && /team_name/i.test(regErr?.message || '')) {
      throw new ClientInputError(`Team name "${cleanTeamName}" is already registered for ${event.title}.`);
    }
    console.error('Registration insert failed:', regErr?.message);
    throw new ClientInputError('Registration could not be saved. Please try again.');
  }

  const regId = String(regRow.id);
  const memberInserts = activeMembers.map((m) => ({
    registration_id: regId,
    event_id: event.id,
    slot_role: m.slotRole,
    full_name: m.fullName.trim(),
    in_game_name: m.inGameName.trim(),
    character_id: m.characterId.trim(),
    academic_level: m.academicLevel,
    college_override: m.collegeOverride || null,
    wants_lunch: m.wantsLunch,
    diet_type: m.wantsLunch ? m.dietType : 'NONE',
  }));

  // Roster, payment proof and audit entry are independent of each other once the row exists.
  const [memRes, proofRes, auditRes] = await Promise.all([
    sb.from('team_members').insert(memberInserts).select(),
    sb
      .from('payment_proofs')
      .insert({
        registration_id: regId,
        utr_number: normalizedUtr,
        upi_app: input.upiApp.trim() || 'UPI',
        paid_amount: fees.totalFee,
        screenshot_path: storagePath,
        file_sha256: fileSha256,
        review_status: 'pending',
      })
      .select()
      .single(),
    sb
      .from('payment_audit_logs')
      .insert({
        registration_id: regId,
        actor_label: `IGL (${cleanPhone})`,
        action: 'SUBMIT',
        notes: `Submitted squad (${activeMembers.length} players, Rs. ${fees.totalFee}, UTR ${normalizedUtr}).`,
      })
      .select()
      .single(),
  ]);

  if (memRes.error || proofRes.error || !proofRes.data) {
    // Deleting the registration removes any roster/proof/audit rows already written.
    await sb.from('registrations').delete().eq('id', regId);
    await sb.storage.from('payment-proofs').remove([storagePath]);
    if (isUniqueViolation(memRes.error)) {
      throw new ClientInputError('One of these Character IDs is already registered in another squad for this event.');
    }
    if (isUniqueViolation(proofRes.error)) {
      throw new ClientInputError('This UTR or payment screenshot has already been submitted.');
    }
    console.error('Registration write failed:', (memRes.error || proofRes.error)?.message);
    throw new ClientInputError('Unable to save your registration. Please try again.');
  }

  return {
    registration: mapSupabaseRegistration(regRow as Record<string, unknown>),
    event,
    members: sortByRole((memRes.data || []).map((m) => mapSupabaseMember(m as Record<string, unknown>))),
    proofs: [mapSupabaseProof(proofRes.data as Record<string, unknown>)],
    auditLogs: auditRes.data ? [mapSupabaseAudit(auditRes.data as Record<string, unknown>)] : [],
  };
}

export async function recordEmailAudit(
  registrationId: string,
  sent: boolean,
  notes: string,
  expectedStatus?: RegistrationStatus,
): Promise<void> {
  const now = new Date().toISOString();
  const statusStr = sent ? 'sent' : 'failed_or_unconfigured';
  const action = sent ? 'EMAIL_SENT' : 'EMAIL_FAIL';
  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const reg = store.registrations.find((r) => r.id === registrationId);
    if (reg && (!expectedStatus || reg.status === expectedStatus)) {
      reg.lastEmailStatus = statusStr;
      reg.lastEmailAt = now;
      reg.updatedAt = now;
    }
    store.auditLogs.push({
      id: crypto.randomUUID(),
      registrationId,
      actorLabel: 'EMAIL_SERVICE',
      action,
      notes,
      createdAt: now,
    });
    writeLocalStore(store);
    return;
  }

  let update = sb
    .from('registrations')
    .update({ last_email_status: statusStr, last_email_at: now, updated_at: now })
    .eq('id', registrationId);
  if (expectedStatus) update = update.eq('status', expectedStatus);
  const { error: statusError } = await update;
  if (statusError) throw new Error('Email status update failed.');

  const { error: auditError } = await sb.from('payment_audit_logs').insert({
    registration_id: registrationId,
    actor_label: 'EMAIL_SERVICE',
    action,
    notes,
  });
  if (auditError) throw new Error('Email audit update failed.');
}

/** One identifier reveals status only, never the other identifier or payment/player data. */
export async function lookupRegistrationStatus(teamCodeRaw: string, phoneRaw: string) {
  const code = teamCodeRaw.trim().toUpperCase();
  const phone = normalizePhone(phoneRaw);
  if ((!code && !phone) || (code && !/^[A-Z0-9-]{3,40}$/.test(code)) ||
      (phoneRaw.trim() && !isValidIndianPhone(phone))) {
    throw new ClientInputError('Enter a valid Team Registration ID or 10-digit team leader mobile number.');
  }
  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    return store.registrations.filter((r) => (!code || r.teamCode.toUpperCase() === code) &&
      (!phone || r.iglPhone === phone)).map((r) => {
      const event = store.events.find((e) => e.id === r.eventId);
      return { teamName: r.teamName, status: r.status, slotNumber: r.slotNumber,
        groupName: r.groupName, eventTitle: event?.title || '',
        venueLabel: event?.venueLabel || '', eventDateLabel: event?.eventDateLabel || '' };
    });
  }
  let query = sb.from('registrations')
    .select('team_name,status,slot_number,group_name,events(title,venue_label,event_date_label)')
    .order('created_at', { ascending: false });
  if (code) query = query.eq('team_code', code);
  if (phone) query = query.eq('igl_phone', phone);
  const { data, error } = await query;
  if (error) throw new Error('Status lookup unavailable.');
  return (data || []).map((row) => {
    const event = (Array.isArray(row.events) ? row.events[0] : row.events) as
      { title: string; venue_label: string; event_date_label: string } | null;
    return { teamName: row.team_name, status: row.status, slotNumber: row.slot_number,
      groupName: row.group_name, eventTitle: event?.title || '',
      venueLabel: event?.venue_label || '', eventDateLabel: event?.event_date_label || '' };
  });
}

export async function trackRegistration(
  teamCodeRaw: string,
  iglPhoneRaw: string
): Promise<RegistrationBundle | null> {
  const cleanCode = teamCodeRaw.trim().toUpperCase();
  const cleanPhone = normalizePhone(iglPhoneRaw);
  if (!cleanCode || !isValidIndianPhone(cleanPhone)) {
    return null;
  }

  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const matches = store.registrations.filter(
      (r) => r.teamCode.toUpperCase() === cleanCode && r.iglPhone === cleanPhone
    );
    return matches.length === 1 ? loadLocalBundle(store, matches[0]) : null;
  }

  const { data: regRow, error: regErr } = await sb
    .from('registrations')
    .select('*')
    .eq('team_code', cleanCode)
    .eq('igl_phone', cleanPhone)
    .maybeSingle();
  if (regErr) throw new Error(`Registration lookup failed: ${regErr.message}`);
  if (!regRow) return null;
  return loadSupabaseBundle(sb, regRow as Record<string, unknown>);
}

function loadLocalBundle(store: LocalStoreData, registration: StoredRegistration): RegistrationBundle {
  const event = store.events.find((e) => e.id === registration.eventId) || DEFAULT_EVENTS[0];
  const members = store.members.filter((m) => m.registrationId === registration.id);
  const proofs = store.proofs.filter((p) => p.registrationId === registration.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const auditLogs = store.auditLogs.filter((a) => a.registrationId === registration.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { registration, event, members, proofs, auditLogs };
}

async function loadSupabaseBundle(
  sb: SupabaseClient,
  regRow: Record<string, unknown>
): Promise<RegistrationBundle> {
  const reg = mapSupabaseRegistration(regRow);
  const [{ data: evtRow }, { data: memRows }, { data: proofRows }, { data: auditRows }] =
    await Promise.all([
      sb.from('events').select('*').eq('id', reg.eventId).maybeSingle(),
      sb.from('team_members').select('*').eq('registration_id', reg.id),
      sb
        .from('payment_proofs')
        .select('*')
        .eq('registration_id', reg.id)
        .order('created_at', { ascending: false }),
      sb
        .from('payment_audit_logs')
        .select('*')
        .eq('registration_id', reg.id)
        .order('created_at', { ascending: false }),
    ]);

  return {
    registration: reg,
    event: evtRow ? mapSupabaseEvent(evtRow as Record<string, unknown>) : DEFAULT_EVENTS[0],
    members: sortByRole((memRows || []).map((m) => mapSupabaseMember(m as Record<string, unknown>))),
    proofs: (proofRows || []).map((p) => mapSupabaseProof(p as Record<string, unknown>)),
    auditLogs: (auditRows || []).map((a) => mapSupabaseAudit(a as Record<string, unknown>)),
  };
}

/** Loads one registration for admin actions without reading the whole dashboard. */
export async function getRegistrationBundleById(registrationId: string): Promise<RegistrationBundle | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const reg = store.registrations.find((r) => r.id === registrationId);
    return reg ? loadLocalBundle(store, reg) : null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(registrationId)) return null;
  const { data: regRow, error } = await sb
    .from('registrations')
    .select('*')
    .eq('id', registrationId)
    .maybeSingle();
  if (error) throw new Error(`Registration lookup failed: ${error.message}`);
  return regRow ? loadSupabaseBundle(sb, regRow as Record<string, unknown>) : null;
}

/**
 * Before a rejected squad becomes active again (re-upload or admin decision), make sure no
 * other active squad has taken its team name or players in the meantime, and restore the
 * released character IDs.
 */
async function reactivateRejectedSquad(bundle: RegistrationBundle): Promise<void> {
  const reg = bundle.registration;
  if (reg.status !== 'rejected') return;
  const ids = bundle.members.map((m) => m.characterId.trim().toLowerCase());
  const sb = getSupabaseServiceClient();

  if (!sb) {
    const store = readLocalStore();
    const activeOthers = store.registrations.filter(
      (r) => r.eventId === reg.eventId && r.id !== reg.id && r.status !== 'rejected'
    );
    if (activeOthers.some((r) => r.teamName.toLowerCase() === reg.teamName.toLowerCase())) {
      throw new ClientInputError(`Team name "${reg.teamName}" has since been registered by another squad.`);
    }
    const activeIds = new Set(
      store.members
        .filter((m) => activeOthers.some((r) => r.id === m.registrationId))
        .map((m) => m.characterId.trim().toLowerCase())
    );
    if (ids.some((id) => activeIds.has(id))) {
      throw new ClientInputError('A player from this squad has since been registered in another squad.');
    }
    return;
  }

  const { data: nameRows, error: nameErr } = await sb
    .from('registrations')
    .select('id')
    .eq('event_id', reg.eventId)
    .neq('id', reg.id)
    .neq('status', 'rejected')
    .ilike('team_name', reg.teamName.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1);
  if (nameErr) throw new ClientInputError('Unable to complete the database request. Please try again.');
  if (nameRows && nameRows.length > 0) {
    throw new ClientInputError(`Team name "${reg.teamName}" has since been registered by another squad.`);
  }

  for (const member of bundle.members) {
    const { error } = await sb
      .from('team_members')
      .update({ character_id: member.characterId })
      .eq('id', member.id);
    if (error) {
      // Roll back the members already restored so the squad stays consistently released.
      for (const restored of bundle.members) {
        if (restored.id === member.id) break;
        await sb
          .from('team_members')
          .update({ character_id: releasedCharacterId(restored.characterId, reg.id) })
          .eq('id', restored.id);
      }
      if (isUniqueViolation(error)) {
        throw new ClientInputError(
          `Character ID "${member.characterId}" has since been registered in another squad.`
        );
      }
      throw new ClientInputError('Unable to complete the database request. Please try again.');
    }
  }
}

/** Frees a rejected squad's character IDs so those players may register in a new squad. */
async function releaseRejectedSquadIds(sb: SupabaseClient, registrationId: string): Promise<void> {
  const { data: rows, error } = await sb
    .from('team_members')
    .select('id, character_id')
    .eq('registration_id', registrationId);
  if (error) {
    console.error('Could not release character IDs:', error.message);
    return;
  }
  await Promise.all(
    (rows || [])
      .filter((row) => !String(row.character_id).includes(RELEASED_ID_MARKER))
      .map((row) =>
        sb
          .from('team_members')
          .update({ character_id: releasedCharacterId(String(row.character_id), registrationId) })
          .eq('id', row.id)
      )
  );
}

export async function resubmitPaymentProof(input: {
  teamCode: string;
  iglPhone: string;
  utrNumber: string;
  upiApp: string;
  fileBuffer: Buffer;
}): Promise<RegistrationBundle> {
  const bundle = await trackRegistration(input.teamCode, input.iglPhone);
  if (!bundle) {
    throw new ClientInputError('Team Registration ID and IGL Phone Number did not match any record.');
  }
  if (
    bundle.registration.status !== 'reupload_required' &&
    bundle.registration.status !== 'rejected'
  ) {
    throw new ClientInputError('Re-upload is only permitted when payment proof is flagged or rejected.');
  }

  const normalizedUtr = normalizeUtr(input.utrNumber);
  if (!isValidUtr(normalizedUtr)) {
    throw new ClientInputError('Enter a valid 12-digit UPI UTR / Reference Number.');
  }
  const mime = detectImageMimeFromMagicBytes(input.fileBuffer);
  if (!mime) {
    throw new ClientInputError('Payment screenshot must be JPEG, PNG, or WebP.');
  }
  if (input.fileBuffer.length > 5 * 1024 * 1024) {
    throw new ClientInputError('Payment screenshot exceeds 5 MB.');
  }
  const fileSha256 = crypto.createHash('sha256').update(input.fileBuffer).digest('hex');
  const now = new Date().toISOString();

  const ownRegistrationId = bundle.registration.id;
  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const activeProofs = store.proofs.filter((p) => p.reviewStatus !== 'rejected');
    // A team may resubmit a clearer screenshot of the same payment, so its own flagged
    // proof does not count as "another submission" for the UTR check.
    if (
      activeProofs.some(
        (p) => p.registrationId !== ownRegistrationId && p.utrNumber.toUpperCase() === normalizedUtr
      )
    ) {
      throw new ClientInputError(`UTR "${normalizedUtr}" is already used by another submission.`);
    }
    if (activeProofs.some((p) => p.fileSha256 === fileSha256)) {
      throw new ClientInputError('This exact screenshot file has already been uploaded.');
    }
    await reactivateRejectedSquad(bundle);
    // The flagged proof is superseded by this upload and was never accepted.
    for (const p of store.proofs) {
      if (p.registrationId === ownRegistrationId && p.reviewStatus === 'reupload_required') {
        p.reviewStatus = 'rejected';
      }
    }

    const ext = extFromMime(mime);
    const fileName = `${bundle.registration.id}-reup-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), input.fileBuffer);

    const newProof: StoredPaymentProof = {
      id: crypto.randomUUID(),
      registrationId: bundle.registration.id,
      utrNumber: normalizedUtr,
      upiApp: input.upiApp.trim() || 'UPI',
      paidAmount: bundle.registration.totalFee,
      screenshotPath: fileName,
      fileSha256,
      reviewStatus: 'pending',
      rejectionReason: null,
      verifiedBy: null,
      verifiedAt: null,
      createdAt: now,
    };

    const reg = store.registrations.find((r) => r.id === bundle.registration.id)!;
    reg.status = 'pending';
    reg.rejectionReason = null;
    reg.updatedAt = now;

    store.proofs.push(newProof);
    store.auditLogs.push({
      id: crypto.randomUUID(),
      registrationId: reg.id,
      actorLabel: `IGL (${reg.iglPhone})`,
      action: 'REUPLOAD',
      notes: `Re-uploaded proof with UTR ${normalizedUtr}.`,
      createdAt: now,
    });
    writeLocalStore(store);

    return (await trackRegistration(reg.teamCode, reg.iglPhone))!;
  }

  const { data: dupUtr, error: dupUtrErr } = await sb
    .from('payment_proofs')
    .select('id')
    .eq('utr_number', normalizedUtr)
    .neq('review_status', 'rejected')
    .neq('registration_id', ownRegistrationId)
    .limit(1);
  if (dupUtrErr) throw new ClientInputError('Unable to complete the database request. Please try again.');
  if (dupUtr && dupUtr.length > 0) {
    throw new ClientInputError(`UTR "${normalizedUtr}" is already used by another submission.`);
  }
  const { data: dupHash, error: dupHashErr } = await sb
    .from('payment_proofs')
    .select('id')
    .eq('file_sha256', fileSha256)
    .neq('review_status', 'rejected')
    .limit(1);
  if (dupHashErr) throw new ClientInputError('Unable to complete the database request. Please try again.');
  if (dupHash && dupHash.length > 0) {
    throw new ClientInputError('This exact screenshot file has already been uploaded.');
  }

  const wasRejected = bundle.registration.status === 'rejected';
  await reactivateRejectedSquad(bundle);
  try {
    return await storeSupabaseReupload(sb, bundle, {
      normalizedUtr,
      upiApp: input.upiApp,
      fileBuffer: input.fileBuffer,
      fileSha256,
      mime,
      now,
    });
  } catch (err) {
    if (wasRejected) await releaseRejectedSquadIds(sb, ownRegistrationId);
    throw err;
  }
}

async function storeSupabaseReupload(
  sb: SupabaseClient,
  bundle: RegistrationBundle,
  input: {
    normalizedUtr: string;
    upiApp: string;
    fileBuffer: Buffer;
    fileSha256: string;
    mime: 'image/jpeg' | 'image/png' | 'image/webp';
    now: string;
  }
): Promise<RegistrationBundle> {
  const { normalizedUtr, fileSha256, mime, now } = input;
  const ownRegistrationId = bundle.registration.id;
  const ext = extFromMime(mime);
  const storagePath = `${bundle.event.slug}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadErr } = await sb.storage
    .from('payment-proofs')
    .upload(storagePath, input.fileBuffer, { contentType: mime });
  if (uploadErr) throw new ClientInputError('Unable to save the image. Please try again.');

  // Supersede the flagged proof so the partial unique UTR index allows the same payment
  // reference to be resubmitted with a clearer screenshot. Restored if the insert fails.
  const { data: supersededRows, error: supersedeErr } = await sb
    .from('payment_proofs')
    .update({ review_status: 'rejected' })
    .eq('registration_id', ownRegistrationId)
    .eq('review_status', 'reupload_required')
    .select('id');
  if (supersedeErr) {
    await sb.storage.from('payment-proofs').remove([storagePath]);
    throw new ClientInputError('Unable to save payment proof. Please try again.');
  }
  const supersededIds = (supersededRows || []).map((row) => String(row.id));

  const { error: proofErr } = await sb.from('payment_proofs').insert({
    registration_id: bundle.registration.id,
    utr_number: normalizedUtr,
    upi_app: input.upiApp.trim() || 'UPI',
    paid_amount: bundle.registration.totalFee,
    screenshot_path: storagePath,
    file_sha256: fileSha256,
    review_status: 'pending',
  });
  if (proofErr) {
    if (supersededIds.length > 0) {
      await sb
        .from('payment_proofs')
        .update({ review_status: 'reupload_required' })
        .in('id', supersededIds);
    }
    await sb.storage.from('payment-proofs').remove([storagePath]);
    throw new ClientInputError('Unable to save payment proof. Please try again.');
  }

  const { error: statusErr } = await sb
    .from('registrations')
    .update({ status: 'pending', rejection_reason: null, updated_at: now })
    .eq('id', bundle.registration.id);
  if (statusErr) {
    console.error('Re-upload status update failed:', statusErr.message);
    throw new ClientInputError('Your proof was saved but the status could not be updated. Please contact the coordinators.');
  }

  await sb.from('payment_audit_logs').insert({
    registration_id: bundle.registration.id,
    actor_label: `IGL (${bundle.registration.iglPhone})`,
    action: 'REUPLOAD',
    notes: `Re-uploaded proof with UTR ${normalizedUtr}.`,
  });

  return (await trackRegistration(bundle.registration.teamCode, bundle.registration.iglPhone))!;
}

export async function listAdminDashboardData(): Promise<{
  events: CampusEvent[];
  bundles: RegistrationBundle[];
  auditLogs: StoredAuditLog[];
}> {
  const sb = getSupabaseServiceClient();
  if (!sb) {
    const events = await listPublicEvents();
    const eventMap = new Map(events.map((e) => [e.id, e]));
    const store = readLocalStore();
    const bundles: RegistrationBundle[] = store.registrations
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((reg) => {
        const proofs = store.proofs
          .filter((p) => p.registrationId === reg.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const latest = proofs[0];
        return {
          registration: reg,
          event: eventMap.get(reg.eventId) || DEFAULT_EVENTS[0],
          members: store.members.filter((m) => m.registrationId === reg.id),
          proofs,
          auditLogs: store.auditLogs
            .filter((a) => a.registrationId === reg.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          latestProofUrl: latest ? `/api/admin/proof-image/${latest.id}` : null,
        };
      });

    return {
      events,
      bundles,
      auditLogs: store.auditLogs
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }

  const [events, regRes, memRes, proofRes, auditRes] = await Promise.all([
    listPublicEvents(),
    sb.from('registrations').select('*').order('created_at', { ascending: false }),
    sb.from('team_members').select('*'),
    sb.from('payment_proofs').select('*').order('created_at', { ascending: false }),
    sb.from('payment_audit_logs').select('*').order('created_at', { ascending: false }).limit(2000),
  ]);
  const loadErr = [regRes, memRes, proofRes, auditRes].map((r) => r.error).find(Boolean);
  if (loadErr) throw new Error(`Admin dashboard load failed: ${loadErr.message}`);
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const regRows = regRes.data;
  const memRows = memRes.data;
  const proofRows = proofRes.data;
  const auditRows = auditRes.data;

  const membersByReg = new Map<string, StoredTeamMember[]>();
  for (const row of memRows || []) {
    const m = mapSupabaseMember(row as Record<string, unknown>);
    const list = membersByReg.get(m.registrationId) || [];
    list.push(m);
    membersByReg.set(m.registrationId, list);
  }

  const proofsByReg = new Map<string, StoredPaymentProof[]>();
  for (const row of proofRows || []) {
    const p = mapSupabaseProof(row as Record<string, unknown>);
    const list = proofsByReg.get(p.registrationId) || [];
    list.push(p);
    proofsByReg.set(p.registrationId, list);
  }

  const auditsByReg = new Map<string, StoredAuditLog[]>();
  const allAudits: StoredAuditLog[] = [];
  for (const row of auditRows || []) {
    const a = mapSupabaseAudit(row as Record<string, unknown>);
    allAudits.push(a);
    const list = auditsByReg.get(a.registrationId) || [];
    list.push(a);
    auditsByReg.set(a.registrationId, list);
  }

  const bundles: RegistrationBundle[] = [];
  for (const row of regRows || []) {
    const reg = mapSupabaseRegistration(row as Record<string, unknown>);
    const proofs = proofsByReg.get(reg.id) || [];
    const latest = proofs[0];
    // Served through the authorized admin route: signed storage URLs expired after five
    // minutes and broke proofs for admins who kept the dashboard open.
    const latestProofUrl = latest ? `/api/admin/proof-image/${latest.id}` : null;
    bundles.push({
      registration: reg,
      event: eventMap.get(reg.eventId) || DEFAULT_EVENTS[0],
      members: sortByRole(membersByReg.get(reg.id) || []),
      proofs,
      auditLogs: auditsByReg.get(reg.id) || [],
      latestProofUrl,
    });
  }

  return { events, bundles, auditLogs: allAudits };
}

export async function getProofFile(proofId: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return getLocalProofFile(proofId);
  if (!/^[0-9a-f-]{36}$/i.test(proofId)) return null;
  const { data: row } = await sb
    .from('payment_proofs')
    .select('screenshot_path')
    .eq('id', proofId)
    .maybeSingle();
  if (!row?.screenshot_path) return null;
  const { data: blob, error } = await sb.storage
    .from('payment-proofs')
    .download(String(row.screenshot_path));
  if (error || !blob) return null;
  const buffer = Buffer.from(await blob.arrayBuffer());
  return { buffer, mime: detectImageMimeFromMagicBytes(buffer) || 'image/jpeg' };
}

export async function getLocalProofFile(proofId: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const store = readLocalStore();
  const proof = store.proofs.find((p) => p.id === proofId);
  if (!proof) return null;
  const fullPath = path.join(UPLOAD_DIR, path.basename(proof.screenshotPath));
  if (!fs.existsSync(fullPath)) return null;
  const buffer = fs.readFileSync(fullPath);
  const mime = detectImageMimeFromMagicBytes(buffer) || 'image/jpeg';
  return { buffer, mime };
}

export async function getLocalQrFile(fileName: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const fullPath = path.join(QR_DIR, path.basename(fileName));
  if (!fs.existsSync(fullPath)) return null;
  const buffer = fs.readFileSync(fullPath);
  const mime = detectImageMimeFromMagicBytes(buffer) || 'image/png';
  return { buffer, mime };
}

export async function decideRegistrationPayment(input: {
  registrationId: string;
  decision: 'approve' | 'reject' | 'reupload_required';
  reason?: string;
  actorEmail: string;
  actorId?: string | null;
}): Promise<RegistrationBundle> {
  const supabase = getSupabaseServiceClient();
  if (supabase) return decideInSupabase(supabase, input);

  const now = new Date().toISOString();
  const current = await getRegistrationBundleById(input.registrationId);
  if (!current) throw new ClientInputError('Registration not found.');
  // A rejected squad released its team name and players; check nobody else took them.
  if (input.decision !== 'reject') await reactivateRejectedSquad(current);
  const sb = getSupabaseServiceClient();

  if (!sb) {
    const store = readLocalStore();
    const reg = store.registrations.find((r) => r.id === input.registrationId);
    if (!reg) throw new ClientInputError('Registration not found.');
    const event = store.events.find((e) => e.id === reg.eventId) || DEFAULT_EVENTS[0];
    const latestProof = store.proofs
      .filter((p) => p.registrationId === reg.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    if (input.decision === 'approve') {
      const takenSlots = store.registrations
        .filter((r) => r.eventId === reg.eventId && r.status === 'verified' && r.id !== reg.id)
        .map((r) => r.slotNumber);
      const slot = chooseApprovalSlot(reg, takenSlots, event.maxTeams);

      reg.status = 'verified';
      reg.slotNumber = slot.slotNumber;
      reg.groupName = slot.groupName;
      reg.rejectionReason = null;
      reg.updatedAt = now;
      if (latestProof) {
        latestProof.reviewStatus = 'approved';
        latestProof.rejectionReason = null;
        latestProof.verifiedAt = now;
        latestProof.verifiedBy = input.actorEmail;
      }
      store.auditLogs.push({
        id: crypto.randomUUID(),
        registrationId: reg.id,
        actorLabel: input.actorEmail,
        action: 'APPROVE',
        notes: `Verified UTR ${latestProof?.utrNumber || 'N/A'}. Assigned ${slot.groupName} · ${slot.slotNumber}.`,
        createdAt: now,
      });
    } else {
      const reasonText =
        input.reason?.trim() ||
        (input.decision === 'reupload_required'
          ? 'Screenshot unclear or UTR could not be matched. Please re-upload a clear receipt.'
          : 'Payment verification failed or invalid transaction.');
      reg.status = input.decision === 'reupload_required' ? 'reupload_required' : 'rejected';
      reg.rejectionReason = reasonText;
      reg.slotNumber = null;
      reg.groupName = null;
      reg.updatedAt = now;
      if (latestProof) {
        latestProof.reviewStatus =
          input.decision === 'reupload_required' ? 'reupload_required' : 'rejected';
        latestProof.rejectionReason = reasonText;
        latestProof.verifiedAt = now;
        latestProof.verifiedBy = input.actorEmail;
      }
      store.auditLogs.push({
        id: crypto.randomUUID(),
        registrationId: reg.id,
        actorLabel: input.actorEmail,
        action: input.decision === 'reupload_required' ? 'REQUEST_REUPLOAD' : 'REJECT',
        notes: reasonText,
        createdAt: now,
      });
    }

    reg.lastEmailStatus = 'pending_send';
    reg.lastEmailAt = null;
    writeLocalStore(store);
    return loadLocalBundle(store, reg);
  }

  throw new ClientInputError('Registration not found.');
}

function chooseApprovalSlot(registration: StoredRegistration, takenSlots: Iterable<string | null>, capacity: number) {
  const { status, slotNumber, groupName } = registration;
  const existing = status === 'verified' && slotNumber && groupName ? { slotNumber, groupName } : null;
  if (existing && confirmedSeat(registration)) return existing;
  const available = assignFirstFreeTournamentSlot(takenSlots, capacity);
  return existing && isWaitlistSlot({ ...available, status }) ? existing : available;
}

/**
 * Approve / reject / request re-upload with the fewest database round trips: one parallel
 * read, one parallel write. The returned bundle is assembled from the written rows instead
 * of being read back again (that read-back used to cost another two round trips).
 */
async function decideInSupabase(
  sb: SupabaseClient,
  input: {
    registrationId: string;
    decision: 'approve' | 'reject' | 'reupload_required';
    reason?: string;
    actorEmail: string;
    actorId?: string | null;
  }
): Promise<RegistrationBundle> {
  const id = input.registrationId;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ClientInputError('Registration not found.');
  const now = new Date().toISOString();
  const approve = input.decision === 'approve';

  const [regRes, proofRes, slotRes] = await Promise.all([
    sb.from('registrations').select('*, events(*), team_members(*)').eq('id', id).maybeSingle(),
    sb.from('payment_proofs').select('*').eq('registration_id', id).order('created_at', { ascending: false }),
    approve
      ? sb.from('registrations').select('event_id, slot_number').eq('status', 'verified').neq('id', id)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
  ]);
  const loadError = regRes.error || proofRes.error || slotRes.error;
  if (loadError) {
    console.error('Decision load failed:', loadError.message);
    throw new ClientInputError('Unable to load the registration. Please try again.');
  }
  if (!regRes.data) throw new ClientInputError('Registration not found.');

  const { events: eventRaw, team_members: rosterRows, ...regRow } = regRes.data as Record<string, unknown>;
  const reg = mapSupabaseRegistration(regRow);
  const eventRow = (Array.isArray(eventRaw) ? eventRaw[0] : eventRaw) as Record<string, unknown> | undefined;
  const event = eventRow ? mapSupabaseEvent(eventRow) : DEFAULT_EVENTS[0];
  const proofs = (proofRes.data || []).map((row) => mapSupabaseProof(row as Record<string, unknown>));
  const members = sortByRole((Array.isArray(rosterRows) ? rosterRows : []).map(mapSupabaseMember));
  const latest = proofs[0];

  // A rejected squad released its team name and players; check nobody else took them.
  if (reg.status === 'rejected' && input.decision !== 'reject') {
    const full = await getRegistrationBundleById(id);
    if (full) await reactivateRejectedSquad(full);
  }

  const reasonText =
    input.reason?.trim().slice(0, 500) ||
    (input.decision === 'reupload_required'
      ? 'Screenshot unclear or UTR could not be matched. Please re-upload a clear receipt.'
      : 'Payment verification failed or invalid transaction.');
  const nextStatus = approve ? 'verified' : input.decision === 'reupload_required' ? 'reupload_required' : 'rejected';

  let slot: { slotNumber: string; groupName: string } | null = null;
  if (approve) {
    const takenSlots = (slotRes.data || []).filter((row) => String(row.event_id) === reg.eventId)
      .map((row) => (row.slot_number ? String(row.slot_number) : null));
    slot = chooseApprovalSlot(reg, takenSlots, event.maxTeams);
  }

  const statusPatch = approve
    ? { status: 'verified', slot_number: slot!.slotNumber, group_name: slot!.groupName, rejection_reason: null, updated_at: now }
    : { status: nextStatus, rejection_reason: reasonText, slot_number: null, group_name: null, updated_at: now };
  const regPatch = { ...statusPatch, last_email_status: 'pending_send', last_email_at: null };
  const proofPatch = {
    review_status: approve ? 'approved' : nextStatus,
    rejection_reason: approve ? null : reasonText,
    verified_by: input.actorId || null,
    verified_at: now,
  };

  const [regUpd, proofUpd, auditIns] = await Promise.all([
    sb.from('registrations').update(regPatch).eq('id', id).select().single(),
    latest
      ? sb.from('payment_proofs').update(proofPatch).eq('id', latest.id).select().single()
      : Promise.resolve({ data: null, error: null }),
    sb
      .from('payment_audit_logs')
      .insert({
        registration_id: id,
        actor_id: input.actorId || null,
        actor_label: input.actorEmail,
        action: approve ? 'APPROVE' : input.decision === 'reupload_required' ? 'REQUEST_REUPLOAD' : 'REJECT',
        notes: approve
          ? `Verified UTR ${latest?.utrNumber || 'N/A'}. Assigned ${slot!.groupName} · ${slot!.slotNumber}.`
          : reasonText,
      })
      .select()
      .single(),
  ]);

  const writeError = regUpd.error || proofUpd.error;
  if (writeError || !regUpd.data) {
    // Undo whichever writes did succeed so the record is never left half-updated.
    const undo: PromiseLike<unknown>[] = [];
    if (!regUpd.error && regUpd.data) {
      undo.push(
        sb
          .from('registrations')
          .update({
            status: reg.status,
            slot_number: reg.slotNumber,
            group_name: reg.groupName,
            rejection_reason: reg.rejectionReason,
            updated_at: reg.updatedAt,
            last_email_status: reg.lastEmailStatus,
            last_email_at: reg.lastEmailAt,
          })
          .eq('id', id)
      );
    }
    if (!proofUpd.error && proofUpd.data && latest) {
      undo.push(
        sb
          .from('payment_proofs')
          .update({ review_status: latest.reviewStatus, rejection_reason: latest.rejectionReason })
          .eq('id', latest.id)
      );
    }
    if (auditIns.data) undo.push(sb.from('payment_audit_logs').delete().eq('id', String((auditIns.data as Record<string, unknown>).id)));
    await Promise.all(undo);
    if (isUniqueViolation(writeError)) {
      throw new ClientInputError(
        /utr|sha256/i.test(writeError?.message || '')
          ? 'This UTR or screenshot is already used by another active squad.'
          : `Team name "${reg.teamName}" is already used by another active squad.`
      );
    }
    console.error('Decision write failed:', writeError?.message);
    throw new ClientInputError('Unable to save the decision. Please try again.');
  }

  // Rejected squads free their players so they can register again in a new squad.
  if (nextStatus === 'rejected') await releaseRejectedSquadIds(sb, id);

  return {
    registration: mapSupabaseRegistration(regUpd.data as Record<string, unknown>),
    event,
    members,
    proofs: proofUpd.data
      ? [mapSupabaseProof(proofUpd.data as Record<string, unknown>), ...proofs.slice(1)]
      : proofs,
    auditLogs: auditIns.data ? [mapSupabaseAudit(auditIns.data as Record<string, unknown>)] : [],
  };
}

type EventConfigPatch = Partial<{
  title: string;
  subtitle: string;
  maxTeams: number;
  baseFee: number;
  lunchFee: number;
  upiVpa: string;
  upiPayeeName: string;
  eventDateLabel: string;
  registrationDeadline: string;
  venueLabel: string;
  isOpen: boolean;
  qrImageUrl: string;
}>;

const EVENT_TEXT_FIELDS = [
  'title',
  'subtitle',
  'upiVpa',
  'upiPayeeName',
  'eventDateLabel',
  'registrationDeadline',
  'venueLabel',
  'qrImageUrl',
] as const;

/** Keeps only editable event settings and rejects malformed values (both storage modes). */
function sanitizeEventPatch(raw: unknown): EventConfigPatch {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const patch: EventConfigPatch = {};
  for (const key of EVENT_TEXT_FIELDS) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > 500) {
      throw new ClientInputError('Invalid event settings.');
    }
    patch[key] = value;
  }
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new ClientInputError('Event title is required.');
  }
  if (patch.upiVpa !== undefined) {
    patch.upiVpa = patch.upiVpa.trim();
    if (patch.upiVpa && !isValidUpiVpa(patch.upiVpa)) {
      throw new ClientInputError('Enter a valid UPI ID, for example collegename@sbi.');
    }
  }
  if (patch.qrImageUrl !== undefined) {
    patch.qrImageUrl = patch.qrImageUrl.trim();
    if (patch.qrImageUrl && !/^(https:\/\/|\/api\/public\/qr\/)/.test(patch.qrImageUrl)) {
      throw new ClientInputError('QR image must be uploaded through the QR upload button.');
    }
  }
  if (input.isOpen !== undefined) {
    if (typeof input.isOpen !== 'boolean') throw new ClientInputError('Invalid event settings.');
    patch.isOpen = input.isOpen;
  }
  for (const key of ['maxTeams', 'baseFee', 'lunchFee'] as const) {
    if (input[key] === undefined) continue;
    const value = Number(input[key]);
    const isCapacity = key === 'maxTeams';
    if (!Number.isFinite(value) || value < (isCapacity ? 2 : 0) || (isCapacity && !Number.isInteger(value))) {
      throw new ClientInputError('Enter valid fees and a whole-number team capacity of at least 2.');
    }
    patch[key] = value;
  }
  return patch;
}

export async function updateEventConfig(
  eventId: string,
  rawPatch: EventConfigPatch
): Promise<CampusEvent> {
  const patch = sanitizeEventPatch(rawPatch);
  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const evt = store.events.find((e) => e.id === eventId);
    if (!evt) throw new ClientInputError('Event not found.');
    Object.assign(evt, patch);
    writeLocalStore(store);
    return evt;
  }

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.subtitle !== undefined) dbPatch.subtitle = patch.subtitle;
  if (patch.maxTeams !== undefined) dbPatch.max_teams = patch.maxTeams;
  if (patch.baseFee !== undefined) dbPatch.base_fee = patch.baseFee;
  if (patch.lunchFee !== undefined) dbPatch.lunch_fee = patch.lunchFee;
  if (patch.upiVpa !== undefined) dbPatch.upi_vpa = patch.upiVpa || null;
  if (patch.upiPayeeName !== undefined) dbPatch.upi_payee_name = patch.upiPayeeName;
  if (patch.eventDateLabel !== undefined) dbPatch.event_date_label = patch.eventDateLabel;
  if (patch.registrationDeadline !== undefined)
    dbPatch.registration_deadline = patch.registrationDeadline;
  if (patch.venueLabel !== undefined) dbPatch.venue_label = patch.venueLabel;
  if (patch.isOpen !== undefined) dbPatch.is_open = patch.isOpen;
  if (patch.qrImageUrl !== undefined) dbPatch.qr_image_url = patch.qrImageUrl;

  const { data, error } = await sb
    .from('events')
    .update(dbPatch)
    .eq('id', eventId)
    .select()
    .single();
  if (error || !data) {
    console.error('Supabase event update failed:', error?.message || 'no row returned (check the event id)');
    throw new ClientInputError('Failed to update event.');
  }
  return mapSupabaseEvent(data as Record<string, unknown>);
}

export async function createExtensibleEvent(input: {
  title: string;
  subtitle: string;
  gameTitle: string;
  maxTeams: number;
  baseFee: number;
  lunchFee: number;
  prizePoolTotal: number;
  eventDateLabel: string;
  venueLabel: string;
  upiVpa?: string;
}): Promise<CampusEvent> {
  if (typeof input.title !== 'string' || !input.title.trim() || typeof input.gameTitle !== 'string' || !input.gameTitle.trim()) {
    throw new ClientInputError('Event title and game are required.');
  }
  for (const [field, fallback] of [['maxTeams',24],['baseFee',299],['lunchFee',100],['prizePoolTotal',5000]] as const) {
    const value = Number(input[field] ?? fallback);
    if (!Number.isFinite(value) || value < (field === 'maxTeams' ? 2 : 0) || (field === 'maxTeams' && !Number.isInteger(value))) {
      throw new ClientInputError('Enter valid fees, prize amount and a whole-number team capacity of at least 2.');
    }
  }
  const slug =
    input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    Math.floor(100 + Math.random() * 900);

  const prefix = input.gameTitle.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'SAMT';
  const baseEvent: CampusEvent = {
    id: crypto.randomUUID(),
    slug,
    title: input.title.trim(),
    subtitle: String(input.subtitle ?? '').trim() || 'Official SAMT College Event',
    gameTitle: input.gameTitle.trim(),
    eventType: 'esports_squad',
    maxTeams: Math.max(2, Number(input.maxTeams || 24)),
    baseFee: Math.max(0, Number(input.baseFee ?? 299)),
    lunchFee: Math.max(0, Number(input.lunchFee ?? 100)),
    prizePoolTotal: Math.max(0, Number(input.prizePoolTotal ?? 5000)),
    prizeBreakdown: [
      {
        position: '1st Position',
        cashPrize: Math.round(Number(input.prizePoolTotal ?? 5000) * 0.6),
        award: 'Winner Trophy & Certificate',
      },
      {
        position: '2nd Position',
        cashPrize: Math.round(Number(input.prizePoolTotal ?? 5000) * 0.4),
        award: 'Runner-Up Trophy & Certificate',
      },
    ],
    qrImageUrl: '',
    upiVpa: input.upiVpa?.trim() || '',
    upiPayeeName: 'Srusti Academy of Management and Technology',
    eventDateLabel: String(input.eventDateLabel ?? '').trim() || 'Dates to be announced',
    registrationDeadline: `Open until ${input.maxTeams || 24} teams fill`,
    venueLabel: String(input.venueLabel ?? '').trim() || 'SAMT Campus',
    isOpen: true,
    rulesJson: {
      codePrefix: `${prefix}26`,
      teamSizeLabel: '4 Active Players (Player 1 = IGL) + 1 Optional Substitute',
      eligibilitySummary:
        'Inter-college participation. Ages 16–22 OR enrolled from 11th Class to Undergraduate (UG). Valid College ID mandatory.',
      mapPool: ['Official Tournament Pool'],
      killPoints: 1,
      placementPoints: [
        { rank: '1st Place', points: 10 },
        { rank: '2nd Place', points: 6 },
        { rank: '3rd Place', points: 5 },
      ],
      stages: [
        {
          stageNumber: '01',
          name: 'Main Event Stage',
          formatAndTeams: `Up to ${input.maxTeams || 24} Registered Teams`,
          advancement: 'Conducted under official SAMT event referee guidelines.',
        },
      ],
      fixtures: [
        {
          stage: 'Main Stage',
          matchId: 'Match 1',
          participants: 'Verified Registered Teams',
          scoring: 'Official SAMT Scoring Criteria',
        },
      ],
      specialRules: [
        'All participants must carry a valid College/Institution ID card.',
        'Official SAMT code of conduct and fair play rules apply.',
      ],
      tieBreaker: ['Official referee decision'],
    },
  };

  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    store.events.push(baseEvent);
    store.eventSequences[baseEvent.id] = 0;
    writeLocalStore(store);
    return baseEvent;
  }

  const { data, error } = await sb
    .from('events')
    .insert({
      slug: baseEvent.slug,
      title: baseEvent.title,
      subtitle: baseEvent.subtitle,
      game_title: baseEvent.gameTitle,
      event_type: baseEvent.eventType,
      max_teams: baseEvent.maxTeams,
      base_fee: baseEvent.baseFee,
      lunch_fee: baseEvent.lunchFee,
      prize_pool_total: baseEvent.prizePoolTotal,
      prize_breakdown: baseEvent.prizeBreakdown,
      qr_image_url: '',
      upi_vpa: baseEvent.upiVpa || null,
      upi_payee_name: baseEvent.upiPayeeName,
      event_date_label: baseEvent.eventDateLabel,
      registration_deadline: baseEvent.registrationDeadline,
      venue_label: baseEvent.venueLabel,
      rules_json: baseEvent.rulesJson,
      is_open: true,
    })
    .select()
    .single();
  if (error || !data) {
    console.error('Supabase event insert failed:', error?.message);
    throw new ClientInputError('Failed to create event.');
  }
  return mapSupabaseEvent(data as Record<string, unknown>);
}

export async function saveOfficialQrImage(eventId: string, fileBuffer: Buffer): Promise<string> {
  const mime = detectImageMimeFromMagicBytes(fileBuffer);
  if (!mime) throw new ClientInputError('QR image must be a valid PNG, JPEG, or WebP file.');
  if (fileBuffer.length > 3 * 1024 * 1024) throw new ClientInputError('QR image must be under 3 MB.');
  const ext = extFromMime(mime);

  const sb = getSupabaseServiceClient();
  if (!sb) {
    ensureLocalDirs();
    const fileName = `qr-${eventId}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(QR_DIR, fileName), fileBuffer);
    const url = `/api/public/qr/${fileName}`;
    await updateEventConfig(eventId, { qrImageUrl: url });
    return url;
  }

  const storagePath = `qr/${eventId}-${Date.now()}.${ext}`;
  const { error } = await sb.storage
    .from('event-assets')
    .upload(storagePath, fileBuffer, { contentType: mime, upsert: true });
  if (error) {
    // Server-side only: the storage reason (missing bucket, MIME/size policy, network) is
    // otherwise invisible and the admin just sees a generic failure.
    console.error('QR upload to Supabase Storage bucket "event-assets" failed:', error.message);
    throw new ClientInputError('Could not save the QR image to storage. Please try again; if it keeps failing, check the Supabase "event-assets" bucket.');
  }
  const { data } = sb.storage.from('event-assets').getPublicUrl(storagePath);
  try {
    await updateEventConfig(eventId, { qrImageUrl: data.publicUrl });
  } catch (err) {
    console.error('QR image stored but the event row was not updated:', err instanceof Error ? err.message : err);
    await sb.storage.from('event-assets').remove([storagePath]);
    throw new ClientInputError('The QR image was uploaded but the event could not be updated. Please try again.');
  }
  return data.publicUrl;
}

function jwtSubject(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf-8'));
    return typeof payload.sub === 'string' && /^[0-9a-f-]{36}$/i.test(payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

const ADMIN_SESSION_TTL_MS = 60_000;
const adminSessionCache = new Map<string, { email: string; userId: string; expiresAt: number }>();

const RETIRED_LOCAL_PASSCODE_SHA256 = '3780a4f068b414a818b5633834632987c9e550b313136b008deeb19441a3f8f5';

export function getLocalAdminPasscode(): string | undefined {
  const passcode = process.env.VERCEL ? undefined : process.env.ADMIN_DEMO_PASSCODE;
  if (!passcode) return undefined;
  // The former demo passcode appeared in published history. Never accept it again.
  if (crypto.createHash('sha256').update(passcode).digest('hex') === RETIRED_LOCAL_PASSCODE_SHA256) return undefined;
  return passcode;
}

export async function verifyAdminToken(authHeader: string | undefined): Promise<{
  ok: boolean;
  email: string;
  userId: string | null;
}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, email: '', userId: null };
  }
  const token = authHeader.slice(7).trim();
  const sb = getSupabaseServiceClient();

  if (!sb) {
    // Local preview token HMAC validation (development only; never accepted on Vercel).
    const secret = getLocalAdminPasscode();
    if (!secret) return { ok: false, email: '', userId: null };
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return { ok: false, email: '', userId: null };
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('hex');
    if (Buffer.byteLength(sig) !== Buffer.byteLength(expectedSig) || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return { ok: false, email: '', userId: null };
    try {
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
      if (!Number.isFinite(payload.exp) || Date.now() > payload.exp) return { ok: false, email: '', userId: null };
      return { ok: true, email: String(payload.email || 'admin@samt.local'), userId: null };
    } catch {
      return { ok: false, email: '', userId: null };
    }
  }

  // Only the hash is kept in memory. A revoked admin loses access within the TTL.
  const cacheKey = crypto.createHash('sha256').update(token).digest('hex');
  const cached = adminSessionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, email: cached.email, userId: cached.userId };
  }
  adminSessionCache.delete(cacheKey);

  // The allowlist lookup runs alongside the token check using the token's (unverified) subject.
  // The result is only used if the verified user turns out to be that same subject.
  const claimedSubject = jwtSubject(token);
  const [userRes, allowRes] = await Promise.all([
    sb.auth.getUser(token),
    claimedSubject
      ? sb.from('admin_users').select('email, role').eq('user_id', claimedSubject).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const data = userRes.data;
  if (userRes.error || !data.user) return { ok: false, email: '', userId: null };

  let allowRow = allowRes.data;
  if (data.user.id !== claimedSubject) {
    const lookup = await sb
      .from('admin_users')
      .select('email, role')
      .eq('user_id', data.user.id)
      .maybeSingle();
    allowRow = lookup.data;
  }

  if (!allowRow) return { ok: false, email: '', userId: null };
  if (adminSessionCache.size > 200) {
    const now = Date.now();
    for (const [key, entry] of adminSessionCache) if (entry.expiresAt <= now) adminSessionCache.delete(key);
  }
  adminSessionCache.set(cacheKey, {
    email: String(allowRow.email),
    userId: data.user.id,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS,
  });
  return { ok: true, email: String(allowRow.email), userId: data.user.id };
}

/** Permanently removes registrations with their roster, payment proofs, audit trail and files. */
export async function deleteRegistrations(ids: unknown): Promise<{ deleted: number }> {
  if (!Array.isArray(ids)) throw new ClientInputError('Choose at least one record to delete.');
  const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  if (unique.length === 0) throw new ClientInputError('Choose at least one record to delete.');
  if (unique.length > 200) throw new ClientInputError('Delete at most 200 records at a time.');

  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const targets = new Set(unique);
    const found = store.registrations.filter((r) => targets.has(r.id));
    for (const proof of store.proofs.filter((p) => targets.has(p.registrationId))) {
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(proof.screenshotPath)));
      } catch {
        // The file may already be gone; the record is what matters.
      }
    }
    store.registrations = store.registrations.filter((r) => !targets.has(r.id));
    store.members = store.members.filter((m) => !targets.has(m.registrationId));
    if (store.attendance) {
      const remainingMembers = new Set(store.members.map((member) => member.id));
      store.attendance = store.attendance.filter((mark) => remainingMembers.has(mark.memberId));
    }
    store.proofs = store.proofs.filter((p) => !targets.has(p.registrationId));
    store.auditLogs = store.auditLogs.filter((a) => !targets.has(a.registrationId));
    writeLocalStore(store);
    return { deleted: found.length };
  }

  const valid = unique.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (valid.length === 0) throw new ClientInputError('Those records no longer exist.');
  const { data: proofRows } = await sb
    .from('payment_proofs')
    .select('screenshot_path')
    .in('registration_id', valid);
  // Members, proofs and audit entries are removed by the database (ON DELETE CASCADE).
  const { data: deletedRows, error } = await sb.from('registrations').delete().in('id', valid).select('id');
  if (error) {
    console.error('Registration delete failed:', error.message);
    throw new ClientInputError('Unable to delete the records. Please try again.');
  }
  const paths = (proofRows || []).map((row) => String(row.screenshot_path)).filter(Boolean);
  if (paths.length > 0) {
    // Best effort: an orphaned file is harmless, a record without its row is not.
    const { error: removeErr } = await sb.storage.from('payment-proofs').remove(paths);
    if (removeErr) console.error('Payment proof cleanup failed:', removeErr.message);
  }
  return { deleted: (deletedRows || []).length };
}

interface VolunteerCredentials extends VolunteerAccount {
  passwordHash: string;
}

export async function getVolunteerCredentials(loginId: string): Promise<VolunteerCredentials | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return readLocalStore().volunteers?.find((volunteer) => volunteer.loginId === loginId) ?? null;
  const { data, error } = await sb.from('check_in_volunteers').select('login_id,password_hash').eq('login_id', loginId).maybeSingle();
  if (error) throw error;
  return data ? { loginId: data.login_id, passwordHash: data.password_hash } : null;
}

export async function listVolunteers(): Promise<VolunteerAccount[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return (readLocalStore().volunteers ?? []).map(({ loginId }) => ({ loginId })).sort((a, b) => a.loginId.localeCompare(b.loginId));
  const { data, error } = await sb.from('check_in_volunteers').select('login_id').order('login_id');
  if (error) throw error;
  return data.map((row) => ({ loginId: row.login_id }));
}

export async function saveVolunteer(credentials: VolunteerCredentials, resetPassword: boolean): Promise<'saved' | 'missing' | 'duplicate'> {
  const { loginId, passwordHash } = credentials;
  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const volunteers = store.volunteers ??= [];
    const index = volunteers.findIndex((volunteer) => volunteer.loginId === loginId);
    if (resetPassword && index < 0) return 'missing';
    if (!resetPassword && index >= 0) return 'duplicate';
    if (resetPassword) volunteers[index] = credentials;
    else volunteers.push(credentials);
    writeLocalStore(store);
    return 'saved';
  }
  const table = sb.from('check_in_volunteers');
  const query = resetPassword
    ? table.update({ password_hash: passwordHash }).eq('login_id', loginId)
    : table.insert({ login_id: loginId, password_hash: passwordHash });
  const { data, error } = await query.select('login_id').maybeSingle();
  if (!resetPassword && error?.code === '23505') return 'duplicate';
  if (error) throw error;
  return data ? 'saved' : 'missing';
}

function checkInSquad(registration: StoredRegistration, event: CampusEvent, members: StoredTeamMember[], marks: AttendanceMark[]): CheckInSquad {
  const attendance = new Map(marks.map((mark) => [mark.memberId, mark]));
  return {
    teamCode: registration.teamCode,
    teamName: registration.teamName,
    eventTitle: event.title,
    eventDate: event.eventDateLabel,
    venue: event.venueLabel,
    seat: confirmedSeat(registration),
    players: sortByRole(members).map((member) => ({
      id: member.id, fullName: member.fullName, slotRole: member.slotRole, inGameName: member.inGameName,
      characterId: member.characterId, college: member.collegeOverride || registration.collegeName,
      academicLevel: member.academicLevel, wantsLunch: member.wantsLunch, dietType: member.dietType,
      attendance: attendance.get(member.id) ?? null,
    })),
  };
}

function mapAttendance(row: { member_id: string; checked_in_at: string; checked_in_by: string }): AttendanceMark {
  return { memberId: row.member_id, checkedInAt: row.checked_in_at, checkedInBy: row.checked_in_by };
}

function findLocalCheckInRegistration(store: LocalStoreData, teamCode: string): StoredRegistration | null {
  const matches = store.registrations.filter((row) => row.teamCode === teamCode);
  return matches.length === 1 && confirmedSeat(matches[0]) ? matches[0] : null;
}

export async function getCheckInSquad(teamCode: string): Promise<CheckInSquad | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const registration = findLocalCheckInRegistration(store, teamCode);
    if (!registration) return null;
    const members = store.members.filter((row) => row.registrationId === registration.id);
    return checkInSquad(registration, store.events.find((event) => event.id === registration.eventId) || DEFAULT_EVENTS[0], members, store.attendance ?? []);
  }
  const { data: row, error } = await sb.from('registrations').select('id,team_code,team_name,college_name,event_id,status,slot_number,group_name').eq('team_code', teamCode).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const registration = mapSupabaseRegistration(row);
  if (!confirmedSeat(registration)) return null;
  const [eventResult, roster] = await Promise.all([
    sb.from('events').select('*').eq('id', registration.eventId).single(),
    sb.from('team_members').select('*,check_in_attendance(member_id,checked_in_at,checked_in_by)').eq('registration_id', registration.id),
  ]);
  if (eventResult.error || roster.error) throw eventResult.error || roster.error;
  const marks = roster.data.flatMap((member) => {
    const mark = member.check_in_attendance;
    return mark ? (Array.isArray(mark) ? mark : [mark]).map(mapAttendance) : [];
  });
  return checkInSquad(registration, mapSupabaseEvent(eventResult.data), roster.data.map(mapSupabaseMember), marks);
}

export async function markParticipantPresent(teamCode: string, memberId: string, actor: string): Promise<AttendanceMark | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const registration = findLocalCheckInRegistration(store, teamCode);
    if (!registration || !store.members.some((member) => member.id === memberId && member.registrationId === registration.id)) return null;
    const marks = store.attendance ??= [];
    const existing = marks.find((mark) => mark.memberId === memberId);
    if (existing) return existing;
    const mark = { memberId, checkedInAt: new Date().toISOString(), checkedInBy: actor };
    marks.push(mark);
    writeLocalStore(store);
    return mark;
  }
  const { data, error } = await sb.rpc('mark_check_in_present', { p_team_code: teamCode, p_member_id: memberId, p_actor: actor });
  if (error) throw error;
  return data?.member_id ? mapAttendance(data) : null;
}

export async function listAttendance(page: number): Promise<{ entries: AttendanceEntry[]; hasMore: boolean }> {
  const start = (page - 1) * CHECK_IN_PAGE_SIZE;
  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const members = new Map(store.members.map((member) => [member.id, member]));
    const registrations = new Map(store.registrations.map((registration) => [registration.id, registration]));
    const marks = [...(store.attendance ?? [])].sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt) || a.memberId.localeCompare(b.memberId));
    const records = marks.slice(start, start + CHECK_IN_PAGE_SIZE);
    return {
      entries: records.flatMap((mark) => {
        const member = members.get(mark.memberId);
        const registration = member && registrations.get(member.registrationId);
        return member && registration ? [{ ...mark, fullName: member.fullName, teamName: registration.teamName, teamCode: registration.teamCode }] : [];
      }),
      hasMore: marks.length > start + CHECK_IN_PAGE_SIZE,
    };
  }
  const { data, error } = await sb.from('check_in_attendance')
    .select('member_id,checked_in_at,checked_in_by,team_members!inner(full_name,registrations!inner(team_name,team_code))')
    .order('checked_in_at', { ascending: false }).order('member_id').range(start, start + CHECK_IN_PAGE_SIZE)
    .returns<Array<Parameters<typeof mapAttendance>[0] & { team_members: { full_name: string; registrations: { team_name: string; team_code: string } } }>>();
  if (error) throw error;
  return {
    entries: data.slice(0, CHECK_IN_PAGE_SIZE).map((row) => ({
      ...mapAttendance(row), fullName: row.team_members.full_name,
      teamName: row.team_members.registrations.team_name, teamCode: row.team_members.registrations.team_code,
    })),
    hasMore: data.length > CHECK_IN_PAGE_SIZE,
  };
}

export function issueLocalAdminToken(email: string): string {
  const secret = getLocalAdminPasscode();
  if (!secret) throw new ClientInputError('Administrator login is not configured.');
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + 12 * 60 * 60 * 1000 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export { isValidEmail };
