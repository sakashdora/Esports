import { ArrowLeft, ArrowRight, CheckCircle2, QrCode, Upload } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo, useState } from 'react';
import type { CampusEvent } from '../lib/defaultEvents';
import { compressScreenshot } from '../lib/imageCompression';
import {
  buildUpiIntentUri,
  calculateRegistrationFee,
  isStrict12DigitUtr,
  isValidUtr,
  validateSquadSubmission,
  type DietType,
  type PlayerInput,
  type SlotRole,
} from '../lib/tournamentRules';
import type { AppRoute } from './Navbar';

interface RegisterViewProps {
  events: CampusEvent[];
  initialSlug: string;
  onNavigate: (next: AppRoute) => void;
  onRefreshEvents: () => void;
}

const DEFAULT_ROSTER: PlayerInput[] = [
  {
    slotRole: 'IGL',
    fullName: '',
    inGameName: '',
    characterId: '',
    academicLevel: 'UG',
    wantsLunch: false,
    dietType: 'NONE',
  },
  {
    slotRole: 'P2',
    fullName: '',
    inGameName: '',
    characterId: '',
    academicLevel: 'UG',
    wantsLunch: false,
    dietType: 'NONE',
  },
  {
    slotRole: 'P3',
    fullName: '',
    inGameName: '',
    characterId: '',
    academicLevel: 'UG',
    wantsLunch: false,
    dietType: 'NONE',
  },
  {
    slotRole: 'P4',
    fullName: '',
    inGameName: '',
    characterId: '',
    academicLevel: 'UG',
    wantsLunch: false,
    dietType: 'NONE',
  },
  {
    slotRole: 'SUB',
    fullName: '',
    inGameName: '',
    characterId: '',
    academicLevel: 'UG',
    wantsLunch: false,
    dietType: 'NONE',
  },
];

const ROLE_LABELS: Record<SlotRole, string> = {
  IGL: 'Player 1 (IGL / Team Leader)',
  P2: 'Player 2 (Active)',
  P3: 'Player 3 (Active)',
  P4: 'Player 4 (Active)',
  SUB: 'Player 5 (Optional Substitute)',
};

