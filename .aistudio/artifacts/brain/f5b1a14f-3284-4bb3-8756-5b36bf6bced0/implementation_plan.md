# Srusti College Event & Esports Championship Platform — Research & Implementation Plan

A full-stack college event management and tournament registration platform for **Srusti Academy of Management and Technology (SAMT)**, launching with the flagship **Campus LAN Esports Championship (2K26)** (*Kalinga Warriors BGMI* and *Kurukshetra Free Fire*) and built on an extensible multi-event architecture powered by **Supabase Free** (PostgreSQL, Auth, and Storage).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **No application code will be written until you review this research report, resolve the open Phase 2 items below, and approve the final architecture.**

### Confirmed Decisions (Phase 1 Requirement Log)
1. **Official Lunch Add-On Fee**: **Rs. 100 per member opting for lunch** (with individual `VEG` / `NON-VEG` selection per player), resolving the Page 1 vs. Pages 2–3 rulebook discrepancy. Total formula: `Rs. 299 Base + (Lunch Count × Rs. 100)`.
2. **Platform Scope**: **Esports Championship flagship, extensible to other college events**. Launches tailored to *Kalinga Warriors (BGMI)* and *Kurukshetra (Free Fire)*, backed by a generic event schema so future college fests or workshops can be added via Admin.
3. **Student Access & Tracking**: **Open registration without a student login wall**. Upon submitting registration and payment proof, teams receive a unique Team Registration ID and can track live verification status using **Team ID + IGL Phone Number** lookup.
4. **Backend & Persistence Stack**: **Supabase Free** (PostgreSQL database, Supabase Auth for Admins, and Supabase Storage for payment screenshots and official UPI QR assets).
5. **Official College Email Confirmations**: Send automated transactional emails from the official college email account to the **Team Leader (IGL) Email** upon registration submission (Pending ID + receipt), Admin payment approval (Verified Slot + Pass link), and Admin rejection/re-upload request (reason + resubmission link).

### Open Questions for Phase 2 Confirmation
Please confirm these remaining items discovered during document analysis before we lock the schema and start development:

| # | Ambiguity / Missing Detail | Source Gap | Recommended Default |
| :--- | :--- | :--- | :--- |
| **Q1** | **Free Fire BR Final Match Count**: Page 6 Flowchart Figure 2 depicts `1 BATTLE (BR FINAL)`, whereas Pages 6–7 Tables 3.1 & 3.4 specify `4 Battle Royale matches` (`BR Final 1–4`). | Internal PDF mismatch | Follow Tables 3.1 & 3.4 (**4 BR Final matches**). |
| **Q2** | **In-Game Name (IGN) vs. Real Name**: Section 1.3 mandates players join rooms with their registered *Character ID and In-Game Name*, while Page 3 form only lists *Name* and *ID*. | Rulebook vs. Form gap | Capture **3 fields per player**: Full Real Name, In-Game Name (IGN), and Character ID. |
| **Q3** | **Eligibility & Contact Fields**: Section 1.2 enforces Age (16–22) OR Academic Level (11th–UG) + College ID verification, and organizers need contact info for room credentials/schedule changes, yet Page 3 lacks phone or age/class fields. | Missing form fields | Require **IGL Email** (confirmed for email confirmations), **IGL WhatsApp/Phone** (for status lookup & room alerts), and per-player **Academic Level (11th–UG)**. |
| **Q4** | **Cross-College Mixed Squads**: Rulebook says students from any college may form a team, while the Page 3 form has a single `College` field at team level. | Unclear team rule | Keep primary `College / Institution` on the team and allow an optional per-player college override if mixed squads are permitted. |
| **Q5** | **Event Dates, Deadlines & Venue**: No tournament dates, registration close timestamp, or campus hall/LAN venue are specified in the PDF. | Missing operational data | Store dates, deadlines, and venue in Admin-editable event settings (displaying *"Dates to be announced"* until configured). |
| **Q6** | **Official UPI QR & VPA**: Static QR image and/or UPI ID (`pa` + `pn`) for fee collection. | Asset pending | Support uploading the **Official Static QR image** in Admin, plus an **optional UPI VPA** to render exact-amount dynamic UPI intent links/QRs (`am` + `tr`). |
| **Q7** | **Cancellation & Refund Policy**: No cancellation or refund terms appear in the rulebook. | Missing policy | Disallow self-service cancellation after submission; handle rare refunds manually via Admin with an audit note. |
| **Q8** | **Official College Email Sending Method**: How the college email account sends automated messages (e.g., Google Workspace/Gmail SMTP via App Password, Microsoft 365 SMTP, or custom domain SMTP). | Email config pending | Use standard server-side **SMTP credentials** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) stored in environment secrets via Express. |

