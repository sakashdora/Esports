export interface AdminFilters {
  search?: string;
  event?: string;
  status?: string;
  lunch?: string;
  from?: string;
  to?: string;
  sort?: string;
}

interface FilterableRegistration {
  registration: { teamCode: string; teamName: string; collegeName: string; iglPhone: string; iglEmail: string; eventId: string; status: string; lunchCount: number; createdAt: string };
  proofs: Array<{ utrNumber: string }>;
}

export function filterAdminRegistrations<T extends FilterableRegistration>(bundles: T[], filters: AdminFilters): T[] {
  const query = (filters.search || '').trim().toLowerCase();
  const result = bundles.filter(({ registration: r, proofs }) => {
    if (filters.event && filters.event !== 'all' && r.eventId !== filters.event) return false;
    if (filters.status && filters.status !== 'all' && r.status !== filters.status) return false;
    if (filters.lunch === 'yes' && r.lunchCount === 0) return false;
    if (filters.lunch === 'no' && r.lunchCount > 0) return false;
    // Calendar-day filters are consistently interpreted in IST.
    const timestamp = Date.parse(r.createdAt);
    const day = Number.isFinite(timestamp) ? new Date(timestamp + 330 * 60000).toISOString().slice(0, 10) : '';
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    return !query || [r.teamCode, r.teamName, r.collegeName, r.iglPhone, r.iglEmail, proofs[0]?.utrNumber || ''].some(value => value.toLowerCase().includes(query));
  });
  return result.sort((a, b) => filters.sort === 'team' ? a.registration.teamName.localeCompare(b.registration.teamName) :
    (filters.sort === 'oldest' ? 1 : -1) * (Date.parse(a.registration.createdAt) - Date.parse(b.registration.createdAt)));
}
