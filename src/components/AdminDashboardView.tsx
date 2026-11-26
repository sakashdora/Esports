import {
  CheckCircle2,
  Download,
  LogOut,
  Mail,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Proof images are private, so they are fetched with the admin token and kept as local
// object URLs. Selecting a team again (or one that was prefetched) shows instantly.
const proofImageCache = new Map<string, string>();
const proofImageLoading = new Map<string, Promise<string>>();

function loadProofImage(url: string, token: string, signal?: AbortSignal): Promise<string> {
  const cached = proofImageCache.get(url);
  if (cached) return Promise.resolve(cached);
  let pending = proofImageLoading.get(url);
  if (!pending) {
    pending = fetch(url, { headers: url.startsWith('/api/') ? { Authorization: 'Bearer ' + token } : {} })
      .then((response) => {
        if (!response.ok) throw new Error('Proof unavailable');
        return response.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        if (proofImageCache.size > 40) {
          const oldest = proofImageCache.keys().next().value;
          if (oldest) {
            URL.revokeObjectURL(proofImageCache.get(oldest)!);
            proofImageCache.delete(oldest);
          }
        }
        proofImageCache.set(url, objectUrl);
        return objectUrl;
      })
      .finally(() => proofImageLoading.delete(url));
    proofImageLoading.set(url, pending);
  }
  if (!signal) return pending;
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    pending!.then(resolve, reject);
  });
}

function clearProofImageCache() {
  for (const objectUrl of proofImageCache.values()) URL.revokeObjectURL(objectUrl);
  proofImageCache.clear();
}