---

## 1. Complete Document Analysis & Requirements

### 1.1 Document Inventory & Findings
Five official materials were analyzed:
- **Official Esports Rulebook PDF (Pages 1–7)**: Governs *Srusti Academy of Management and Technology — Campus LAN Esports Championship (2K26)* covering *Kalinga Warriors (BGMI)* and *Kurukshetra (Free Fire)*.
- **Brand Background & Style Board PDF (Pages 8–9)**: Defines the textured obsidian canvas, the metallic red/silver `e-SPORTS` wordmark, 4 official swatches (Crimson Red, Metallic Silver gradient, Obsidian Black, Pure White), and 5 brand fonts (`Anton`, `Antonio`, `PUBG Sans Regular`, `Garet`, `Poppins`).
- **Institutional & Club Logos (4 PNGs)**:
  - *Srusti Academy of Management and Technology (SAMT)* royal blue & gold crest.
  - *SAGS* amber-orange & royal blue crest.
  - *Srusti Prasaar* silver/burnt-orange media broadcast crest.
  - *e-SPORTS* transparent cutout wordmark.

### 1.2 Extracted Mandatory vs. Optional Requirements

#### Mandatory Requirements (From Official Rulebook)
- **Fixed Prize Pool**: Rs. 20,000 total — Rs. 10,000 per game title (1st Position: Rs. 5,500 + Trophy; 2nd Position: Rs. 3,500 + Trophy; Final Match MVP: Rs. 1,000 based on verified final-match kills).
- **Registration Fee**: Rs. 299 mandatory base team fee per registered squad.
- **Roster Composition**: Exactly **4 active players** (Player 1 designated as **IGL**) + **1 optional substitute** (Player 5).
- **Eligibility**: Inter-college participation; age 16–22 OR enrolled from 11th Class to Undergraduate (UG); valid college ID required at physical LAN check-in.
- **Fair Play & Hardware Declarations**: Mobile devices only (no emulators/triggers/PC clients), anti-cheating & device inspection consent, 10-minute no-show forfeit policy, and **Free Fire Active Character Skill uniqueness rule** (no duplicate active skills across squad members).
- **Payment Proof Retention**: Teams must complete fee payment via official instructions and upload/retain payment proof.

#### Optional Requirements
- **Optional Lunch Add-On**: Per-member toggle (`Yes +Rs. 100` / `No`) with mandatory `VEG` / `NON-VEG` selection whenever opted in.
- **Player 5 (Substitute)**: Optional 5th squad member slot during registration.
- **Multi-Event Extensibility**: Admin capability to publish additional college events beyond the two flagship LAN Esports titles.

### 1.3 Event-Wise Registration Specifications

