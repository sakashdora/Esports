import { ClientInputError } from './errors.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_EVENTS, EVENT_DATE_LABEL, type CampusEvent } from '../src/lib/defaultEvents.js';
import { sanitizePublicTeam, type PublicRegisteredTeam } from '../src/lib/liveBoard.js';
import {
  assignFirstFreeTournamentSlot,
  calculateRegistrationFee,
  formatTeamCode,
  isValidEmail,
  isValidIndianPhone,
  isValidUtr,
  normalizePhone,
  normalizeUtr,
  validateSquadSubmission,
  type PlayerInput,
  type RegistrationStatus,
} from '../src/lib/tournamentRules.js';

export interface StoredTeamMember extends PlayerInput {
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
}

const DATA_DIR = process.env.VERCEL ? path.join('/tmp', '.data') : path.resolve(process.cwd(), '.data');
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

function mapSupabaseEvent(row: Record<string, unknown>, stats?: { verified: number; pending: number; total: number }): CampusEvent {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subtitle: String(row.subtitle || ''),
    gameTitle: String(row.game_title),
    eventType: (row.event_type as CampusEvent['eventType']) || 'esports_squad',
    maxTeams: Number(row.max_teams || 24),
    baseFee: Number(row.base_fee || 299),
    lunchFee: Number(row.lunch_fee || 100),
    prizePoolTotal: Number(row.prize_pool_total || 10000),
    prizeBreakdown: (row.prize_breakdown as CampusEvent['prizeBreakdown']) || [],
    qrImageUrl: String(row.qr_image_url || ''),
    upiVpa: String(row.upi_vpa || ''),
    upiPayeeName: String(row.upi_payee_name || 'Srusti Academy of Management and Technology'),
    eventDateLabel: DEFAULT_EVENTS.some(e => e.slug === row.slug) ? EVENT_DATE_LABEL : String(row.event_date_label || 'Dates to be announced'),
    registrationDeadline: String(row.registration_deadline || 'Open until 24 slots fill'),
    venueLabel: String(row.venue_label || 'SAMT Campus LAN Arena'),
    isOpen: Boolean(row.is_open),
    rulesJson: row.rules_json as CampusEvent['rulesJson'],
    registeredCount: stats?.total ?? 0,
    verifiedCount: stats?.verified ?? 0,
    pendingCount: stats?.pending ?? 0,
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
    baseFee: Number(row.base_fee || 299),
    lunchTotal: Number(row.lunch_total || 0),
    totalFee: Number(row.total_fee || 299),
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

function mapSupabaseMember(row: Record<string, unknown>): StoredTeamMember {
  return {
    id: String(row.id),
    registrationId: String(row.registration_id),
    eventId: String(row.event_id),
    slotRole: row.slot_role as PlayerInput['slotRole'],
    fullName: String(row.full_name),
    inGameName: String(row.in_game_name),
    characterId: String(row.character_id),
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

export async function ensureSeedEventsInSupabase(): Promise<void> {
  const sb = getSupabaseServiceClient();
  if (!sb) return;
  const { data: existing, error } = await sb.from('events').select('slug');
  if (error) {
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
    const store = readLocalStore();
    return store.events.map((evt) => {
      const eventRegs = store.registrations.filter(
        (r) => r.eventId === evt.id && r.status !== 'rejected'
      );
      return {
        ...evt,
        registeredCount: eventRegs.length,
        verifiedCount: eventRegs.filter((r) => r.status === 'verified').length,
        pendingCount: eventRegs.filter(
          (r) => r.status === 'pending' || r.status === 'reupload_required'
        ).length,
      };
    });
  }

  await ensureSeedEventsInSupabase();
  const { data: eventsData, error } = await sb
    .from('events')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new ClientInputError('Unable to complete the database request. Please try again.');

  const { data: regStats } = await sb
    .from('registrations')
    .select('event_id, status')
    .neq('status', 'rejected');

  const countMap = new Map<string, { verified: number; pending: number; total: number }>();
  for (const row of regStats || []) {
    const eventId = String(row.event_id);
    const cur = countMap.get(eventId) || { verified: 0, pending: 0, total: 0 };
    cur.total += 1;
    if (row.status === 'verified') cur.verified += 1;
    else if (row.status === 'pending' || row.status === 'reupload_required') cur.pending += 1;
    countMap.set(eventId, cur);
  }

  return (eventsData || []).map((row) =>
    mapSupabaseEvent(row as Record<string, unknown>, countMap.get(String(row.id)))
  );
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
  const event = await getEventBySlug(input.eventSlug);
  if (!event) {
    throw new ClientInputError('Selected event was not found.');
  }
  if (!event.isOpen) {
    throw new ClientInputError('Registrations for this event are currently closed.');
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
  const activeMembers = input.members.filter((m) =>
    input.hasSubstitute ? true : m.slotRole !== 'SUB'
  );
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

    const nextSeq = (store.eventSequences[event.id] || 0) + 1;
    store.eventSequences[event.id] = nextSeq;
    const prefix = event.rulesJson.codePrefix || 'SAMT26';
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

  // Supabase Free production path
  const { count: activeCount } = await sb
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .neq('status', 'rejected');

  const isWaitlisted = (activeCount || 0) >= event.maxTeams;

  const { data: dupUtr } = await sb
    .from('payment_proofs')
    .select('id')
    .eq('utr_number', normalizedUtr)
    .neq('review_status', 'rejected')
    .limit(1);
  if (dupUtr && dupUtr.length > 0) {
    throw new ClientInputError(`UTR / Reference "${normalizedUtr}" has already been submitted.`);
  }

  const { data: dupHash } = await sb
    .from('payment_proofs')
    .select('id')
    .eq('file_sha256', fileSha256)
    .neq('review_status', 'rejected')
    .limit(1);
  if (dupHash && dupHash.length > 0) {
    throw new ClientInputError('This exact payment screenshot file has already been submitted.');
  }

  const { count: eventTotalCount } = await sb
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id);

  const prefix = event.rulesJson.codePrefix || 'SAMT26';
  const teamCode = formatTeamCode(prefix, (eventTotalCount || 0) + 1);
  const ext = extFromMime(mime);
  const storagePath = `${event.slug}/${teamCode}-${Date.now()}.${ext}`;

  const { error: uploadErr } = await sb.storage
    .from('payment-proofs')
    .upload(storagePath, input.fileBuffer, { contentType: mime, upsert: false });
  if (uploadErr) {
    throw new ClientInputError('Unable to save payment screenshot. Please try again.');
  }

  const { data: regRow, error: regErr } = await sb
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
      eligibility_confirmed: input.eligibilityConfirmed,
      fair_play_confirmed: input.fairPlayConfirmed,
      active_skill_confirmed: input.activeSkillConfirmed,
    })
    .select()
    .single();

  if (regErr || !regRow) {
    await sb.storage.from('payment-proofs').remove([storagePath]);
    throw new ClientInputError('Registration insert failed (team name may already exist).');
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
    college_override: m.collegeOverride?.trim() || null,
    wants_lunch: m.wantsLunch,
    diet_type: m.wantsLunch ? m.dietType : 'NONE',
  }));

  const { data: memRows, error: memErr } = await sb
    .from('team_members')
    .insert(memberInserts)
    .select();

  if (memErr) {
    await sb.from('registrations').delete().eq('id', regId);
    await sb.storage.from('payment-proofs').remove([storagePath]);
    throw new ClientInputError('Unable to save roster. Check that players are not already registered.');
  }

  const { data: proofRow, error: proofErr } = await sb
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
    .single();

  if (proofErr || !proofRow) {
    await sb.from('registrations').delete().eq('id', regId);
    await sb.storage.from('payment-proofs').remove([storagePath]);
    throw new ClientInputError('Payment proof insert failed.');
  }

  const { data: auditRow } = await sb
    .from('payment_audit_logs')
    .insert({
      registration_id: regId,
      actor_label: `IGL (${cleanPhone})`,
      action: 'SUBMIT',
      notes: `Submitted squad (${activeMembers.length} players, Rs. ${fees.totalFee}, UTR ${normalizedUtr}).`,
    })
    .select()
    .single();

  return {
    registration: mapSupabaseRegistration(regRow as Record<string, unknown>),
    event,
    members: (memRows || []).map((m) => mapSupabaseMember(m as Record<string, unknown>)),
    proofs: [mapSupabaseProof(proofRow as Record<string, unknown>)],
    auditLogs: auditRow ? [mapSupabaseAudit(auditRow as Record<string, unknown>)] : [],
  };
}

