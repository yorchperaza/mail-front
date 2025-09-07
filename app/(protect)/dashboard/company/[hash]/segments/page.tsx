'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    PlayCircleIcon,
    XMarkIcon,
    EyeIcon,
    ClipboardDocumentIcon,
    FunnelIcon,
    ChartBarIcon,
    ServerStackIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    CubeIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
    ExclamationTriangleIcon as ExclamationTriangleSolid,
    ClockIcon as ClockSolid,
    ArrowPathIcon as ArrowPathSolid,
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
} from 'recharts';

/* ---------- Types ---------- */
type SegmentItem = {
    id: number;
    name: string;
    definition: Record<string, unknown> | null;
    materialized_count: number | null;
    last_built_at: string | null;
    hash?: string | null;
};

type SyncRunResponse = {
    mode?: 'sync';
    status?: 'ok' | 'error';
    error?: string;
    entryId?: string | null;
    result?: unknown;
    company?: number;
    segment?: number;
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

type EnqueueResponse = {
    status: 'enqueued';
    entryId: string;
    segment: { id: number; name: string | null };
};

type StatusPayload = {
    progress: number | null;
    status: 'queued' | 'running' | 'ok' | 'error' | 'unknown';
    message?: string | null;
    updatedAt?: string | null;
    entryId?: string | null;
};

type BackendStatus = {
    status?: StatusPayload['status'] | null;
    message?: string | null;
    updatedAt?: string | null;
    entryId?: string | null;
    progress?: number | null;
};

/* ---------- Status Configuration ---------- */
const STATUS_CONFIG = {
    ok: {
        label: 'Ready',
        icon: CheckCircleSolid,
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
        dotClass: 'bg-emerald-500',
    },
    running: {
        label: 'Running',
        icon: ArrowPathSolid,
        bgClass: 'bg-indigo-50',
        textClass: 'text-indigo-700',
        borderClass: 'border-indigo-200',
        dotClass: 'bg-indigo-500',
    },
    queued: {
        label: 'Queued',
        icon: ClockSolid,
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
        dotClass: 'bg-amber-500',
    },
    error: {
        label: 'Error',
        icon: ExclamationTriangleSolid,
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-700',
        borderClass: 'border-rose-200',
        dotClass: 'bg-rose-500',
    },
    unknown: {
        label: 'Unknown',
        icon: ExclamationTriangleIcon,
        bgClass: 'bg-gray-50',
        textClass: 'text-gray-700',
        borderClass: 'border-gray-200',
        dotClass: 'bg-gray-500',
    },
};

function getStatusConfig(status?: StatusPayload['status']) {
    return STATUS_CONFIG[status || 'unknown'] || STATUS_CONFIG.unknown;
}

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

function StatusBadge({ s }: { s: StatusPayload | undefined }) {
    const config = getStatusConfig(s?.status);
    const Icon = config.icon;
    const title = s?.message
        ? s.message
        : s?.updatedAt
            ? `Updated: ${new Date(s.updatedAt).toLocaleString()}`
            : undefined;

    return (
        <div className="flex flex-col gap-1">
            <span
                title={title}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${config.bgClass} ${config.textClass} border ${config.borderClass}`}
            >
                <Icon className="h-3 w-3" />
                {config.label}
            </span>
            {typeof s?.progress === 'number' && s.status !== 'ok' && (
                <div className="h-1.5 w-24 rounded-full bg-gray-100 overflow-hidden">
                    <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{
                            width: `${Math.min(100, Math.max(0, s.progress))}%`,
                        }}
                    />
                </div>
            )}
        </div>
    );
}

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
    return (
        <span
            title={title}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700"
        >
            {children}
        </span>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            onClick={async (e) => {
                e.stopPropagation();
                try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                } catch {}
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            title="Copy to clipboard"
        >
            {copied ? (
                <>
                    <CheckCircleIcon className="h-3 w-3" />
                    Copied
                </>
            ) : (
                <>
                    <ClipboardDocumentIcon className="h-3 w-3" />
                    Copy
                </>
            )}
        </button>
    );
}

function StatCard({
                      label,
                      value,
                      change,
                      icon,
                      color,
                  }: {
    label: string;
    value: number | string;
    change?: number;
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
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                {change !== undefined && (
                    <div className={`mt-1 text-xs ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% from previous
                    </div>
                )}
            </div>
        </div>
    );
}

