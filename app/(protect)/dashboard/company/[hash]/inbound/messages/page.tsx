'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Brush,
} from 'recharts';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    FunnelIcon,
    ChartBarIcon,
    InboxArrowDownIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    GlobeAltIcon,
    CalendarDaysIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    AdjustmentsHorizontalIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
    XCircleIcon as XCircleSolid,
} from '@heroicons/react/24/solid';

/* ----------------------------- Types ----------------------------- */

type DomainBrief = { id: number; domain: string | null };

type InboundMessage = {
    id: number;
    from_email: string | null;
    subject: string | null;
    raw_mime_ref: string | null;
    spam_score: number | null;
    dkim_result: string | null;
    dmarc_result: string | null;
    arc_result: string | null;
    received_at: string | null; // ISO8601
    domain: { id: number; domain: string | null } | null;
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ----------------------------- Helpers ----------------------------- */

const toLocale = (s?: string | null, format: 'full' | 'short' | 'time' = 'short') => {
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
                second: '2-digit'
            });
        } else if (format === 'time') {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Build a YYYY-MM-DD key for chart bucketing */
const dayKey = (iso?: string | null): string => {
    if (!iso) return 'unknown';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'unknown';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

function getAuthResultConfig(result?: string | null) {
    const normalized = (result || '').toLowerCase();
    if (normalized === 'pass') {
        return {
            label: 'Pass',
            icon: CheckCircleSolid,
            bgClass: 'bg-emerald-50',
            textClass: 'text-emerald-700',
            borderClass: 'border-emerald-200',
        };
    } else if (normalized === 'fail') {
        return {
            label: 'Fail',
            icon: XCircleSolid,
            bgClass: 'bg-red-50',
            textClass: 'text-red-700',
            borderClass: 'border-red-200',
        };
    } else {
        return {
            label: result || 'None',
            icon: ExclamationTriangleIcon,
            bgClass: 'bg-gray-50',
            textClass: 'text-gray-700',
            borderClass: 'border-gray-200',
        };
    }
}

function getSpamScoreConfig(score?: number | null) {
    if (score === null || score === undefined) {
        return {
            label: '—',
            bgClass: 'bg-gray-50',
            textClass: 'text-gray-600',
            borderClass: 'border-gray-200',
        };
    }
    if (score < 3) {
        return {
            label: score.toFixed(1),
            bgClass: 'bg-emerald-50',
            textClass: 'text-emerald-700',
            borderClass: 'border-emerald-200',
        };
    } else if (score < 5) {
        return {
            label: score.toFixed(1),
            bgClass: 'bg-amber-50',
            textClass: 'text-amber-700',
            borderClass: 'border-amber-200',
        };
    } else {
        return {
            label: score.toFixed(1),
            bgClass: 'bg-red-50',
            textClass: 'text-red-700',
            borderClass: 'border-red-200',
        };
    }
}

function StatCard({ label, value, change, icon, color }: {
    label: string;
    value: number | string;
    change?: number;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'amber' | 'red' | 'purple';
}) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        red: 'from-red-500 to-red-600',
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
                {change !== undefined && (
                    <div className={`mt-1 text-xs ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% from previous
                    </div>
                )}
            </div>
        </div>
    );
}

/* ----------------------------- Page ----------------------------- */

export default function InboundMessagesListPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = clamp(parseInt(search.get('perPage') || '25', 10) || 25, 1, 200);

    const qFromUrl       = (search.get('search') || '').trim();
    const domainFromUrl  = (search.get('domainId') || '').trim();
    const minSpamFromUrl = (search.get('minSpam') || '').trim();
    const maxSpamFromUrl = (search.get('maxSpam') || '').trim();
    const fromDateUrl    = (search.get('receivedFrom') || '').trim();
    const toDateUrl      = (search.get('receivedTo') || '').trim();
    const dkimFromUrl    = (search.get('dkim') || '').trim();
    const dmarcFromUrl   = (search.get('dmarc') || '').trim();
    const arcFromUrl     = (search.get('arc') || '').trim();

    // Controlled inputs
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [domainId, setDomainId] = useState<string>(domainFromUrl);
    const [minSpam, setMinSpam] = useState<string>(minSpamFromUrl);
    const [maxSpam, setMaxSpam] = useState<string>(maxSpamFromUrl);
    const [receivedFrom, setReceivedFrom] = useState<string>(fromDateUrl);
    const [receivedTo, setReceivedTo] = useState<string>(toDateUrl);
    const [dkim, setDkim] = useState<string>(dkimFromUrl);
    const [dmarc, setDmarc] = useState<string>(dmarcFromUrl);
    const [arc, setArc] = useState<string>(arcFromUrl);

    // Advanced section toggle
    const [showAdvanced, setShowAdvanced] = useState<boolean>(
        Boolean(minSpamFromUrl || maxSpamFromUrl || fromDateUrl || toDateUrl || dkimFromUrl || dmarcFromUrl || arcFromUrl)
    );

    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);
    useEffect(() => setDomainId(domainFromUrl), [domainFromUrl]);
    useEffect(() => setMinSpam(minSpamFromUrl), [minSpamFromUrl]);
    useEffect(() => setMaxSpam(maxSpamFromUrl), [maxSpamFromUrl]);
    useEffect(() => setReceivedFrom(fromDateUrl), [fromDateUrl]);
    useEffect(() => setReceivedTo(toDateUrl), [toDateUrl]);
    useEffect(() => setDkim(dkimFromUrl), [dkimFromUrl]);
    useEffect(() => setDmarc(dmarcFromUrl), [dmarcFromUrl]);
    useEffect(() => setArc(arcFromUrl), [arcFromUrl]);

    // Data state
    const [data, setData] = useState<ApiListResponse<InboundMessage> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Domains for filter dropdown
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
        if (qFromUrl)       sp.set('search', qFromUrl);
        if (domainFromUrl)  sp.set('domainId', domainFromUrl);
        if (minSpamFromUrl) sp.set('minSpam', minSpamFromUrl);
        if (maxSpamFromUrl) sp.set('maxSpam', maxSpamFromUrl);
        if (fromDateUrl)    sp.set('receivedFrom', fromDateUrl);
        if (toDateUrl)      sp.set('receivedTo', toDateUrl);
        if (dkimFromUrl)    sp.set('dkim', dkimFromUrl);
        if (dmarcFromUrl)   sp.set('dmarc', dmarcFromUrl);
        if (arcFromUrl)     sp.set('arc', arcFromUrl);
        return `${backend}/companies/${hash}/inbound-messages?${sp.toString()}`;
    }, [
        backend, hash, page, perPage, qFromUrl, domainFromUrl, minSpamFromUrl,
        maxSpamFromUrl, fromDateUrl, toDateUrl, dkimFromUrl, dmarcFromUrl, arcFromUrl
    ]);

    // Fetch messages
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load inbound messages (${res.status})`);
                const json: ApiListResponse<InboundMessage> = await res.json();
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
        updateQuery({
            search:       searchTerm,
            domainId:     domainId,
            minSpam:      minSpam,
            maxSpam:      maxSpam,
            receivedFrom: receivedFrom,
            receivedTo:   receivedTo,
            dkim,
            dmarc,
            arc,
            page: 1,
        });
    }

    function clearFilters() {
        setSearchTerm('');
        setDomainId('');
        setMinSpam('');
        setMaxSpam('');
        setReceivedFrom('');
        setReceivedTo('');
        setDkim('');
        setDmarc('');
        setArc('');
        updateQuery({
            search: undefined,
            domainId: undefined,
            minSpam: undefined,
            maxSpam: undefined,
            receivedFrom: undefined,
            receivedTo: undefined,
            dkim: undefined,
            dmarc: undefined,
            arc: undefined,
            page: 1
        });
    }

    function applyQuickRange(days: number) {
        const now = new Date();
        const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const from = new Date(to);
        from.setUTCDate(to.getUTCDate() - (days - 1));

        // Convert to datetime-local format
        const fromStr = from.toISOString().slice(0, 16);
        const toStr = to.toISOString().slice(0, 16);

        setReceivedFrom(fromStr);
        setReceivedTo(toStr);
        updateQuery({ receivedFrom: fromStr, receivedTo: toStr, page: 1 });
    }

    const backHref = `/dashboard/company/${hash}`;

    /* ----------------------------- Chart data ----------------------------- */
    const chartPoints = useMemo(() => {
        const map = new Map<string, number>();
        (data?.items || []).forEach(m => {
            const k = dayKey(m.received_at);
            if (k !== 'unknown') {
                map.set(k, (map.get(k) || 0) + 1);
            }
        });
        const arr = Array.from(map.entries())
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([date, count]) => ({ date, count }));
        return arr;
    }, [data]);

    // Calculate stats
    const stats = useMemo(() => {
        const items = data?.items || [];
        let passCount = 0;
        let failCount = 0;
        let highSpamCount = 0;

        items.forEach(m => {
            if (m.dkim_result?.toLowerCase() === 'pass') passCount++;
            if (m.dmarc_result?.toLowerCase() === 'pass') passCount++;
            if (m.dkim_result?.toLowerCase() === 'fail') failCount++;
            if (m.dmarc_result?.toLowerCase() === 'fail') failCount++;
            if ((m.spam_score || 0) >= 5) highSpamCount++;
        });

        return {
            total: data?.meta.total || 0,
            authPass: passCount,
            authFail: failCount,
            highSpam: highSpamCount,
        };
    }, [data]);

    /* ----------------------------- Render ----------------------------- */

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
                        <h2 className="text-lg font-semibold">Error Loading Messages</h2>
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

    // Active filter chips
    const chips: Array<{ key: string; label: string }> = [];
    if (searchTerm) chips.push({ key: 'search', label: `Search: ${searchTerm}` });
    if (domainId) chips.push({ key: 'domainId', label: `Domain: ${domains.find(d => String(d.id) === domainId)?.domain ?? '#' + domainId}` });
    if (minSpam) chips.push({ key: 'minSpam', label: `Min spam: ${minSpam}` });
    if (maxSpam) chips.push({ key: 'maxSpam', label: `Max spam: ${maxSpam}` });
    if (receivedFrom) chips.push({ key: 'receivedFrom', label: `From: ${new Date(receivedFrom).toLocaleDateString()}` });
    if (receivedTo) chips.push({ key: 'receivedTo', label: `To: ${new Date(receivedTo).toLocaleDateString()}` });
    if (dkim) chips.push({ key: 'dkim', label: `DKIM: ${dkim}` });
    if (dmarc) chips.push({ key: 'dmarc', label: `DMARC: ${dmarc}` });
    if (arc) chips.push({ key: 'arc', label: `ARC: ${arc}` });

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
                            <h1 className="text-2xl font-bold text-gray-900">Inbound Messages</h1>
                            <p className="text-sm text-gray-500">
                                {meta.total.toLocaleString()} total messages received
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Messages"
                        value={stats.total}
                        icon={<InboxArrowDownIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="Auth Passed"
                        value={stats.authPass}
                        icon={<CheckCircleIcon className="h-5 w-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="Auth Failed"
                        value={stats.authFail}
                        icon={<XCircleIcon className="h-5 w-5" />}
                        color="red"
                    />
                    <StatCard
                        label="High Spam Score"
                        value={stats.highSpam}
                        icon={<ExclamationTriangleIcon className="h-5 w-5" />}
                        color="amber"
                    />
                </div>

                {/* Chart */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <ChartBarIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">
                                    Message Volume Over Time
                                </h3>
                            </div>
                            <div className="text-xs text-indigo-100">
                                {chartPoints.length} days with data
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={chartPoints} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                                <defs>
                                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    tickMargin={10}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    tickMargin={10}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fill="url(#colorMessages)"
                                />
                                <Brush
                                    dataKey="date"
                                    height={25}
                                    stroke="#9ca3af"
                                    fill="#f9fafb"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Filters */}
                <form onSubmit={onSubmitSearch} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <FunnelIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Filters</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-purple-100">
                                    {chips.length} active
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Quick Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Quick Ranges:</span>
                            {[
                                { label: 'Today', days: 1, icon: <CalendarDaysIcon className="h-3.5 w-3.5" /> },
                                { label: 'Last 7 Days', days: 7 },
                                { label: 'Last 30 Days', days: 30 },
                                { label: 'Last 90 Days', days: 90 },
                            ].map(({ label, days, icon }) => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => applyQuickRange(days)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                                >
                                    {icon}
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Main Filters Grid */}
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
                                    placeholder="Subject, from address, MIME ref…"
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

                        {/* Active filter chips */}
                        {chips.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {chips.map(c => (
                                    <span
                                        key={c.key}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 ring-1 ring-purple-200"
                                    >
                                        {c.label}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updates: Record<string, string | number | undefined> = { [c.key]: undefined, page: 1 };
                                                updateQuery(updates);
                                                // Reset the local state for this field
                                                if (c.key === 'search') setSearchTerm('');
                                                if (c.key === 'domainId') setDomainId('');
                                                if (c.key === 'minSpam') setMinSpam('');
                                                if (c.key === 'maxSpam') setMaxSpam('');
                                                if (c.key === 'receivedFrom') setReceivedFrom('');
                                                if (c.key === 'receivedTo') setReceivedTo('');
                                                if (c.key === 'dkim') setDkim('');
                                                if (c.key === 'dmarc') setDmarc('');
                                                if (c.key === 'arc') setArc('');
                                            }}
                                            className="rounded-full hover:bg-purple-200 p-0.5 transition-colors"
                                        >
                                            <XMarkIcon className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Advanced Filters */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <AdjustmentsHorizontalIcon className="h-4 w-4" />
                                    Advanced Filters
                                </div>
                                {showAdvanced ? (
                                    <ChevronUpIcon className="h-4 w-4" />
                                ) : (
                                    <ChevronDownIcon className="h-4 w-4" />
                                )}
                            </button>

                            {showAdvanced && (
                                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-200">
                                    {/* Spam Score Range */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Spam Score Range
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                value={minSpam}
                                                onChange={(e) => setMinSpam(e.target.value)}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                placeholder="Min"
                                                type="number"
                                                step="0.1"
                                            />
                                            <input
                                                value={maxSpam}
                                                onChange={(e) => setMaxSpam(e.target.value)}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                placeholder="Max"
                                                type="number"
                                                step="0.1"
                                            />
                                        </div>
                                    </div>

                                    {/* Date Range */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Received Date Range
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="datetime-local"
                                                value={receivedFrom}
                                                onChange={(e) => setReceivedFrom(e.target.value)}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            />
                                            <input
                                                type="datetime-local"
                                                value={receivedTo}
                                                onChange={(e) => setReceivedTo(e.target.value)}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Authentication Results */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Authentication Results
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <select
                                                value={dkim}
                                                onChange={(e) => setDkim(e.target.value)}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                                                title="DKIM"
                                            >
                                                <option value="">DKIM: Any</option>
                                                <option value="pass">DKIM: Pass</option>
                                                <option value="fail">DKIM: Fail</option>
                                                <option value="none">DKIM: None</option>
                                            </select>

                                            <select
                                                value={dmarc}
                                                onChange={(e) => setDmarc(e.target.value)}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                                                title="DMARC"
                                            >
                                                <option value="">DMARC: Any</option>
                                                <option value="pass">DMARC: Pass</option>
                                                <option value="fail">DMARC: Fail</option>
                                                <option value="none">DMARC: None</option>
                                            </select>

                                            <select
                                                value={arc}
                                                onChange={(e) => setArc(e.target.value)}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                                                title="ARC"
                                            >
                                                <option value="">ARC: Any</option>
                                                <option value="pass">ARC: Pass</option>
                                                <option value="fail">ARC: Fail</option>
                                                <option value="none">ARC: None</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                                Showing {items.length} of {meta.total.toLocaleString()} results
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

                {/* Messages Table */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    From
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Subject
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Spam Score
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    DKIM
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    DMARC
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    ARC
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Domain
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Received
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {items.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-12 text-center text-gray-500" colSpan={8}>
                                        <InboxArrowDownIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                                        <p className="text-sm font-medium">No inbound messages found</p>
                                        <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
                                    </td>
                                </tr>
                            ) : (
                                items.map((m) => {
                                    const spamConfig = getSpamScoreConfig(m.spam_score);
                                    const dkimConfig = getAuthResultConfig(m.dkim_result);
                                    const dmarcConfig = getAuthResultConfig(m.dmarc_result);
                                    const arcConfig = getAuthResultConfig(m.arc_result);

                                    return (
                                        <tr
                                            key={m.id}
                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/dashboard/company/${hash}/inbound-messages/${m.id}`)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-gray-900 font-mono">
                                                    {m.from_email || '—'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                                                    {m.subject || <span className="text-gray-400 italic">No Subject</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${spamConfig.bgClass} ${spamConfig.textClass} border ${spamConfig.borderClass}`}>
                                                        {spamConfig.label}
                                                    </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${dkimConfig.bgClass} ${dkimConfig.textClass}`}>
                                                        <dkimConfig.icon className="h-3 w-3" />
                                                        {dkimConfig.label}
                                                    </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${dmarcConfig.bgClass} ${dmarcConfig.textClass}`}>
                                                        <dmarcConfig.icon className="h-3 w-3" />
                                                        {dmarcConfig.label}
                                                    </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${arcConfig.bgClass} ${arcConfig.textClass}`}>
                                                        <arcConfig.icon className="h-3 w-3" />
                                                        {arcConfig.label}
                                                    </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {m.domain ? (
                                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                            {m.domain.domain || `#${m.domain.id}`}
                                                        </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500">
                                                <div className="flex items-center gap-1">
                                                    <ClockIcon className="h-3.5 w-3.5" />
                                                    {toLocale(m.received_at, 'short')}
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