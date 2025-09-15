"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import {
    ArrowLeftIcon,
    ShieldCheckIcon,
    ChartBarIcon,
    CalendarDaysIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    FunnelIcon,
    ServerStackIcon,
    DocumentChartBarIcon,
    GlobeAltIcon,
    ClockIcon,
    InboxIcon,
} from '@heroicons/react/24/outline';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    PieChart,
    Pie,
    Cell,
} from "recharts";

/* ================= Types ================= */
type IsoString = string;
type TlsRptWindow = { start: IsoString | null; end: IsoString | null };
type FailureDetail = {
    "result-type"?: string;
    "result_reason_code"?: string;
    "sending-mta-ip"?: string;
    "receiving-mx-hostname"?: string;
    "receiving-ip"?: string;
    "failed-session-count"?: number;
    [k: string]: unknown;
};
type TlsRptRow = {
    id: number;
    org: string | null;
    reportId: string | null;
    window: TlsRptWindow;
    summary: { success: number; failure: number };
    details: FailureDetail[] | null;
    receivedAt: IsoString | null;
};
type DomainBrief = { id: number; name: string };
type CompanyTlsRptResponse = {
    company: { id: number; hash: string; name: string | null };
    range: { from: string; to: string };
    domains: DomainBrief[];
    reports: Record<string, TlsRptRow[]>;
};
type ByStringNumber = Record<string, number>;

/* ================= Helpers ================= */
const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const QUICK_RANGES = [
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 14 Days', days: 14 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 60 Days', days: 60 },
    { label: 'Last 90 Days', days: 90 },
];

const PIE_COLORS = ['#10b981', '#ef4444'];