function DefinitionChips({ def }: { def: Record<string, unknown> | null }) {
    if (!def || Object.keys(def).length === 0) {
        return <span className="text-gray-400">—</span>;
    }
    const chips: React.ReactNode[] = [];

    if (def.status) {
        chips.push(
            <Chip key="status">
                Status: <b className="font-semibold">{String(def.status)}</b>
            </Chip>
        );
    }
    if (def.email_contains) {
        chips.push(
            <Chip key="email_contains" title="Email substring match">
                Email contains <code className="font-mono text-[11px]">{String(def.email_contains)}</code>
            </Chip>
        );
    }
    if (Array.isArray(def.in_list_ids) && def.in_list_ids.length) {
        chips.push(
            <Chip key="in_lists" title="Contact must be in any of these lists">
                In lists: <code className="font-mono text-[11px]">{def.in_list_ids.join(', ')}</code>
            </Chip>
        );
    }
    if (Array.isArray(def.not_in_list_ids) && def.not_in_list_ids.length) {
        chips.push(
            <Chip key="not_in_lists" title="Contact must NOT be in these lists">
                Not in lists: <code className="font-mono text-[11px]">{def.not_in_list_ids.join(', ')}</code>
            </Chip>
        );
    }
    if (typeof def.gdpr_consent === 'boolean') {
        chips.push(
            <Chip key="gdpr" title="Whether GDPR consent timestamp exists">
                GDPR consent:{' '}
                <b className={`font-semibold ${def.gdpr_consent ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {def.gdpr_consent ? 'Yes' : 'No'}
                </b>
            </Chip>
        );
    }

    Object.entries(def)
        .filter(([k]) => !['status', 'email_contains', 'in_list_ids', 'not_in_list_ids', 'gdpr_consent'].includes(k))
        .forEach(([k, v]) => {
            chips.push(
                <Chip key={`extra_${k}`}>
                    {k}: <code className="font-mono text-[11px]">{JSON.stringify(v)}</code>
                </Chip>
            );
        });

    if (chips.length === 0) return <span className="text-gray-400">—</span>;
    return <div className="flex flex-wrap gap-1.5">{chips}</div>;
}

/* ---------- Main Component ---------- */
export default function SegmentsListPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();

    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [data, setData] = useState<ApiListResponse<SegmentItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [workingId, setWorkingId] = useState<number | null>(null);
    const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);
    const [statusMap, setStatusMap] = useState<Record<number, StatusPayload>>({});

    const pollTimers = useRef<Record<number, number>>({});
    const toastTimer = useRef<number | null>(null);

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
        return `${backend}/companies/${hash}/segments?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl]);

    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);

    useEffect(() => {
        const timersAtMount = pollTimers.current;
        const toastAtMount = toastTimer.current;
        return () => {
            Object.values(timersAtMount).forEach((h) => window.clearInterval(h));
            if (toastAtMount) window.clearTimeout(toastAtMount);
        };
    }, []);

    function showToast(kind: 'info' | 'success' | 'error', text: string, ms = 3000) {
        setToast({ kind, text });
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), ms);
    }

    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load segments (${res.status})`);
                const json: ApiListResponse<SegmentItem> = await res.json();
                if (!abort) {
                    setData(json);

                    // PRIME STATUSES for visible rows right away
                    // fire-and-forget; don't await so the table renders fast
                    for (const item of json.items ?? []) {
                        fetchStatusOnce(item.id);
                    }
                }
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [listUrl]);

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

// 2) make fetchStatusOnce start polling when the backend says queued/running
    async function fetchStatusOnce(segmentId: number) {
        try {
            const res = await fetch(`${backend}/companies/${hash}/segments/${segmentId}/builds/status`, {
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error(String(res.status));
            const json = (await res.json()) as BackendStatus;

            const payload: StatusPayload = {
                status: (json.status as StatusPayload['status']) ?? 'unknown',
                message: json.message ?? null,
                updatedAt: json.updatedAt ?? new Date().toISOString(),
                entryId: json.entryId ?? null,
                progress: typeof json.progress === 'number' ? json.progress : null,
            };

            setStatusMap((prev) => ({ ...prev, [segmentId]: payload }));

            // NEW: if it's active, ensure polling has started
            if (payload.status === 'queued' || payload.status === 'running') {
                startPolling(segmentId);
                return;
            }

            // If terminal, stop and update row meta
            if (payload.status === 'ok' || payload.status === 'error') {
                if (pollTimers.current[segmentId]) {
                    window.clearInterval(pollTimers.current[segmentId]);
                    delete pollTimers.current[segmentId];
                }
                setData((prev) =>
                    prev
                        ? {
                            ...prev,
                            items: prev.items.map((s) =>
                                s.id === segmentId ? { ...s, last_built_at: new Date().toISOString() } : s
                            ),
                        }
                        : prev
                );
                showToast(
                    payload.status === 'ok' ? 'success' : 'error',
                    payload.status === 'ok' ? 'Segment built successfully' : 'Build failed'
                );
            }
        } catch {
            // Keep previous status
        }
    }


    function startPolling(segmentId: number, ms = 2500) {
        if (pollTimers.current[segmentId]) return;
        pollTimers.current[segmentId] = window.setInterval(() => fetchStatusOnce(segmentId), ms);
    }

    async function handleBuild(id: number) {
        setWorkingId(id);
        try {
            const res = await fetch(
                `${backend}/companies/${hash}/segments/${id}/builds/run-now`,
                { method: 'POST', headers: authHeaders(), body: JSON.stringify({ materialize: true }) }
            );

            // Async enqueue path (old behavior)
            if (res.status === 202) {
                const payload = (await res.json()) as { entryId?: string | null };
                setStatusMap((prev) => ({
                    ...prev,
                    [id]: {
                        status: 'queued',
                        entryId: payload?.entryId ?? null,
                        updatedAt: new Date().toISOString(),
                        progress: null,
                        message: 'Waiting for a worker',
                    },
                }));
                showToast('info', 'Build enqueued');
                startPolling(id);
                return;
            }

            // Synchronous path with heartbeat
            if (res.ok) {
                let jsonUnknown: unknown;
                try {
                    jsonUnknown = await res.json();
                } catch {
                    jsonUnknown = {};
                }
                const json = jsonUnknown as Partial<SyncRunResponse>;

                if (json.mode === 'sync' && json.status === 'ok') {
                    setStatusMap((prev) => ({
                        ...prev,
                        [id]: {
                            status: 'ok',
                            entryId: null,
                            updatedAt: new Date().toISOString(),
                            progress: 100,
                            message: 'Segment built',
                        },
                    }));
                    showToast('success', 'Segment built successfully');
                    return;
                }

                throw new Error(
                    json.error ? `Build failed: ${String(json.error)}` : `Unexpected response (${res.status})`
                );
            }

            // Non-OK / Non-202
            throw new Error(`Failed to enqueue (${res.status})`);
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to start build');
        } finally {
            setWorkingId(null);
        }
    }


    async function handleDelete(id: number) {
        if (!confirm('Delete this segment? This action cannot be undone.')) return;
        setWorkingId(id);
        try {
            const res = await fetch(`${backend}/companies/${hash}/segments/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            setData((prev) =>
                prev
                    ? {
                        ...prev,
                        items: prev.items.filter((i) => i.id !== id),
                        meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) },
                    }
                    : prev
            );
            showToast('success', 'Segment deleted');
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Delete failed');
        } finally {
            setWorkingId(null);
        }
    }

    const backHref = `/dashboard/company/${hash}`;
    const createHref = `/dashboard/company/${hash}/segments/create`;

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

    const maskHash = (h?: string | null) =>
        !h ? '—' : String(h).length <= 12 ? String(h) : `${String(h).slice(0, 6)}…${String(h).slice(-4)}`;

    // Calculate stats
    const stats = useMemo(() => {
        const items = data?.items ?? [];
        const total = items.length;
        const withCount = items.filter(s => typeof s.materialized_count === 'number').length;
        const totalContacts = items.reduce((sum, s) => sum + (s.materialized_count || 0), 0);
        const avgSize = withCount > 0 ? Math.round(totalContacts / withCount) : 0;

        return { total, withCount, totalContacts, avgSize };
    }, [data]);

    // Chart data
    const chartData = useMemo(() => {
        const items = data?.items ?? [];
        return items
            .filter(s => typeof s.materialized_count === 'number')
            .map(s => ({
                name: s.name.length > 20 ? s.name.substring(0, 20) + '...' : s.name,
                count: s.materialized_count || 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [data]);

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
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Segments</h2>
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
                {toast && <Toast kind={toast.kind} text={toast.text} onClose={() => setToast(null)} />}

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
                            <h1 className="text-2xl font-bold text-gray-900">Segments</h1>
                            <p className="text-sm text-gray-500">
                                {meta.total} total segments
                            </p>
                        </div>
                    </div>

                    <Link
                        href={createHref}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm"
                    >
                        <PlusIcon className="h-5 w-5" />
                        New Segment
                    </Link>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Segments"
                        value={meta.total}
                        icon={<ServerStackIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="Built Segments"
                        value={stats.withCount}
                        icon={<CheckCircleIcon className="h-5 w-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="Total Contacts"
                        value={stats.totalContacts.toLocaleString()}
                        icon={<CubeIcon className="h-5 w-5" />}
                        color="purple"
                    />
                    <StatCard
                        label="Avg Size"
                        value={stats.avgSize.toLocaleString()}
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
                                        Top Segments by Size
                                    </h3>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 11, fill: '#6b7280' }}
                                        tickMargin={10}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
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
                                        fill="url(#colorCount)"
                                    />
                                </AreaChart>
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
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Filters & Search</h3>
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
                                    placeholder="Search by segment name…"
                                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            clearFilters();
                                        }}
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
                                    {[10, 25, 50, 100, 200].map((n) => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
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
                                    Hash
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Definition
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Count
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Last Built
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Actions
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {items.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-12 text-center text-gray-500" colSpan={7}>
                                        <ServerStackIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No segments found</h3>
                                        <p className="text-sm text-gray-500">Create your first segment to get started</p>
                                    </td>
                                </tr>
                            ) : (
                                items.map((s) => (
                                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900">{s.name}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {s.hash ? (
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded-lg border font-mono">
                                                        {maskHash(s.hash)}
                                                    </code>
                                                    <CopyButton text={s.hash} />
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <DefinitionChips def={s.definition} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge s={statusMap[s.id]} />
                                        </td>
                                        <td className="px-4 py-3">
                                            {typeof s.materialized_count === 'number' ? (
                                                <span className="font-medium">{s.materialized_count.toLocaleString()}</span>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {toLocale(s.last_built_at)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/dashboard/company/${hash}/segments/${s.id}/preview`}
                                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                                    title="Preview"
                                                >
                                                    <EyeIcon className="h-3.5 w-3.5" />
                                                    Preview
                                                </Link>
                                                <button
                                                    onClick={() => handleBuild(s.id)}
                                                    disabled={workingId === s.id}
                                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors disabled:opacity-50"
                                                    title="Build"
                                                >
                                                    <PlayCircleIcon className="h-3.5 w-3.5" />
                                                    {workingId === s.id ? 'Building…' : 'Build'}
                                                </button>
                                                <Link
                                                    href={`/dashboard/company/${hash}/segments/${s.id}/edit`}
                                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 transition-colors"
                                                    title="Edit"
                                                >
                                                    <PencilSquareIcon className="h-3.5 w-3.5" />
                                                    Edit
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(s.id)}
                                                    disabled={workingId === s.id}
                                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 transition-colors disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="h-3.5 w-3.5" />
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
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
            </div>
        </div>
    );
}