# Srusti Campus Esports

React + Vite frontend with an Express API. BGMI and Free Fire squads register, submit UPI payment proof, track applications, and receive a slot after administrator verification. The public board shows aggregate registration counts and available capacity by game.

## Event and fees

- Campus entry: **13 December 2026, 9:30 AM IST**.
- Entry: **₹299 per team**. Optional lunch: **₹100 once per team**, regardless of meal count. Total: ₹299 or ₹399.
- Individual meal choices remain available for catering. Previously saved payment totals are preserved.
- Built-in events use the official date from `src/lib/defaultEvents.ts`, including previously stored event settings. Other events retain their dates.

## Development and checks

Use Node.js 22 or newer. Run `npm ci`, configure `.env` using `.env.example`, then `npm run dev`.

```
npm run lint
node --import tsx --test src/lib/*.test.ts server/workflow.test.ts
npm run build
```

The workflow test uses an isolated temporary store and synthetic data. It does not send emails or contact Supabase.

## Deployment and privacy

The build writes public assets to `dist/` and server code to `build/server.js`. Set `NODE_ENV=production` and run `npm start`. Never publish `build/`, `.data/`, or environment files as static assets. Docker includes both build directories.

Configure a unique `ADMIN_DEMO_PASSCODE` for local administration; there is no fallback password. Replace any previously used demo password before deployment. Admin sessions use tab-scoped storage and authorization headers, including proof-image requests. Database mode also checks the Supabase admin allowlist. Payment proof storage must stay private; see `supabase/schema.sql`.

Configure official UPI details, SMTP delivery, and Supabase before launch. Local JSON persistence is for development/single-process use, not concurrent or serverless production writes. Supabase registration currently uses multiple writes and needs transaction/concurrency hardening before heavy traffic. Live payment settlement, SMTP delivery and database policies require deployment-specific testing.

## Status lookup and response latency (21 November 2026)

- Track Status accepts a team leader mobile number **or** registration ID. Single-identifier responses contain only team/event/status/slot information. Private details, printing passes, and changing payment proof still require both matching identifiers. Mobile lookup supports multiple registrations.
- Registration and admin decisions return after persistence without waiting for SMTP. Vercel `waitUntil` keeps delivery running after the response, within the function's 30-second limit. This is best-effort delivery, not a durable retry queue. Admins can refresh email status and use Resend Email if delivery fails or remains pending after a timeout. No schema migration or R2 bucket is needed for these changes.
- Approval updates the affected admin row directly. The public board polls every five seconds while visible when SSE is unavailable; CDN responses expire after two seconds without serving stale content during revalidation.
- API JSON responses expose total handler duration in `Server-Timing`. POST logs contain the route template, duration and status, not input identifiers. Email logs contain duration and delivery outcome. Compare these timings with Vercel/DB regions and upload timing before changing infrastructure.
- Tests include stalled local SMTP, OR lookup, multiple matches, mismatched identifiers, private response filtering and protected proof changes. Run `npm test`, `npm run lint`, `npm run build`, and `npm run check:api`.

## Design direction

College esports broadcast style: oversized condensed headlines, charcoal backgrounds, crimson actions, gold timing accents, existing game artwork and a prominent match-day ticket. Short entrances and poster hover effects respect reduced-motion preferences. Registration, rulebooks, tracking and the live board retain their navigation.

## Approved homepage artwork

The centered homepage uses `public/assets/brand/srusti-student-arena.png`, generated with the built-in imagegen tool. Art brief: four fictional Indian undergraduate players aged 18–22, two on each side of a symmetrical blue/crimson college arena, with a dark central area reserved for live branding and countdown. The college crest and esports wordmark remain original supplied assets. Full rulebooks are available through tournament cards.

Responsive preview verified at 320, 390, 768 and 1440 CSS-pixel widths with no horizontal overflow. The title and countdown share the same center line. Mobile navigation, pause-effects control and tournament-to-registration navigation were exercised in the browser.

## Verification and security review (18 November 2026)

- `npm run lint`, `npm run build`, and `npm test`: passed; 15 tests cover fees, countdown boundaries, registration/reupload/approval, public data filtering, malformed requests and administrator authorization.
- `npm audit --omit=dev`: zero known production vulnerabilities. The full development tree still reports the picomatch repeated-extglob ReDoS advisory (GHSA-fc5q-39xc-vjpf), through Vite/tinyglobby. The registry's latest picomatch was 4.0.7, still affected. Build tooling is now dev-only and excluded from the production container; development binds to loopback. Do not expose the development server or process untrusted glob patterns.
- Unexpected API errors are redacted. Payment proof routes require authorization headers, responses are not cached, and framing is denied. Supabase schema no longer seeds a shared administrator identity and ensures the payment-proofs bucket is private when applied.
- Tracked source and public build were checked for configured secret values and private data/build paths. No matches were found. This is not a guarantee against all vulnerabilities or a review of deployed database state.
- Homepage checks at 390, 768 and 1440 pixels: no horizontal overflow; FAQ toggles, countdown updates and no browser console errors. Coordinator/admin navigation links were removed from public navigation; the existing protected admin route remains available to authorized staff.
- Initial homepage JavaScript is about 263 KB (83 KB gzipped), down from 372 KB (107 KB gzipped) before route splitting. Particles stop when hidden/off-screen, respect reduced-motion changes, and draw at up to 30 fps. Countdown stops while hidden, refreshes on return, and never displays zero before entry opens.

Live Supabase policies, SMTP delivery, payment settlement, production concurrency and deployed infrastructure still require environment-specific validation. Applying the SQL changes to an existing database is a separate deployment step.
