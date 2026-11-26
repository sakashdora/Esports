import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express, Request, RequestHandler, Response } from 'express';
import {
  getCheckInSquad, getLocalAdminPasscode, getVolunteerCredentials, isSupabaseConfigured, listAttendance, listVolunteers,
  markParticipantPresent, saveVolunteer, verifyAdminToken,
} from './store.js';

const passwordKey = promisify(scrypt);
const loginIdPattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const teamCodePattern = /^[A-Z0-9]{1,16}-\d{3,10}$/;
const memberIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function hashesMatch(expected: string, supplied: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function hashPassword(password: string, salt = randomBytes(16).toString('hex')): Promise<string> {
  const key = await passwordKey(password, salt, 64) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

function volunteerSecret(): string | undefined {
  if (isSupabaseConfigured()) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  return getLocalAdminPasscode();
}

function volunteerSignature(secret: string, id: string, expiry: string, passwordHash: string) {
  return createHmac('sha256', secret).update(`volunteer:${id}:${expiry}:${passwordHash}`).digest('base64url');
}

export async function signInVolunteer(loginId: string, password: string) {
  const secret = volunteerSecret();
  if (!secret || !loginIdPattern.test(loginId)) return null;
  const volunteer = await getVolunteerCredentials(loginId);
  if (!volunteer) return null;
  if (password.length < 8 || password.length > 128) return { token: '' };
  const [salt] = volunteer.passwordHash.split(':');
  if (!hashesMatch(volunteer.passwordHash, await hashPassword(password, salt))) return { token: '' };
  const expiry = String(Date.now() + 10 * 60 * 60 * 1_000);
  const signature = volunteerSignature(secret, loginId, expiry, volunteer.passwordHash);
  return { token: `volunteer:${loginId}:${expiry}:${signature}` };
}

async function staffActor(header?: string): Promise<string | null> {
  if (!header?.startsWith('Bearer volunteer:')) {
    const admin = await verifyAdminToken(header);
    return admin.ok ? admin.email : null;
  }
  const secret = volunteerSecret();
  const [, id, expiry, signature, extra] = header.slice(7).split(':');
  if (!secret || extra !== undefined || !loginIdPattern.test(id || '') || !/^\d{13}$/.test(expiry || '') || Number(expiry) <= Date.now() || !signature) return null;
  const volunteer = await getVolunteerCredentials(id);
  return volunteer && hashesMatch(volunteerSignature(secret, id, expiry, volunteer.passwordHash), signature) ? id : null;
}

export function readCheckInCode(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 8_000) return '';
  const value = raw.trim();
  let candidate = value;
  if (value.startsWith('Srusti Esports 2026 | Team check-in\n')) {
    const lines = value.split('\n');
    candidate = lines[1]?.match(/^Team code: ([\w-]+)$/)?.[1]
      || lines[1]?.match(/^Team: .+ \(([\w-]+)\)$/)?.[1] || '';
  } else if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      candidate = url.pathname === '/track' ? url.searchParams.get('code') || '' : '';
    } catch {
      return '';
    }
  }
  candidate = candidate.toUpperCase();
  return teamCodePattern.test(candidate) ? candidate : '';
}

function checkInFailure(res: Response, error: unknown) {
  const code = (error as { code?: string })?.code;
  console.error('[check-in] request failed', code || 'internal');
  res.status(500).json({ error: 'Check-in is temporarily unavailable. Please try again.' });
}

function saveVolunteerHandler(resetPassword: boolean): RequestHandler {
  return async (req, res) => {
    const inputId = resetPassword ? req.params.loginId : req.body?.loginId;
    const loginId = typeof inputId === 'string' ? inputId.trim().toLowerCase() : '';
    const password: unknown = req.body?.password;
    if (!loginIdPattern.test(loginId)) {
      return res.status(400).json({ error: 'Use 3–32 letters, numbers, periods, underscores or hyphens for the volunteer ID. Start with a letter or number.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128 || !password.trim()) {
      return res.status(400).json({ error: 'Enter a password with 8–128 characters.' });
    }
    try {
      const outcome = await saveVolunteer({ loginId, passwordHash: await hashPassword(password) }, resetPassword);
      if (outcome === 'duplicate') return res.status(409).json({ error: 'That volunteer ID is already in use.' });
      if (outcome === 'missing') return res.status(404).json({ error: 'Volunteer account not found.' });
      return res.status(resetPassword ? 200 : 201).json({ loginId });
    } catch (error) {
      checkInFailure(res, error);
    }
  };
}

type StaffHandler = (req: Request, res: Response, actor: string) => Promise<unknown>;

function requireCheckInStaff(handler: StaffHandler): RequestHandler {
  return async (req, res) => {
    try {
      const actor = await staffActor(req.headers.authorization);
      if (!actor) return res.status(401).json({ error: 'Sign in again to access check-in.' });
      await handler(req, res, actor);
    } catch (error) {
      checkInFailure(res, error);
    }
  };
}

export function mountCheckInRoutes(app: Express, requireAdmin: RequestHandler, limitCredentials: RequestHandler) {
  app.get('/api/admin/volunteers', requireAdmin, async (_req, res) => {
    try {
      res.json({ volunteers: await listVolunteers() });
    } catch (error) {
      checkInFailure(res, error);
    }
  });
  app.post('/api/admin/volunteers', requireAdmin, limitCredentials, saveVolunteerHandler(false));
  app.patch('/api/admin/volunteers/:loginId/password', requireAdmin, limitCredentials, saveVolunteerHandler(true));

  app.post('/api/check-in/lookup', requireCheckInStaff(async (req, res) => {
    const code = readCheckInCode(req.body?.code);
    if (!code) return res.status(400).json({ error: 'Scan a Srusti team pass or enter its Team ID.' });
    const squad = await getCheckInSquad(code);
    if (!squad) return res.status(404).json({ error: 'No confirmed team found for that pass.' });
    return res.json({ squad });
  }));

  app.post('/api/check-in/:teamCode/present', requireCheckInStaff(async (req, res, actor) => {
    const code = req.params.teamCode.toUpperCase();
    const memberId: unknown = req.body?.memberId;
    if (!teamCodePattern.test(code) || typeof memberId !== 'string' || !memberIdPattern.test(memberId)) {
      return res.status(400).json({ error: 'Select a participant from a verified team pass.' });
    }
    const mark = await markParticipantPresent(code, memberId, actor);
    if (!mark) return res.status(404).json({ error: 'The participant or confirmed seat is no longer available.' });
    return res.json({ mark });
  }));

  app.get('/api/check-in/attendance', requireCheckInStaff(async (req, res) => {
    const page = Number(req.query.page ?? '1');
    if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) {
      return res.status(400).json({ error: 'Choose a valid attendance page.' });
    }
    return res.json(await listAttendance(page));
  }));
}