export function RegisterView({
  events,
  initialSlug,
  onNavigate,
  onRefreshEvents,
}: RegisterViewProps) {
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const event = useMemo(
    () => events.find((e) => e.slug === selectedSlug) || events[0],
    [events, selectedSlug]
  );

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [teamName, setTeamName] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [iglPhone, setIglPhone] = useState('');
  const [iglEmail, setIglEmail] = useState('');
  const [hasSubstitute, setHasSubstitute] = useState(false);
  const [members, setMembers] = useState<PlayerInput[]>(DEFAULT_ROSTER);
  const [eligibilityConfirmed, setEligibilityConfirmed] = useState(false);
  const [fairPlayConfirmed, setFairPlayConfirmed] = useState(false);
  const [activeSkillConfirmed, setActiveSkillConfirmed] = useState(false);

  // Payment step state
  const [utrNumber, setUtrNumber] = useState('');
  const [upiApp, setUpiApp] = useState('Google Pay');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{
    teamCode: string;
    totalFee: number;
    status: string;
    emailNote: string;
  } | null>(null);

  const activeMembers = useMemo(
    () => members.filter((m) => (hasSubstitute ? true : m.slotRole !== 'SUB')),
    [members, hasSubstitute]
  );

  const feeSummary = useMemo(
    () =>
      calculateRegistrationFee(
        activeMembers,
        event?.baseFee ?? 299,
        event?.lunchFee ?? 100
      ),
    [activeMembers, event]
  );

  const upiIntentUri = useMemo(() => {
    if (!event?.upiVpa) return '';
    return buildUpiIntentUri({
      vpa: event.upiVpa,
      payeeName: event.upiPayeeName || 'Srusti Academy of Management and Technology',
      amount: feeSummary.totalFee,
      teamCode: teamName.trim().slice(0, 14) || event.rulesJson.codePrefix || 'SAMT26',
      eventTitle: event.title,
    });
  }, [event, feeSummary.totalFee, teamName]);

  // A static QR that fails to load (moved/deleted file, private bucket) falls back to the
  // VPA-generated QR when a VPA is configured, instead of a broken image.
  const [failedQrUrl, setFailedQrUrl] = useState('');
  const qrLoadFailed = Boolean(event?.qrImageUrl) && failedQrUrl === event?.qrImageUrl;
  const showStaticQr = Boolean(event?.qrImageUrl) && !qrLoadFailed;

  function updateMember(role: SlotRole, patch: Partial<PlayerInput>) {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.slotRole !== role) return m;
        const next = { ...m, ...patch };
        if (patch.wantsLunch === false) next.dietType = 'NONE';
        if (patch.wantsLunch === true && next.dietType === 'NONE') next.dietType = 'VEG';
        return next;
      })
    );
  }

  function goToStep2() {
    const check = validateSquadSubmission({
      eventSlug: event.slug,
      teamName,
      collegeName,
      iglPhone,
      iglEmail,
      hasSubstitute: false,
      members: DEFAULT_ROSTER.map((m) => ({
        ...m,
        fullName: 'ok',
        inGameName: 'ok',
        characterId: m.slotRole,
      })),
      eligibilityConfirmed: true,
      fairPlayConfirmed: true,
      activeSkillConfirmed: true,
    });

    const step1Errors: Record<string, string> = {};
    // The server rejects closed events at final submission; say so before the roster is filled in.
    if (!event.isOpen) step1Errors.event = 'Registrations for this event are currently closed.';
    for (const key of ['teamName', 'collegeName', 'iglPhone', 'iglEmail']) {
      if (check.errors[key]) step1Errors[key] = check.errors[key];
    }
    setFieldErrors(step1Errors);
    if (Object.keys(step1Errors).length === 0) {
      setStep(2);
    }
  }

  function goToStep3() {
    const check = validateSquadSubmission({
      eventSlug: event.slug,
      teamName,
      collegeName,
      iglPhone,
      iglEmail,
      hasSubstitute,
      members,
      eligibilityConfirmed,
      fairPlayConfirmed,
      activeSkillConfirmed,
    });
    setFieldErrors(check.errors);
    if (check.valid) {
      setStep(3);
    }
  }

  async function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setSubmitError('');
    try {
      const compressed = await compressScreenshot(file);
      setScreenshotFile(compressed);
      const url = URL.createObjectURL(compressed);
      setScreenshotPreview(url);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Invalid image file.');
    }
  }

  async function handleSubmitRegistration(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    if (!isValidUtr(utrNumber)) {
      setSubmitError('Please enter a valid 12-digit UPI UTR / Transaction Reference Number.');
      return;
    }
    if (!screenshotFile) {
      setSubmitError('Please upload your UPI payment screenshot before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('screenshot', screenshotFile);
      formData.append(
        'payload',
        JSON.stringify({
          eventSlug: event.slug,
          teamName,
          collegeName,
          iglPhone,
          iglEmail,
          hasSubstitute,
          members: activeMembers,
          eligibilityConfirmed,
          fairPlayConfirmed,
          activeSkillConfirmed,
          utrNumber,
          upiApp,
        })
      );

      const res = await fetch('/api/registrations', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        throw new Error(json?.error || 'Registration service is unavailable right now. Please try again shortly.');
      }

      setReceipt({
        teamCode: json.registration.teamCode,
        totalFee: json.registration.totalFee,
        status: json.registration.status,
        emailNote: json.emailNote || '',
      });
      setStep(4);
      onRefreshEvents();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit registration.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!event) return null;

  return (
    <main className="min-h-screen bg-[#110D0C] text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <button
            type="button"
            onClick={() => onNavigate({ page: 'home' })}
            className="inline-flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </button>

          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className={step === 1 ? 'font-semibold text-[#E5C736]' : ''}>1. Squad Info</span>
            <span aria-hidden="true">/</span>
            <span className={step === 2 ? 'font-semibold text-[#E5C736]' : ''}>
              2. Roster &amp; Meals
            </span>
            <span aria-hidden="true">/</span>
            <span className={step === 3 ? 'font-semibold text-[#E5C736]' : ''}>
              3. UPI QR &amp; Proof
            </span>
            <span aria-hidden="true">/</span>
            <span className={step === 4 ? 'font-semibold text-[#16A34A]' : ''}>4. Receipt</span>
          </div>
        </div>

        {/* Live Fee Banner */}
        {step < 4 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#1A1716] px-5 py-4">
            <div>
              <div className="text-xs text-neutral-400">Registering For</div>
              <div className="font-display text-xl font-bold text-white uppercase">
                {event.title.replace(/2k26/gi, '2026')} ({event.gameTitle})
              </div>
            </div>
            <div className="flex items-center gap-6 text-right">
              <div>
                <div className="text-xs text-neutral-400">Meal Add-On</div>
                <div className="font-mono text-sm font-medium text-neutral-200 tabular-nums">
                  Rs. {feeSummary.lunchTotal} per team ({feeSummary.vegCount}V /{' '}
                  {feeSummary.nonVegCount}NV)
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-400">Total Payable</div>
                <div className="font-mono text-2xl font-bold text-[#E5C736] tabular-nums">
                  Rs. {feeSummary.totalFee}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Squad & IGL Contact */}
        {step === 1 && (
          <section className="mt-6 rounded-xl border border-white/10 bg-[#1A1716] p-6 sm:p-8">
            <h1 className="font-display text-2xl font-bold text-white uppercase">
              Step 1 · Squad &amp; Team Leader (IGL) Details
            </h1>
            <p className="mt-1 text-xs text-neutral-400">
              Official registration confirmation, verification status, and final slot pass will be
              emailed to the Team Leader (IGL).
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="reg-event" className="block text-xs font-medium text-neutral-300">
                  Tournament / Event Title
                </label>
                <select
                  id="reg-event"
                  value={event.slug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-white/15 bg-[#110D0C] px-3.5 py-2.5 text-sm text-white focus:border-[#D41B14] focus:outline-none"
                >
                  {events.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.title.replace(/2k26/gi, '2026')} — {item.gameTitle} ({item.registeredCount || 0}/{item.maxTeams}{' '}
                      Teams)
                    </option>
                  ))}
                </select>
                {fieldErrors.event && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.event}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-team-name" className="block text-xs font-medium text-neutral-300">
                  Squad / Team Name *
                </label>
                <input
                  id="reg-team-name"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Kalinga Apex"
                  className="mt-1.5 w-full rounded-md border border-white/15 bg-[#110D0C] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-[#D41B14] focus:outline-none"
                />
                {fieldErrors.teamName && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.teamName}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-college" className="block text-xs font-medium text-neutral-300">
                  College / Educational Institution *
                </label>
                <input
                  id="reg-college"
                  type="text"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  placeholder="e.g. Srusti Academy of Management and Technology"
                  className="mt-1.5 w-full rounded-md border border-white/15 bg-[#110D0C] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-[#D41B14] focus:outline-none"
                />
                {fieldErrors.collegeName && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.collegeName}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-xs font-medium text-neutral-300">
                  IGL WhatsApp / Phone Number (10 digits) *
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  value={iglPhone}
                  onChange={(e) => setIglPhone(e.target.value)}
                  placeholder="9876543210"
                  className="mt-1.5 w-full rounded-md border border-white/15 bg-[#110D0C] px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-neutral-500 focus:border-[#D41B14] focus:outline-none"
                />
                {fieldErrors.iglPhone && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.iglPhone}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-xs font-medium text-neutral-300">
                  Team Leader (IGL) Email Address *
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={iglEmail}
                  onChange={(e) => setIglEmail(e.target.value)}
                  placeholder="leader@college.edu.in"
                  className="mt-1.5 w-full rounded-md border border-white/15 bg-[#110D0C] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-[#D41B14] focus:outline-none"
                />
                {fieldErrors.iglEmail && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.iglEmail}</p>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={goToStep2}
                className="inline-flex items-center gap-2 rounded-md bg-[#D41B14] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#B41510]"
              >
                Continue to Roster &amp; Meals
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {/* Step 2: 4 Active + 1 Optional Substitute & Meal Preferences */}
        {step === 2 && (
          <section className="mt-6 rounded-xl border border-white/10 bg-[#1A1716] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white uppercase">
                  Step 2 · Squad Roster &amp; Optional Lunch (+Rs. {event.lunchFee}/Team)
                </h2>
                <p className="mt-1 text-xs text-neutral-400">
                  Enter exact Full Name, In-Game Name (IGN), and Character ID as required by Section
                  1.3 of the official rulebook. Lunch is optional: select meals below for a single Rs. {event.lunchFee} team charge. No meals means no lunch charge.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-[#110D0C] px-3.5 py-2 text-xs font-medium text-neutral-200">
                <input
                  type="checkbox"
                  checked={hasSubstitute}
                  onChange={(e) => setHasSubstitute(e.target.checked)}
                  className="h-4 w-4 accent-[#D41B14]"
                />
                Include Player 5 (Optional Substitute)
              </label>
            </div>

            <div className="mt-6 space-y-5">
              {activeMembers.map((member) => {
                const prefix = `member_${member.slotRole}`;
                return (
                  <div
                    key={member.slotRole}
                    className="rounded-lg border border-white/10 bg-[#110D0C] p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <span className="text-xs font-semibold text-[#E5C736]">
                        {ROLE_LABELS[member.slotRole]}
                      </span>

                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-200">
                          <input
                            type="checkbox"
                            checked={member.wantsLunch}
                            onChange={(e) =>
                              updateMember(member.slotRole, { wantsLunch: e.target.checked })
                            }
                            className="h-4 w-4 accent-[#D41B14]"
                          />
                          Include this player’s meal
                        </label>

                        {member.wantsLunch && (
                          <div className="flex items-center gap-1 rounded-md border border-white/15 bg-[#1A1716] p-0.5">
                            {(['VEG', 'NON_VEG'] as DietType[]).map((diet) => (
                              <button
                                key={diet}
                                type="button"
                                onClick={() => updateMember(member.slotRole, { dietType: diet })}
                                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                                  member.dietType === diet
                                    ? diet === 'VEG'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-[#D41B14] text-white'
                                    : 'text-neutral-400 hover:text-white'
                                }`}
                              >
                                {diet === 'VEG' ? 'VEG' : 'NON-VEG'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div>
                        <label
                          htmlFor={`${prefix}-fullName`}
                          className="block text-[11px] text-neutral-400"
                        >
                          Full Real Name *
                        </label>
                        <input
                          id={`${prefix}-fullName`}
                          type="text"
                          value={member.fullName}
                          onChange={(e) =>
                            updateMember(member.slotRole, { fullName: e.target.value })
                          }
                          placeholder="Full name"
                          className="mt-1 w-full rounded border border-white/15 bg-[#1A1716] px-3 py-2 text-xs text-white focus:border-[#D41B14] focus:outline-none"
                        />
                        {fieldErrors[`${prefix}_fullName`] && (
                          <p className="mt-1 text-[11px] text-red-400">
                            {fieldErrors[`${prefix}_fullName`]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`${prefix}-ign`}
                          className="block text-[11px] text-neutral-400"
                        >
                          In-Game Name (IGN) *
                        </label>
                        <input
                          id={`${prefix}-ign`}
                          type="text"
                          value={member.inGameName}
                          onChange={(e) =>
                            updateMember(member.slotRole, { inGameName: e.target.value })
                          }
                          placeholder="Exact IGN"
                          className="mt-1 w-full rounded border border-white/15 bg-[#1A1716] px-3 py-2 text-xs text-white focus:border-[#D41B14] focus:outline-none"
                        />
                        {fieldErrors[`${prefix}_inGameName`] && (
                          <p className="mt-1 text-[11px] text-red-400">
                            {fieldErrors[`${prefix}_inGameName`]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`${prefix}-cid`}
                          className="block text-[11px] text-neutral-400"
                        >
                          Character ID *
                        </label>
                        <input
                          id={`${prefix}-cid`}
                          type="text"
                          value={member.characterId}
                          onChange={(e) =>
                            updateMember(member.slotRole, { characterId: e.target.value })
                          }
                          placeholder="e.g. 5123456789"
                          className="mt-1 w-full rounded border border-white/15 bg-[#1A1716] px-3 py-2 font-mono text-xs text-white focus:border-[#D41B14] focus:outline-none"
                        />
                        {fieldErrors[`${prefix}_characterId`] && (
                          <p className="mt-1 text-[11px] text-red-400">
                            {fieldErrors[`${prefix}_characterId`]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor={`${prefix}-level`}
                          className="block text-[11px] text-neutral-400"
                        >
                          Academic Level
                        </label>
                        <select
                          id={`${prefix}-level`}
                          value={member.academicLevel}
                          onChange={(e) =>
                            updateMember(member.slotRole, { academicLevel: e.target.value })
                          }
                          className="mt-1 w-full rounded border border-white/15 bg-[#1A1716] px-3 py-2 text-xs text-white focus:border-[#D41B14] focus:outline-none"
                        >
                          <option value="11th">11th Class</option>
                          <option value="12th">12th Class</option>
                          <option value="UG">Undergraduate (UG)</option>
                          <option value="Age 16-22">Other (Age 16–22)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mandatory Declarations */}
            <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-xs">
              <label className="flex cursor-pointer items-start gap-2.5 text-neutral-300">
                <input
                  type="checkbox"
                  checked={eligibilityConfirmed}
                  onChange={(e) => setEligibilityConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#D41B14]"
                />
                <span>
                  I confirm every squad member is aged 16–22 OR enrolled in 11th Class to UG and
                  will carry a valid College/Institution ID card to the venue.
                </span>
              </label>
              {fieldErrors.eligibilityConfirmed && (
                <p className="text-red-400">{fieldErrors.eligibilityConfirmed}</p>
              )}

              <label className="flex cursor-pointer items-start gap-2.5 text-neutral-300">
                <input
                  type="checkbox"
                  checked={fairPlayConfirmed}
                  onChange={(e) => setFairPlayConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#D41B14]"
                />
                <span>
                  Our squad agrees to mobile-only hardware rules (no emulators, triggers, or hacks)
                  and the 10-minute match punctuality forfeit rule.
                </span>
              </label>
              {fieldErrors.fairPlayConfirmed && (
                <p className="text-red-400">{fieldErrors.fairPlayConfirmed}</p>
              )}

              {event.slug === 'kurukshetra-free-fire' && (
                <>
                  <label className="flex cursor-pointer items-start gap-2.5 text-neutral-300">
                    <input
                      type="checkbox"
                      checked={activeSkillConfirmed}
                      onChange={(e) => setActiveSkillConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#D41B14]"
                    />
                    <span>
                      Free Fire Active Skill Rule: Each player on our squad will equip a{' '}
                      <strong>different</strong> active character skill (no duplicates).
                    </span>
                  </label>
                  {fieldErrors.activeSkillConfirmed && (
                    <p className="text-red-400">{fieldErrors.activeSkillConfirmed}</p>
                  )}
                </>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-md border border-white/15 px-5 py-2.5 text-xs font-medium text-neutral-200 hover:bg-white/5"
              >
                Back
              </button>
              <button
                type="button"
                onClick={goToStep3}
                className="inline-flex items-center gap-2 rounded-md bg-[#D41B14] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#B41510]"
              >
                Proceed to UPI QR Payment
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {/* Step 3: Official College UPI QR + Proof Upload */}
        {step === 3 && (
          <form
            onSubmit={handleSubmitRegistration}
            className="mt-6 grid gap-6 lg:grid-cols-12"
          >
            {/* Left: Official College QR Display */}
            <div className="rounded-xl border border-white/10 bg-[#1A1716] p-6 lg:col-span-5">
              <h2 className="font-display text-2xl font-bold text-white uppercase">
                Scan Official College QR
              </h2>
              <p className="mt-1 text-xs text-neutral-400">
                Pay exact amount{' '}
                <strong className="font-mono text-[#E5C736] tabular-nums">
                  Rs. {feeSummary.totalFee}
                </strong>{' '}
                using any UPI app (GPay, PhonePe, Paytm, BHIM).
              </p>

              <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white p-5 text-slate-900">
                {showStaticQr ? (
                  <>
                    <a
                      href={event.qrImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open the QR at full size"
                      className="block w-full"
                    >
                      <img
                        src={event.qrImageUrl}
                        alt={`Official UPI QR for ${event.title.replace(/2k26/gi, '2026')}`}
                        referrerPolicy="no-referrer"
                        onError={() => setFailedQrUrl(event.qrImageUrl)}
                        className="mx-auto h-auto max-h-[26rem] w-full max-w-[18rem] object-contain"
                      />
                    </a>
                    {event.upiVpa && (
                      <span className="mt-2 font-mono text-xs break-all text-slate-600">
                        VPA: {event.upiVpa}
                      </span>
                    )}
                    <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-700">
                      <a href={event.qrImageUrl} target="_blank" rel="noreferrer" className="underline hover:text-slate-900">
                        View full size
                      </a>
                      <a href={event.qrImageUrl} download={`${event.slug}-upi-qr`} className="underline hover:text-slate-900">
                        Save QR image
                      </a>
                    </div>
                    <p className="mt-2 max-w-xs text-center text-[11px] text-slate-500">
                      Paying from this phone? Save the QR, then choose “Scan from gallery” in your UPI app.
                    </p>
                  </>
                ) : upiIntentUri ? (
                  <>
                    <QRCodeSVG value={upiIntentUri} size={200} />
                    <span className="mt-2 font-mono text-xs text-slate-600">
                      VPA: {event.upiVpa}
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <QrCode className="h-16 w-16 text-slate-400" />
                    {qrLoadFailed ? (
                      <>
                        <p className="mt-3 text-xs font-semibold text-slate-800">
                          Official College QR Could Not Be Loaded
                        </p>
                        <p className="mt-1 max-w-xs text-[11px] text-slate-500">
                          Refresh the page to try again, or contact the tournament coordinators
                          for the official payment details before paying.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-3 text-xs font-semibold text-slate-800">
                          Official College QR Pending Upload
                        </p>
                        <p className="mt-1 max-w-xs text-[11px] text-slate-500">
                          Tournament administrators can upload the official static UPI QR or set the
                          college UPI VPA inside Admin → Events &amp; QR Setup.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {upiIntentUri && (
                <a
                  href={upiIntentUri}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-[#E5C736]/40 bg-[#E5C736]/10 px-4 py-2.5 text-xs font-semibold text-[#E5C736] hover:bg-[#E5C736]/20"
                >
                  Open in UPI App (Rs. {feeSummary.totalFee})
                </a>
              )}

              <div className="mt-5 space-y-1.5 border-t border-white/10 pt-4 text-xs text-neutral-300">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Base Team Fee</span>
                  <span className="font-mono tabular-nums">Rs. {feeSummary.baseFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">
                    Team lunch · {feeSummary.lunchCount} meals
                  </span>
                  <span className="font-mono tabular-nums">Rs. {feeSummary.lunchTotal}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-white">
                  <span>Total Exact Payment</span>
                  <span className="font-mono text-[#E5C736] tabular-nums">
                    Rs. {feeSummary.totalFee}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Proof Submission */}
            <div className="rounded-xl border border-white/10 bg-[#1A1716] p-6 lg:col-span-7">
              <h2 className="font-display text-2xl font-bold text-white uppercase">
                Upload Payment Screenshot &amp; UTR
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                Note: Uploading a screenshot submits your team as{' '}
                <strong className="text-neutral-200">Pending Verification</strong>. Your slot is
                confirmed once an administrator matches your 12-digit UTR against the college bank
                statement.
              </p>

              <div className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="utr-input" className="block text-xs font-medium text-neutral-300">
                      12-Digit UPI UTR / Ref Number *
                    </label>
                    <input
                      id="utr-input"
                      type="text"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="e.g. 432198765432"
                      className="mt-1.5 w-full rounded-md border border-white/15 bg-[#110D0C] px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-neutral-500 focus:border-[#D41B14] focus:outline-none"
                    />
                    <p className="mt-1 text-[11px] text-neutral-400">
                      {utrNumber.trim()
                        ? isStrict12DigitUtr(utrNumber)
                          ? 'Valid 12-digit NPCI UTR format detected.'
                          : 'Must be your exact UPI Reference / UTR ID.'
                        : 'Found in GPay/PhonePe/Paytm transaction details.'}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="upi-app" className="block text-xs font-medium text-neutral-300">
                      UPI Application Used
                    </label>
                    <select
                      id="upi-app"
                      value={upiApp}
                      onChange={(e) => setUpiApp(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-white/15 bg-[#110D0C] px-3.5 py-2.5 text-sm text-white focus:border-[#D41B14] focus:outline-none"
                    >
                      <option value="Google Pay">Google Pay</option>
                      <option value="PhonePe">PhonePe</option>
                      <option value="Paytm">Paytm</option>
                      <option value="BHIM UPI">BHIM UPI</option>
                      <option value="Bank App / Other">Bank App / Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="screenshot-upload"
                    className="block text-xs font-medium text-neutral-300"
                  >
                    Payment Success Screenshot (JPEG, PNG, WebP · Auto-compressed) *
                  </label>
                  <label
                    htmlFor="screenshot-upload"
                    className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/25 bg-[#110D0C] p-6 text-center transition-colors hover:border-[#D41B14]"
                  >
                    {screenshotPreview && screenshotFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="rounded bg-white p-2">
                          <img
                            src={screenshotPreview}
                            alt="Uploaded payment proof preview"
                            className="max-h-44 rounded object-contain"
                          />
                        </div>
                        <span className="font-mono text-[11px] text-emerald-400">
                          Attached: {screenshotFile.name} ({Math.round(screenshotFile.size / 1024)} KB) — Click to replace
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-7 w-7 text-neutral-400" />
                        <span className="mt-2 text-xs font-medium text-neutral-200">
                          Click to select payment screenshot
                        </span>
                        <span className="mt-1 text-[11px] text-neutral-500">
                          Ensure Amount (Rs. {feeSummary.totalFee}), Date/Time, and 12-digit UTR are
                          clearly visible
                        </span>
                      </>
                    )}
                    <input
                      id="screenshot-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleFileSelect(e.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                </div>

                {submitError && (
                  <div
                    role="alert"
                    className="rounded-md border border-red-500/40 bg-red-950/50 px-4 py-3 text-xs text-red-200"
                  >
                    {submitError}
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-5">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-md border border-white/15 px-5 py-2.5 text-xs font-medium text-neutral-200 hover:bg-white/5"
                  >
                    Back to Roster
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-md bg-[#D41B14] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#B41510] disabled:opacity-50"
                  >
                    {submitting ? 'Submitting Proof...' : 'Submit Registration'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Step 4: Instant Confirmation Receipt */}
        {step === 4 && receipt && (
          <section className="mx-auto mt-8 max-w-2xl rounded-xl border border-white/10 bg-[#1A1716] p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-4 font-display text-3xl font-bold text-white uppercase">
              Registration Submitted
            </h1>
            <p className="mt-2 text-xs text-neutral-300">{receipt.emailNote}</p>

            <div className="mt-6 rounded-lg border border-white/10 bg-[#110D0C] p-5 text-left text-xs">
              <div className="flex justify-between border-b border-white/10 pb-2.5">
                <span className="text-neutral-400">Unique Team Registration ID</span>
                <span className="font-mono text-base font-bold text-[#E5C736]">
                  {receipt.teamCode}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/10 py-2.5">
                <span className="text-neutral-400">Current Status</span>
                <span className="font-semibold text-amber-400 uppercase">{receipt.status}</span>
              </div>
              <div className="flex justify-between pt-2.5">
                <span className="text-neutral-400">Submitted Fee</span>
                <span className="font-mono font-semibold text-white tabular-nums">
                  Rs. {receipt.totalFee}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  onNavigate({ page: 'track', prefillCode: receipt.teamCode })
                }
                className="rounded-md bg-[#D41B14] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#B41510]"
              >
                Track Verification Status
              </button>
              <button
                type="button"
                onClick={() => onNavigate({ page: 'home' })}
                className="rounded-md border border-white/15 px-5 py-2.5 text-xs font-medium text-neutral-200 hover:bg-white/5"
              >
                Return to Events
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
