import { ArrowLeft, ArrowRight, Check, CheckCircle2, Plus, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PaymentQrPanel } from './PaymentQrPanel';
import type { CampusEvent } from '../lib/defaultEvents';
import { compressScreenshot } from '../lib/imageCompression';
import { getEventBannerUrl } from '../lib/eventArtwork';
import { DigitHint } from './DigitHint';
import { cleanPhoneInput, cleanUtrInput, digitBorderClass, phoneStatus, utrStatus } from '../lib/numericInput';
import { clearDraft, loadDraft, rememberTeamCode, saveDraft } from '../lib/registrationDraft';
import {
  buildUpiIntentUri,
  calculateRegistrationFee,
  isStrict12DigitUtr,
  MAX_COLLEGE_NAME_LENGTH,
  validateSquadSubmission,
  type PlayerInput,
  type SlotRole,
} from '../lib/tournamentRules';
import type { AppRoute } from './Navbar';
import { RegistrationPlayerCard } from './RegistrationPlayerCard';
import { CollegePicker } from './CollegePicker';
import './registration.css';

interface RegisterViewProps {
  events: CampusEvent[];
  event: CampusEvent;
  onNavigate: (next: AppRoute) => void;
  onRefreshEvents: () => void;
}

const DEFAULT_ROSTER: PlayerInput[] = [
  {
    slotRole: 'IGL',
    fullName: '',
    inGameName: '',
    characterId: '',
    academicLevel: '',
    wantsLunch: false,
    dietType: 'NONE',
  },
  {
    slotRole: 'P2',
    fullName: '',
    inGameName: '',
    characterId: '',
    academicLevel: '',
    wantsLunch: false,
    dietType: 'NONE',
  },
  {
    slotRole: 'P3',
    fullName: '',
    inGameName: '',
    characterId: '',
    academicLevel: '',
    wantsLunch: false,
    dietType: 'NONE',
  },
  {
    slotRole: 'P4',
    fullName: '',
    inGameName: '',
    characterId: '',
    academicLevel: '',
    wantsLunch: false,
    dietType: 'NONE',
  },
  {
    slotRole: 'SUB',
    fullName: '',
    inGameName: '',
    characterId: '',
    academicLevel: '',
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
  IGL: 'Player 1 · Team leader',
  P2: 'Player 2',
  P3: 'Player 3',
  P4: 'Player 4',
  SUB: 'Player 5 · Optional substitute',
};

const REGISTRATION_STEPS = ['Squad details', 'Player roster', 'Payment', 'Receipt'] as const;

export function RegisterView({
  events,
  event,
  onNavigate,
  onRefreshEvents,
}: RegisterViewProps) {
  // An unfinished registration from this browser (refresh, closed tab, lost connection).
  const [savedDraft] = useState(() => loadDraft());
  const sameTournamentDraft = savedDraft?.eventSlug === event.slug ? savedDraft : null;
  const [draftRestored, setDraftRestored] = useState(Boolean(savedDraft));
  const [teamName, setTeamName] = useState(savedDraft?.teamName ?? '');
  const [iglPhone, setIglPhone] = useState(savedDraft?.iglPhone ?? '');
  const [iglEmail, setIglEmail] = useState(savedDraft?.iglEmail ?? '');
  const [hasSubstitute, setHasSubstitute] = useState(savedDraft?.hasSubstitute ?? false);
  const [members, setMembers] = useState<PlayerInput[]>(() =>
    savedDraft
      ? DEFAULT_ROSTER.map((blank) => {
          const saved = savedDraft.members.find((m) => m.slotRole === blank.slotRole);
          return {
            ...blank,
            ...saved,
            academicLevel: typeof saved?.academicLevel === 'string' ? saved.academicLevel : '',
            otherAcademicLevel: typeof saved?.otherAcademicLevel === 'string' ? saved.otherAcademicLevel : '',
            collegeOverride: typeof saved?.collegeOverride === 'string'
              ? saved.collegeOverride
              : blank.slotRole === 'IGL' ? savedDraft.collegeName : '',
          };
        })
      : DEFAULT_ROSTER
  );
  const leader = members.find((member) => member.slotRole === 'IGL');
  const leaderName = leader?.fullName ?? '';
  const collegeName = leader?.collegeOverride ?? '';
  const [step, setStep] = useState<1 | 2 | 3 | 4>(() => {
    if (sameTournamentDraft?.step !== 3) return sameTournamentDraft?.step ?? 1;
    const roster = validateSquadSubmission({ ...sameTournamentDraft, collegeName, members });
    return roster.valid ? 3 : 2;
  });
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const [eligibilityConfirmed, setEligibilityConfirmed] = useState(savedDraft?.eligibilityConfirmed ?? false);
  const [fairPlayConfirmed, setFairPlayConfirmed] = useState(savedDraft?.fairPlayConfirmed ?? false);
  const [activeSkillConfirmed, setActiveSkillConfirmed] = useState(sameTournamentDraft?.activeSkillConfirmed ?? false);

  // Payment step state
  const [utrNumber, setUtrNumber] = useState(sameTournamentDraft?.utrNumber ?? '');
  const [upiApp, setUpiApp] = useState(sameTournamentDraft?.upiApp ?? 'Google Pay');
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

  const [formEventSlug, setFormEventSlug] = useState(event.slug);
  if (formEventSlug !== event.slug) {
    // Keep the roster, but reset the event-specific state before rendering the new entry form.
    setFormEventSlug(event.slug);
    setStep(1);
    setActiveSkillConfirmed(false);
    setUtrNumber('');
    setUpiApp('Google Pay');
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setDraftRestored(false);
    setReceipt(null);
    setFieldErrors({});
    setSubmitError('');
  }

  const activeMembers = useMemo(
    () => members.filter((m) => (hasSubstitute ? true : m.slotRole !== 'SUB')),
    [members, hasSubstitute]
  );
  const requiredMembers = members.filter((member) => member.slotRole !== 'SUB');
  const substitute = members.find((member) => member.slotRole === 'SUB');
  const rosterErrors = step === 2 ? validateSquadSubmission({
    eventSlug: event.slug,
    teamName, collegeName, iglPhone, iglEmail,
    hasSubstitute: false,
    members: requiredMembers,
    eligibilityConfirmed: true,
    fairPlayConfirmed: true,
    activeSkillConfirmed: true,
  }).errors : {};
  const rosterErrorKeys = Object.keys(rosterErrors);
  const readyRoles = new Set(requiredMembers.filter(({ slotRole }) =>
    !rosterErrors.members && !rosterErrorKeys.some((key) => key === `member_${slotRole}` || key.startsWith(`member_${slotRole}_`))
  ).map(({ slotRole }) => slotRole));
  const canAddSubstitute = readyRoles.size === requiredMembers.length;

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

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    stepHeading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step]);

  // Save the current step before a quick reload. Screenshots are files and cannot be kept.
  useEffect(() => {
    if (step === 4) return;
    const hasContent = [teamName, collegeName, iglPhone, iglEmail, utrNumber].some((v) => v.trim()) ||
      members.some((m) => m.fullName.trim() || m.inGameName.trim() || m.characterId.trim() ||
        m.collegeOverride?.trim() || m.otherAcademicLevel?.trim());
    if (!hasContent) return;
    saveDraft({
      eventSlug: event.slug, step, teamName, collegeName, iglPhone, iglEmail, hasSubstitute,
      members, eligibilityConfirmed, fairPlayConfirmed, activeSkillConfirmed, utrNumber, upiApp,
    });
  }, [event.slug, step, teamName, collegeName, iglPhone, iglEmail, hasSubstitute, members,
    eligibilityConfirmed, fairPlayConfirmed, activeSkillConfirmed, utrNumber, upiApp]);

  useEffect(() => {
    if (screenshotPreview) return () => URL.revokeObjectURL(screenshotPreview);
  }, [screenshotPreview]);

  function startOver() {
    clearDraft();
    setDraftRestored(false);
    setStep(1);
    setTeamName(''); setIglPhone(''); setIglEmail('');
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
    setFieldErrors((errors) => {
      const updatedFields = Object.keys(patch).map((field) => `member_${role}_${field}`);
      if ('wantsLunch' in patch) updatedFields.push(`member_${role}_dietType`);
      if (role === 'IGL' && 'collegeOverride' in patch) updatedFields.push('collegeName');
      if (!updatedFields.some((field) => field in errors)) return errors;
      return Object.fromEntries(Object.entries(errors).filter(([field]) => !updatedFields.includes(field)));
    });
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
        fullName: m.slotRole === 'IGL' ? leaderName : 'ok',
        inGameName: 'ok',
        characterId: m.slotRole,
        academicLevel: 'UG',
      })),
      eligibilityConfirmed: true,
      fairPlayConfirmed: true,
      activeSkillConfirmed: true,
    });

    const step1Errors: Record<string, string> = {};
    // The server rejects closed events at final submission; say so before the roster is filled in.
    if (!event.isOpen) step1Errors.event = 'Registrations for this event are currently closed.';
    for (const key of ['teamName', 'collegeName', 'member_IGL_fullName', 'iglPhone', 'iglEmail']) {
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
    <main className="registration-page min-h-screen text-neutral-100">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 sm:pt-7">
        <div className="mb-3">
          <button
            type="button"
            onClick={() => onNavigate({ page: 'home' })}
            className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </button>

        </div>
        <header className="registration-cover">
          <img src={getEventBannerUrl(event.slug, event.gameTitle)} alt="" />
          <div className="registration-cover-copy">
            <p>{eventLabel(event)}</p>
            <h1>Register your squad</h1>
          </div>
        </header>

        <ol aria-label="Registration steps" className="registration-steps">
            {REGISTRATION_STEPS.map((label, index) => {
              const number = index + 1;
              return (
                <li
                  key={label}
                  aria-current={step === number ? 'step' : undefined}
                  data-complete={step > number}
                >
                  <span className="registration-step-number">{step > number ? <Check className="size-4" aria-label="Complete" /> : number}</span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>

        {draftRestored && step < 4 && (
          <div role="status" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5C736]/40 bg-[#E5C736]/10 px-4 py-3 text-xs text-[#F3E7A6]">
            <span>
              Your registration draft was restored.
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

        <div className={step < 4 ? 'registration-layout' : ''}>
          {step < 4 && (
            <aside className="registration-fees" aria-label="Registration fee summary">
              <h2 className="font-display text-xl font-bold">Entry fee</h2>
              <dl>
                <div><dt>Squad registration</dt><dd>₹{feeSummary.baseFee}</dd></div>
                <div><dt>Optional lunch</dt><dd>₹{feeSummary.lunchTotal}</dd></div>
                {feeSummary.lunchCount > 0 && (
                  <div className="registration-fee-meals"><dt>Meals selected</dt><dd>{feeSummary.vegCount} veg · {feeSummary.nonVegCount} non-veg</dd></div>
                )}
                <div className="registration-fee-total" aria-live="polite"><dt>Total payable</dt><dd>₹{feeSummary.totalFee}</dd></div>
              </dl>
            </aside>
          )}
          <div className="min-w-0">

            {/* Step 1: Squad & IGL Contact */}
            {step === 1 && (
              <section className="registration-panel">
                <div className="registration-step-header">
                  <h2 ref={stepHeading} tabIndex={-1}>Squad details</h2>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="reg-event" className="block text-xs font-medium text-neutral-300">
                      Tournament / Event Title
                    </label>
                    <select
                      id="reg-event"
                      value={event.slug}
                      onChange={(e) => onNavigate({ page: 'register', slug: e.target.value })}
                      className="mt-1.5 w-full rounded-md border border-white/15 bg-[#110D0C] px-3.5 py-2.5 text-sm text-white focus:border-[#D41B14] focus:outline-none"
                    >
                      {events.map((item) => (
                        <option key={item.id} value={item.slug}>
                          {eventLabel(item)}
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
                      Team leader’s college / institution *
                    </label>
                    <CollegePicker
                      id="reg-college"
                      value={collegeName}
                      onChange={(value) => updateMember('IGL', { collegeOverride: value })}
                      maxLength={MAX_COLLEGE_NAME_LENGTH}
                      invalid={Boolean(fieldErrors.collegeName)}
                      errorId="reg-college-error"
                      inputClassName="mt-1.5 w-full rounded-md border border-white/15 bg-[#110D0C] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-[#D41B14] focus:outline-none"
                    />
                    {fieldErrors.collegeName && (
                      <p id="reg-college-error" className="mt-1 text-xs text-red-400">{fieldErrors.collegeName}</p>
                    )}
                  </div>
                </div>

                <fieldset className="registration-leader min-w-0">
                  <legend className="sr-only">Team leader details</legend>
                  <h3 className="font-display text-xl font-bold text-[#F5D985]">Team leader (IGL)</h3>
                  <p className="mt-1 text-sm text-neutral-400">We’ll email confirmation and the slot pass to the team leader.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor="reg-leader-name" className="registration-label text-[#F5D985]">Team leader’s full name *</label>
                      <input
                        id="reg-leader-name"
                        type="text"
                        autoComplete="name"
                        value={leaderName}
                        onChange={(e) => updateMember('IGL', { fullName: e.target.value })}
                        aria-required="true"
                        aria-invalid={Boolean(fieldErrors.member_IGL_fullName)}
                        aria-describedby={fieldErrors.member_IGL_fullName ? 'reg-leader-name-error' : undefined}
                        className="registration-input registration-leader-input"
                      />
                      {fieldErrors.member_IGL_fullName && <p id="reg-leader-name-error" className="registration-error">{fieldErrors.member_IGL_fullName}</p>}
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
                </fieldset>

                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    onClick={goToStep2}
                    className="inline-flex items-center gap-2 rounded-md bg-[#D41B14] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#B41510]"
                  >
                    Continue to roster
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="registration-panel">
                <div className="registration-step-header">
                  <div>
                    <h2 ref={stepHeading} tabIndex={-1}>Player roster</h2>
                    <p>Enter each player’s in-game details, college and academic level. Any meals selected add ₹{event.lunchFee} once per squad.</p>
                  </div>
                  <span className="registration-progress" role="status">{readyRoles.size} of 4 ready</span>
                </div>

                <div className="mt-6 space-y-4">
                  {requiredMembers.map((member) => (
                    <RegistrationPlayerCard
                      key={member.slotRole}
                      member={member}
                      label={ROLE_LABELS[member.slotRole]}
                      complete={readyRoles.has(member.slotRole)}
                      errors={fieldErrors}
                      leaderCollege={collegeName}
                      onChange={(patch) => updateMember(member.slotRole, patch)}
                    />
                  ))}

                  <div className="registration-substitute">
                    <div>
                      <h3 className="font-display text-xl font-bold">Optional substitute</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        {canAddSubstitute || hasSubstitute
                          ? 'You can register one backup player.'
                          : 'Complete the four required player profiles to add a substitute.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canAddSubstitute && !hasSubstitute}
                      onClick={() => {
                        setHasSubstitute(!hasSubstitute);
                        setFieldErrors((errors) => Object.fromEntries(
                          Object.entries(errors).filter(([key]) => !key.startsWith('member_SUB'))
                        ));
                      }}
                      className="registration-secondary"
                    >
                      {!hasSubstitute && <Plus className="size-4" aria-hidden="true" />}
                      {hasSubstitute ? 'Remove Player 5' : 'Add Player 5'}
                    </button>
                  </div>

                  {hasSubstitute && substitute && (
                    <RegistrationPlayerCard
                      member={substitute}
                      label={ROLE_LABELS.SUB}
                      complete={false}
                      errors={fieldErrors}
                      leaderCollege={collegeName}
                      onChange={(patch) => updateMember('SUB', patch)}
                    />
                  )}
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

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
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
                    Continue to payment
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </section>
            )}

            {/* Step 3: Official College UPI QR + Proof Upload */}
            {step === 3 && (
              <form
                onSubmit={handleSubmitRegistration}
                className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
              >
                {/* Left: Official College QR Display */}
                <PaymentQrPanel
                  event={event}
                  feeSummary={feeSummary}
                  upiIntentUri={upiIntentUri}
                />

                {/* Right: Proof Submission */}
                <div className="registration-panel">
                  <h2 ref={stepHeading} tabIndex={-1} className="font-display text-2xl font-bold text-white">
                    Upload payment proof
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                    Note: Uploading a screenshot submits your team as{' '}
                    <strong className="text-neutral-200">Pending Verification</strong>. Your slot is
                    confirmed once an administrator matches your 12-digit UTR against the college bank
                    statement.
                  </p>

                  <div className="mt-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
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
                            <span className="max-w-full font-mono text-[11px] wrap-anywhere text-emerald-400">
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

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
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
              <section className="mx-auto mt-8 max-w-2xl rounded-xl border border-white/10 bg-[#1A1716] p-4 text-center sm:p-8">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <h2 ref={stepHeading} tabIndex={-1} className="mt-4 font-display text-3xl font-bold text-white">
                  Registration Submitted
                </h2>
                <p className="mt-2 text-xs text-neutral-300">{receipt.emailNote}</p>
                <p className="mt-2 text-xs text-amber-200">
                  Save your Team Registration ID below. Use it or your team leader mobile number to track
                  your status or re-upload proof.
                </p>

                <div className="mt-6 rounded-lg border border-white/10 bg-[#110D0C] p-5 text-left text-xs">
                  <div className="flex flex-wrap justify-between gap-2 border-b border-white/10 pb-2.5">
                    <span className="text-neutral-400">Unique Team Registration ID</span>
                    <span className="font-mono text-base font-bold text-[#E5C736]">
                      {receipt.teamCode}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 border-b border-white/10 py-2.5">
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
        </div>
      </div>
    </main>
  );
}