export async function recordEmailAudit(
  registrationId: string,
  sent: boolean,
  notes: string
): Promise<void> {
  const now = new Date().toISOString();
  const statusStr = sent ? 'sent' : 'failed_or_unconfigured';
  const action = sent ? 'EMAIL_SENT' : 'EMAIL_FAIL';
  const sb = getSupabaseServiceClient();
  if (!sb) {
    const store = readLocalStore();
    const reg = store.registrations.find((r) => r.id === registrationId);
    if (reg) {
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

  await sb
    .from('registrations')
    .update({ last_email_status: statusStr, last_email_at: now, updated_at: now })
    .eq('id', registrationId);

  await sb.from('payment_audit_logs').insert({
    registration_id: registrationId,
    actor_label: 'EMAIL_SERVICE',
    action,
    notes,
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
    const reg = store.registrations.find(
      (r) => r.teamCode.toUpperCase() === cleanCode && r.iglPhone === cleanPhone
    );
    if (!reg) return null;
    const event = store.events.find((e) => e.id === reg.eventId) || DEFAULT_EVENTS[0];
    const members = store.members.filter((m) => m.registrationId === reg.id);
    // Newest first, matching the Supabase path: callers treat proofs[0] as the latest proof.
    const proofs = store.proofs
      .filter((p) => p.registrationId === reg.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const auditLogs = store.auditLogs
      .filter((a) => a.registrationId === reg.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { registration: reg, event, members, proofs, auditLogs };
  }

  const { data: regRow } = await sb
    .from('registrations')
    .select('*')
    .eq('team_code', cleanCode)
    .eq('igl_phone', cleanPhone)
    .maybeSingle();

  if (!regRow) return null;
  const reg = mapSupabaseRegistration(regRow as Record<string, unknown>);
  const { data: evtRow } = await sb.from('events').select('*').eq('id', reg.eventId).single();
  const { data: memRows } = await sb
    .from('team_members')
    .select('*')
    .eq('registration_id', reg.id);
  const { data: proofRows } = await sb
    .from('payment_proofs')
    .select('*')
    .eq('registration_id', reg.id)
    .order('created_at', { ascending: false });
  const { data: auditRows } = await sb
    .from('payment_audit_logs')
    .select('*')
    .eq('registration_id', reg.id)
    .order('created_at', { ascending: false });

  return {
    registration: reg,
    event: mapSupabaseEvent((evtRow || {}) as Record<string, unknown>),
    members: (memRows || []).map((m) => mapSupabaseMember(m as Record<string, unknown>)),
    proofs: (proofRows || []).map((p) => mapSupabaseProof(p as Record<string, unknown>)),
    auditLogs: (auditRows || []).map((a) => mapSupabaseAudit(a as Record<string, unknown>)),
  };
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

  const ext = extFromMime(mime);
  const storagePath = `${bundle.event.slug}/${bundle.registration.teamCode}-reup-${Date.now()}.${ext}`;
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

  await sb
    .from('registrations')
    .update({ status: 'pending', rejection_reason: null, updated_at: now })
    .eq('id', bundle.registration.id);

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
  const events = await listPublicEvents();
  const eventMap = new Map(events.map((e) => [e.id, e]));

  const sb = getSupabaseServiceClient();
  if (!sb) {
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

  const { data: regRows } = await sb
    .from('registrations')
    .select('*')
    .order('created_at', { ascending: false });
  const { data: memRows } = await sb.from('team_members').select('*');
  const { data: proofRows } = await sb
    .from('payment_proofs')
    .select('*')
    .order('created_at', { ascending: false });
  const { data: auditRows } = await sb
    .from('payment_audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

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
    let latestProofUrl: string | null = null;
    if (latest) {
      const { data: signed } = await sb.storage
        .from('payment-proofs')
        .createSignedUrl(latest.screenshotPath, 300);
      latestProofUrl = signed?.signedUrl || null;
    }
    bundles.push({
      registration: reg,
      event: eventMap.get(reg.eventId) || DEFAULT_EVENTS[0],
      members: membersByReg.get(reg.id) || [],
      proofs,
      auditLogs: auditsByReg.get(reg.id) || [],
      latestProofUrl,
    });
  }

  return { events, bundles, auditLogs: allAudits };
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
  const now = new Date().toISOString();
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
      const slot =
        reg.slotNumber && reg.groupName
          ? { slotNumber: reg.slotNumber, groupName: reg.groupName }
          : assignFirstFreeTournamentSlot(takenSlots, event.maxTeams);

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

    writeLocalStore(store);
    return (await trackRegistration(reg.teamCode, reg.iglPhone))!;
  }

  const { data: regRow } = await sb
    .from('registrations')
    .select('*')
    .eq('id', input.registrationId)
    .single();
  if (!regRow) throw new ClientInputError('Registration not found.');
  const reg = mapSupabaseRegistration(regRow as Record<string, unknown>);
  const { data: evtRow } = await sb.from('events').select('*').eq('id', reg.eventId).single();
  const event = mapSupabaseEvent((evtRow || {}) as Record<string, unknown>);

  const { data: latestProofRow } = await sb
    .from('payment_proofs')
    .select('*')
    .eq('registration_id', reg.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (input.decision === 'approve') {
    const { data: verifiedRows, error: verifiedErr } = await sb
      .from('registrations')
      .select('slot_number')
      .eq('event_id', reg.eventId)
      .eq('status', 'verified')
      .neq('id', reg.id);
    if (verifiedErr) throw new ClientInputError('Unable to complete the database request. Please try again.');

    const slot =
      reg.slotNumber && reg.groupName
        ? { slotNumber: reg.slotNumber, groupName: reg.groupName }
        : assignFirstFreeTournamentSlot(
            (verifiedRows || []).map((row) => (row.slot_number ? String(row.slot_number) : null)),
            event.maxTeams
          );

    await sb
      .from('registrations')
      .update({
        status: 'verified',
        slot_number: slot.slotNumber,
        group_name: slot.groupName,
        rejection_reason: null,
        updated_at: now,
      })
      .eq('id', reg.id);

    if (latestProofRow) {
      await sb
        .from('payment_proofs')
        .update({
          review_status: 'approved',
          rejection_reason: null,
          verified_by: input.actorId || null,
          verified_at: now,
        })
        .eq('id', latestProofRow.id);
    }

    await sb.from('payment_audit_logs').insert({
      registration_id: reg.id,
      actor_id: input.actorId || null,
      actor_label: input.actorEmail,
      action: 'APPROVE',
      notes: `Verified UTR ${latestProofRow?.utr_number || 'N/A'}. Assigned ${slot.groupName} · ${slot.slotNumber}.`,
    });
  } else {
    const reasonText =
      input.reason?.trim() ||
      (input.decision === 'reupload_required'
        ? 'Screenshot unclear or UTR could not be matched. Please re-upload.'
        : 'Payment verification failed.');
    const nextStatus = input.decision === 'reupload_required' ? 'reupload_required' : 'rejected';

    await sb
      .from('registrations')
      .update({
        status: nextStatus,
        rejection_reason: reasonText,
        slot_number: null,
        group_name: null,
        updated_at: now,
      })
      .eq('id', reg.id);

    if (latestProofRow) {
      await sb
        .from('payment_proofs')
        .update({
          review_status: nextStatus,
          rejection_reason: reasonText,
          verified_by: input.actorId || null,
          verified_at: now,
        })
        .eq('id', latestProofRow.id);
    }

    await sb.from('payment_audit_logs').insert({
      registration_id: reg.id,
      actor_id: input.actorId || null,
      actor_label: input.actorEmail,
      action: input.decision === 'reupload_required' ? 'REQUEST_REUPLOAD' : 'REJECT',
      notes: reasonText,
    });
  }

  return (await trackRegistration(reg.teamCode, reg.iglPhone))!;
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
  if (error || !data) throw new ClientInputError('Failed to update event.');
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
  if (error || !data) throw new ClientInputError('Failed to create event.');
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
  if (error) throw new ClientInputError('Unable to complete the database request. Please try again.');
  const { data } = sb.storage.from('event-assets').getPublicUrl(storagePath);
  await updateEventConfig(eventId, { qrImageUrl: data.publicUrl });
  return data.publicUrl;
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
    // Local preview token HMAC validation
    const secret = process.env.ADMIN_DEMO_PASSCODE;
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

  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return { ok: false, email: '', userId: null };

  const { data: allowRow } = await sb
    .from('admin_users')
    .select('email, role')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (!allowRow) return { ok: false, email: '', userId: null };
  return { ok: true, email: String(allowRow.email), userId: data.user.id };
}

export async function listPublicLiveBoard(): Promise<{
  events: CampusEvent[];
  teams: PublicRegisteredTeam[];
  generatedAt: string;
}> {
  const events = await listPublicEvents();
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const sb = getSupabaseServiceClient();

  if (!sb) {
    const store = readLocalStore();
    const teams = store.registrations
      .filter((r) => r.status !== 'rejected')
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((reg) => {
        const evt = eventMap.get(reg.eventId) || DEFAULT_EVENTS[0];
        const members = store.members.filter((m) => m.registrationId === reg.id);
        return sanitizePublicTeam({
          registration: reg,
          event: evt,
          members,
        });
      });

    return {
      events,
      teams,
      generatedAt: new Date().toISOString(),
    };
  }

  const { data: regRows, error: regErr } = await sb
    .from('registrations')
    .select(
      'id, team_code, event_id, team_name, college_name, has_substitute, status, group_name, slot_number, created_at, updated_at'
    )
    .neq('status', 'rejected')
    .order('created_at', { ascending: false });
  if (regErr) throw new ClientInputError('Unable to load registration data.');

  const { data: memRows, error: memErr } = await sb
    .from('team_members')
    .select('registration_id, slot_role, in_game_name');
  if (memErr) throw new ClientInputError('Unable to load roster data.');

  const membersByReg = new Map<
    string,
    Array<{ slotRole: PlayerInput['slotRole']; inGameName: string }>
  >();
  for (const row of memRows || []) {
    const regId = String(row.registration_id);
    const list = membersByReg.get(regId) || [];
    list.push({
      slotRole: row.slot_role as PlayerInput['slotRole'],
      inGameName: String(row.in_game_name || ''),
    });
    membersByReg.set(regId, list);
  }

  const teams = (regRows || []).map((row) => {
    const regId = String(row.id);
    const eventId = String(row.event_id);
    const evt = eventMap.get(eventId) || DEFAULT_EVENTS[0];
    return sanitizePublicTeam({
      registration: {
        id: regId,
        teamCode: String(row.team_code),
        eventId,
        teamName: String(row.team_name),
        collegeName: String(row.college_name),
        hasSubstitute: Boolean(row.has_substitute),
        status: row.status as RegistrationStatus,
        groupName: row.group_name ? String(row.group_name) : null,
        slotNumber: row.slot_number ? String(row.slot_number) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      },
      event: evt,
      members: membersByReg.get(regId) || [],
    });
  });

  return {
    events,
    teams,
    generatedAt: new Date().toISOString(),
  };
}

export function issueLocalAdminToken(email: string): string {
  const secret = process.env.ADMIN_DEMO_PASSCODE;
  if (!secret) throw new ClientInputError('Administrator login is not configured.');
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + 12 * 60 * 60 * 1000 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export { isValidEmail };
