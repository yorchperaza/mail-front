'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    FunnelIcon,
    ChartBarIcon,
    MagnifyingGlassIcon,
    CalendarDaysIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    EyeIcon,
    ArrowPathIcon,
    DocumentDuplicateIcon,
    EnvelopeIcon,
    GlobeAltIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    AdjustmentsHorizontalIcon,
    InboxIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
    XCircleIcon as XCircleSolid,
    ClockIcon as ClockSolid,
    ExclamationTriangleIcon as ExclamationTriangleSolid,
} from '@heroicons/react/24/solid';

/* Recharts */
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Brush,
} from 'recharts';

/* ========================= Types ========================= */

type MessageItem = {
    id: number;
    company_id: number;
    domain_id: number | null;
    domainName: string | null;
    from: { email: string; name: string | null };
    replyTo: string | null;
    subject: string | null;
    createdAt: string | null;
    queuedAt: string | null;
    sentAt: string | null;
    state: 'queued' | 'sent' | 'failed' | 'preview' | 'queue_failed' | string | null;
    messageId: string | null;
    recipients?: {
        to: string[];
        cc: string[];
        bcc: string[];
    };
};

type ApiResponse = {
    meta: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        sort: 'created_at' | 'queued_at' | 'sent_at';
        order: 'asc' | 'desc';
        filters: Record<string, unknown>;
    };
    items: MessageItem[];
};

type DomainItem = {
    id: number;
    domain: string;
    statusDomain: string | number | null;
};

/* ========================= Helpers ========================= */

const STATE_CONFIG = {
    sent: {
        label: 'Sent',
        icon: CheckCircleSolid,
        color: 'emerald',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
        dotClass: 'bg-emerald-500',
    },
    queued: {
        label: 'Queued',
        icon: ClockSolid,
        color: 'amber',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
        dotClass: 'bg-amber-500',
    },
    failed: {
        label: 'Failed',
        icon: XCircleSolid,
        color: 'red',
        bgClass: 'bg-red-50',
        textClass: 'text-red-700',
        borderClass: 'border-red-200',
        dotClass: 'bg-red-500',
    },
    preview: {
        label: 'Preview',
        icon: EyeIcon,
        color: 'blue',
        bgClass: 'bg-blue-50',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-200',
        dotClass: 'bg-blue-500',
    },
    queue_failed: {
        label: 'Queue Failed',
        icon: ExclamationTriangleSolid,
        color: 'red',
        bgClass: 'bg-red-50',
        textClass: 'text-red-700',
        borderClass: 'border-red-200',
        dotClass: 'bg-red-500',
    },
};

function getStateConfig(state?: string | null) {
    return STATE_CONFIG[(state || '').toLowerCase() as keyof typeof STATE_CONFIG] || {
        label: state || 'Unknown',
        icon: ArrowPathIcon,
        color: 'gray',
        bgClass: 'bg-gray-50',
        textClass: 'text-gray-700',
        borderClass: 'border-gray-200',
        dotClass: 'bg-gray-500',
    };
}

function toLocale(s?: string | null, format: 'full' | 'short' | 'time' = 'short') {
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
}

/* Build query string from an object */
function buildQuery(params: Record<string, unknown>) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (typeof v === 'string' && v.trim() === '') return;
        if (Array.isArray(v)) {
            if (v.length === 0) return;
            sp.set(k, v.join(','));
            return;
        }
        sp.set(k, String(v));
    });
    return sp.toString();
}

