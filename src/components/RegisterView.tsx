import { ArrowLeft, ArrowRight, CheckCircle2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PaymentQrPanel } from './PaymentQrPanel';
import type { CampusEvent } from '../lib/defaultEvents';
import { compressScreenshot } from '../lib/imageCompression';
import { DigitHint } from './DigitHint';
import { cleanPhoneInput, cleanUtrInput, digitBorderClass, phoneStatus, utrStatus } from '../lib/numericInput';
import { clearDraft, loadDraft, rememberTeamCode, saveDraft } from '../lib/registrationDraft';
import {
  buildUpiIntentUri,
  calculateRegistrationFee,
  isStrict12DigitUtr,
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

/** "Kurukshetra — Free Fire" already names its game; avoid "Free Fire — Free Fire". */
function eventLabel(item: CampusEvent): string {
  const title = item.title.replace(/2k26/gi, '2026');
  return title.toLowerCase().includes(item.gameTitle.toLowerCase()) ? title : `${title} — ${item.gameTitle}`;
}

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

  // An unfinished registration from this browser (refresh, closed tab, lost connection).
  const [savedDraft] = useState(() => loadDraft());
  const [draftRestored, setDraftRestored] = useState(Boolean(savedDraft));
  const [step, setStep] = useState<1 | 2 | 3 | 4>(savedDraft?.step ?? 1);
  const [teamName, setTeamName] = useState(savedDraft?.teamName ?? '');
  const [collegeName, setCollegeName] = useState(savedDraft?.collegeName ?? '');
  const [iglPhone, setIglPhone] = useState(savedDraft?.iglPhone ?? '');
  const [iglEmail, setIglEmail] = useState(savedDraft?.iglEmail ?? '');
  const [hasSubstitute, setHasSubstitute] = useState(savedDraft?.hasSubstitute ?? false);
  const [members, setMembers] = useState<PlayerInput[]>(() =>
    savedDraft
      ? DEFAULT_ROSTER.map((blank) => savedDraft.members.find((m) => m.slotRole === blank.slotRole) ?? blank)
      : DEFAULT_ROSTER
  );
  const [eligibilityConfirmed, setEligibilityConfirmed] = useState(savedDraft?.eligibilityConfirmed ?? false);
  const [fairPlayConfirmed, setFairPlayConfirmed] = useState(savedDraft?.fairPlayConfirmed ?? false);
  const [activeSkillConfirmed, setActiveSkillConfirmed] = useState(savedDraft?.activeSkillConfirmed ?? false);

  // Payment step state
  const [utrNumber, setUtrNumber] = useState(savedDraft?.utrNumber ?? '');
  const [upiApp, setUpiApp] = useState(savedDraft?.upiApp ?? 'Google Pay');
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

  const paymentReady = Boolean(event?.qrImageUrl || event?.upiVpa);
  const phoneState = phoneStatus(iglPhone);
  const utrState = utrStatus(utrNumber);

  // Save progress shortly after every change. Screenshots are files and cannot be kept.
  useEffect(() => {
    if (step === 4 || !event) return;
    const hasContent = [teamName, collegeName, iglPhone, iglEmail, utrNumber].some((v) => v.trim()) ||
      members.some((m) => m.fullName.trim() || m.inGameName.trim() || m.characterId.trim());
    if (!hasContent) return;
    const timer = window.setTimeout(() => {
      saveDraft({
        eventSlug: event.slug, step, teamName, collegeName, iglPhone, iglEmail, hasSubstitute,
        members, eligibilityConfirmed, fairPlayConfirmed, activeSkillConfirmed, utrNumber, upiApp,
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [event, step, teamName, collegeName, iglPhone, iglEmail, hasSubstitute, members,
    eligibilityConfirmed, fairPlayConfirmed, activeSkillConfirmed, utrNumber, upiApp]);

  function startOver() {
    clearDraft();
    setDraftRestored(false);
    setStep(1);
    setTeamName(''); setCollegeName(''); setIglPhone(''); setIglEmail('');
    setHasSubstitute(false); setMembers(DEFAULT_ROSTER);
    setEligibilityConfirmed(false); setFairPlayConfirmed(false); setActiveSkillConfirmed(false);
    setUtrNumber(''); setUpiApp('Google Pay');
    setScreenshotFile(null); setScreenshotPreview(null);
    setFieldErrors({}); setSubmitError('');
  }

  // While waiting on the payment step for details to be published, re-check quietly so the
  // QR appears without a page refresh (which would wipe the filled-in form).
  useEffect(() => {
    if (step !== 3 || paymentReady) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') onRefreshEvents();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [step, paymentReady, onRefreshEvents]);

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

    if (!isStrict12DigitUtr(utrNumber)) {
      setSubmitError('Enter the 12-digit UPI UTR / Reference number from your payment receipt (digits only).');
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
      clearDraft();
      rememberTeamCode(json.registration.teamCode);
      setDraftRestored(false);
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
            className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </button>

          <ol aria-label="Registration steps" className="grid w-full grid-cols-4 gap-1 text-[11px] text-neutral-400 sm:flex sm:w-auto sm:items-center sm:gap-3 sm:text-xs">
            {(['Squad Info', 'Roster & Meals', 'UPI QR & Proof', 'Receipt'] as const).map((label, index) => {
              const n = (index + 1) as 1 | 2 | 3 | 4;
              const active = step === n;
              return (
                <li
                  key={label}
                  aria-current={active ? 'step' : undefined}
                  className={`border-t-2 pt-1.5 sm:border-t-0 sm:pt-0 ${
                    active
                      ? `font-semibold ${n === 4 ? 'border-[#16A34A] text-[#16A34A]' : 'border-[#E5C736] text-[#E5C736]'}`
                      : step > n
                        ? 'border-white/40 text-neutral-300'
                        : 'border-white/10'
                  }`}
                >
                  {n}. {label}
                </li>
              );
            })}
          </ol>
        </div>

        {draftRestored && step < 4 && (
          <div role="status" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5C736]/40 bg-[#E5C736]/10 px-4 py-3 text-xs text-[#F3E7A6]">
            <span>
              Welcome back: your unfinished registration was restored.
              {step === 3 ? ' Please attach your payment screenshot again.' : ''}
            </span>
            <span className="flex gap-3">
              <button type="button" onClick={() => setDraftRestored(false)} className="font-semibold underline">
                Continue
              </button>
              <button type="button" onClick={startOver} className="font-semibold underline">
                Start over
              </button>
            </span>
          </div>
        )}

        {/* Live Fee Banner */}
        {step < 4 && (
          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-white/10 bg-[#1A1716] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs text-neutral-400">Registering For</div>
              <div className="font-display text-xl font-bold text-white uppercase">
                {eventLabel(event)}
              </div>
            </div>
            <div className="flex items-end justify-between gap-6 border-t border-white/10 pt-3 sm:border-t-0 sm:pt-0 sm:text-right">
              <div>
                <div className="text-xs text-neutral-400">Meal Add-On</div>
                <div className="font-mono text-sm font-medium whitespace-nowrap text-neutral-200 tabular-nums">
                  Rs. {feeSummary.lunchTotal}
                  <span className="ml-1 text-xs text-neutral-400">
                    ({feeSummary.vegCount}V / {feeSummary.nonVegCount}NV)
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-400">Total Payable</div>
                <div className="font-mono text-2xl font-bold whitespace-nowrap text-[#E5C736] tabular-nums">
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
                      {eventLabel(item)} ({item.registeredCount || 0}/{item.maxTeams}{' '}
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
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={iglPhone}
                  onChange={(e) => setIglPhone(cleanPhoneInput(e.target.value))}
                  aria-describedby="reg-phone-hint"
                  aria-invalid={phoneState.tone === 'error'}
                  placeholder="9876543210"
                  className={`mt-1.5 w-full rounded-md border bg-[#110D0C] px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-neutral-500 focus:outline-none ${digitBorderClass(phoneState.tone)}`}
                />
                <DigitHint id="reg-phone-hint" status={phoneState} />
                {fieldErrors.iglPhone && phoneState.tone === 'idle' && (
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
            <PaymentQrPanel
              event={event}
              feeSummary={feeSummary}
              upiIntentUri={upiIntentUri}
              className="lg:col-span-5"
            />

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
                      inputMode="numeric"
                      autoComplete="off"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(cleanUtrInput(e.target.value))}
                      aria-describedby="utr-hint"
                      aria-invalid={utrState.tone === 'error'}
                      placeholder="e.g. 432198765432"
                      className={`mt-1.5 w-full rounded-md border bg-[#110D0C] px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-neutral-500 focus:outline-none ${digitBorderClass(utrState.tone)}`}
                    />
                    <DigitHint id="utr-hint" status={utrState} />
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

                {!paymentReady && (
                  <div
                    role="status"
                    className="rounded-md border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-xs text-amber-100"
                  >
                    Payment details for this event are not published yet, so registrations can't be
                    submitted right now. Your details stay on this page; check back shortly.
                  </div>
                )}

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
                    disabled={submitting || !paymentReady}
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
            <p className="mt-2 text-xs text-amber-200">
              Save your Team Registration ID below. Use it or your team leader mobile number to track
              your status or re-upload proof.
            </p>

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