function authHeaders(): HeadersInit {
    const token = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function fmt(n?: number | null) {
    return n == null || Number.isNaN(n) ? "0" : new Intl.NumberFormat().format(n);
}

function toDateLabel(iso?: string | null, format: 'short' | 'full' = 'short') {
    if (!iso) return "—";
    try {
        const date = new Date(iso);
        if (format === 'full') {
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
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
        return String(iso);
    }
}

function todayYMD() {
    return new Date().toISOString().slice(0, 10);
}

function fmtDateUTC(d: Date) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Aggregate helpful stats from TLS-RPT rows */
function aggregateTlsrpt(rows: TlsRptRow[]) {
    let success = 0, failure = 0;
    const byResultType: ByStringNumber = {};
    const byReceivingMx: ByStringNumber = {};
    const topFailures: Array<{ mx: string; count: number; reason?: string }> = [];

    for (const r of rows) {
        success += r.summary?.success ?? 0;
        failure += r.summary?.failure ?? 0;
        const details = Array.isArray(r.details) ? r.details : [];
        for (const d of details) {
            const c = Number(d["failed-session-count"] ?? 0) || 0;
            const resType = String(d["result-type"] ?? "unknown");
            byResultType[resType] = (byResultType[resType] || 0) + c;
            const mx = String(d["receiving-mx-hostname"] ?? d["receiving-ip"] ?? "unknown");
            byReceivingMx[mx] = (byReceivingMx[mx] || 0) + c;
            if (c > 0) topFailures.push({
                mx,
                count: c,
                reason: typeof d["result_reason_code"] === "string" ? d["result_reason_code"] : undefined
            });
        }
    }
    topFailures.sort((a, b) => b.count - a.count);
    return {
        success,
        failure,
        total: success + failure,
        byResultType,
        byReceivingMx,
        topFailures: topFailures.slice(0, 10)
    };
}

/* ================= Components ================= */

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

/* ================= Main Page Component ================= */
export default function CompanyTlsRptPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    const [quick, setQuick] = useState<number | null>(30);
    const [from, setFrom] = useState<string>(() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 29);
        return d.toISOString().slice(0, 10);
    });
    const [to, setTo] = useState<string>(() => todayYMD());

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CompanyTlsRptResponse | null>(null);
    const [activeDomainId, setActiveDomainId] = useState<number | null>(null);

    // Hydrate state from URL on first render
    const didInitFromUrl = useRef(false);
    useEffect(() => {
        if (didInitFromUrl.current) return;
        didInitFromUrl.current = true;

        const sp = searchParams;
        const qStr = sp.get("q");
        const f = sp.get("from");
        const t = sp.get("to");
        const d = sp.get("domain");

        if (qStr) {
            const qNum = Number(qStr);
            const range = QUICK_RANGES.find(r => r.days === qNum);
            if (range) {
                setQuick(qNum);
                const end = new Date();
                const start = new Date();
                start.setUTCDate(start.getUTCDate() - (qNum - 1));
                setFrom(start.toISOString().slice(0, 10));
                setTo(end.toISOString().slice(0, 10));
            } else {
                setQuick(null);
            }
        }

        if (f && t) {
            setFrom(f);
            setTo(t);
            setQuick(null);
        }

        if (d) {
            const id = Number(d);
            if (!Number.isNaN(id)) setActiveDomainId(id);
        }
    }, [searchParams]);

    // Keep URL in sync with state
    useEffect(() => {
        const qs = new URLSearchParams();

        if (quick && QUICK_RANGES.find(r => r.days === quick)) {
            qs.set("q", String(quick));
        } else {
            if (from) qs.set("from", from);
            if (to) qs.set("to", to);
        }

        if (activeDomainId != null) {
            qs.set("domain", String(activeDomainId));
        }

        const next = `${pathname}?${qs.toString()}`;
        const current = `${pathname}?${searchParams.toString()}`;
        if (next !== current) {
            router.replace(next, { scroll: false });
        }
    }, [quick, from, to, activeDomainId, pathname, searchParams, router]);

    // When quick changes, recompute dates
    useEffect(() => {
        if (quick == null) return;
        const end = new Date();
        const start = new Date();
        start.setUTCDate(start.getUTCDate() - (quick - 1));
        setFrom(start.toISOString().slice(0, 10));
        setTo(end.toISOString().slice(0, 10));
    }, [quick]);

    // Fetch data
    useEffect(() => {
        let aborted = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const url = `${backend}/companies/${hash}/reports/tlsrpt?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
                const res = await fetch(url, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed: ${res.status}`);
                const json: CompanyTlsRptResponse = await res.json();
                if (aborted) return;
                setData(json);

                setActiveDomainId(prev => {
                    if (prev != null) return prev;
                    return json.domains?.[0]?.id ?? null;
                });
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to load TLS-RPT data";
                if (!aborted) setError(msg);
            } finally {
                if (!aborted) setLoading(false);
            }
        })();
        return () => { aborted = true; };
    }, [hash, from, to]);

    function applyQuickRange(days: number) {
        const now = new Date();
        const toDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const fromDate = new Date(toDate);
        fromDate.setUTCDate(toDate.getUTCDate() - (days - 1));
        setFrom(fmtDateUTC(fromDate));
        setTo(fmtDateUTC(toDate));
        setQuick(days);
    }

    const activeDomain = useMemo(
        () => (data && activeDomainId != null ? data.domains.find(d => d.id === activeDomainId) ?? null : null),
        [data, activeDomainId]
    );

    const domainReports: TlsRptRow[] = useMemo(() => {
        if (!data || activeDomainId == null) return [];
        return data.reports?.[String(activeDomainId)] ?? [];
    }, [data, activeDomainId]);

    const agg = useMemo(() => aggregateTlsrpt(domainReports), [domainReports]);

    const byResultBars = useMemo(
        () => Object.entries(agg.byResultType)
            .sort((a, b) => b[1] - a[1])
            .map(([result, count]) => ({ result, count })),
        [agg.byResultType]
    );

    const byMxBars = useMemo(
        () => Object.entries(agg.byReceivingMx)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([mx, count]) => ({ mx, count })),
        [agg.byReceivingMx]
    );

    const pieData = useMemo(() => ([
        { name: "Successful TLS", value: agg.success },
        { name: "Failed TLS", value: agg.failure },
    ]), [agg.success, agg.failure]);

    const successRate = agg.total > 0 ? ((agg.success / agg.total) * 100).toFixed(1) : '0';

    /* ============== Loading State ============== */
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

    /* ============== Error State ============== */
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading TLS-RPT Reports</h2>
                    </div>
                    <p className="text-gray-600">{error}</p>
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

    /* ============== Main Render ============== */
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
                            <h1 className="text-2xl font-bold text-gray-900">TLS-RPT Reports</h1>
                            <p className="text-sm text-gray-500">
                                {data.company.name || "Company"} · {domainReports.length} reports
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Success Rate:</span>
                        <span className="text-2xl font-bold text-emerald-600">{successRate}%</span>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Sessions"
                        value={agg.total}
                        icon={<InboxIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="Successful TLS"
                        value={agg.success}
                        icon={<CheckCircleIcon className="h-5 w-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="Failed TLS"
                        value={agg.failure}
                        icon={<XCircleIcon className="h-5 w-5" />}
                        color="red"
                    />
                    <StatCard
                        label="Active Domains"
                        value={data.domains.length}
                        icon={<GlobeAltIcon className="h-5 w-5" />}
                        color="amber"
                    />
                </div>

                {/* Date Range & Domain Filters */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <FunnelIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Filters & Date Range</h3>
                            </div>
                            <div className="text-xs text-purple-100">
                                {from} to {to}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Quick Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Quick Ranges:</span>
                            {QUICK_RANGES.map(({ label, days }) => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => applyQuickRange(days)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                        quick === days
                                            ? 'bg-gray-900 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <CalendarDaysIcon className="h-3.5 w-3.5" />
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Date Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <CalendarDaysIcon className="inline h-4 w-4 mr-1" />
                                    Date From
                                </label>
                                <input
                                    type="date"
                                    value={from}
                                    onChange={(e) => { setFrom(e.target.value); setQuick(null); }}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    max={to}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <CalendarDaysIcon className="inline h-4 w-4 mr-1" />
                                    Date To
                                </label>
                                <input
                                    type="date"
                                    value={to}
                                    onChange={(e) => { setTo(e.target.value); setQuick(null); }}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    min={from}
                                    max={todayYMD()}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <GlobeAltIcon className="inline h-4 w-4 mr-1" />
                                    Domain
                                </label>
                                <select
                                    value={activeDomainId || ''}
                                    onChange={(e) => setActiveDomainId(Number(e.target.value))}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    {data.domains.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Success vs Failure Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pie Chart */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <ChartBarIcon className="h-5 w-5" />
                                    <h3 className="text-sm font-semibold uppercase tracking-wider">
                                        Success vs Failure
                                    </h3>
                                </div>
                                <div className="text-xs text-indigo-100">
                                    {activeDomain?.name}
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        label={(entry) => `${entry.name}: ${fmt(entry.value)}`}
                                    >
                                        {pieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: unknown) => fmt(Number(value))} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Failure Types Chart */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <ExclamationTriangleIcon className="h-5 w-5" />
                                    <h3 className="text-sm font-semibold uppercase tracking-wider">
                                        Failure Result Types
                                    </h3>
                                </div>
                                <div className="text-xs text-red-100">
                                    {byResultBars.length} types
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={byResultBars} margin={{ top: 10, right: 30, left: 0, bottom: 50 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="result"
                                        tick={{ fontSize: 11, fill: '#6b7280' }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        formatter={(value: unknown) => [fmt(Number(value)), 'Failures']}
                                    />
                                    <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Top Receiving MX Failures */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <ServerStackIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">
                                    Top Receiving MX (Failures)
                                </h3>
                            </div>
                            <div className="text-xs text-amber-100">
                                Top 10 servers
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={byMxBars} margin={{ top: 10, right: 30, left: 0, bottom: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="mx"
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={100}
                                />
                                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                    formatter={(value: unknown) => [fmt(Number(value)), 'Failures']}
                                />
                                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Failure Details */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <DocumentChartBarIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">
                                    Top Failure Details
                                </h3>
                            </div>
                            <div className="text-xs text-gray-300">
                                {agg.topFailures.length} instances
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {agg.topFailures.length === 0 ? (
                            <div className="p-12 text-center">
                                <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-lg font-semibold text-gray-900">No failures found</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Great! No TLS failures reported for this period.
                                </p>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Receiving MX
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Failure Reason
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Count
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {agg.topFailures.map((f, i) => (
                                    <tr key={`${f.mx}-${i}`} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{f.mx}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-500">
                                                {f.reason || <span className="text-gray-400 italic">No reason specified</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    {fmt(f.count)}
                                                </span>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Raw Reports Table */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <ClockIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">
                                    Raw Report Windows
                                </h3>
                            </div>
                            <div className="text-xs text-blue-100">
                                {domainReports.length} reports for {activeDomain?.name}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {domainReports.length === 0 ? (
                            <div className="p-12 text-center">
                                <InboxIcon className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-lg font-semibold text-gray-900">No reports found</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Try adjusting your date range or domain selection
                                </p>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Reporter
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Report Window
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Success
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Failed
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Received
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Report ID
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {domainReports.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {r.org || <span className="text-gray-400 italic">Unknown</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-500">
                                                {toDateLabel(r.window.start)} → {toDateLabel(r.window.end)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                    {fmt(r.summary?.success)}
                                                </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    {fmt(r.summary?.failure)}
                                                </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {toDateLabel(r.receivedAt, 'full')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-xs text-gray-500 font-mono">
                                                {r.reportId ? r.reportId.slice(0, 12) + '...' : '—'}
                                            </code>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}