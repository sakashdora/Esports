import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  LogOut,
  Mail,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Upload,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

function ProtectedProofImage({ url, token, zoom }: { url: string; token: string; zoom: boolean }) {
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setSource(''); setFailed(false);
    fetch(url, { headers: url.startsWith('/api/') ? { Authorization: 'Bearer ' + token } : {}, signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Proof unavailable'); return response.blob(); })
      .then(blob => { objectUrl = URL.createObjectURL(blob); setSource(objectUrl); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, token]);
  if (!source) return <p role="status">{failed ? 'Unable to load proof. Refresh to retry.' : 'Loading payment proof…'}</p>;
  return <img src={source} alt="Uploaded UPI Payment Proof" className={zoom ? 'mx-auto max-h-[600px] w-full rounded object-contain' : 'mx-auto max-h-60 rounded object-contain'} />;
}

import type { CampusEvent } from '../lib/defaultEvents';
import { escapeCsvCell } from '../lib/tournamentRules';

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

interface AuditLog {
  id: string;
  registrationId: string;
  actorLabel: string;
  action: string;
  notes: string;
  createdAt: string;
}

interface AdminDashboardViewProps {
  onEventsUpdated: () => void;
}

const STORAGE_TOKEN_KEY = 'samt_admin_token';
const STORAGE_EMAIL_KEY = 'samt_admin_email';

export function AdminDashboardView({ onEventsUpdated }: AdminDashboardViewProps) {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(STORAGE_TOKEN_KEY) || '');
  const [adminEmail, setAdminEmail] = useState<string>(
    () => sessionStorage.getItem(STORAGE_EMAIL_KEY) || ''
  );
  const [systemMode, setSystemMode] = useState<'supabase' | 'local'>('local');
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Dashboard data
  const [tab, setTab] = useState<'queue' | 'rosters' | 'events' | 'audit'>('queue');
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [bundles, setBundles] = useState<AdminBundle[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');

  // Side-by-side Verification Inspector Modal
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingDecision, setProcessingDecision] = useState(false);
  const [zoomImage, setZoomImage] = useState(false);

  // New event form state
  const [newEvtTitle, setNewEvtTitle] = useState('');
  const [newEvtGame, setNewEvtGame] = useState('');
  const [newEvtSubtitle, setNewEvtSubtitle] = useState('');
  const [newEvtMaxTeams, setNewEvtMaxTeams] = useState(24);
  const [newEvtBaseFee, setNewEvtBaseFee] = useState(299);
  const [newEvtPrize, setNewEvtPrize] = useState(10000);
  const [newEvtVenue, setNewEvtVenue] = useState('SAMT Campus Arena');
  const [newEvtDate, setNewEvtDate] = useState('Dates to be announced');

  // Schema SQL viewer
  const [schemaSql, setSchemaSql] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => {
        setSystemMode(d.mode === 'supabase' ? 'supabase' : 'local');
        setSmtpConfigured(Boolean(d.smtpConfigured));
      })
      .catch(() => {});
  }, []);

  async function fetchOverview(activeToken = token) {
    if (!activeToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const json = await res.json();
      setEvents(json.events || []);
      setBundles(json.bundles || []);
      setAuditLogs(json.auditLogs || []);
      setSystemMode(json.mode === 'supabase' ? 'supabase' : 'local');
      setSmtpConfigured(Boolean(json.smtpConfigured));
    } catch {
      setActionMsg('Failed to refresh dashboard data.');
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Authentication failed.');
      sessionStorage.setItem(STORAGE_TOKEN_KEY, json.token);
      sessionStorage.setItem(STORAGE_EMAIL_KEY, json.email);
      setToken(json.token);
      setAdminEmail(json.email);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_EMAIL_KEY);
    setToken('');
    setAdminEmail('');
    setSelectedId(null);
  }

  const selectedBundle = useMemo(
    () => bundles.find((b) => b.registration.id === selectedId) || null,
    [bundles, selectedId]
  );

  const filteredBundles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bundles.filter((b) => {
      if (statusFilter !== 'all' && b.registration.status !== statusFilter) return false;
      if (eventFilter !== 'all' && b.registration.eventId !== eventFilter) return false;
      if (!q) return true;
      const latestUtr = b.proofs[0]?.utrNumber || '';
      return (
        b.registration.teamCode.toLowerCase().includes(q) ||
        b.registration.teamName.toLowerCase().includes(q) ||
        b.registration.collegeName.toLowerCase().includes(q) ||
        b.registration.iglPhone.includes(q) ||
        latestUtr.toLowerCase().includes(q)
      );
    });
  }, [bundles, statusFilter, eventFilter, searchQuery]);

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
    if (!selectedBundle) return;
    setProcessingDecision(true);
    setActionMsg('');
    try {
      const res = await fetch(
        `/api/admin/registrations/${selectedBundle.registration.id}/decision`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ decision, reason: rejectReason }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Decision failed.');
      setActionMsg(
        `${selectedBundle.registration.teamCode} updated to ${json.registration.status.toUpperCase()}. ${
          json.emailNote || ''
        }`
      );
      setRejectReason('');
      await fetchOverview();
      onEventsUpdated();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setProcessingDecision(false);
    }
  }

  async function handleResendEmail(regId: string) {
    setActionMsg('');
    try {
      const res = await fetch(`/api/admin/registrations/${regId}/resend-email`, {
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
    } catch {
      setActionMsg('Failed to trigger email resend.');
    }
  }

  async function handleQrUpload(eventId: string, file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append('qr', file);
    const res = await fetch(`/api/admin/events/${eventId}/qr`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json();
    if (!res.ok) {
      setActionMsg(json.error || 'QR upload failed.');
      return;
    }
    setActionMsg('Official UPI QR image updated.');
    await fetchOverview();
    onEventsUpdated();
  }

  async function handleEventFieldUpdate(eventId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setActionMsg('Event configuration saved.');
      await fetchOverview();
      onEventsUpdated();
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newEvtTitle.trim() || !newEvtGame.trim()) return;
    const res = await fetch('/api/admin/events', {
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
      'Roster (Role: Name / IGN / CharID)',
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
        .map((m) => `${m.slotRole}: ${m.fullName} (${m.inGameName} / ${m.characterId})`)
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
    URL.revokeObjectURL(url);
  }

  async function loadSchemaSql() {
    const res = await fetch('/api/admin/schema.sql', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSchemaSql(await res.text());
    }
  }

  // Unauthenticated Admin Login Screen
  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900">
        <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <img
              src="/assets/aistudio/Prospectus_2026_-_27_-_1_bb4cb47c.png"
              alt="SAMT Crest"
              referrerPolicy="no-referrer"
              className="h-10 w-10 object-contain"
            />
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                Coordinator Verification Console
              </h1>
              <p className="text-xs text-slate-500">
                {systemMode === 'supabase'
                  ? 'Supabase Auth Required (Admin Allowlist)'
                  : 'Local Preview Mode (Connect Supabase in .env for Production)'}
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-xs font-medium text-slate-700">
                Coordinator Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="info.esport@srustiacademy.ac.in"
                required={systemMode === 'supabase'}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#233D8B] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="admin-pass" className="block text-xs font-medium text-slate-700">
                {systemMode === 'supabase' ? 'Password' : 'Admin Passcode'}
              </label>
              <input
                id="admin-pass"
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder={systemMode === 'supabase' ? '••••••••' : 'Enter configured administrator password'}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#233D8B] focus:outline-none"
              />
              {systemMode === 'local' && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Use the administrator password configured on the server.
                </p>
              )}
            </div>

            {loginError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-md bg-[#233D8B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a2f6e] disabled:opacity-50"
            >
              {loggingIn ? 'Signing In...' : 'Sign In to Verification Console'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Top Workspace Header */}
        <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="text-xs font-medium text-slate-500">
              SAMT Event Administration · {adminEmail} ·{' '}
              {systemMode === 'supabase' ? 'Supabase Connected' : 'Local Preview Storage'}
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
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Total Registrations</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {kpis.total}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Pending Review</div>
            <div className="mt-1 font-mono text-2xl font-bold text-amber-600 tabular-nums">
              {kpis.pending}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Verified Squads</div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-600 tabular-nums">
              {kpis.verified}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Verified Collections</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              Rs. {kpis.verifiedRevenue.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-4 lg:col-span-1">
            <div className="text-xs text-slate-500">Verified Meals (V / NV)</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
              {kpis.totalVeg} Veg · {kpis.totalNonVeg} NV
            </div>
          </div>
        </div>

        {actionMsg && (
          <div className="no-print mt-4 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-800">
            {actionMsg}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="no-print mt-6 flex flex-wrap items-center gap-1 border-b border-slate-200">
          {(
            [
              ['queue', 'Verification Queue'],
              ['rosters', 'Participant Rosters & Meals'],
              ['events', 'Events & UPI QR Setup'],
              ['audit', 'Audit Logs & Supabase SQL'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                if (key === 'audit' && !schemaSql) loadSchemaSql();
              }}
              className={`border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === key
                  ? 'border-[#233D8B] text-[#233D8B]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* TAB 1: Verification Queue + Side-by-Side Inspector */}
        {tab === 'queue' && (
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            {/* Queue List */}
            <div className="rounded-lg border border-slate-200 bg-white lg:col-span-7">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Team ID, Name, UTR, Phone..."
                    className="w-full rounded border border-slate-300 py-1.5 pr-3 pl-8 text-xs focus:border-[#233D8B] focus:outline-none"
                  />
                </div>
                <select
                  aria-label="Filter by event"
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                >
                  <option value="all">All Events</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.gameTitle}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="reupload_required">Re-upload Needed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {filteredBundles.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  No registrations match the current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="px-3 py-2.5 font-medium">Team ID</th>
                        <th className="px-3 py-2.5 font-medium">Team &amp; Event</th>
                        <th className="px-3 py-2.5 font-medium">UTR Ref</th>
                        <th className="px-3 py-2.5 text-right font-medium">Amount</th>
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
                              setSelectedId(b.registration.id);
                              setZoomImage(false);
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSel ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap text-slate-900">
                              {b.registration.teamCode}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-slate-900">
                                {b.registration.teamName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {b.event.gameTitle} · {b.registration.collegeName}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap text-slate-700">
                              {utr}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap tabular-nums">
                              Rs. {b.registration.totalFee}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap uppercase ${
                                  b.registration.status === 'verified'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : b.registration.status === 'pending'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {b.registration.status === 'verified' && b.registration.slotNumber
                                  ? `VERIFIED (${b.registration.slotNumber})`
                                  : b.registration.status.replace('_', ' ')}
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
            <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5">
              {!selectedBundle ? (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-xs text-slate-500">
                  Select a team row from the queue to inspect the uploaded payment screenshot,
                  verify UTR uniqueness, and approve or reject.
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <div className="font-mono text-xs font-bold text-[#233D8B]">
                        {selectedBundle.registration.teamCode}
                      </div>
                      <h2 className="text-base font-bold text-slate-900">
                        {selectedBundle.registration.teamName}
                      </h2>
                      <div className="text-xs text-slate-500">
                        IGL: {selectedBundle.registration.iglPhone} ·{' '}
                        {selectedBundle.registration.iglEmail}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResendEmail(selectedBundle.registration.id)}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Mail className="h-3 w-3" />
                      Resend Email
                    </button>
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
                      <div className="font-mono font-semibold text-slate-900">
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
                        <ProtectedProofImage url={selectedBundle.latestProofUrl} token={token} zoom={zoomImage} />
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
                      placeholder="Reason / Note (required if rejecting or requesting re-upload)"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-[#233D8B] focus:outline-none"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={processingDecision}
                        onClick={() => handleDecision('approve')}
                        className="inline-flex items-center justify-center gap-1 rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={processingDecision}
                        onClick={() => handleDecision('reupload_required')}
                        className="rounded border border-amber-500 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        Re-upload
                      </button>
                      <button
                        type="button"
                        disabled={processingDecision}
                        onClick={() => handleDecision('reject')}
                        className="inline-flex items-center justify-center gap-1 rounded bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-4 py-3 font-medium">Team ID &amp; Slot</th>
                    <th className="px-4 py-3 font-medium">Team / College</th>
                    <th className="px-4 py-3 font-medium">IGL Contact</th>
                    <th className="px-4 py-3 font-medium">Squad Members (Name · IGN · ID)</th>
                    <th className="px-4 py-3 font-medium">Meals</th>
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
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] tabular-nums">
                        {b.registration.vegCount} Veg / {b.registration.nonVegCount} NV
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
                        Official UPI VPA (Optional Dynamic QR)
                      </label>
                      <input
                        type="text"
                        defaultValue={evt.upiVpa}
                        onBlur={(e) =>
                          handleEventFieldUpdate(evt.id, { upiVpa: e.target.value })
                        }
                        placeholder="samt@sbi"
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

                  <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                    <div className="text-xs text-slate-600">
                      {evt.qrImageUrl ? 'Static UPI QR Uploaded' : 'No Static QR Image Uploaded'}
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-[#233D8B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a2f6e]">
                      <Upload className="h-3.5 w-3.5" />
                      Upload Official QR
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleQrUpload(evt.id, e.target.files?.[0])}
                        className="sr-only"
                      />
                    </label>
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
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
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
                className="mt-4 rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Publish New Event
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: Audit Logs & Supabase / SMTP Setup */}
        {tab === 'audit' && (
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="rounded-lg border border-slate-200 bg-white lg:col-span-7">
              <div className="border-b border-slate-200 px-4 py-3 text-xs font-bold text-slate-900">
                Immutable Payment &amp; Email Audit Trail
              </div>
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="px-3 py-2 font-medium">Timestamp</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                      <th className="px-3 py-2 font-medium">Actor</th>
                      <th className="px-3 py-2 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] font-semibold">
                          {log.action}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-700">{log.actorLabel}</td>
                        <td className="px-3 py-2 text-[11px] text-slate-600">{log.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5">
              <h3 className="text-sm font-bold text-slate-900">
                Supabase Free &amp; College SMTP Integration Status
              </h3>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between rounded bg-slate-50 px-3 py-2">
                  <span>Supabase Database &amp; Storage</span>
                  <span
                    className={`font-semibold ${
                      systemMode === 'supabase' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {systemMode === 'supabase' ? 'Connected' : 'Local Preview Fallback'}
                  </span>
                </div>
                <div className="flex justify-between rounded bg-slate-50 px-3 py-2">
                  <span>Official College Email (SMTP)</span>
                  <span
                    className={`font-semibold ${
                      smtpConfigured ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {smtpConfigured ? 'Configured' : 'Pending SMTP Credentials'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Supabase SQL Migration Script
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(schemaSql);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#233D8B] hover:underline"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedSql ? 'Copied!' : 'Copy schema.sql'}
                </button>
              </div>
              <pre className="mt-2 max-h-64 overflow-auto rounded border border-slate-200 bg-slate-950 p-3 font-mono text-[10px] text-slate-200">
                {schemaSql || 'Loading supabase/schema.sql...'}
              </pre>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#233D8B] hover:underline"
              >
                Open Supabase Dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
