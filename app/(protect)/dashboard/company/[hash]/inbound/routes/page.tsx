'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    FunnelIcon,
    GlobeAltIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    ArrowPathIcon,
    InboxArrowDownIcon,
    PaperAirplaneIcon,
    ArchiveBoxIcon,
    StopIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type DomainBrief = { id: number; domain: string | null };

type DestinationForward = { type: 'forward'; to: string[] };
type DestinationStore = { type: 'store'; notify?: string[] };
type DestinationStop = { type: 'stop' };
type DestinationOther = { type?: string; [key: string]: unknown };

type Destination = DestinationForward | DestinationStore | DestinationStop | DestinationOther;

type InboundRouteItem = {
    id: number;
    pattern: string | null;
    action: string | null;
    destination: Destination | null;
    spam_threshold: number | null;
    dkim_required: number | null;
    tls_required: number | null;
    created_at: string | null;
    domain: { id: number; domain: string | null } | null;
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ----------------------------- Helpers ----------------------------- */

function getActionConfig(action?: string | null) {
    const normalized = (action || '').toLowerCase();
    if (normalized === 'forward') {
        return {
            label: 'Forward',
            icon: PaperAirplaneIcon,
            bgClass: 'bg-blue-50',
            textClass: 'text-blue-700',
            borderClass: 'border-blue-200',
        };
    } else if (normalized === 'store') {
        return {
            label: 'Store',
            icon: ArchiveBoxIcon,
            bgClass: 'bg-emerald-50',
            textClass: 'text-emerald-700',
            borderClass: 'border-emerald-200',
        };
    } else if (normalized === 'stop') {
        return {
            label: 'Stop',
            icon: StopIcon,
            bgClass: 'bg-red-50',
            textClass: 'text-red-700',
            borderClass: 'border-red-200',
        };
    } else {
        return {
            label: action || 'Unknown',
            icon: ArrowPathIcon,
            bgClass: 'bg-gray-50',
            textClass: 'text-gray-700',
            borderClass: 'border-gray-200',
        };
    }
}

function StatCard({ label, value, icon, color }: {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'amber' | 'purple';
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
                <div className="text-2xl font-bold text-gray-900">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
            </div>
        </div>
    );
}

/* ----------------------------- Page ----------------------------- */

export default function InboundRoutesListPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();
    const domainFromUrl = search.get('domainId') || '';

    // Controlled inputs
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [domainId, setDomainId] = useState<string>(domainFromUrl);
    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);
    useEffect(() => setDomainId(domainFromUrl), [domainFromUrl]);

    // Data state
    const [data, setData] = useState<ApiListResponse<InboundRouteItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Domains for filter
    const [domains, setDomains] = useState<DomainBrief[]>([]);
    const [domainsErr, setDomainsErr] = useState<string | null>(null);

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const listUrl = useMemo(() => {
        const sp = new URLSearchParams();
        sp.set('page', String(page));
        sp.set('perPage', String(perPage));
        if (qFromUrl) sp.set('search', qFromUrl);
        if (domainFromUrl) sp.set('domainId', domainFromUrl);
        return `${backend}/companies/${hash}/inbound-routes?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl, domainFromUrl]);

    // Fetch routes
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load inbound routes (${res.status})`);
                const json: ApiListResponse<InboundRouteItem> = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [listUrl]);

    // Fetch domains for filter dropdown
    useEffect(() => {
        let abort = false;
        (async () => {
            setDomainsErr(null);
            try {
                const url = `${backend}/companies/${hash}/domains`;
                const res = await fetch(url, { headers: authHeaders() });
                if (res.ok) {
                    const list = (await res.json()) as DomainBrief[];
                    const norm: DomainBrief[] = list.map(d => ({ id: d.id, domain: d.domain ?? null }));
                    if (!abort) setDomains(norm);
                } else {
                    if (!abort) setDomainsErr(`Failed to load domains (${res.status})`);
                }
            } catch (e) {
                if (!abort) setDomainsErr(e instanceof Error ? e.message : 'Failed to load domains');
            }
        })();
        return () => { abort = true; };
    }, [backend, hash]);

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
        updateQuery({ search: searchTerm, domainId, page: 1 });
    }

    function clearFilters() {
        setSearchTerm('');
        setDomainId('');
        updateQuery({ search: undefined, domainId: undefined, page: 1 });
    }

    async function handleDelete(id: number) {
        if (!confirm('Are you sure you want to delete this route? This action cannot be undone.')) return;
        setDeletingId(id);
        try {
            const url = `${backend}/companies/${hash}/inbound-routes/${id}`;
            const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            setData(prev => prev
                ? { ...prev, items: prev.items.filter(i => i.id !== id), meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) } }
                : prev);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    const backHref   = `/dashboard/company/${hash}`;
    const createHref = `/dashboard/company/${hash}/inbound/routes/create`;
    const editHref   = (id: number) => `/dashboard/company/${hash}/inbound/routes/${id}`;

    const toLocale = (s?: string | null, format: 'full' | 'short' = 'short') => {
        if (!s) return '—';
        try {
            const date = new Date(s);
            if (format === 'full') {
                return date.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                });
            }
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return s;
        }
    };

    const yesNo = (v?: number | null) => {
        if (v === 1) return { text: 'Yes', class: 'text-emerald-600' };
        if (v === 0) return { text: 'No', class: 'text-gray-400' };
        return { text: '—', class: 'text-gray-400' };
    };

    const destSummary = (r: InboundRouteItem) => {
        const d = r.destination;
        if (!d || typeof d !== 'object') return '—';

        if ('type' in d) {
            switch (d.type) {
                case 'forward':
                    return Array.isArray(d.to) && d.to.length ? d.to.join(', ') : '(no destinations)';
                case 'store':
                    return Array.isArray(d.notify) && d.notify.length ? d.notify.join(', ') : '(store only)';
                case 'stop':
                    return '(stop processing)';
                default:
                    return '—';
            }
        }
        return '—';
    };

    // Calculate stats
    const stats = useMemo(() => {
        const items = data?.items || [];
        let forwardCount = 0;
        let storeCount = 0;
        let stopCount = 0;

        items.forEach(r => {
            const action = (r.action || '').toLowerCase();
            if (action === 'forward') forwardCount++;
            else if (action === 'store') storeCount++;
            else if (action === 'stop') stopCount++;
        });

        return {
            total: data?.meta.total || 0,
            forward: forwardCount,
            store: storeCount,
            stop: stopCount,
        };
    }, [data]);

    if (loading) {
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
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Routes</h2>
                    </div>
                    <p className="text-gray-600">{err}</p>
                    <button
                        onClick={() => router.push(backHref)}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { items, meta } = data;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(backHref)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Dashboard
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Inbound Routes</h1>
                            <p className="text-sm text-gray-500">
                                {meta.total.toLocaleString()} total routes configured
                            </p>
                        </div>
                    </div>

                    <Link
                        href={createHref}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-700 transition-all"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New Route
                    </Link>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Routes"
                        value={stats.total}
                        icon={<InboxArrowDownIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="Forward Routes"
                        value={stats.forward}
                        icon={<PaperAirplaneIcon className="h-5 w-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="Store Routes"
                        value={stats.store}
                        icon={<ArchiveBoxIcon className="h-5 w-5" />}
                        color="amber"
                    />
                    <StatCard
                        label="Stop Routes"
                        value={stats.stop}
                        icon={<StopIcon className="h-5 w-5" />}
                        color="purple"
                    />
                </div>

                {/* Filters */}
                <form onSubmit={onSubmitSearch} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <FunnelIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Filters & Search</h3>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Search */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <MagnifyingGlassIcon className="inline h-4 w-4 mr-1" />
                                    Search
                                </label>
                                <input
                                    name="search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Pattern or action..."
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 pr-8"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2 top-1/2 translate-y-1 p-1 rounded hover:bg-gray-100"
                                    >
                                        <XMarkIcon className="h-4 w-4 text-gray-500" />
                                    </button>
                                )}
                            </div>

                            {/* Domain */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <GlobeAltIcon className="inline h-4 w-4 mr-1" />
                                    Domain
                                </label>
                                <select
                                    value={domainId}
                                    onChange={(e) => setDomainId(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">All domains</option>
                                    {domains.map(d => (
                                        <option key={d.id} value={d.id}>{d.domain ?? `#${d.id}`}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Per page */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Results per page
                                </label>
                                <select
                                    value={perPage}
                                    onChange={(e) => updateQuery({ perPage: e.target.value, page: 1 })}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                                {(searchTerm || domainId) && (
                                    <span>Filters active</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                                >
                                    Clear All
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                                >
                                    <MagnifyingGlassIcon className="h-4 w-4" />
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Routes Table */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Pattern
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Action
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Destination
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Spam
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    DKIM
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    TLS
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Domain
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Created
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Actions
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {items.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-12 text-center text-gray-500" colSpan={9}>
                                        <InboxArrowDownIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                                        <p className="text-sm font-medium">No routes found</p>
                                        <p className="text-xs text-gray-400 mt-1">Create your first route to start processing inbound messages</p>
                                    </td>
                                </tr>
                            ) : (
                                items.map((r) => {
                                    const actionConfig = getActionConfig(r.action);
                                    const ActionIcon = actionConfig.icon;
                                    const dkimStatus = yesNo(r.dkim_required);
                                    const tlsStatus = yesNo(r.tls_required);

                                    return (
                                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <code className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                                    {r.pattern || '*'}
                                                </code>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${actionConfig.bgClass} ${actionConfig.textClass}`}>
                                                        <ActionIcon className="h-3 w-3" />
                                                        {actionConfig.label}
                                                    </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                    <span className="text-sm text-gray-600 truncate max-w-xs block">
                                                        {destSummary(r)}
                                                    </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {r.spam_threshold !== null ? (
                                                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                                                            {r.spam_threshold}
                                                        </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    {r.dkim_required === 1 && <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />}
                                                    <span className={`text-sm ${dkimStatus.class}`}>{dkimStatus.text}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    {r.tls_required === 1 && <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />}
                                                    <span className={`text-sm ${tlsStatus.class}`}>{tlsStatus.text}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {r.domain ? (
                                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                            {r.domain.domain || `#${r.domain.id}`}
                                                        </span>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">All</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500">
                                                <div className="flex items-center gap-1">
                                                    <ClockIcon className="h-3.5 w-3.5" />
                                                    {toLocale(r.created_at)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        href={editHref(r.id)}
                                                        className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                                                    >
                                                        <PencilSquareIcon className="h-3.5 w-3.5" />
                                                        Edit
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(r.id)}
                                                        disabled={deletingId === r.id}
                                                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-sm ring-1 transition-all ${
                                                            deletingId === r.id
                                                                ? 'bg-red-100 text-red-400 ring-red-200 cursor-not-allowed'
                                                                : 'bg-white text-red-600 ring-red-200 hover:bg-red-50'
                                                        }`}
                                                    >
                                                        <TrashIcon className="h-3.5 w-3.5" />
                                                        {deletingId === r.id ? 'Deleting...' : 'Delete'}
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
                        <span className="font-semibold">{meta.total.toLocaleString()}</span> results
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

                {/* Domain Error */}
                {domainsErr && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                        <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                            <p className="text-sm text-amber-800">{domainsErr}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}