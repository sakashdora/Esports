import { scheduleConfirmation } from './notifications.js';
import { ClientInputError, clientErrorMessage } from './errors.js';
import { filterAdminRegistrations, type AdminFilters } from '../src/lib/adminFilters.js';
import { exportAdminPdf, exportAdminWorkbook } from './adminExports.js';
import 'dotenv/config';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { isSmtpConfigured, sendTeamConfirmationEmail } from './email.js';
import {
  createExtensibleEvent,
  createRegistrationWithProof,
  decideRegistrationPayment,
  getEventBySlug,
  getProofFile,
  deleteRegistrations,
  getRegistrationBundleById,
  getLocalQrFile,
  getSupabaseAnonClient,
  getSupabaseServiceClient,
  isSupabaseConfigured,
  issueLocalAdminToken,
  listAdminDashboardData,
  listPublicEvents,
  listPublicLiveBoard,
  recordEmailAudit,
  resubmitPaymentProof,
  saveOfficialQrImage,
  trackRegistration,
  lookupRegistrationStatus,
  updateEventConfig,
  verifyAdminToken,
} from './store.js';
import type { PlayerInput } from '../src/lib/tournamentRules.js';

const liveBoardEmitter = new EventEmitter();
liveBoardEmitter.setMaxListeners(100);

// Serverless instances (Vercel) cannot hold long-lived streams or share in-process events,
// so the live board polls there instead of streaming.
const supportsStreaming = !process.env.VERCEL;

// Public read endpoints may be briefly cached by the CDN; this absorbs traffic spikes
// without making counts noticeably stale.
function setPublicCache(res: Response) {
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=2, must-revalidate');
}