function fmtDateUTC(d: Date) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Build a YYYY-MM-DD key for chart bucketing */
function dayKey(iso?: string | null): string {
    if (!iso) return 'unknown';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'unknown';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function shortId(id?: string | null, head = 8, tail = 4) {
    if (!id) return '—';
    if (id.length <= head + tail + 1) return id;
    return `${id.slice(0, head)}...${id.slice(-tail)}`;
}

/* ========================= Components ========================= */

function CopyButton({ text, small = false }: { text: string; small?: boolean }) {
    const [copied, setCopied] = React.useState(false);

    return (
        <button
            type="button"
            onClick={async (e) => {
                e.stopPropagation();
                try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                } catch {}
            }}
            className={`inline-flex items-center gap-1 rounded-md transition-all ${
                small
                    ? 'px-1.5 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700'
                    : 'px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title="Copy to clipboard"
        >
            {copied ? (
                <>
                    <CheckCircleIcon className="h-3 w-3" />
                    Copied
                </>
            ) : (
                <>
                    <DocumentDuplicateIcon className="h-3 w-3" />
                    Copy
                </>
            )}
        </button>
    );
}

function RecipientBadge({ type, count }: { type: 'to' | 'cc' | 'bcc'; count: number }) {
    if (count === 0) return null;

    const config = {
        to: { label: 'TO', bgClass: 'bg-green-100', textClass: 'text-green-700', borderClass: 'border-green-200' },
        cc: { label: 'CC', bgClass: 'bg-blue-100', textClass: 'text-blue-700', borderClass: 'border-blue-200' },
        bcc: { label: 'BCC', bgClass: 'bg-purple-100', textClass: 'text-purple-700', borderClass: 'border-purple-200' },
    };

    const { label, bgClass, textClass, borderClass } = config[type];

    return (
        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${bgClass} ${textClass} border ${borderClass}`}>
            {label}: {count}
        </span>
    );
}

