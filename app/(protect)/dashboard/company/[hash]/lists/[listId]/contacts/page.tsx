'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    EyeIcon,
    PencilSquareIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    FunnelIcon,
    UserGroupIcon,
    CalendarDaysIcon,
    EnvelopeIcon,
    ChartBarIcon,
    ClockIcon,
    UserPlusIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
} from '@heroicons/react/24/solid';

/* Recharts */
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
} from 'recharts';

type MemberItem = {
    id: number;
    subscribed_at: string | null;
    contact: {
        id: number;
        email: string | null;
        name: string | null;
        status: string | null;
    } | null;
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

type ListSummary = {
    id: number;
    name: string;
    created_at?: string | null;
    counts?: { contacts?: number | null; campaigns?: number | null };
};

type ContactSearchItem = {
    id: number;
    email: string | null;
    name: string | null;
    status: string | null;
};

/* ---------- Components ---------- */
function Toast({
                   kind = 'info',
                   text,
                   onClose,
               }: {
    kind?: 'info' | 'success' | 'error';
    text: string;
    onClose: () => void;
}) {
    const styles = {
        success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        error: 'bg-rose-50 border-rose-200 text-rose-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    return (
        <div
            className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border px-4 py-3 shadow-lg ${styles[kind]}`}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{text}</span>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1 hover:bg-white/40 transition-colors"
                    aria-label="Close"
                    title="Close"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function StatCard({
                      label,
                      value,
                      icon,
                      color,
                      subtitle,
                  }: {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'amber' | 'purple';
    subtitle?: string;
}) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        purple: 'from-purple-500 to-purple-600',
    };

    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className={`bg-gradient-to-r ${colors[color]} p-3`}>
                <div className="flex items-center justify-between text-white">
                    {icon}
                    <span className="text-xs font-medium uppercase tracking-wider opacity-90">{label}</span>
                </div>
            </div>
            <div className="p-4">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                {subtitle && (
                    <div className="mt-1 text-xs text-gray-600">{subtitle}</div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status?: string | null }) {
    if (!status) return <span className="text-gray-400">—</span>;

    const statusColors: Record<string, string> = {
        active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        subscribed: 'bg-blue-50 text-blue-700 border-blue-200',
        unsubscribed: 'bg-gray-50 text-gray-700 border-gray-200',
        bounced: 'bg-red-50 text-red-700 border-red-200',
        cleaned: 'bg-amber-50 text-amber-700 border-amber-200',
    };

    const colorClass = statusColors[status.toLowerCase()] || 'bg-gray-50 text-gray-700 border-gray-200';

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${colorClass}`}>
            {status}
        </span>
    );
}