| Specification | Title 1: Kalinga Warriors (2K26) — BGMI | Title 2: Kurukshetra — Free Fire |
| :--- | :--- | :--- |
| **Team Capacity** | **24 Teams** (Group A: 12, Group B: 12) | **24 Teams** (Group A: 12, Group B: 12) |
| **Squad Size** | 4 Active (Player 1 = IGL) + 1 Optional Sub | 4 Active (Player 1 = IGL) + 1 Optional Sub |
| **Fee Structure** | Rs. 299 + (Lunch Opt-In Members × Rs. 100) | Rs. 299 + (Lunch Opt-In Members × Rs. 100) |
| **Stage 1 (Qualifiers)** | 3 BR Matches per group; Top 6 each advance (12 total) | 3 BR Matches per group; Top 6 each advance (12 total) |
| **Stage 2 (Finals / BR)** | Grand Final: 12 teams, 4 BR Matches | BR Final Round: 12 teams, 4 BR Matches (Top 4 advance) |
| **Stage 3 (Playoffs)** | N/A | Clash Squad 4v4 BO3 Semifinals (#1v#4, #2v#3) & Grand Final |
| **Map Pool** | Erangel, Miramar, Rondo (random per match) | Bermuda, Kalahari, Purgatory (random per match) |
| **BR Scoring** | 1st: 10, 2nd: 6, 3rd: 5, 4th: 4, 5th: 3, 6th: 2, 7–8th: 1, 9–12th: 0 + 1 pt/kill | 1st: 12, 2nd: 9, 3rd: 8, 4th: 7, 5th: 6, 6th: 5, 7th: 4, 8th: 3, 9th: 2, 10th: 1, 11–12th: 0 + 1 pt/kill |
| **Game-Specific Validation** | Character ID + IGN uniqueness per event | Character ID + IGN uniqueness + Active Skill acknowledgement |
| **Tie-Breaker Order** | (1) Total kills → (2) Best single-match placement → (3) Referee decision | (1) Total kills → (2) Best single-match placement → (3) Referee decision |

### 1.4 Functional & Non-Functional Requirements

#### Functional Requirements
- **Student Portal**: Event directory with live remaining slot counters (e.g., `18 / 24 Slots Filled`), interactive rulebook & scoring matrices, multi-step team registration wizard with mandatory **IGL Email** + real-time fee & Veg/Non-Veg meal calculator, official QR payment step, screenshot + UTR proof submission, automated **IGL Email receipt & verification confirmation**, and Team ID + Phone status lookup with printable verified pass.
- **Admin Dashboard**: Role-protected login via Supabase Auth, KPI summary cards, event & capacity configuration, official UPI QR uploader, side-by-side payment proof review queue (zoomable screenshot + UTR duplicate indicator + amount match check), 1-click Approve / Reject / Request Re-upload actions with reason codes (automatically emailing the Team Leader), manual "Resend Confirmation Email" trigger with delivery status, participant & meal count rosters, CSV/Excel & print-ready PDF exports, and immutable audit trail.

#### Non-Functional Requirements (Supabase Free Tier Aligned)
- **Mobile-First Performance**: Fast load over campus 4G networks; client-side image compression before upload so screenshots stay compact while preserving readable UTR/timestamp text.
- **Supabase Free Guardrails**: Stay well within **500 MB database storage**, **1 GB file storage**, **5 GB uncached / 5 GB cached egress**, and **50,000 MAU**. Enforce strict max upload size (e.g., 2 MB compressed / 5 MB hard cap) and avoid unnecessary polling.
- **Inactivity Mitigation**: Supabase Free pauses projects after **7 consecutive days of zero requests**; include a lightweight health check / admin reminder before tournament week.
- **Accessibility**: WCAG AA contrast, $\ge 44\text{px}$ mobile touch targets, tabular numerals on all financial and scoring figures.

---

## 2. User Experience, Branding & Sitemap

### 2.1 Visual Identity & Branding Architecture
The design fuses **SAMT institutional credibility** with the **official Srusti e-SPORTS brand guide**—deliberately avoiding generic neon-cyan cyberpunk tropes:

- **Aesthetic Direction**: High-contrast editorial tournament arena on the public portal; crisp, high-density verification workstation in the Admin console.
- **Color Palette (60-30-10 Discipline)**:
  - *Public Event Portal*: **Obsidian Black (`#110D0C`)** and **Charcoal Surface (`#1A1716`)** (60% canvas), **Metallic Silver (`#C0C0C0` / `#2A2524` borders)** (30% structure), **Crimson Red (`#D41B14`)** (10% primary CTA & active focus), accented subtly with **SAMT Royal Blue (`#233D8B`)** and **Championship Gold (`#E5C736`)** strictly on institutional crests and prize placements.
  - *Admin Verification Dashboard*: Clean neutral slate (`#F8FAFC` canvas, `#FFFFFF` flat bordered panels) with semantic status badges always paired with explicit text labels (**Pending**, **Verified**, **Rejected**, **Re-upload Needed**).
- **Typography (2+1 Brand Rule)**:
  - *Display*: `Antonio` (directly from the Esports Brand Guide) with tight tracking and `text-wrap: balance`.
  - *Body & Controls*: `Poppins` (directly from the Esports Brand Guide) for readable rules, forms, and navigation.
  - *Tabular Data & IDs*: `JetBrains Mono` (`tabular-nums`) for Team IDs (`KW-2K26-014`), 12-digit UTRs, fee math, and scoring tables.
- **Header & Navigation Discipline**: Clean single-row 3-zone top bar (`Brand Crest & Wordmark` — `Events · Rules · Schedule · Track Status` — `Register Squad`), zero pill clutter on metadata, and official SAMT, SAGS, and Srusti Prasaar partner crests anchored respectfully in the Hero trust strip and Footer.

### 2.2 Proposed Website Sitemap

```
Srusti Campus Event Platform
│
├── / (Public Home & Championship Hub)
│   ├── Hero Banner (e-SPORTS + SAMT Crest, Prize Pool Rs. 20,000, Primary CTA)
│   ├── Active Events Grid (BGMI Kalinga Warriors, Free Fire Kurukshetra, + Extensible Events)
│   └── Organizer & Media Partners Strip (SAMT, SAGS, Srusti Prasaar)
│
├── /events/:slug (Event Details, Rulebook & Fixtures)
│   ├── Live Slot Capacity & Eligibility Summary
│   ├── Stage Progression & Map Pool
│   ├── Placement & Kill Points Matrix
│   └── Prize Breakdown & Fair Play Rules
│
├── /register/:slug (Multi-Step Squad Registration & QR Payment)
│   ├── Step 1: Team Info, IGL Contact & College Verification
│   ├── Step 2: 4 Active + 1 Optional Sub Roster + Meal/Veg/Non-Veg Toggles
│   ├── Step 3: Fee Summary + Official UPI QR Display + UTR & Screenshot Upload
│   └── Step 4: Instant Pending Confirmation & Unique Team Registration ID
│
├── /track (Student Status Lookup & Digital Pass)
│   ├── Lookup by Team Registration ID + IGL Phone Number
│   ├── Live Status Timeline (Pending Review -> Verified / Action Required)
│   ├── Resubmit Payment Proof (if flagged for re-upload by Admin)
│   └── Printable / Downloadable Official Team Pass (once Verified)
│
└── /admin (Protected Admin Console — Supabase Auth)
    ├── /admin/login (Email/Password Authentication)
    ├── /admin (Overview KPIs: Revenue, Pending Queue, Slot Fill, Veg/Non-Veg Totals)
    ├── /admin/payments (Side-by-Side Screenshot Inspector, UTR Deduplication, Approve/Reject)
    ├── /admin/registrations (Searchable Roster Table, Capacity/Waitlist, CSV/PDF Export)
    ├── /admin/events (Event & Fee Config, Official UPI QR Uploader, Registration Open/Close)
    └── /admin/logs (Immutable Payment & Admin Audit Trail)
```

### 2.3 Complete Registration & Verification Workflow

```
┌──────────────────┐     ┌───────────────────────┐     ┌─────────────────────────┐
│ 1. Select Event  │────▶│ 2. Roster & Meal Form │────▶│ 3. Calculate Exact Fee  │
│ (Slot Check <24) │     │ 4 Active + 1 Opt. Sub │     │ Rs.299 + (Meals × Rs.100│
└──────────────────┘     │ + Veg/Non-Veg Toggles │     └────────────┬────────────┘
                         └───────────────────────┘                  │
                                                                    ▼
┌──────────────────┐     ┌───────────────────────┐     ┌─────────────────────────┐
│ 6. Pending ID    │◀────│ 5. Upload Proof       │◀────│ 4. Display Official QR  │
│ + IGL Email Sent │     │ Screenshot + 12d UTR  │     │ Scan & Pay via UPI App  │
└────────┬─────────┘     │ (+ Duplicate Check)   │     └─────────────────────────┘
         │               └───────────────────────┘
         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ 7. Admin Verification Desk (Side-by-Side Screenshot + UTR + Bank Statement)    │
└──────────────────┬─────────────────────────────┬───────────────────────────────┘
                   │                             │
                   ▼ (Matches Bank Credit)       ▼ (Mismatch / Unclear / Fake)
         ┌───────────────────┐         ┌───────────────────────┐
         │ 8a. APPROVED      │         │ 8b. REJECTED / RE-UP  │
         │ Slot Confirmed +  │         │ Reason Logged + Email │
         │ Email + Pass      │         │ Sent w/ /track Link   │
         └───────────────────┘         └───────────────────────┘
```

---

## 3. QR-Based Payment Feasibility Report & Product Trade-Offs

### 3.1 Technical Reality Check: Static UPI QR Without a Gateway
Because the college currently has **no payment gateway (Razorpay/Stripe/Cashfree)** and no direct bank webhook API, **uploading a payment screenshot cannot automatically prove that money settled in the college bank account**:

- **What CANNOT be verified technically without a PG/Bank API**:
  1. Real-time settlement confirmation from NPCI/bank servers.
  2. Screenshot authenticity via EXIF metadata (WhatsApp, Android, and iOS screenshot tools strip or rewrite EXIF metadata, and modern fake-UPI generator apps produce pixel-clean mock receipts).
  3. Automatic OCR reliability across 20+ Indian UPI apps (GPay, PhonePe, Paytm, BHIM, Amazon Pay, CRED, bank apps) which all format UTR/UPI Ref IDs, timestamps, and fonts differently.

- **What CAN be verified technically (and enforced automatically)**:
  1. **Strict 12-Digit UTR / UPI Ref Validation & Uniqueness**: Every NPCI UPI transaction generates a 12-digit numeric UTR/RRN (or app-specific Transaction ID). Enforcing a PostgreSQL `UNIQUE` index on normalized `utr_number` prevents two teams from reusing the same transaction ID.
  2. **Cryptographic File Deduplication (`SHA-256`)**: Hashing uploaded screenshots prevents students from re-uploading an identical image across multiple submissions.
  3. **Exact Expected Amount Binding**: The system computes and locks `expected_amount` server-side from the roster's meal selections, displaying it right next to the screenshot during Admin review.
  4. **Dynamic UPI Intent Upgrade (Zero-Cost NPCI Standard)**: If the college shares their **UPI VPA (`pa`)** alongside their printed QR image, we can generate a per-registration NPCI UPI QR (`upi://pay?pa=<VPA>&pn=<College>&am=<EXACT_FEE>&tr=<TEAM_ID>&cu=INR`) on the fly using open-source QR rendering. This **locks the exact rupee amount** in the payer's UPI app (preventing Rs. 299 vs. Rs. 499 typos) and embeds the **Team Registration ID** in the bank statement remark—without using any third-party payment gateway!

### 3.2 Payment Approach Comparison

| Option | Automation | Setup Cost / Effort | Fraud Resistance | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **A. Static QR + Screenshot Only** | Manual | Zero | Low (prone to edited screenshots & wrong amounts) | Avoid alone |
| **B. Static QR + Mandatory 12-digit UTR + File Hash + Admin Side-by-Side Verification** | Semi-automated deduplication + Manual bank check | Zero cost; uses existing college QR immediately | Moderate-High (blocks duplicate UTRs/files; human matches bank statement) | **Baseline Required** |
| **C. Dynamic NPCI `upi://pay` QR (exact `am` + `tr`) + UTR + Screenshot + Admin Verification** | Amount & Team ID locked + Automated deduplication | Zero cost (needs college VPA string only) | High (no underpayment typos; bank statement shows Team ID) | **Strongly Recommended** |
| **D. Payment Gateway (Razorpay/Easebuzz)** | 100% Real-time | ~2% TDR + KYC/Merchant onboarding | Highest | Deferred (requires user approval) |

### 3.3 Key Architecture Trade-Offs
- **Decision 1 — Client-Direct Supabase vs. Express BFF + Supabase**:
  - *Chosen Approach*: **Express Server Proxy + Supabase JS SDK** for sensitive public writes (registration submission, duplicate UTR/hash checks, rate-limited status lookup, signed screenshot URLs) paired with **Supabase Auth + RLS** for Admin operations.
  - *Why*: Keeping `SUPABASE_SERVICE_ROLE_KEY` strictly server-side prevents malicious actors from bypassing capacity limits, probing other teams' phone numbers/screenshots, or altering fee calculations via browser dev tools.
- **Decision 2 — Private Storage Bucket for Payment Screenshots**:
  - *Chosen Approach*: Store screenshots in a **private Supabase Storage bucket** (`payment-proofs`), never a public URL bucket. Admins view images via short-lived signed URLs.
  - *Why*: Payment screenshots often reveal students' personal UPI IDs, bank names, and account/phone fragments; public URLs would leak student PII.

---

## 4. Technical Architecture, Database Design & Security

### 4.1 System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React 19 + Vite + Tailwind v4)               │
│                                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐  │
│  │ Public Event Showcase & │  │ Registration Wizard │  │ Admin Dashboard  │  │
│  │ Team Status Tracker     │  │ + Client Compression│  │ (Supabase Auth)  │  │
│  └────────────┬────────────┘  └──────────┬──────────┘  └────────┬─────────┘  │
└───────────────┼──────────────────────────┼──────────────────────┼────────────┘
                │ HTTPS / JSON             │ Multipart / JSON     │ Bearer JWT
                ▼                          ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    EXPRESS API SERVER (Port 3000 + Vite Middleware)          │
│                                                                              │
│  • Server-side Fee & Capacity Validation    • File Validation & SHA-256 Hash │
│  • Rate-Limited Team ID + Phone Lookup      • Admin JWT Verification & RBAC  │
│  • Atomic Slot & Duplicate UTR Guard        • Signed Storage URL Generator   │
│  • Transactional Email Dispatch (College SMTP via Nodemailer)                │
└──────────────┬─────────────────────────────────────────────────────┬─────────┘
               │ Service Role / Verified JWT                         │ SMTP/TLS
               ▼                                                     ▼
┌───────────────────────────────────────────────────┐  ┌───────────────────────┐
│              SUPABASE FREE PLATFORM               │  │ OFFICIAL COLLEGE      │
│                                                   │  │ EMAIL SERVER (SMTP)   │
│  ┌────────────────┐ ┌────────────┐ ┌───────────┐ │  │                       │
│  │ PostgreSQL DB  │ │ Supabase   │ │ Supabase  │ │  │ • Pending Receipt     │
│  │ (RLS Enabled)  │ │ Auth       │ │ Storage   │ │  │ • Verified Slot Pass  │
│  └────────────────┘ └────────────┘ └───────────┘ │  │ • Re-upload Notice    │
└───────────────────────────────────────────────────┘  └───────────────────────┘
```

### 4.2 Database Schema & ER Diagram (Supabase PostgreSQL)

```
┌───────────────────────────┐         ┌──────────────────────────────────────┐
│          events           │         │            registrations             │
├───────────────────────────┤         ├──────────────────────────────────────┤
│ PK id (uuid)              │───1:N───│ PK id (uuid)                         │
│ UQ slug (text)            │         │ UQ team_code (text, e.g. KW-26-001)  │
│    title (text)           │         │ FK event_id (uuid)                   │
│    game_title (text)      │         │    team_name (text)                  │
│    event_type (text)      │         │    college_name (text)               │
│    max_teams (int, 24)    │         │    igl_phone (text)                  │
│    base_fee (int, 299)    │         │    igl_email (text)                  │
│    lunch_fee (int, 100)   │         │    lunch_count (int)                 │
│    qr_image_url (text)    │         │    total_fee (int)                   │
│    upi_vpa (text, null)   │         │    status (pending|verified|rejected)│
│    rules_json (jsonb)     │         │    slot_number (text, e.g. A1..B12)  │
│    is_open (boolean)      │         │    created_at (timestamptz)          │
└───────────────────────────┘         └───────┬──────────────────────┬───────┘
                                              │                      │
                                             1:N                    1:N
                                              ▼                      ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────┐
│            team_members              │  │         payment_proofs           │
├──────────────────────────────────────┤  ├──────────────────────────────────┤
│ PK id (uuid)                         │  │ PK id (uuid)                     │
│ FK registration_id (uuid)            │  │ FK registration_id (uuid)        │
│    slot_role (IGL|P2|P3|P4|SUB)      │  │ UQ utr_number (text)             │
│    full_name (text)                  │  │    upi_app (text)                │
│    in_game_name (text)               │  │    paid_amount (int)             │
│    character_id (text)               │  │    screenshot_path (text)        │
│    academic_level (text)             │  │ UQ file_sha256 (text)            │
│    wants_lunch (boolean)             │  │    review_status (text)          │
│    diet_type (VEG|NON_VEG|NONE)      │  │    rejection_reason (text)       │
└──────────────────────────────────────┘  │    verified_by (uuid -> auth)    │
                                          │    verified_at (timestamptz)     │
                                          └──────────────────┬───────────────┘
                                                             │ 1:N
                                                             ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────┐
│            admin_users               │  │        payment_audit_logs        │
├──────────────────────────────────────┤  ├──────────────────────────────────┤
│ PK user_id (uuid -> auth.users)      │  │ PK id (uuid)                     │
│    email (text)                      │  │ FK registration_id (uuid)        │
│    role (super_admin|verifier)       │  │ FK actor_id (uuid -> admin_users)│
│    created_at (timestamptz)          │  │    action (SUBMIT|APPROVE|REJECT │
└──────────────────────────────────────┘  │            |EMAIL_SENT|EMAIL_FAIL)│
                                          │    notes (text)                  │
                                          │    created_at (timestamptz)      │
                                          └──────────────────────────────────┘
```

### 4.3 Security & Data Protection Assessment
- **Row-Level Security (RLS)**: Enabled on all tables. Public (`anon`) policies allow reading open `events` and aggregate slot counts only—no public `SELECT` on `registrations`, `team_members`, or `payment_proofs`.
- **PII Protection on Status Lookup**: The `/api/registrations/track` endpoint requires both `team_code` AND `igl_phone`, is rate-limited per IP, and returns masked/minimal confirmation details (Team Name, Event, Status, Meal Count, Pass Download) without exposing raw screenshots or full phone/email lists.
- **File Upload Hardening**: Validate magic bytes (`image/jpeg`, `image/png`, `image/webp`) server-side, reject SVG/HTML/executables, enforce $\le 5\text{ MB}$ limit, compute `SHA-256` to block duplicate proof uploads, and store inside private `payment-proofs` bucket.
- **Atomic Capacity & Duplicate Prevention**: Use a PostgreSQL RPC/transaction to count active (`pending` + `verified`) teams against `max_teams` (preventing race conditions on slot #24, or routing #25+ to waitlist if enabled) and enforce unique indexes on `(event_id, lower(team_name))`, `(event_id, character_id)`, and `utr_number`.
- **Admin RBAC & Audit Trail**: Admin API routes verify the Supabase Auth JWT and check membership in `admin_users` (`super_admin` vs. `verifier`). Every status change writes an immutable row to `payment_audit_logs`.
- **Email & SMTP Hardening**: Store official college email credentials strictly in server-side environment secrets (`SMTP_*`), escape/sanitize all user-entered strings (Team Name, College, Rejection Notes) inside HTML email templates to prevent injection, and execute email dispatch asynchronously with logged status (`EMAIL_SENT` / `EMAIL_FAIL`) plus an Admin **Resend Email** control so transient SMTP failures never roll back database registrations or approvals.

### 4.4 Potential Risks, Limitations & Mitigations
1. **Fake / Edited Payment Screenshots**: *Mitigation*: Require 12-digit UTR with uniqueness constraint + side-by-side Admin verification against the college's bank/UPI statement before marking status `verified`.
2. **Supabase Free Inactivity Pause (7 Days)**: *Mitigation*: Document a pre-event readiness check (and optional lightweight cron ping) so the database is never paused during registration windows.
3. **1 GB Storage Cap on Screenshots**: *Mitigation*: Compress screenshots in-browser via HTML5 Canvas (max width 1280px, ~150–300 KB JPEG/WebP) before upload; 1,000 teams would consume only ~250 MB.
4. **No Automated Refund Settlement**: *Mitigation*: Display clear "Verify amount before paying" notice and handle rare manual refunds outside the app with an Admin `REFUNDED` audit status.

### 4.5 Estimated Development Roadmap & Phases

| Phase | Scope & Deliverables | Gate |
| :--- | :--- | :--- |
| **Phase 1 (Current)** | Document analysis, QR payment feasibility, Supabase architecture, security review | **Done** |
| **Phase 2 (Next)** | Review & confirm Open Questions Q1–Q8 and finalize requirements | **Awaiting Your Input** |
| **Phase 3–5** | Finalize Supabase SQL migration script, RLS policies, API & SMTP contracts, and UI wireframes | Approval Gate |
| **Phase 6** | Full-stack implementation: Express + Supabase SDK + Nodemailer SMTP, Event Pages, Registration + QR Wizard, Status Tracker, Admin Verification Console, CSV/PDF Exports | Build Complete |
| **Phase 7** | Unit tests (`node:test`) for fee/scoring/UTR logic, end-to-end browser verification, security & email validation, and deployment checklist | Release Ready |