function StatCard({ label, value, change, icon, color }: {
    label: string;
    value: number;
    change?: number;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'amber' | 'red';
}) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        red: 'from-red-500 to-red-600',
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
                <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
                {change !== undefined && (
                    <div className={`mt-1 text-xs ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% from previous
                    </div>
                )}
            </div>
        </div>
    );
}

/* ========================= Main Page Component ========================= */

export default function CompanyMessagesPage() {
    const router = useRouter();
    const pathname = usePathname();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [domains, setDomains] = useState<DomainItem[]>([]);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    // URL parameters
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const sort = (search.get('sort') || 'created_at') as 'created_at' | 'queued_at' | 'sent_at';
    const order = (search.get('order') || 'desc') as 'asc' | 'desc';
    const domain_id = search.get('domain_id') || '';
    const date_from = search.get('date_from') || '';
    const date_to = search.get('date_to') || '';
    const hour_from = search.get('hour_from') || '';
    const hour_to = search.get('hour_to') || '';
    const state = search.get('state') || '';
    const fromLike = search.get('from') || '';
    const toLike = search.get('to') || '';
    const subjectLike = search.get('subject') || '';
    const message_id = search.get('message_id') || '';
    const has_opens = search.get('has_opens') || '';
    const has_clicks = search.get('has_clicks') || '';

    const qs = useMemo(
        () => buildQuery({
            page, perPage, sort, order, domain_id, date_from, date_to,
            hour_from, hour_to, state, from: fromLike, to: toLike,
            subject: subjectLike, message_id, has_opens, has_clicks,
        }),
        [page, perPage, sort, order, domain_id, date_from, date_to, hour_from, hour_to, state, fromLike, toLike, subjectLike, message_id, has_opens, has_clicks]
    );

    const listUrl = `${backend}/companies/${hash}/messages?${qs}`;
    const domainsUrl = `${backend}/companies/${hash}/domains`;

    // Fetch messages
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
                if (!res.ok) throw new Error(`Failed to load messages (${res.status})`);
                const json: ApiResponse = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [listUrl, token]);

    // Fetch domains
    useEffect(() => {
        let abort = false;
        (async () => {
            try {
                const res = await fetch(domainsUrl, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
                if (!res.ok) throw new Error(`Failed to load domains (${res.status})`);
                const json: DomainItem[] = await res.json();
                if (!abort) setDomains(json);
            } catch (e) {
                if (!abort) console.error(e);
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [domainsUrl, token]);

    function updateQuery(partial: Record<string, unknown>, resetPage = false) {
        const sp = new URLSearchParams(search.toString());
        Object.entries(partial).forEach(([k, v]) => {
            if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
                sp.delete(k);
            } else {
                sp.set(k, String(v));
            }
        });
        if (resetPage) sp.set('page', '1');
        router.replace(`${pathname}?${sp.toString()}`);
    }

    function submitFilters(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const selectedStates = Array.from(fd.getAll('state')).map(String);
        updateQuery({
            domain_id: (fd.get('domain_id') as string) || '',
            date_from: (fd.get('date_from') as string) || '',
            date_to: (fd.get('date_to') as string) || '',
            hour_from: (fd.get('hour_from') as string) || '',
            hour_to: (fd.get('hour_to') as string) || '',
            state: selectedStates.join(',') || '',
            from: (fd.get('from') as string) || '',
            to: (fd.get('to') as string) || '',
            subject: (fd.get('subject') as string) || '',
            message_id: (fd.get('message_id') as string) || '',
            has_opens: (fd.get('has_opens') as string) || '',
            has_clicks: (fd.get('has_clicks') as string) || '',
        }, true);
    }

    function clearFilters() {
        setShowAdvanced(false);
        updateQuery({
            page: 1, perPage, sort, order,
            domain_id: '', date_from: '', date_to: '', hour_from: '', hour_to: '',
            state: '', from: '', to: '', subject: '', message_id: '', has_opens: '', has_clicks: ''
        }, false);
    }

    function applyQuickRange(days: number) {
        const now = new Date();
        const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const from = new Date(to);
        from.setUTCDate(to.getUTCDate() - (days - 1));
        updateQuery({ date_from: fmtDateUTC(from), date_to: fmtDateUTC(to) }, true);
    }

    // Chart data
    const chartData = useMemo(() => {
        const items = data?.items ?? [];
        const pickDate = (m: MessageItem) => {
            if (sort === 'sent_at') return m.sentAt || m.queuedAt || m.createdAt;
            if (sort === 'queued_at') return m.queuedAt || m.createdAt || m.sentAt;
            return m.createdAt || m.queuedAt || m.sentAt;
        };

        // Group by date and state
        const map = new Map<string, Record<string, number>>();
        items.forEach((m) => {
            const k = dayKey(pickDate(m));
            if (k !== 'unknown') {
                const existing = map.get(k) || { sent: 0, queued: 0, failed: 0 };
                const state = (m.state || '').toLowerCase();
                if (state === 'sent') existing.sent++;
                else if (state === 'queued' || state === 'preview') existing.queued++;
                else if (state === 'failed' || state === 'queue_failed') existing.failed++;
                map.set(k, existing);
            }
        });

        return Array.from(map.entries())
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([date, counts]) => ({ date, ...counts, total: counts.sent + counts.queued + counts.failed }));
    }, [data, sort]);

    // Stats calculations
    const stats = useMemo(() => {
        const items = data?.items ?? [];
        const stateCounts = { sent: 0, queued: 0, failed: 0 };
        items.forEach(m => {
            const s = (m.state || '').toLowerCase();
            if (s === 'sent') stateCounts.sent++;
            else if (s === 'queued' || s === 'preview') stateCounts.queued++;
            else if (s === 'failed' || s === 'queue_failed') stateCounts.failed++;
        });
        return stateCounts;
    }, [data]);

    const formKey = search.toString();

    // Loading state
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
                        onClick={() => router.push(`/dashboard/company/${hash}`)}
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
                            onClick={() => router.push(`/dashboard/company/${hash}`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Dashboard
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Email Messages</h1>
                            <p className="text-sm text-gray-500">
                                {meta.total.toLocaleString()} total messages
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                        >
                            {viewMode === 'grid' ? 'Table View' : 'Grid View'}
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Messages"
                        value={meta.total}
                        icon={<InboxIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="Sent"
                        value={stats.sent}
                        icon={<CheckCircleIcon className="h-5 w-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="Queued"
                        value={stats.queued}
                        icon={<ClockIcon className="h-5 w-5" />}
                        color="amber"
                    />
                    <StatCard
                        label="Failed"
                        value={stats.failed}
                        icon={<XCircleIcon className="h-5 w-5" />}
                        color="red"
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
                                Grouped by {sort.replace('_', ' ')}
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                                <defs>
                                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                                    </linearGradient>
                                    <linearGradient id="colorQueued" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
                                    </linearGradient>
                                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
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
                                <Legend
                                    wrapperStyle={{ paddingTop: '20px' }}
                                    iconType="circle"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sent"
                                    stackId="1"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fill="url(#colorSent)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="queued"
                                    stackId="1"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    fill="url(#colorQueued)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="failed"
                                    stackId="1"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    fill="url(#colorFailed)"
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
                <form key={formKey} onSubmit={submitFilters} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <FunnelIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Filters</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-purple-100">
                                    {Object.values({ domain_id, date_from, date_to, state, fromLike, toLike, subjectLike, message_id })
                                        .filter(Boolean).length} active
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
                            {/* Domain */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <GlobeAltIcon className="inline h-4 w-4 mr-1" />
                                    Domain
                                </label>
                                <select
                                    name="domain_id"
                                    defaultValue={domain_id}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">All domains</option>
                                    {domains.map((d) => (
                                        <option key={d.id} value={String(d.id)}>{d.domain}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Range */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <CalendarDaysIcon className="inline h-4 w-4 mr-1" />
                                    Date From
                                </label>
                                <input
                                    type="date"
                                    name="date_from"
                                    defaultValue={date_from}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <CalendarDaysIcon className="inline h-4 w-4 mr-1" />
                                    Date To
                                </label>
                                <input
                                    type="date"
                                    name="date_to"
                                    defaultValue={date_to}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        {/* State Filters */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Message State
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(STATE_CONFIG).map(([key, config]) => {
                                    const isChecked = (state || '').split(',').includes(key);
                                    const Icon = config.icon;
                                    return (
                                        <label
                                            key={key}
                                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer transition-all ${
                                                isChecked
                                                    ? `${config.bgClass} ${config.textClass} ring-2 ${config.borderClass}`
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                name="state"
                                                value={key}
                                                defaultChecked={isChecked}
                                                className="sr-only"
                                            />
                                            <Icon className="h-4 w-4" />
                                            {config.label}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

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
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            From Email
                                        </label>
                                        <input
                                            name="from"
                                            defaultValue={fromLike}
                                            placeholder="Contains..."
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            To Email
                                        </label>
                                        <input
                                            name="to"
                                            defaultValue={toLike}
                                            placeholder="Contains..."
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Subject
                                        </label>
                                        <input
                                            name="subject"
                                            defaultValue={subjectLike}
                                            placeholder="Contains..."
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Message ID
                                        </label>
                                        <input
                                            name="message_id"
                                            defaultValue={message_id}
                                            placeholder="Exact match"
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Opens Tracking
                                        </label>
                                        <select
                                            name="has_opens"
                                            defaultValue={has_opens}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        >
                                            <option value="">Any</option>
                                            <option value="1">Enabled</option>
                                            <option value="0">Disabled</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Clicks Tracking
                                        </label>
                                        <select
                                            name="has_clicks"
                                            defaultValue={has_clicks}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        >
                                            <option value="">Any</option>
                                            <option value="1">Enabled</option>
                                            <option value="0">Disabled</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sort & Display Options */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-gray-700">Sort by:</label>
                                    <select
                                        value={sort}
                                        onChange={(e) => updateQuery({ sort: e.target.value }, true)}
                                        className="rounded-lg border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    >
                                        <option value="created_at">Created Date</option>
                                        <option value="queued_at">Queued Date</option>
                                        <option value="sent_at">Sent Date</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-gray-700">Order:</label>
                                    <select
                                        value={order}
                                        onChange={(e) => updateQuery({ order: e.target.value }, true)}
                                        className="rounded-lg border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    >
                                        <option value="desc">Newest First</option>
                                        <option value="asc">Oldest First</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-gray-700">Per page:</label>
                                    <select
                                        value={perPage}
                                        onChange={(e) => updateQuery({ perPage: e.target.value, page: 1 })}
                                        className="rounded-lg border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    >
                                        {[10, 25, 50, 100, 200].map((n) => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </div>
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

                {/* Messages List/Grid */}
                {items.length === 0 ? (
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-12">
                        <div className="text-center">
                            <InboxIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-lg font-semibold text-gray-900">No messages found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Try adjusting your filters or date range
                            </p>
                        </div>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* Grid View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((m) => {
                            const stateConfig = getStateConfig(m.state);
                            const StateIcon = stateConfig.icon;
                            const totalRecipients = (m.recipients?.to?.length || 0) +
                                (m.recipients?.cc?.length || 0) +
                                (m.recipients?.bcc?.length || 0);

                            return (
                                <div
                                    key={m.id}
                                    onClick={() => router.push(`/dashboard/company/${hash}/messaging/messages/${encodeURIComponent(m.messageId || '')}`)}
                                    className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-lg hover:ring-indigo-200 transition-all cursor-pointer overflow-hidden"
                                >
                                    <div className={`h-1 ${stateConfig.dotClass}`} />
                                    <div className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-900 truncate">
                                                    {m.subject || <span className="text-gray-400 italic">No Subject</span>}
                                                </h3>
                                            </div>
                                            <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${stateConfig.bgClass} ${stateConfig.textClass}`}>
                                                <StateIcon className="h-3 w-3" />
                                                {stateConfig.label}
                                            </span>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                                                <span className="truncate">
                                                    {m.from.name || m.from.email}
                                                </span>
                                            </div>

                                            {m.domainName && (
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <GlobeAltIcon className="h-4 w-4 text-gray-400" />
                                                    <span className="truncate">{m.domainName}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 text-gray-600">
                                                <UserGroupIcon className="h-4 w-4 text-gray-400" />
                                                <div className="flex gap-1">
                                                    <RecipientBadge type="to" count={m.recipients?.to?.length || 0} />
                                                    <RecipientBadge type="cc" count={m.recipients?.cc?.length || 0} />
                                                    <RecipientBadge type="bcc" count={m.recipients?.bcc?.length || 0} />
                                                    {totalRecipients === 0 && <span className="text-gray-400">No recipients</span>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 text-gray-600">
                                                <ClockIcon className="h-4 w-4 text-gray-400" />
                                                <span className="text-xs">
                                                    {toLocale(m.sentAt || m.queuedAt || m.createdAt)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            <div className="flex items-center justify-between">
                                                <code className="text-xs text-gray-500 font-mono truncate max-w-[150px]">
                                                    {shortId(m.messageId)}
                                                </code>
                                                {m.messageId && <CopyButton text={m.messageId} small />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Table View */
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Subject / Message ID
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        From / Domain
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Recipients
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Timestamps
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Actions
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {items.map((m) => {
                                    const stateConfig = getStateConfig(m.state);
                                    const StateIcon = stateConfig.icon;

                                    return (
                                        <tr
                                            key={m.id}
                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/dashboard/company/${hash}/messaging/messages/${encodeURIComponent(m.messageId || '')}`)}
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${stateConfig.bgClass} ${stateConfig.textClass}`}>
                                                        <StateIcon className="h-3 w-3" />
                                                        {stateConfig.label}
                                                    </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {m.subject || <span className="text-gray-400 italic">No Subject</span>}
                                                </div>
                                                <div className="text-xs text-gray-500 font-mono mt-1">
                                                    {shortId(m.messageId)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-gray-900">
                                                    {m.from.name || m.from.email}
                                                </div>
                                                {m.domainName && (
                                                    <div className="text-xs text-blue-600 mt-1">
                                                        {m.domainName}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    <RecipientBadge type="to" count={m.recipients?.to?.length || 0} />
                                                    <RecipientBadge type="cc" count={m.recipients?.cc?.length || 0} />
                                                    <RecipientBadge type="bcc" count={m.recipients?.bcc?.length || 0} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500">
                                                <div>Created: {toLocale(m.createdAt, 'short')}</div>
                                                {m.queuedAt && <div>Queued: {toLocale(m.queuedAt, 'short')}</div>}
                                                {m.sentAt && <div>Sent: {toLocale(m.sentAt, 'short')}</div>}
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {m.messageId && (
                                                    <CopyButton text={m.messageId} small />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

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
            </div>
        </div>
    );
}