function ProtectedProofImage({ url, token, zoom }: { url: string; token: string; zoom: boolean }) {
  const [source, setSource] = useState(() => proofImageCache.get(url) || '');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    const cached = proofImageCache.get(url);
    if (cached) {
      setSource(cached);
      return;
    }
    setSource('');
    loadProofImage(url, token, controller.signal)
      .then((objectUrl) => { if (!controller.signal.aborted) setSource(objectUrl); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [url, token]);
  if (!source) {
    return failed ? (
      <p role="status" className="py-6 text-xs text-red-700">Unable to load the proof. Select the team again to retry.</p>
    ) : (
      <div role="status" aria-label="Loading payment proof" className="mx-auto h-40 w-full max-w-xs animate-pulse rounded bg-slate-200" />
    );
  }
  return <img src={source} alt="Uploaded UPI Payment Proof" decoding="async" className={zoom ? 'mx-auto max-h-[600px] w-full rounded object-contain' : 'mx-auto max-h-60 rounded object-contain'} />;
}

import type { CampusEvent } from '../lib/defaultEvents';
import { adminRequest } from '../lib/adminRequest';
import { readAdminLoginResponse } from '../lib/adminLogin';
import { filterAdminRegistrations } from '../lib/adminFilters';
import { buildUpiIntentUri, calculateRegistrationFee, escapeCsvCell } from '../lib/tournamentRules';
import { compressScreenshot } from '../lib/imageCompression';
import { PaymentQrPanel } from './PaymentQrPanel';
import { VOLUNTEER_ID_KEY, VOLUNTEER_TOKEN_KEY } from '../lib/checkIn';
import { CheckInDesk } from './CheckInDesk';
import { VolunteerAccounts } from './VolunteerAccounts';
import type { AppRoute } from './Navbar';

interface AdminBundle {
  registration: {
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
    status: string;
    slotNumber: string | null;
    groupName: string | null;
    rejectionReason: string | null;
    lastEmailStatus: string;
    lastEmailAt: string | null;
    createdAt: string;
  };
  event: CampusEvent;
  members: Array<{
    id: string;
    slotRole: string;
    fullName: string;
    inGameName: string;
    characterId: string;
    academicLevel: string;
    collegeOverride?: string;
    wantsLunch: boolean;
    dietType: string;
  }>;
  proofs: Array<{
    id: string;
    utrNumber: string;
    upiApp: string;
    paidAmount: number;
    reviewStatus: string;
    rejectionReason: string | null;
    createdAt: string;
  }>;
  latestProofUrl: string | null;
}

interface AdminDashboardViewProps {
  onEventsUpdated: () => void;
  onNavigate: (route: AppRoute) => void;
}

const STORAGE_TOKEN_KEY = 'samt_admin_token';
const STORAGE_EMAIL_KEY = 'samt_admin_email';

export function AdminDashboardView({ onEventsUpdated, onNavigate }: AdminDashboardViewProps) {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(STORAGE_TOKEN_KEY) || '');
  const [adminEmail, setAdminEmail] = useState<string>(
    () => sessionStorage.getItem(STORAGE_EMAIL_KEY) || ''
  );
  const activeToken = useRef(token);
  const overviewSequence = useRef(0);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [uploadingQrFor, setUploadingQrFor] = useState<string | null>(null);
  const [qrNotice, setQrNotice] = useState<Record<string, { tone: 'ok' | 'error'; text: string }>>({});
  const [brokenQrPreview, setBrokenQrPreview] = useState<Record<string, string>>({});
  const [qrPreviewFor, setQrPreviewFor] = useState<string | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState(true);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Dashboard data
  const [tab, setTab] = useState<'queue' | 'rosters' | 'events' | 'check-in' | 'volunteers'>('queue');
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [bundles, setBundles] = useState<AdminBundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [lunchFilter, setLunchFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [exporting, setExporting] = useState(false);
  const filters = { search: searchQuery, event: eventFilter, status: statusFilter, lunch: lunchFilter, from: dateFrom, to: dateTo, sort: sortOrder };

  // Side-by-side Verification Inspector Modal
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingDecision, setProcessingDecision] = useState(false);
  const [decisionNote, setDecisionNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [lastApproval, setLastApproval] = useState<{ id: string; text: string; nextTeamCode?: string; emailNote?: string } | null>(null);
  const approvalNotice = useRef<HTMLParagraphElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [zoomImage, setZoomImage] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // New event form state
  const [newEvtTitle, setNewEvtTitle] = useState('');
  const [newEvtGame, setNewEvtGame] = useState('');
  const [newEvtSubtitle, setNewEvtSubtitle] = useState('');
  const [newEvtMaxTeams, setNewEvtMaxTeams] = useState(24);
  const [newEvtBaseFee, setNewEvtBaseFee] = useState(299);
  const [newEvtPrize, setNewEvtPrize] = useState(10000);
  const [newEvtVenue, setNewEvtVenue] = useState('SAMT Campus Arena');
  const [newEvtDate, setNewEvtDate] = useState('Dates to be announced');

  async function fetchAdmin(url: string, init: RequestInit = {}) {
    const requestToken = activeToken.current;
    const response = await adminRequest(url, requestToken, init, () => {
      if (activeToken.current !== requestToken) return;
      handleLogout();
      setLoginError('Your admin session expired. Please sign in again.');
    });
    if (activeToken.current !== requestToken) throw new Error('Session changed. Please retry.');
    return response;
  }

  async function fetchOverview(requestToken = token) {
    if (!requestToken) return;
    const sequence = ++overviewSequence.current;
    setLoading(true);
    try {
      const res = await fetchAdmin('/api/admin/overview', {
        headers: { Authorization: `Bearer ${requestToken}` },
      });
      const json = await res.json();
      if (activeToken.current !== requestToken || sequence !== overviewSequence.current) return;
      setEvents(json.events || []);
      setBundles(json.bundles || []);
      // Warm the cache for the teams waiting for review so opening one is instant.
      const waiting = ((json.bundles || []) as AdminBundle[])
        .filter((b) => b.latestProofUrl && (b.registration.status === 'pending' || b.registration.status === 'waitlisted'))
        .slice(0, 8);
      void (async () => {
        for (let i = 0; i < waiting.length; i += 2) {
          await Promise.allSettled(waiting.slice(i, i + 2).map((b) => loadProofImage(b.latestProofUrl!, requestToken)));
        }
      })();
      setSmtpConfigured(Boolean(json.smtpConfigured));
    } catch (error) {
      if (activeToken.current === requestToken && sequence === overviewSequence.current) {
        const reason = error instanceof Error ? ` (${error.message})` : '';
        setActionMsg(`Failed to refresh dashboard data${reason}. Your previous data is still shown; try Refresh.`);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      fetchOverview(token);
    }
  }, [token]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });
      const json = await readAdminLoginResponse(res);
      if (json.role === 'volunteer') {
        sessionStorage.setItem(VOLUNTEER_TOKEN_KEY, json.token);
        sessionStorage.setItem(VOLUNTEER_ID_KEY, json.email);
        onNavigate({ page: 'volunteer' });
        return;
      }
      sessionStorage.removeItem(VOLUNTEER_TOKEN_KEY);
      sessionStorage.removeItem(VOLUNTEER_ID_KEY);
      sessionStorage.setItem(STORAGE_TOKEN_KEY, json.token);
      sessionStorage.setItem(STORAGE_EMAIL_KEY, json.email);
      activeToken.current = json.token;
      setLoginPass('');
      setLoginError('');
      setToken(json.token);
      setAdminEmail(json.email);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoggingIn(false);
    }
  }

  const handleLogout = useCallback(() => {
    clearProofImageCache();
    sessionStorage.removeItem(STORAGE_TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_EMAIL_KEY);
    activeToken.current = '';
    overviewSequence.current += 1;
    setBundles([]); setEvents([]);
    setRejectReason(''); setZoomImage(false); setActionMsg(''); setLoginPass(''); setLoginEmail('');
    setLastApproval(null); setDecisionNote(null);
    setToken('');
    setAdminEmail('');
    setSelectedId(null);
  }, []);

  const selectedBundle = useMemo(
    () => bundles.find((b) => b.registration.id === selectedId) || null,
    [bundles, selectedId]
  );

  const filteredBundles = useMemo(() => filterAdminRegistrations(bundles, filters),
    [bundles, searchQuery, statusFilter, eventFilter, lunchFilter, dateFrom, dateTo, sortOrder]);

  useEffect(() => {
    if (lastApproval) approvalNotice.current?.focus();
  }, [lastApproval]);

  function selectRegistration(id: string | null) {
    setSelectedId(id);
    setRejectReason('');
    setZoomImage(false);
    setDecisionNote(null);
  }

  // On phones the inspector sits below the list, so bring it into view after a tap.
  function openRegistration(id: string) {
    selectRegistration(id);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => inspectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  async function exportReport(format: 'xlsx' | 'pdf') {
    if (exporting) return;
    if (dateFrom && dateTo && dateFrom > dateTo) { setActionMsg('Start date must be before end date.'); return; }
    setExporting(true);
    try {
      const res = await fetchAdmin('/api/admin/export/' + format, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(filters) });
      const blob = await res.blob();
      if (!activeToken.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'srusti-registrations.' + format;
      link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setActionMsg('Filtered ' + format.toUpperCase() + ' report downloaded.');
    } catch (error) { setActionMsg(error instanceof Error ? error.message : 'Export failed.'); }
    finally { setExporting(false); }
  }

  const kpis = useMemo(() => {
    let pending = 0;
    let verified = 0;
    let rejected = 0;
    let verifiedRevenue = 0;
    let totalVeg = 0;
    let totalNonVeg = 0;
    for (const b of bundles) {
      if (b.registration.status === 'pending' || b.registration.status === 'reupload_required') {
        pending += 1;
      } else if (b.registration.status === 'verified') {
        verified += 1;
        verifiedRevenue += b.registration.totalFee;
        totalVeg += b.registration.vegCount;
        totalNonVeg += b.registration.nonVegCount;
      } else if (b.registration.status === 'rejected') {
        rejected += 1;
      }
    }
    return {
      total: bundles.length,
      pending,
      verified,
      rejected,
      verifiedRevenue,
      totalVeg,
      totalNonVeg,
    };
  }, [bundles]);

  async function handleDecision(decision: 'approve' | 'reject' | 'reupload_required') {
    if (!selectedBundle || processingDecision) return;
    if (decision !== 'approve' && !rejectReason.trim()) {
      setDecisionNote({ tone: 'error', text: 'Enter a reason before rejecting or requesting a new payment proof.' });
      return;
    }
    const target = selectedBundle;
    const targetId = target.registration.id;
    const reason = rejectReason;
    setProcessingDecision(true);
    setActionMsg('');
    setDecisionNote(null);
    setLastApproval(null);
    // Ignore older refresh responses while a decision is being saved.
    overviewSequence.current += 1;
    try {
      const res = await fetchAdmin(
        `/api/admin/registrations/${targetId}/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, reason }),
        }
      );
      const json = await res.json();
      overviewSequence.current += 1;
      setBundles((current) => current.map((item) => item.registration.id === json.registration.id
        ? { ...item, registration: json.registration, proofs: json.proofs } : item));
      setRejectReason('');
      onEventsUpdated();
      if (decision === 'approve' && json.registration.status === 'verified') {
        const index = filteredBundles.findIndex((bundle) => bundle.registration.id === targetId);
        const inReviewOrder = [...filteredBundles.slice(index + 1), ...filteredBundles.slice(0, Math.max(0, index))];
        const next = inReviewOrder.find(({ registration }) =>
          registration.id !== targetId && registration.status === 'pending'
        );
        const { groupName, slotNumber } = json.registration;
        const seat = slotNumber ? ` · ${groupName ? groupName + ' · ' : ''}Seat ${slotNumber}` : '';
        setLastApproval({
          id: targetId,
          text: `${target.registration.teamCode} approved${seat}`,
          nextTeamCode: next?.registration.teamCode,
          emailNote: json.emailNote,
        });
        if (next) selectRegistration(next.registration.id);
      } else {
        const label = decision === 'reject' ? 'Rejected.' : decision === 'reupload_required' ? 'Re-upload requested.' : 'Decision saved.';
        setDecisionNote({ tone: 'ok', text: `${target.registration.teamCode}: ${label} ${json.emailNote || ''}` });
        setActionMsg(`${target.registration.teamCode} updated to ${String(json.registration.status).toUpperCase()}.`);
      }
    } catch (err) {
      setDecisionNote({ tone: 'error', text: err instanceof Error ? err.message : 'Action failed. Nothing was changed.' });
    } finally {
      setProcessingDecision(false);
    }
  }

  async function deleteRecords(ids: string[]) {
    if (ids.length === 0 || deleting) return;
    const label = ids.length === 1
      ? (bundles.find((b) => b.registration.id === ids[0])?.registration.teamCode || 'this record')
      : `${ids.length} records`;
    const confirmed = window.confirm(
      `Permanently delete ${label}?\n\nThis removes the team, its roster, payment proof and history. It cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    setActionMsg('');
    try {
      const res = await fetchAdmin('/api/admin/registrations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      const gone = new Set(ids);
      setBundles((current) => current.filter((b) => !gone.has(b.registration.id)));
      setCheckedIds(new Set());
      if (selectedId && gone.has(selectedId)) setSelectedId(null);
      // Don't keep showing "approved" for a team that no longer exists.
      setLastApproval((current) => (current && gone.has(current.id) ? null : current));
      setActionMsg(`Deleted ${json.deleted ?? ids.length} record(s).`);
      onEventsUpdated();
    } catch (error) {
      setActionMsg(error instanceof Error ? error.message : 'Delete failed. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  function toggleChecked(id: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleResendEmail(regId: string) {
    setActionMsg('');
    try {
      const res = await fetchAdmin(`/api/admin/registrations/${regId}/resend-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setActionMsg(
        json.ok
          ? 'Confirmation email re-sent to Team Leader.'
          : `Email not sent: ${json.error || 'SMTP not configured.'}`
      );
      await fetchOverview();
    } catch (error) {
      setActionMsg(error instanceof Error ? `Email resend failed: ${error.message}` : 'Failed to trigger email resend.');
    }
  }

  function setQrNoticeFor(eventId: string, notice: { tone: 'ok' | 'error'; text: string } | null) {
    setQrNotice((prev) => {
      const next = { ...prev };
      if (notice) next[eventId] = notice;
      else delete next[eventId];
      return next;
    });
  }

  async function handleQrUpload(eventId: string, file: File | undefined) {
    if (!file || uploadingQrFor) return;
    setUploadingQrFor(eventId);
    setActionMsg('');
    setQrNoticeFor(eventId, null);
    try {
      // Phone photos of a printed QR are often far above the 3 MB server limit;
      // downscale large images in the browser first (small QR files are sent unchanged).
      const prepared = await compressScreenshot(file);
      const fd = new FormData();
      fd.append('qr', prepared);
      const res = await fetchAdmin(`/api/admin/events/${eventId}/qr`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!json || typeof json.qrImageUrl !== 'string' || !json.qrImageUrl) {
        throw new Error('The server did not confirm the QR was saved. Please try again.');
      }
      const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      // Shown inside the event card (the top banner is off-screen on this tab).
      setQrNoticeFor(eventId, { tone: 'ok', text: `QR uploaded and saved at ${time}. Participant view is shown below.` });
      setActionMsg('Official UPI QR image updated.');
      setQrPreviewFor(eventId);
      await fetchOverview();
      onEventsUpdated();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'QR upload failed. Please try again.';
      setQrNoticeFor(eventId, { tone: 'error', text: `Upload failed: ${message}` });
      setActionMsg(message);
    } finally {
      setUploadingQrFor(null);
    }
  }

  async function handleQrRemove(eventId: string) {
    if (!window.confirm('Remove the uploaded QR image? Students will see the UPI ID QR (if set) instead.')) return;
    await handleEventFieldUpdate(eventId, { qrImageUrl: '' });
    setQrNoticeFor(eventId, { tone: 'ok', text: 'QR image removed.' });
  }

  async function handleEventFieldUpdate(eventId: string, patch: Record<string, unknown>) {
    // Leaving a field without editing it should not save or reload the whole dashboard.
    const current = events.find((evt) => evt.id === eventId) as unknown as Record<string, unknown> | undefined;
    if (current && Object.entries(patch).every(([key, value]) => current[key] === value)) return;
    try {
      const res = await fetchAdmin(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setActionMsg('Event configuration saved.');
        setQrNoticeFor(eventId, { tone: 'ok', text: 'Saved. Participants see the change within a few seconds.' });
        await fetchOverview();
        onEventsUpdated();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed. Please try again.';
      setActionMsg(message);
      // Shown on the event card too: the top banner is off-screen on this tab.
      setQrNoticeFor(eventId, { tone: 'error', text: `Not saved: ${message}` });
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (creatingEvent) return;
    setCreatingEvent(true);
    try {
      if (!newEvtTitle.trim() || !newEvtGame.trim()) {
        setActionMsg('Enter an event title and game before publishing.');
        return;
      }
      const res = await fetchAdmin('/api/admin/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newEvtTitle,
          gameTitle: newEvtGame,
          subtitle: newEvtSubtitle,
          maxTeams: newEvtMaxTeams,
          baseFee: newEvtBaseFee,
          lunchFee: 100,
          prizePoolTotal: newEvtPrize,
          venueLabel: newEvtVenue,
          eventDateLabel: newEvtDate,
        }),
      });
      if (res.ok) {
        setNewEvtTitle('');
        setNewEvtGame('');
        setNewEvtSubtitle('');
        setActionMsg('New college event created and published.');
        await fetchOverview();
        onEventsUpdated();
      }
    } catch (error) {
      setActionMsg(error instanceof Error ? error.message : 'Request failed. Please try again.');
    } finally { setCreatingEvent(false); }
  }

  function exportCsv() {
    const headers = [
      'Team ID',
      'Event',
      'Game',
      'Status',
      'Group',
      'Slot',
      'Team Name',
      'College',
      'IGL Phone',
      'IGL Email',
      'Total Fee (INR)',
      'Lunch Count',
      'Veg Meals',
      'Non-Veg Meals',
      'Latest UTR',
      'Roster (Role: Name / IGN / CharID / College / Academic level)',
    ];
    const rows = filteredBundles.map((b) => [
      b.registration.teamCode,
      b.event.title,
      b.event.gameTitle,
      b.registration.status,
      b.registration.groupName || '',
      b.registration.slotNumber || '',
      b.registration.teamName,
      b.registration.collegeName,
      b.registration.iglPhone,
      b.registration.iglEmail,
      b.registration.totalFee,
      b.registration.lunchCount,
      b.registration.vegCount,
      b.registration.nonVegCount,
      b.proofs[0]?.utrNumber || '',
      b.members
        .map((m) => `${m.slotRole}: ${m.fullName} (${[m.inGameName, m.characterId, m.collegeOverride, m.academicLevel].filter(Boolean).join(' / ')})`)
        .join(' | '),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `samt-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    // Revoking synchronously can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Unauthenticated Admin Login Screen
  if (!token) {
    return (
      <main className="staff-desk min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:py-16">
        <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <img
              src="/assets/brand/srusti-academy-crest.png"
              alt="Srusti crest"
              referrerPolicy="no-referrer"
              className="h-10 w-10 object-contain"
            />
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                Tournament staff sign-in
              </h1>
              <p className="text-xs text-slate-500">
                Use your admin email or volunteer ID.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-xs font-medium text-slate-700">
                Admin email or volunteer ID
              </label>
              <input
                id="admin-email"
                autoComplete="username"
                type="text"
                autoCapitalize="none"
                spellCheck={false}
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Email or volunteer ID"
                required
                className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-[#233D8B] focus:outline-none sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="admin-pass" className="block text-xs font-medium text-slate-700">
                Password
              </label>
              <input
                id="admin-pass"
                autoComplete="current-password"
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••"
                required
                className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-[#233D8B] focus:outline-none sm:text-sm"
              />
            </div>

            {loginError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="min-h-11 w-full rounded-md bg-[#233D8B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a2f6e] disabled:opacity-50"
            >
              {loggingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="staff-desk min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Top Workspace Header */}
        <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="break-all text-xs font-medium text-slate-500">
              SAMT Event Administration · {adminEmail}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Payment Verification &amp; Tournament Desk
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fetchOverview()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Summary
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {!smtpConfigured && (
          <p role="status" className="no-print mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Confirmation emails are not being sent: the college email (SMTP) settings are missing on the server.
            Teams can still track their status on the website.
          </p>
        )}

        <div className="no-print mt-5 flex flex-wrap items-center gap-x-1 border-b border-slate-200">
          {([
            ['queue', 'Verification Queue'],
            ['check-in', 'Check-in'],
            ['volunteers', 'Volunteers'],
            ['rosters', 'Participant Rosters & Meals'],
            ['events', 'Events & UPI QR Setup'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={`min-h-11 rounded-t-md border-b-2 px-2.5 py-2.5 text-xs font-semibold transition-colors sm:px-4 ${
                tab === key
                  ? 'border-[#233D8B] bg-blue-50 text-[#233D8B]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab !== 'volunteers' && tab !== 'check-in' && <>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button disabled={exporting || loading} onClick={() => exportReport('xlsx')} className="rounded-md bg-[#233D8B] px-4 py-2 text-sm text-white disabled:opacity-50">{exporting ? 'Preparing report…' : 'Export Excel (.xlsx)'}</button>
          <button disabled={exporting || loading} onClick={() => exportReport('pdf')} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-50">Export PDF</button>
          <span className="text-xs text-slate-500">Exports use the filters below.</span>
        </div>
        {/* KPI Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:gap-4 lg:grid-cols-5">
          <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
            <div className="text-xs text-slate-500">Total Registrations</div>
            <div className="mt-1 font-mono text-xl font-bold sm:text-2xl text-slate-900 tabular-nums">
              {kpis.total}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
            <div className="text-xs text-slate-500">Pending Review</div>
            <div className="mt-1 font-mono text-xl font-bold sm:text-2xl text-amber-600 tabular-nums">
              {kpis.pending}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
            <div className="text-xs text-slate-500">Verified Squads</div>
            <div className="mt-1 font-mono text-xl font-bold sm:text-2xl text-emerald-600 tabular-nums">
              {kpis.verified}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
            <div className="text-xs text-slate-500">Verified Collections</div>
            <div className="mt-1 font-mono text-xl font-bold sm:text-2xl text-slate-900 tabular-nums">
              Rs. {kpis.verifiedRevenue.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-3 sm:p-4 lg:col-span-1">
            <div className="text-xs text-slate-500">Verified Meals (V / NV)</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
              {kpis.totalVeg} Veg · {kpis.totalNonVeg} NV
            </div>
          </div>
        </div>

        {actionMsg && (
          <div role="status" aria-live="polite" className="no-print mt-4 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-800">
            {actionMsg}
          </div>
        )}

        <fieldset aria-label="Registration filters" disabled={processingDecision} className="no-print mt-5 min-w-0 rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative flex gap-2 sm:col-span-2">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search registrations"
                placeholder="Search team, college, email, phone or UTR"
                className="min-h-10 w-full min-w-0 rounded border border-slate-300 py-2 pr-3 pl-8 text-sm focus:border-[#233D8B] focus:outline-none sm:text-xs"
              />
              <button
                type="button"
                aria-expanded={showFilters}
                aria-controls="admin-more-filters"
                onClick={() => setShowFilters((open) => !open)}
                className="min-h-10 shrink-0 rounded border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:hidden"
              >
                {showFilters ? 'Hide filters' : 'Filters'}
              </button>
            </div>
            <div id="admin-more-filters" className={`${showFilters ? 'grid' : 'hidden'} gap-2 sm:contents`}>
            <select aria-label="Filter by event" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="min-h-10 rounded border border-slate-300 p-2 text-xs">
              <option value="all">All Events</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
            <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-h-10 rounded border border-slate-300 p-2 text-xs">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Approved</option>
              <option value="reupload_required">Re-upload Needed</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="rejected">Rejected</option>
            </select>
            <select aria-label="Filter by lunch" value={lunchFilter} onChange={(e) => setLunchFilter(e.target.value)} className="min-h-10 rounded border border-slate-300 p-2 text-xs">
              <option value="all">All lunch preferences</option>
              <option value="yes">Lunch opted in</option>
              <option value="no">No lunch</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              From
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="min-h-10 min-w-0 flex-1 rounded border border-slate-300 p-2" />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              To
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="min-h-10 min-w-0 flex-1 rounded border border-slate-300 p-2" />
            </label>
            <select aria-label="Sort registrations" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="min-h-10 rounded border border-slate-300 p-2 text-xs">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="team">Team name A–Z</option>
            </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span role="status">Showing {filteredBundles.length} of {bundles.length} teams · dates in IST</span>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setEventFilter('all'); setStatusFilter('all'); setLunchFilter('all'); setDateFrom(''); setDateTo(''); setSortOrder('newest'); }}
              className="min-h-10 px-2 font-medium text-[#233D8B] hover:underline"
            >
              Clear filters
            </button>
          </div>
        </fieldset>
        </>}
        {tab === 'check-in' && <div className="mt-6"><CheckInDesk token={token} onSessionExpired={handleLogout} /></div>}
        {tab === 'volunteers' && <div className="mt-6"><VolunteerAccounts token={token} onSessionExpired={handleLogout} /></div>}

        {/* TAB 1: Verification Queue + Side-by-Side Inspector */}
        {tab === 'queue' && (
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            {/* Queue List */}
            <div ref={queueRef} className="min-w-0 scroll-mt-20 rounded-lg border border-slate-200 bg-white lg:col-span-7">
              <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                <h2 className="text-sm font-semibold text-slate-900">Payment review</h2>
                <div role="group" aria-label="Quick review filters" className="flex gap-1.5">
                  {([['pending', 'Pending'], ['verified', 'Approved']] as const).map(([status, label]) => (
                    <button
                      key={status}
                      type="button"
                      disabled={processingDecision}
                      aria-pressed={statusFilter === status}
                      onClick={() => {
                        const nextStatus = statusFilter === status ? 'all' : status;
                        setStatusFilter(nextStatus);
                        if (nextStatus !== 'all' && selectedBundle?.registration.status !== nextStatus) {
                          const first = filterAdminRegistrations(bundles, { ...filters, status: nextStatus })[0];
                          selectRegistration(first?.registration.id ?? null);
                        }
                      }}
                      className={`rounded border px-3 py-1.5 text-xs font-semibold ${statusFilter === status
                        ? 'border-[#233D8B] bg-[#233D8B] text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {checkedIds.size > 0 && (
                <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  <span>{checkedIds.size} selected</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => setCheckedIds(new Set())} className="rounded border border-red-200 bg-white px-2.5 py-1 font-medium hover:bg-red-100">
                      Clear selection
                    </button>
                    <button type="button" disabled={deleting} onClick={() => void deleteRecords([...checkedIds])} className="rounded bg-red-600 px-2.5 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                      {deleting ? 'Deleting…' : `Delete selected (${checkedIds.size})`}
                    </button>
                  </span>
                </div>
              )}
              {filteredBundles.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  No registrations match the current filters.
                </div>
              ) : (
                <div role="region" aria-label="Registration queue" tabIndex={0} className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="w-8 px-3 py-2.5">
                          <input
                            type="checkbox"
                            aria-label="Select all shown records"
                            checked={filteredBundles.length > 0 && filteredBundles.every((b) => checkedIds.has(b.registration.id))}
                            onChange={(e) =>
                              setCheckedIds(e.target.checked ? new Set(filteredBundles.map((b) => b.registration.id)) : new Set())
                            }
                          />
                        </th>
                        <th className="px-3 py-2.5 font-medium">Team ID</th>
                        <th className="px-3 py-2.5 font-medium">Team &amp; Event</th>
                        <th className="hidden px-3 py-2.5 font-medium sm:table-cell">UTR Ref</th>
                        <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Amount</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBundles.map((b) => {
                        const isSel = b.registration.id === selectedId;
                        const utr = b.proofs[0]?.utrNumber || '—';
                        return (
                          <tr
                            key={b.registration.id}
                            onClick={() => {
                              if (!processingDecision) openRegistration(b.registration.id);
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSel ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="w-8 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                aria-label={`Select ${b.registration.teamCode}`}
                                checked={checkedIds.has(b.registration.id)}
                                onChange={() => toggleChecked(b.registration.id)}
                              />
                            </td>
                            <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap text-slate-900">
                              <button
                                type="button"
                                disabled={processingDecision}
                                aria-current={isSel ? 'true' : undefined}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openRegistration(b.registration.id);
                                }}
                                className="text-[#233D8B] hover:underline"
                              >
                                {b.registration.teamCode}
                              </button>
                            </td>
                            <td className="px-2 py-2.5 wrap-anywhere sm:px-3">
                              <div className="font-medium text-slate-900">
                                {b.registration.teamName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {b.event.gameTitle} · {b.registration.collegeName}
                              </div>
                              <div className="mt-0.5 font-mono text-[11px] text-slate-700 sm:hidden">
                                Rs. {b.registration.totalFee} · {utr}
                              </div>
                            </td>
                            <td className="hidden px-3 py-2.5 font-mono text-[11px] whitespace-nowrap text-slate-700 sm:table-cell">
                              {utr}
                            </td>
                            <td className="hidden px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap tabular-nums sm:table-cell">
                              Rs. {b.registration.totalFee}
                            </td>
                            <td className="px-3 py-2.5 sm:whitespace-nowrap">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase sm:whitespace-nowrap ${
                                  b.registration.status === 'verified'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : b.registration.status === 'pending'
                                    ? 'bg-amber-50 text-amber-700'
                                    : b.registration.status === 'reupload_required'
                                    ? 'bg-orange-50 text-orange-700'
                                    : b.registration.status === 'waitlisted'
                                    ? 'bg-sky-50 text-sky-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {b.registration.status === 'verified'
                                  ? `Approved${b.registration.slotNumber ? ` (${b.registration.slotNumber})` : ''}`
                                  : b.registration.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right: Side-by-Side Payment Proof Inspector */}
            <div
              ref={inspectorRef}
              className={`min-w-0 scroll-mt-20 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 lg:col-span-5 ${
                !selectedBundle && !lastApproval ? 'hidden lg:block' : ''
              }`}
            >
              {lastApproval && (
                <div className="no-print mb-4 grid gap-2 rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <p ref={approvalNotice} tabIndex={-1} role="status" className="scroll-mt-24 font-semibold">
                    {lastApproval.text}
                  </p>
                  <p>{lastApproval.nextTeamCode ? `Next pending team opened · ${lastApproval.nextTeamCode}` : 'No other pending teams match these filters.'}</p>
                  {lastApproval.emailNote && <p>{lastApproval.emailNote}</p>}
                  <button
                    type="button"
                    disabled={processingDecision || !bundles.some(({ registration }) => registration.id === lastApproval.id)}
                    onClick={() => {
                      setStatusFilter('verified');
                      selectRegistration(lastApproval.id);
                    }}
                    className="w-fit rounded border border-emerald-300 bg-white px-2.5 py-1.5 font-semibold hover:bg-emerald-100 disabled:opacity-50"
                  >
                    View approved registration
                  </button>
                </div>
              )}
              {!selectedBundle ? (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-xs text-slate-500">
                  Select a team row from the queue to inspect the uploaded payment screenshot,
                  verify UTR uniqueness, and approve or reject.
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => queueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="no-print mb-3 inline-flex min-h-10 items-center text-xs font-semibold text-[#233D8B] hover:underline lg:hidden"
                  >
                    ← Back to team list
                  </button>
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3 wrap-anywhere">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-[#233D8B]">
                        {selectedBundle.registration.teamCode}
                      </div>
                      <h2 className="text-base font-bold text-slate-900">
                        {selectedBundle.registration.teamName}
                      </h2>
                      <div className="break-all text-xs text-slate-500">
                        IGL: <a href={`tel:${selectedBundle.registration.iglPhone}`} className="hover:underline">{selectedBundle.registration.iglPhone}</a> ·{' '}
                        {selectedBundle.registration.iglEmail}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleResendEmail(selectedBundle.registration.id)}
                      className="inline-flex min-h-9 items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Mail className="h-3 w-3" />
                      Resend Email
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void deleteRecords([selectedBundle.registration.id])}
                      className="inline-flex min-h-9 items-center gap-1 rounded border border-red-300 px-2.5 py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete record
                    </button>
                    </div>
                  </div>

                  {/* Expected vs Paid Summary */}
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded bg-slate-50 p-3 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-500">Expected Fee</div>
                      <div className="font-mono font-bold text-slate-900 tabular-nums">
                        Rs. {selectedBundle.registration.totalFee}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">UTR Reference</div>
                      <div className="font-mono font-semibold break-all text-slate-900">
                        {selectedBundle.proofs[0]?.utrNumber || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Meals</div>
                      <div className="font-mono text-slate-800 tabular-nums">
                        {selectedBundle.registration.vegCount}V /{' '}
                        {selectedBundle.registration.nonVegCount}NV
                      </div>
                    </div>
                  </div>

                  {/* Squad roster for cross-checking before a decision */}
                  <div className="mt-3 rounded border border-slate-200 p-3 text-[11px] wrap-anywhere">
                    <div className="flex flex-wrap justify-between gap-1 text-slate-500">
                      <span>{selectedBundle.event.title} · {selectedBundle.registration.collegeName}</span>
                      <span>
                        Email: {selectedBundle.registration.lastEmailStatus === 'sent' ? 'Sent' :
                          selectedBundle.registration.lastEmailStatus === 'pending_send' ? 'Delivery pending' :
                          selectedBundle.registration.lastEmailStatus === 'failed_or_unconfigured' ? 'Not delivered — use Resend Email' : 'Not sent'}.
                        {' '}Refresh to check the latest delivery result.
                      </span>
                      <span>
                        Status: <strong className="text-slate-800">{selectedBundle.registration.status === 'verified'
                          ? 'Approved'
                          : selectedBundle.registration.status.replace(/_/g, ' ')}</strong>
                        {selectedBundle.registration.slotNumber ? ` · ${selectedBundle.registration.groupName} ${selectedBundle.registration.slotNumber}` : ''}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-0.5">
                      {selectedBundle.members.map((m) => (
                        <li key={m.id} className="flex flex-wrap gap-x-2">
                          <span className="w-8 font-mono font-semibold text-slate-500">{m.slotRole}</span>
                          <span className="text-slate-900">{m.fullName}</span>
                          <span className="text-slate-500">{m.inGameName} · {m.characterId}</span>
                          <span className="basis-full text-slate-500">{[m.collegeOverride, m.academicLevel].filter(Boolean).join(' · ')}</span>
                        </li>
                      ))}
                    </ul>
                    {selectedBundle.registration.rejectionReason && (
                      <p className="mt-2 text-orange-700">Last note: {selectedBundle.registration.rejectionReason}</p>
                    )}
                  </div>

                  {/* Screenshot Viewer */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                      <span>
                        Payment Screenshot ({selectedBundle.proofs[0]?.upiApp || 'UPI'})
                      </span>
                      {selectedBundle.latestProofUrl && (
                        <button
                          type="button"
                          onClick={() => setZoomImage((z) => !z)}
                          className="text-[#233D8B] hover:underline"
                        >
                          {zoomImage ? 'Fit Preview' : 'Zoom Screenshot'}
                        </button>
                      )}
                    </div>

                    {selectedBundle.latestProofUrl ? (
                      <div className="mt-1.5 overflow-auto rounded border border-slate-200 bg-slate-100 p-2 text-center">
                        <ProtectedProofImage key={selectedBundle.latestProofUrl} url={selectedBundle.latestProofUrl} token={token} zoom={zoomImage} />
                      </div>
                    ) : (
                      <div className="mt-1.5 rounded border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">
                        No screenshot attached.
                      </div>
                    )}
                  </div>

                  {/* Decision Controls */}
                  <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      aria-label="Reason or note for the team"
                      placeholder="Reason / Note (required if rejecting or requesting re-upload)"
                      className="min-h-11 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#233D8B] focus:outline-none sm:text-xs"
                    />
                    {decisionNote && (
                      <p
                        role={decisionNote.tone === 'error' ? 'alert' : 'status'}
                        className={`rounded border px-3 py-2 text-xs ${
                          decisionNote.tone === 'ok'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {decisionNote.text}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={processingDecision}
                        onClick={() => handleDecision('approve')}
                        className="inline-flex min-h-11 items-center justify-center gap-1 rounded bg-emerald-600 px-2 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {processingDecision ? 'Saving…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={processingDecision}
                        onClick={() => handleDecision('reupload_required')}
                        className="min-h-11 rounded border border-amber-500 bg-amber-50 px-2 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        Re-upload
                      </button>
                      <button
                        type="button"
                        disabled={processingDecision}
                        onClick={() => handleDecision('reject')}
                        className="inline-flex min-h-11 items-center justify-center gap-1 rounded bg-red-600 px-2 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Participant Rosters & Meal Breakdown */}
        {tab === 'rosters' && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white">
            {filteredBundles.length === 0 && (
              <p className="p-10 text-center text-xs text-slate-500">No registrations match the current filters.</p>
            )}
            {/* Phones: one card per team instead of a wide table. */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filteredBundles.map((b) => (
                <li key={b.registration.id} className="p-4 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-900">{b.registration.teamCode}</div>
                      <div className="text-[11px] text-slate-500">
                        {b.registration.slotNumber
                          ? `${b.registration.groupName} · ${b.registration.slotNumber}`
                          : b.registration.status.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void deleteRecords([b.registration.id])}
                      aria-label={`Delete ${b.registration.teamCode} ${b.registration.teamName}`}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded border border-red-200 px-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" /> Delete
                    </button>
                  </div>
                  <div className="mt-2 font-semibold break-words text-slate-900">{b.registration.teamName}</div>
                  <div className="text-[11px] break-words text-slate-500">{b.event.gameTitle} · {b.registration.collegeName}</div>
                  <div className="mt-1 text-[11px] break-all text-slate-600">
                    <a href={`tel:${b.registration.iglPhone}`} className="font-mono hover:underline">{b.registration.iglPhone}</a> · {b.registration.iglEmail}
                  </div>
                  <ul className="mt-2 space-y-1 rounded bg-slate-50 p-2 text-[11px]">
                    {b.members.map((m) => (
                      <li key={m.id} className="break-words">
                        <span className="font-mono font-semibold text-slate-700">[{m.slotRole}]</span> {m.fullName} · <strong>{m.inGameName}</strong> ·{' '}
                        <span className="font-mono">{m.characterId}</span>
                        <div className="text-slate-500">{[m.collegeOverride, m.academicLevel].filter(Boolean).join(' · ')}</div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 font-mono text-[11px] text-slate-700 tabular-nums">
                    Meals: {b.registration.vegCount} Veg / {b.registration.nonVegCount} NV
                  </div>
                </li>
              ))}
            </ul>
            <div role="region" aria-label="Participant rosters" tabIndex={0} className={`hidden overflow-x-auto ${filteredBundles.length ? 'md:block' : ''}`}>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-4 py-3 font-medium">Team ID &amp; Slot</th>
                    <th className="px-4 py-3 font-medium">Team / College</th>
                    <th className="px-4 py-3 font-medium">IGL Contact</th>
                    <th className="px-4 py-3 font-medium">Squad Members (Name · IGN · ID)</th>
                    <th className="px-4 py-3 font-medium">Meals</th>
                    <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBundles.map((b) => (
                    <tr key={b.registration.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900">
                          {b.registration.teamCode}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {b.registration.slotNumber
                            ? `${b.registration.groupName} · ${b.registration.slotNumber}`
                            : b.registration.status}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {b.registration.teamName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {b.event.gameTitle} · {b.registration.collegeName}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        <div>{b.registration.iglPhone}</div>
                        <div className="font-sans text-slate-500">{b.registration.iglEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <ul className="space-y-0.5 text-[11px]">
                          {b.members.map((m) => (
                            <li key={m.id}>
                              <span className="font-mono font-semibold text-slate-700">
                                [{m.slotRole}]
                              </span>{' '}
                              {m.fullName} · <strong>{m.inGameName}</strong> ·{' '}
                              <span className="font-mono">{m.characterId}</span>
                              <div className="text-slate-500">{[m.collegeOverride, m.academicLevel].filter(Boolean).join(' · ')}</div>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] tabular-nums">
                        {b.registration.vegCount} Veg / {b.registration.nonVegCount} NV
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => void deleteRecords([b.registration.id])}
                          aria-label={`Delete ${b.registration.teamCode} ${b.registration.teamName}`}
                          className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Events, Fees & Official UPI QR Configuration */}
        {tab === 'events' && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-lg border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="text-xs font-semibold text-[#233D8B]">{evt.gameTitle}</div>
                      <h3 className="text-base font-bold text-slate-900">{evt.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEventFieldUpdate(evt.id, { isOpen: !evt.isOpen })}
                      className={`rounded px-2.5 py-1 text-xs font-semibold ${
                        evt.isOpen
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {evt.isOpen ? 'Open' : 'Closed'}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Official UPI ID (VPA) · enables “Open in UPI App”
                      </label>
                      <input
                        type="text"
                        defaultValue={evt.upiVpa}
                        onBlur={(e) =>
                          handleEventFieldUpdate(evt.id, { upiVpa: e.target.value.trim() })
                        }
                        placeholder="collegename@sbi"
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">UPI Payee Name (as on bank account)</label>
                      <input
                        type="text"
                        defaultValue={evt.upiPayeeName}
                        onBlur={(e) =>
                          handleEventFieldUpdate(evt.id, { upiPayeeName: e.target.value.trim() })
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">Entry Fee per Team (Rs.)</label>
                      <input
                        type="number"
                        min={0}
                        defaultValue={evt.baseFee}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (e.target.value !== '' && Number.isFinite(value) && value >= 0) {
                            void handleEventFieldUpdate(evt.id, { baseFee: value });
                          }
                        }}
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">Lunch Add-on per Team (Rs.)</label>
                      <input
                        type="number"
                        min={0}
                        defaultValue={evt.lunchFee}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (e.target.value !== '' && Number.isFinite(value) && value >= 0) {
                            void handleEventFieldUpdate(evt.id, { lunchFee: value });
                          }
                        }}
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">Venue Label</label>
                      <input
                        type="text"
                        defaultValue={evt.venueLabel}
                        onBlur={(e) =>
                          handleEventFieldUpdate(evt.id, { venueLabel: e.target.value })
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">Event Date Label</label>
                      <input
                        type="text"
                        defaultValue={evt.eventDateLabel}
                        onBlur={(e) =>
                          handleEventFieldUpdate(evt.id, { eventDateLabel: e.target.value })
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">Max Squads</label>
                      <input
                        type="number"
                        defaultValue={evt.maxTeams}
                        onBlur={(e) =>
                          handleEventFieldUpdate(evt.id, {
                            maxTeams: Number(e.target.value) || 24,
                          })
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                    <div className="flex min-w-0 items-center gap-3 text-xs text-slate-600">
                      {evt.qrImageUrl ? (
                        <a
                          href={evt.qrImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open uploaded QR at full size"
                          className="shrink-0 rounded border border-slate-200 bg-white p-1"
                        >
                          <img
                            src={evt.qrImageUrl}
                            alt={`Uploaded UPI QR for ${evt.title}`}
                            referrerPolicy="no-referrer"
                            onLoad={() => setBrokenQrPreview((prev) => ({ ...prev, [evt.id]: '' }))}
                            onError={() => setBrokenQrPreview((prev) => ({ ...prev, [evt.id]: evt.qrImageUrl }))}
                            className="h-20 w-20 object-contain"
                          />
                        </a>
                      ) : null}
                      <div>
                        <div>
                          {evt.qrImageUrl ? 'Static UPI QR Uploaded' : 'No Static QR Image Uploaded'}
                        </div>
                        {evt.qrImageUrl ? (
                          <div className="mt-1 flex gap-3 text-[11px] font-medium">
                            <a href={evt.qrImageUrl} target="_blank" rel="noreferrer" className="text-[#233D8B] hover:underline">
                              View full size
                            </a>
                            <button type="button" onClick={() => handleQrRemove(evt.id)} className="text-red-700 hover:underline">
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1 text-[11px] text-slate-500">
                            {evt.upiVpa ? 'Students see a QR generated from the UPI VPA.' : 'Upload a QR or set a UPI VPA so students can pay.'}
                          </div>
                        )}
                      </div>
                    </div>
                    <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded bg-[#233D8B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a2f6e] ${uploadingQrFor ? 'pointer-events-none opacity-50' : ''}`}>
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingQrFor === evt.id ? 'Uploading…' : evt.qrImageUrl ? 'Replace QR' : 'Upload Official QR'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={Boolean(uploadingQrFor)}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          // Reset so choosing the same file again still triggers an upload.
                          e.target.value = '';
                          void handleQrUpload(evt.id, file);
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {evt.qrImageUrl && brokenQrPreview[evt.id] === evt.qrImageUrl && (
                    <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                      The QR is saved, but its image cannot be loaded, so participants cannot see it.
                      Check that the storage bucket for event assets is public, then upload again.
                    </p>
                  )}
                  {qrNotice[evt.id] && (
                    <p
                      role="status"
                      className={`mt-3 rounded border px-3 py-2 text-[11px] ${
                        qrNotice[evt.id].tone === 'ok'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {qrNotice[evt.id].text}
                    </p>
                  )}

                  <div className="mt-3">
                    <button
                      type="button"
                      aria-expanded={qrPreviewFor === evt.id}
                      onClick={() => setQrPreviewFor((prev) => (prev === evt.id ? null : evt.id))}
                      className="text-xs font-semibold text-[#233D8B] hover:underline"
                    >
                      {qrPreviewFor === evt.id ? 'Hide participant view' : 'Preview participant view'}
                    </button>
                    {qrPreviewFor === evt.id && (
                      <div className="mt-2 rounded-lg bg-[#110D0C] p-3">
                        <p className="text-[11px] text-neutral-400">
                          As shown on the registration payment step (base fee, no lunch).
                        </p>
                        <PaymentQrPanel
                          event={evt}
                          feeSummary={calculateRegistrationFee([], evt.baseFee, evt.lunchFee)}
                          upiIntentUri={
                            evt.upiVpa
                              ? buildUpiIntentUri({
                                  vpa: evt.upiVpa,
                                  payeeName: evt.upiPayeeName || 'Srusti Academy of Management and Technology',
                                  amount: evt.baseFee,
                                  teamCode: evt.rulesJson?.codePrefix || 'SAMT26',
                                  eventTitle: evt.title,
                                })
                              : ''
                          }
                          className="mt-2"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Extensible Event Creator */}
            <form
              onSubmit={handleCreateEvent}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Plus className="h-4 w-4 text-[#233D8B]" />
                Add New College Event (Extensible Portal)
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  type="text"
                  value={newEvtTitle}
                  onChange={(e) => setNewEvtTitle(e.target.value)}
                  placeholder="Event Title (e.g. Valorant LAN)"
                  className="rounded border border-slate-300 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={newEvtGame}
                  onChange={(e) => setNewEvtGame(e.target.value)}
                  placeholder="Category / Game"
                  className="rounded border border-slate-300 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={newEvtSubtitle}
                  onChange={(e) => setNewEvtSubtitle(e.target.value)}
                  placeholder="Short Subtitle"
                  className="rounded border border-slate-300 px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  value={newEvtBaseFee}
                  onChange={(e) => setNewEvtBaseFee(Number(e.target.value))}
                  placeholder="Base Fee (Rs.)"
                  className="rounded border border-slate-300 px-3 py-2 font-mono text-xs"
                />
                <input
                  type="number"
                  value={newEvtMaxTeams}
                  onChange={(e) => setNewEvtMaxTeams(Number(e.target.value))}
                  placeholder="Max Teams"
                  className="rounded border border-slate-300 px-3 py-2 font-mono text-xs"
                />
                <input
                  type="number"
                  value={newEvtPrize}
                  onChange={(e) => setNewEvtPrize(Number(e.target.value))}
                  placeholder="Prize Pool (Rs.)"
                  className="rounded border border-slate-300 px-3 py-2 font-mono text-xs"
                />
                <input
                  type="text"
                  value={newEvtDate}
                  onChange={(e) => setNewEvtDate(e.target.value)}
                  placeholder="Event Dates"
                  className="rounded border border-slate-300 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={newEvtVenue}
                  onChange={(e) => setNewEvtVenue(e.target.value)}
                  placeholder="Campus Venue"
                  className="rounded border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={creatingEvent}
                className="mt-4 rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {creatingEvent ? 'Publishing…' : 'Publish New Event'}
              </button>
            </form>
          </div>
        )}

      </div>
    </main>
  );
}