function emitLiveBoardUpdate() {
  liveBoardEmitter.emit('update', { timestamp: new Date().toISOString() });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Lightweight in-memory rate limiter for public lookup & submissions
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'unknown'}:${req.path}`;
    const now = Date.now();
    const cur = rateLimitMap.get(key);
    if (!cur || now > cur.resetAt) {
      // Drop expired windows so the map cannot grow without bound on a long-running server.
      if (rateLimitMap.size > 5000) {
        for (const [entryKey, entry] of rateLimitMap) if (now > entry.resetAt) rateLimitMap.delete(entryKey);
      }
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (cur.count >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    cur.count += 1;
    return next();
  };
}

interface AdminRequest extends Request {
  admin?: { email: string; userId: string | null };
}

async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const headerToken = req.headers.authorization;
  const auth = await verifyAdminToken(headerToken).catch(() => ({ ok: false, email: '', userId: null }));
  if (!auth.ok) {
    return res.status(401).json({ error: 'Unauthorized. Valid Admin session required.' });
  }
  req.admin = { email: auth.email, userId: auth.userId };
  return next();
}

export function createApiApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  // Behind Vercel/a reverse proxy every request arrives from the proxy's address, so without
  // this all students shared one rate-limit bucket and could lock each other out.
  app.set('trust proxy', process.env.VERCEL ? true : 'loopback, linklocal, uniquelocal');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use((req, res, next) => {
    const started = performance.now();
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const duration = Math.round(performance.now() - started);
      res.setHeader('Server-Timing', 'api;dur=' + duration);
      if (req.method === 'POST') console.info(JSON.stringify({
        operation: req.route?.path || 'request', durationMs: duration, status: res.statusCode,
      }));
      return originalJson(body);
    }) as typeof res.json;
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  // 1. Health & System Status
  app.get('/api/health', (_req, res) => {
    // Deliberately minimal: which database or mail service is in use is not for visitors.
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // 2. Public Events
  app.get('/api/events', async (_req, res) => {
    try {
      const events = await listPublicEvents();
      setPublicCache(res);
      res.json({ events });
    } catch (err) {
      const message = 'Failed to load events';
      res.status(500).json({ error: message });
    }
  });

  // Public registration totals (JSON and server-sent events).
  app.get('/api/live-registrations', async (_req, res) => {
    try {
      const board = await listPublicLiveBoard();
      setPublicCache(res);
      res.json({ ...board, realtime: supportsStreaming });
    } catch (err) {
      const message = 'Failed to load live registered teams.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/live-registrations/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    if (!supportsStreaming) {
      // Tell the browser to reconnect slowly; the page polls the JSON endpoint instead.
      res.write('retry: 60000\n\n');
      try {
        const board = await listPublicLiveBoard();
        res.write(`event: board\ndata: ${JSON.stringify(board)}\n\n`);
      } catch {
        // The page falls back to polling.
      }
      res.end();
      return;
    }

    const sendSnapshot = async () => {
      try {
        const board = await listPublicLiveBoard();
        if (!res.writableEnded) {
          res.write(`event: board\ndata: ${JSON.stringify(board)}\n\n`);
        }
      } catch {
        // Ignore transient read errors during stream push
      }
    };

    await sendSnapshot();

    const onUpdate = () => {
      void sendSnapshot();
    };
    liveBoardEmitter.on('update', onUpdate);

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(`: ping ${Date.now()}\n\n`);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      liveBoardEmitter.off('update', onUpdate);
    });
  });

  app.get('/api/events/:slug', async (req, res) => {
    try {
      const event = await getEventBySlug(req.params.slug);
      if (!event) return res.status(404).json({ error: 'Event not found.' });
      setPublicCache(res);
      return res.json({ event });
    } catch (err) {
      const message = 'Failed to load event';
      return res.status(500).json({ error: message });
    }
  });

  // Public Local QR Serving
  app.get('/api/public/qr/:fileName', async (req, res) => {
    const file = await getLocalQrFile(req.params.fileName);
    if (!file) return res.status(404).send('QR not found');
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(file.buffer);
  });

  // 3. Student Squad Registration + QR Payment Proof Submission
  app.post(
    '/api/registrations',
    rateLimit(20, 60_000),
    upload.single('screenshot'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Payment screenshot image is required.' });
        }

        let rawPayload;
        try { rawPayload = typeof req.body.payload === 'string' ? JSON.parse(req.body.payload) : req.body; } catch { return res.status(400).json({ error: 'Invalid registration details.' }); }
        if (!rawPayload || typeof rawPayload !== 'object') return res.status(400).json({ error: 'Invalid registration details.' });
        const members = (rawPayload.members || []) as PlayerInput[];

        const bundle = await createRegistrationWithProof({
          eventSlug: String(rawPayload.eventSlug || ''),
          teamName: String(rawPayload.teamName || ''),
          collegeName: String(rawPayload.collegeName || ''),
          iglPhone: String(rawPayload.iglPhone || ''),
          iglEmail: String(rawPayload.iglEmail || ''),
          hasSubstitute: Boolean(rawPayload.hasSubstitute),
          members,
          eligibilityConfirmed: Boolean(rawPayload.eligibilityConfirmed),
          fairPlayConfirmed: Boolean(rawPayload.fairPlayConfirmed),
          activeSkillConfirmed: Boolean(rawPayload.activeSkillConfirmed),
          utrNumber: String(rawPayload.utrNumber || ''),
          upiApp: String(rawPayload.upiApp || 'UPI'),
          fileBuffer: req.file.buffer,
        });

        scheduleConfirmation(bundle);

        emitLiveBoardUpdate();

        return res.status(201).json({
          registration: bundle.registration,
          event: bundle.event,
          members: bundle.members,
          emailDispatched: false,
          emailDelivery: 'background',
          emailNote: 'Registration saved. Email delivery is in progress; keep your Team Registration ID safe.',
        });
      } catch (err) {
        const message = clientErrorMessage(err, 'Registration submission failed.');
        return res.status(400).json({ error: message });
      }
    }
  );

  // 4. Status with either identifier; private details require both.
  app.post('/api/registrations/track', rateLimit(30, 60_000), async (req, res) => {
    try {
      const teamCode = String(req.body.teamCode || '').trim();
      const iglPhone = String(req.body.iglPhone || '').trim();
      if (!teamCode || !iglPhone) {
        const matches = await lookupRegistrationStatus(teamCode, iglPhone);
        if (!matches.length) return res.status(404).json({ error: 'No matching registration found. Check the identifier and try again.' });
        return res.json({ matches, detailsVerified: false });
      }
      const bundle = await trackRegistration(teamCode, iglPhone);
      if (!bundle) {
        return res.status(404).json({
          error: 'No matching registration found. Verify your Team ID and 10-digit IGL Phone.',
        });
      }
      const latestProof = bundle.proofs[0];
      return res.json({
        detailsVerified: true,
        registration: bundle.registration,
        event: {
          title: bundle.event.title,
          gameTitle: bundle.event.gameTitle,
          slug: bundle.event.slug,
          venueLabel: bundle.event.venueLabel,
          eventDateLabel: bundle.event.eventDateLabel,
          qrImageUrl: bundle.event.qrImageUrl,
          upiVpa: bundle.event.upiVpa,
          upiPayeeName: bundle.event.upiPayeeName,
        },
        members: bundle.members.map((m) => ({
          slotRole: m.slotRole,
          fullName: m.fullName,
          inGameName: m.inGameName,
          characterId: m.characterId,
          academicLevel: m.academicLevel,
          wantsLunch: m.wantsLunch,
          dietType: m.dietType,
        })),
        latestProof: latestProof
          ? {
            utrNumber: latestProof.utrNumber,
            upiApp: latestProof.upiApp,
            paidAmount: latestProof.paidAmount,
            reviewStatus: latestProof.reviewStatus,
            rejectionReason: latestProof.rejectionReason,
            createdAt: latestProof.createdAt,
          }
          : null,
      });
    } catch (err) {
      const message = clientErrorMessage(err, 'Lookup failed. Please try again.');
      return res.status(err instanceof ClientInputError ? 400 : 500).json({ error: message });
    }
  });

  // 5. Resubmit Payment Proof (when Admin requests re-upload)
  app.post(
    '/api/registrations/reupload',
    rateLimit(15, 60_000),
    upload.single('screenshot'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'New payment screenshot is required.' });
        }
        const bundle = await resubmitPaymentProof({
          teamCode: String(req.body.teamCode || ''),
          iglPhone: String(req.body.iglPhone || ''),
          utrNumber: String(req.body.utrNumber || ''),
          upiApp: String(req.body.upiApp || 'UPI'),
          fileBuffer: req.file.buffer,
        });
        emitLiveBoardUpdate();
        return res.json({ ok: true, registration: bundle.registration });
      } catch (err) {
        const message = clientErrorMessage(err, 'Re-upload failed.');
        return res.status(400).json({ error: message });
      }
    }
  );

  // 6. Admin Login
  app.post('/api/admin/login', rateLimit(15, 60_000), async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');

      if (!isSupabaseConfigured()) {
        // The passcode fallback is for local development only. On Vercel it can never be
        // legitimate (storage there is temporary), so it must not be usable even if the
        // database settings go missing, and an old passcode in git history must not open it.
        if (process.env.VERCEL) return res.status(503).json({ error: 'Administrator login is not configured.' });
        const expected = process.env.ADMIN_DEMO_PASSCODE;
        if (!expected) return res.status(503).json({ error: 'Administrator login is not configured.' });
        if (password !== expected) {
          return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const adminEmail = email || 'info.esport@srustiacademy.ac.in';
        return res.json({
          token: issueLocalAdminToken(adminEmail),
          email: adminEmail,
          mode: 'local',
        });
      }

      const anon = getSupabaseAnonClient();
      const svc = getSupabaseServiceClient();
      if (!anon || !svc) {
        return res.status(500).json({ error: 'Supabase client unavailable.' });
      }
      const { data, error } = await anon.auth.signInWithPassword({ email, password });
      if (error || !data.session || !data.user) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      const { data: allowRow } = await svc
        .from('admin_users')
        .select('email, role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!allowRow) {
        return res.status(403).json({
          error: 'Account authenticated, but not listed in public.admin_users allowlist.',
        });
      }

      return res.json({
        token: data.session.access_token,
        email: String(allowRow.email),
        mode: 'supabase',
      });
    } catch (err) {
      const message = 'Login failed.';
      return res.status(500).json({ error: message });
    }
  });

  // 7. Protected Admin Dashboard Overview
  app.get('/api/admin/overview', requireAdmin, async (_req: AdminRequest, res) => {
    try {
      const data = await listAdminDashboardData();
      res.json({
        ...data,
        mode: isSupabaseConfigured() ? 'supabase' : 'local',
        smtpConfigured: isSmtpConfigured(),
      });
    } catch (err) {
      const message = 'Failed to load admin overview.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/admin/export/:format', requireAdmin, rateLimit(10, 60_000), async (req, res) => {
    if (!['xlsx', 'pdf'].includes(req.params.format)) return res.status(400).json({ error: 'Choose Excel or PDF.' });
    const filters: AdminFilters = {};
    for (const key of ['search', 'event', 'status', 'lunch', 'from', 'to', 'sort'] as const) {
      if (typeof req.body?.[key] === 'string') filters[key] = req.body[key].slice(0, 200);
    }
    if (filters.from && filters.to && filters.from > filters.to) return res.status(400).json({ error: 'Start date must be before end date.' });
    try {
      const data = await listAdminDashboardData();
      const bundles = filterAdminRegistrations(data.bundles, filters);
      const format = req.params.format;
      const bytes = format === 'xlsx' ? await exportAdminWorkbook(bundles) : await exportAdminPdf(bundles);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Disposition', `attachment; filename="srusti-registrations.${format}"`);
      res.type(format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf');
      return res.send(bytes);
    } catch {
      return res.status(500).json({ error: 'Export failed. Please try again.' });
    }
  });

  // 8. Protected Admin Proof Image Viewer (Local Mode)
  app.get('/api/admin/proof-image/:proofId', requireAdmin, async (req, res) => {
    const file = await getProofFile(req.params.proofId).catch(() => null);
    if (!file) return res.status(404).send('Screenshot not found');
    res.setHeader('Content-Type', file.mime);
    // A proof image never changes for a given proof id, so the admin's browser can keep it:
    // re-opening a team or going back to it is instant instead of downloading it again.
    res.setHeader('Cache-Control', 'private, max-age=3600, immutable');
    return res.send(file.buffer);
  });

  // 9. Admin Verification Decision (Approve / Reject / Re-upload) + Email Dispatch
  // Permanently delete one or more registrations (used to clear demo/test entries).
  app.post('/api/admin/registrations/delete', requireAdmin, rateLimit(20, 60_000), async (req: AdminRequest, res) => {
    try {
      const result = await deleteRegistrations(req.body?.ids);
      console.info(JSON.stringify({ operation: 'admin-delete', deleted: result.deleted }));
      emitLiveBoardUpdate();
      return res.json({ ok: true, deleted: result.deleted });
    } catch (err) {
      return res.status(400).json({ error: clientErrorMessage(err, 'Delete failed.') });
    }
  });

  app.post('/api/admin/registrations/:id/decision', requireAdmin, async (req: AdminRequest, res) => {
    try {
      const decision = req.body.decision as 'approve' | 'reject' | 'reupload_required';
      if (!['approve', 'reject', 'reupload_required'].includes(decision)) {
        return res.status(400).json({ error: 'Invalid decision type.' });
      }
      const bundle = await decideRegistrationPayment({
        registrationId: req.params.id,
        decision,
        reason: typeof req.body.reason === 'string' ? req.body.reason : undefined,
        actorEmail: req.admin!.email,
        actorId: req.admin!.userId,
      });

      scheduleConfirmation(bundle);

      emitLiveBoardUpdate();

      return res.json({
        ok: true,
        registration: bundle.registration,
        proofs: bundle.proofs,
        auditLogs: bundle.auditLogs,
        emailSent: false,
        emailDelivery: 'background',
        emailNote: 'Decision saved. Email delivery is in progress.',
      });
    } catch (err) {
      const message = clientErrorMessage(err, 'Decision update failed.');
      return res.status(400).json({ error: message });
    }
  });

  // 10. Admin Manual Email Resend
  app.post(
    '/api/admin/registrations/:id/resend-email',
    requireAdmin,
    async (req: AdminRequest, res) => {
      try {
        const bundle = await getRegistrationBundleById(req.params.id);
        if (!bundle) return res.status(404).json({ error: 'Registration not found.' });

        const latestProof = bundle.proofs[0];
        const statusForEmail =
          bundle.registration.status === 'verified'
            ? 'verified'
            : bundle.registration.status === 'reupload_required'
              ? 'reupload_required'
              : bundle.registration.status === 'rejected'
                ? 'rejected'
                : 'pending';

        const emailRes = await sendTeamConfirmationEmail({
          toEmail: bundle.registration.iglEmail,
          teamCode: bundle.registration.teamCode,
          teamName: bundle.registration.teamName,
          eventTitle: bundle.event.title,
          gameTitle: bundle.event.gameTitle,
          status: statusForEmail,
          totalFee: bundle.registration.totalFee,
          lunchCount: bundle.registration.lunchCount,
          vegCount: bundle.registration.vegCount,
          nonVegCount: bundle.registration.nonVegCount,
          utrNumber: latestProof?.utrNumber || '',
          slotNumber: bundle.registration.slotNumber,
          groupName: bundle.registration.groupName,
          rejectionReason: bundle.registration.rejectionReason,
          venueLabel: bundle.event.venueLabel,
          eventDateLabel: bundle.event.eventDateLabel,
        });

        await recordEmailAudit(
          bundle.registration.id,
          emailRes.sent,
          emailRes.sent
            ? `Manual resend by ${req.admin!.email} to ${bundle.registration.iglEmail}`
            : emailRes.error || 'Manual resend failed'
        );

        return res.json({ ok: emailRes.sent, error: emailRes.error });
      } catch (err) {
        const message = 'Resend failed.';
      return res.status(500).json({ error: message });
      }
    }
  );

  // 11. Admin Event Management & Official QR Upload
  app.post('/api/admin/events', requireAdmin, async (req, res) => {
    try {
      const evt = await createExtensibleEvent(req.body);
      emitLiveBoardUpdate();
      res.status(201).json({ event: evt });
    } catch (err) {
      const message = clientErrorMessage(err, 'Failed to create event.');
      res.status(400).json({ error: message });
    }
  });

  app.patch('/api/admin/events/:id', requireAdmin, async (req, res) => {
    try {
      const evt = await updateEventConfig(req.params.id, req.body);
      emitLiveBoardUpdate();
      res.json({ event: evt });
    } catch (err) {
      const message = clientErrorMessage(err, 'Failed to update event.');
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/admin/events/:id/qr', requireAdmin, upload.single('qr'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'QR image file is required.' });
      const qrImageUrl = await saveOfficialQrImage(req.params.id, req.file.buffer);
      return res.json({ qrImageUrl });
    } catch (err) {
      const message = clientErrorMessage(err, 'QR upload failed.');
      return res.status(400).json({ error: message });
    }
  });

  app.get('/api/admin/schema.sql', requireAdmin, (_req, res) => {
    const sqlPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');
    if (!fs.existsSync(sqlPath)) return res.status(404).send('Schema not found');
    return res.type('text/plain').send(fs.readFileSync(sqlPath, 'utf-8'));
  });

  // Unknown API routes must answer with JSON, not the SPA's index.html.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  // Error handler for Multer upload size errors
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message} (max 5 MB)` });
    }
    const invalidBody = err instanceof SyntaxError || (typeof err === 'object' && err !== null && 'status' in err && [400, 413].includes(Number(err.status)));
    return res.status(invalidBody ? 400 : 500).json({ error: invalidBody ? 'Invalid request body.' : 'Unable to complete the request. Please try again.' });
  });

  return app;
}