export default function ContactsByListPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash, listId } = useParams<{ hash: string; listId: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();

    // State
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [listInfo, setListInfo] = useState<ListSummary | null>(null);
    const [data, setData] = useState<ApiListResponse<MemberItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);

    // Force-refetch
    const [reloadTick, setReloadTick] = useState(0);
    const refreshMembers = () => setReloadTick(t => t + 1);

    // Add-members modal
    const [addOpen, setAddOpen] = useState(false);
    const [pickQuery, setPickQuery] = useState('');
    const [pickDebounced, setPickDebounced] = useState('');
    const [pickLoading, setPickLoading] = useState(false);
    const [pickErr, setPickErr] = useState<string | null>(null);
    const [pickResults, setPickResults] = useState<ContactSearchItem[]>([]);
    const [pickSelected, setPickSelected] = useState<Set<number>>(new Set());
    const [addingBulk, setAddingBulk] = useState(false);
    const [addEmail, setAddEmail] = useState('');
    const [addingEmail, setAddingEmail] = useState(false);

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    // URLs
    const listInfoUrl = useMemo(
        () => `${backend}/companies/${hash}/lists/${listId}`,
        [backend, hash, listId]
    );

    const membersUrl = useMemo(() => {
        const sp = new URLSearchParams();
        sp.set('page', String(page));
        sp.set('perPage', String(perPage));
        sp.set('_r', String(reloadTick));
        return `${backend}/companies/${hash}/lists/${listId}/contacts?${sp.toString()}`;
    }, [backend, hash, listId, page, perPage, reloadTick]);

    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);

    // Fetch list info
    useEffect(() => {
        let abort = false;
        (async () => {
            try {
                const res = await fetch(listInfoUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load list (${res.status})`);
                const json: ListSummary = await res.json();
                if (!abort) setListInfo(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            }
        })();
        return () => { abort = true; };
    }, [listInfoUrl]);

    // Fetch members
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(membersUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load members (${res.status})`);
                const json: ApiListResponse<MemberItem> = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [membersUrl]);

    function showToast(kind: 'info' | 'success' | 'error', text: string) {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 3000);
    }

    function updateQuery(partial: Record<string, unknown>) {
        const sp = new URLSearchParams(search.toString());
        Object.entries(partial).forEach(([k, v]) => {
            if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) sp.delete(k);
            else sp.set(k, String(v));
        });
        router.replace(`?${sp.toString()}`);
    }

    function onSubmitSearch(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        updateQuery({ search: searchTerm, page: 1 });
    }

    function clearFilters() {
        setSearchTerm('');
        updateQuery({ search: undefined, page: 1 });
    }

    async function handleRemove(membershipId: number, contactId?: number | null) {
        if (!contactId) return;
        if (!confirm('Remove this contact from the list?')) return;
        setRemovingId(membershipId);
        try {
            const url = `${backend}/companies/${hash}/lists/${listId}/contacts/${contactId}`;
            const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok && res.status !== 204) throw new Error(`Remove failed (${res.status})`);

            setData(prev => prev
                ? {
                    ...prev,
                    items: prev.items.filter(i => i.id !== membershipId),
                    meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) },
                }
                : prev
            );
            showToast('success', 'Contact removed from list');
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to remove contact');
        } finally {
            setRemovingId(null);
        }
    }

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setPickDebounced(pickQuery.trim()), 300);
        return () => clearTimeout(t);
    }, [pickQuery]);

    // Fetch live results
    useEffect(() => {
        if (!addOpen) return;
        let abort = false;
        (async () => {
            setPickErr(null);
            setPickLoading(true);
            try {
                const sp = new URLSearchParams();
                sp.set('page', '1');
                sp.set('perPage', pickDebounced ? '20' : '10');
                if (pickDebounced) sp.set('search', pickDebounced);
                const url = `${backend}/companies/${hash}/contacts?${sp.toString()}`;
                const res = await fetch(url, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Search failed (${res.status})`);
                const json: ApiListResponse<ContactSearchItem> = await res.json();

                const existingIds = new Set<number>(
                    (data?.items || [])
                        .map(m => m.contact?.id)
                        .filter((id): id is number => typeof id === 'number')
                );
                const results = (json.items || []).filter(c => !existingIds.has(c.id));
                if (!abort) setPickResults(results);
            } catch (e) {
                if (!abort) setPickErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setPickLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [addOpen, pickDebounced, backend, hash, data?.items]);

    function togglePick(id: number) {
        setPickSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    async function addSelectedToList() {
        if (pickSelected.size === 0) return;
        setAddingBulk(true);
        try {
            const ids = Array.from(pickSelected);
            for (const cid of ids) {
                const res = await fetch(`${backend}/companies/${hash}/lists/${listId}/contacts`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ contact_id: cid }),
                });
                if (!res.ok) throw new Error(`Failed to add contact #${cid} (${res.status})`);
            }

            setPickSelected(new Set());
            setPickQuery('');
            setAddOpen(false);
            refreshMembers();

            showToast('success', `Added ${ids.length} contact(s) to the list`);

            fetch(listInfoUrl, { headers: authHeaders() })
                .then(r => (r.ok ? r.json() : null))
                .then(json => json && setListInfo(json))
                .catch(() => {});
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to add contacts');
        } finally {
            setAddingBulk(false);
        }
    }

    async function addOneByEmail() {
        const email = addEmail.trim().toLowerCase();
        if (!email) return;
        setAddingEmail(true);
        try {
            const res = await fetch(`${backend}/companies/${hash}/lists/${listId}/contacts`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ email }),
            });
            if (!res.ok) throw new Error(`Failed to add ${email} (${res.status})`);

            setAddEmail('');
            setAddOpen(false);
            refreshMembers();

            showToast('success', `Added ${email} to the list`);

            fetch(listInfoUrl, { headers: authHeaders() })
                .then(r => (r.ok ? r.json() : null))
                .then(json => json && setListInfo(json))
                .catch(() => {});
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to add contact');
        } finally {
            setAddingEmail(false);
        }
    }

    const backHref = `/dashboard/company/${hash}/lists`;
    const toLocale = (s?: string | null) => {
        if (!s) return '—';
        try {
            return new Date(s).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return s;
        }
    };

    // Stats calculations
    const stats = useMemo(() => {
        const items = data?.items ?? [];
        const total = items.length;
        const withEmail = items.filter(m => m.contact?.email).length;
        const statuses = items.reduce((acc, m) => {
            const status = m.contact?.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const todayCount = items.filter(m => {
            if (!m.subscribed_at) return false;
            const subDate = new Date(m.subscribed_at).toDateString();
            const today = new Date().toDateString();
            return subDate === today;
        }).length;

        return { total, withEmail, statuses, todayCount };
    }, [data]);

    // Chart data for status distribution
    const chartData = useMemo(() => {
        return Object.entries(stats.statuses).map(([status, count]) => ({
            name: status,
            value: count,
        }));
    }, [stats]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-32 rounded-xl bg-gray-200" />
                            ))}
                        </div>
                        <div className="h-96 rounded-xl bg-gray-200" />
                    </div>
                </div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <XMarkIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading List</h2>
                    </div>
                    <p className="text-gray-600">{err}</p>
                    <button
                        onClick={() => router.push(backHref)}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Lists
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { items, meta } = data;

    // Client-side filter
    const filtered = items.filter(m => {
        if (!searchTerm) return true;
        const needle = searchTerm.toLowerCase();
        const c = m.contact;
        return (
            (c?.email || '').toLowerCase().includes(needle) ||
            (c?.name || '').toLowerCase().includes(needle) ||
            (c?.status || '').toLowerCase().includes(needle)
        );
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {toast && <Toast kind={toast.kind} text={toast.text} onClose={() => setToast(null)} />}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(backHref)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Lists
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {listInfo?.name ?? `List #${listId}`}
                            </h1>
                            <p className="text-sm text-gray-500">
                                {meta.total} {meta.total === 1 ? 'member' : 'members'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setAddOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm"
                    >
                        <UserPlusIcon className="h-5 w-5" />
                        Add Members
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Members"
                        value={meta.total}
                        icon={<UserGroupIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="With Email"
                        value={stats.withEmail}
                        icon={<EnvelopeIcon className="h-5 w-5" />}
                        color="emerald"
                        subtitle={`${Math.round((stats.withEmail / Math.max(1, meta.total)) * 100)}% of total`}
                    />
                    <StatCard
                        label="Added Today"
                        value={stats.todayCount}
                        icon={<CalendarDaysIcon className="h-5 w-5" />}
                        color="purple"
                    />
                    <StatCard
                        label="Unique Statuses"
                        value={Object.keys(stats.statuses).length}
                        icon={<ChartBarIcon className="h-5 w-5" />}
                        color="amber"
                    />
                </div>

                {/* Chart */}
                {chartData.length > 0 && (
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <ChartBarIcon className="h-5 w-5" />
                                    <h3 className="text-sm font-semibold uppercase tracking-wider">
                                        Status Distribution
                                    </h3>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={(entry) => `${entry.name}: ${entry.value}`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Search/Filter Bar */}
                <form onSubmit={onSubmitSearch} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <FunnelIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Filter Members</h3>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    name="search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Filter this page (name, email, status)…"
                                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                                        aria-label="Clear search"
                                        title="Clear search"
                                    >
                                        <XMarkIcon className="h-4 w-4 text-gray-500" />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Per page:</label>
                                <select
                                    value={perPage}
                                    onChange={(e) => updateQuery({ perPage: e.target.value, page: 1 })}
                                    className="rounded-lg border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                            >
                                <MagnifyingGlassIcon className="h-4 w-4" />
                                Apply
                            </button>

                            <button
                                type="button"
                                onClick={clearFilters}
                                disabled={!qFromUrl && page === 1}
                                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </form>

                {/* Table */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Name
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Email
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Subscribed
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Actions
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-12 text-center text-gray-500" colSpan={5}>
                                        <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No contacts found</h3>
                                        <p className="text-sm text-gray-500">Try adjusting your filters or add new members</p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((m) => {
                                    const c = m.contact;
                                    const email = c?.email ?? '';
                                    return (
                                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">
                                                    {c?.name || <span className="text-gray-400 italic">(no name)</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {email ? (
                                                    <div className="flex items-center gap-1">
                                                        <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                                                        <span className="font-mono text-sm text-gray-700">{email}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={c?.status} />
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                <div className="flex items-center gap-1">
                                                    <ClockIcon className="h-4 w-4 text-gray-400" />
                                                    {toLocale(m.subscribed_at)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {email ? (
                                                        <>
                                                            <Link
                                                                href={`/dashboard/company/${hash}/contacts/detail?email=${encodeURIComponent(email)}`}
                                                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                                                title="View"
                                                            >
                                                                <EyeIcon className="h-3.5 w-3.5" />
                                                                View
                                                            </Link>
                                                            <Link
                                                                href={`/dashboard/company/${hash}/contacts/edit?email=${encodeURIComponent(email)}`}
                                                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 transition-colors"
                                                                title="Edit"
                                                            >
                                                                <PencilSquareIcon className="h-3.5 w-3.5" />
                                                                Edit
                                                            </Link>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">no actions</span>
                                                    )}
                                                    <button
                                                        onClick={() => handleRemove(m.id, c?.id)}
                                                        disabled={removingId === m.id}
                                                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 transition-colors disabled:opacity-50"
                                                        title="Remove from list"
                                                    >
                                                        <TrashIcon className="h-3.5 w-3.5" />
                                                        {removingId === m.id ? 'Removing…' : 'Remove'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between rounded-xl bg-white shadow-sm ring-1 ring-gray-200 px-6 py-4">
                    <div className="text-sm text-gray-700">
                        Showing <span className="font-semibold">{((meta.page - 1) * meta.perPage) + 1}</span> to{' '}
                        <span className="font-semibold">{Math.min(meta.page * meta.perPage, meta.total)}</span> of{' '}
                        <span className="font-semibold">{meta.total}</span> results
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => updateQuery({ page: Math.max(1, meta.page - 1) })}
                            disabled={meta.page <= 1}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Previous
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                                const pageNum = i + 1;
                                const isActive = pageNum === meta.page;

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => updateQuery({ page: pageNum })}
                                        className={`h-8 w-8 rounded-lg text-sm font-medium transition-all ${
                                            isActive
                                                ? 'bg-indigo-500 text-white shadow-sm'
                                                : 'bg-white text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            {meta.totalPages > 5 && (
                                <>
                                    <span className="px-2 text-gray-400">...</span>
                                    <button
                                        onClick={() => updateQuery({ page: meta.totalPages })}
                                        className={`h-8 px-2 rounded-lg text-sm font-medium transition-all ${
                                            meta.page === meta.totalPages
                                                ? 'bg-indigo-500 text-white shadow-sm'
                                                : 'bg-white text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200'
                                        }`}
                                    >
                                        {meta.totalPages}
                                    </button>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => updateQuery({ page: Math.min(meta.totalPages, meta.page + 1) })}
                            disabled={meta.page >= meta.totalPages}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Next
                            <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                        </button>
                    </div>
                </div>

                {/* Add Members Modal */}
                {addOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
                        <div className="relative bg-white w-full max-w-2xl rounded-xl shadow-2xl border overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-white">
                                        Add Members to &#34;{listInfo?.name ?? `List #${listId}`}&#34;
                                    </h2>
                                    <button
                                        onClick={() => setAddOpen(false)}
                                        className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                                        aria-label="Close"
                                    >
                                        <XMarkIcon className="h-5 w-5 text-white" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Add by email */}
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                                    <label className="block text-sm font-semibold text-gray-700">Quick Add by Email</label>
                                    <div className="flex gap-2">
                                        <input
                                            value={addEmail}
                                            onChange={(e) => setAddEmail(e.target.value)}
                                            placeholder="user@example.com"
                                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        />
                                        <button
                                            onClick={addOneByEmail}
                                            disabled={addingEmail || !addEmail.trim()}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                        >
                                            <CheckCircleSolid className="h-5 w-5" />
                                            {addingEmail ? 'Adding…' : 'Add'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500">If the email doesn&#39;t exist yet, it will be created and subscribed.</p>
                                </div>

                                {/* Live search */}
                                <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                                    <label className="block text-sm font-semibold text-gray-700">Search Existing Contacts</label>
                                    <div className="relative">
                                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            value={pickQuery}
                                            onChange={(e) => setPickQuery(e.target.value)}
                                            placeholder="Search contacts…"
                                            className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        />
                                        {pickQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setPickQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                                                aria-label="Clear"
                                            >
                                                <XMarkIcon className="h-4 w-4 text-gray-500" />
                                            </button>
                                        )}
                                    </div>

                                    {pickErr && (
                                        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                                            <p className="text-sm text-red-700">{pickErr}</p>
                                        </div>
                                    )}

                                    {pickLoading ? (
                                        <p className="text-sm text-gray-600">Searching…</p>
                                    ) : (
                                        <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
                                            {pickResults.length === 0 ? (
                                                <div className="p-8 text-center">
                                                    <UserGroupIcon className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                                                    <p className="text-sm text-gray-500">No contacts found</p>
                                                </div>
                                            ) : (
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-3 py-2 w-10"></th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                                                    </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                    {pickResults.map(c => {
                                                        const checked = pickSelected.has(c.id);
                                                        return (
                                                            <tr key={c.id} className="hover:bg-gray-50">
                                                                <td className="px-3 py-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={() => togglePick(c.id)}
                                                                        className="rounded text-blue-600 focus:ring-blue-500"
                                                                        aria-label={`Select ${c.email ?? c.name ?? c.id}`}
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-2 text-sm">
                                                                    {c.name || <span className="text-gray-400 italic">(no name)</span>}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <span className="font-mono text-xs text-gray-700">{c.email ?? '—'}</span>
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <StatusBadge status={c.status} />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-sm text-gray-600">
                                            {pickSelected.size} contact(s) selected
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setAddOpen(false)}
                                                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={addSelectedToList}
                                                disabled={addingBulk || pickSelected.size === 0}
                                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                            >
                                                <CheckCircleSolid className="h-5 w-5" />
                                                {addingBulk ? 'Adding…' : `Add ${pickSelected.size} Selected`}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}