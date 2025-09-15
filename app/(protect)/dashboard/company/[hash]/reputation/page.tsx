"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import {
    ArrowLeftIcon,
    CalendarDaysIcon,
    StarIcon,
    TrophyIcon,
    BuildingOfficeIcon,
    DocumentChartBarIcon,
    ClockIcon,
    FunnelIcon,
    ChartPieIcon,
    TagIcon,
    SparklesIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
    StarIcon as StarSolid,
} from '@heroicons/react/24/solid';
import {
    ResponsiveContainer,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    Area,
    AreaChart,
} from "recharts";

/* ================= Types ================= */
type Iso = string;

type HistoryItem = {
    id: number;
    provider: string | null;
    score: number;
    sampledAt: Iso;
    notes: string | null;
};

type DomainBrief = { id: number; name: string };

type ReputationHistoryResponse = {
    company: { id: number; hash: string; name: string | null };
    range: { from: string; to: string };
    domains: DomainBrief[];
    history: Record<string, HistoryItem[]>;
};

type LinePoint = { date: string; [provider: string]: number | string };

/* ================= Constants & Helpers ================= */
const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const QUICK_RANGES = [
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 14 Days', days: 14 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 60 Days', days: 60 },
    { label: 'Last 90 Days', days: 90 },
];

// Chart colors for different providers
const CHART_COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
];

function authHeaders(): HeadersInit {
    const token = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function todayYMD() {
    return new Date().toISOString().slice(0, 10);
}

function ymd(d: Date) {
    return d.toISOString().slice(0, 10);
}

function toDateLabel(iso?: string | null, format: 'full' | 'short' | 'date' = 'short') {
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
        } else if (format === 'date') {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }
        return date.toLocaleDateString();
    } catch {
        return String(iso);
    }
}

function uniq<T>(arr: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const v of arr) {
        const k = JSON.stringify(v);
        if (!seen.has(k)) {
            seen.add(k);
            out.push(v);
        }
    }
    return out;
}

function getScoreColor(score: number): string {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
}

function getScoreBadgeClass(score: number): string {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (score >= 60) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (score >= 40) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-red-100 text-red-700 border-red-200';
}

function StatCard({ label, value, change, icon, color, subtitle }: {
    label: string;
    value: number | string;
    change?: number;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'amber' | 'red';
    subtitle?: string;
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
                <div className="text-2xl font-bold text-gray-900">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
                {subtitle && (
                    <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
                )}
                {change !== undefined && (
                    <div className={`mt-1 text-xs ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% from previous
                    </div>
                )}
            </div>
        </div>
    );
}

/* ================= Main Component ================= */
export default function CompanyReputationPage() {
    const { hash } = useParams<{ hash: string }>();
    const router = useRouter();
    const pathname = usePathname();
    const search = useSearchParams();

    // State management
    const urlFrom = search.get("from");
    const urlTo = search.get("to");
    const urlQuick = search.get("quick");
    const urlDomainId = search.get("domainId");
    const urlProviders = search.get("providers");

    const initialQuick: number | null =
        urlQuick === null ? 30 : (urlQuick === "custom" ? null : Number(urlQuick) || 30);

    const [quick, setQuick] = useState<number | null>(initialQuick);
    const [from, setFrom] = useState<string>(() => {
        if (urlFrom) return urlFrom;
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - ((initialQuick ?? 30) - 1));
        return ymd(d);
    });
    const [to, setTo] = useState<string>(() => urlTo || todayYMD());

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ReputationHistoryResponse | null>(null);
    const [activeDomainId, setActiveDomainId] = useState<number | null>(
        urlDomainId ? Number(urlDomainId) : null
    );
    const [selectedProviders, setSelectedProviders] = useState<string[]>(
        urlProviders ? urlProviders.split(",").filter(Boolean) : []
    );

    // URL sync
    useEffect(() => {
        const params = new URLSearchParams(search.toString());
        params.set("from", from);
        params.set("to", to);
        params.set("quick", quick == null ? "custom" : String(quick));
        if (activeDomainId != null) params.set("domainId", String(activeDomainId));
        else params.delete("domainId");
        if (selectedProviders.length) params.set("providers", selectedProviders.join(","));
        else params.delete("providers");
        router.replace(`${pathname}?${params.toString()}`);
    }, [from, to, quick, activeDomainId, selectedProviders, search, router, pathname]);

    useEffect(() => {
        if (quick == null) return;
        const end = new Date();
        const start = new Date();
        start.setUTCDate(start.getUTCDate() - (quick - 1));
        setFrom(ymd(start));
        setTo(ymd(end));
    }, [quick]);

    // Fetch data
    useEffect(() => {
        let aborted = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const url = `${backend}/companies/${hash}/reputation/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
                const res = await fetch(url, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed: ${res.status}`);
                const json: ReputationHistoryResponse = await res.json();
                if (aborted) return;
                setData(json);
                const firstId = json.domains?.[0]?.id ?? null;
                setActiveDomainId(prev => {
                    if (prev == null) return firstId;
                    return json.domains.some(d => d.id === prev) ? prev : firstId;
                });
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to load reputation history";
                if (!aborted) setError(msg);
            } finally {
                if (!aborted) setLoading(false);
            }
        })();
        return () => { aborted = true; };
    }, [hash, from, to]);

    // Data processing
    const domainItems: HistoryItem[] = useMemo(() => {
        if (!data || activeDomainId == null) return [];
        return data.history[String(activeDomainId)] ?? [];
    }, [data, activeDomainId]);

    const allProviders: string[] = useMemo(() => {
        const ps = domainItems.map(i => i.provider ?? "unknown");
        return uniq(ps);
    }, [domainItems]);

    useEffect(() => {
        if (selectedProviders.length === 0 && allProviders.length > 0) {
            setSelectedProviders(allProviders.slice(0, Math.min(3, allProviders.length)));
        }
    }, [allProviders, selectedProviders.length]);

    const series: LinePoint[] = useMemo(() => {
        const byDay: Record<string, Record<string, number>> = {};
        for (const it of domainItems) {
            const day = it.sampledAt.slice(0, 10);
            const prov = it.provider ?? "unknown";
            byDay[day] ??= {};
            byDay[day][prov] = it.score;
        }
        const days = Object.keys(byDay).sort();
        return days.map(d => ({ date: d, ...byDay[d] }));
    }, [domainItems]);

    const latestScores = useMemo(() => {
        const latest: Record<string, number> = {};
        for (const prov of allProviders) {
            const item = [...domainItems].reverse().find(i => (i.provider ?? "unknown") === prov);
            if (item) latest[prov] = item.score;
        }
        return latest;
    }, [domainItems, allProviders]);

    const avgLatest = useMemo(() => {
        const vals = Object.values(latestScores);
        if (!vals.length) return 0;
        const sum = vals.reduce((a, b) => a + b, 0);
        return Math.round((sum / vals.length) * 10) / 10;
    }, [latestScores]);

    const applyQuickRange = (days: number) => {
        setQuick(days);
    };

    const onChangeFrom = (v: string) => {
        setFrom(v);
        setQuick(null);
    };

    const onChangeTo = (v: string) => {
        setTo(v);
        setQuick(null);
    };

    const toggleProvider = (p: string) => {
        setSelectedProviders(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    };

    const activeDomain = data?.domains.find(d => d.id === activeDomainId) ?? null;

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

    if (error || !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Reputation Data</h2>
                    </div>
                    <p className="text-gray-600">{error || "Failed to load data"}</p>
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
                            <h1 className="text-2xl font-bold text-gray-900">Reputation Reports</h1>
                            <p className="text-sm text-gray-500">
                                {data.company.name || "Company"} • {domainItems.length} samples
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Average Score"
                        value={avgLatest}
                        icon={<TrophyIcon className="h-5 w-5" />}
                        color="emerald"
                        subtitle={activeDomain?.name}
                    />
                    <StatCard
                        label="Providers"
                        value={allProviders.length}
                        icon={<BuildingOfficeIcon className="h-5 w-5" />}
                        color="blue"
                        subtitle="In selected range"
                    />
                    <StatCard
                        label="Total Samples"
                        value={domainItems.length}
                        icon={<DocumentChartBarIcon className="h-5 w-5" />}
                        color="amber"
                        subtitle="Data points collected"
                    />
                    <StatCard
                        label="Best Score"
                        value={Math.max(...Object.values(latestScores), 0)}
                        icon={<StarIcon className="h-5 w-5" />}
                        color="red"
                        subtitle="Latest maximum"
                    />
                </div>

                {/* Filters Section */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <FunnelIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Date Range & Domain</h3>
                            </div>
                            <div className="text-xs text-purple-100">
                                {toDateLabel(from, 'date')} to {toDateLabel(to, 'date')}
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
                                            ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <CalendarDaysIcon className="h-3.5 w-3.5" />
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Date & Domain Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <CalendarDaysIcon className="inline h-4 w-4 mr-1" />
                                    Date From
                                </label>
                                <input
                                    type="date"
                                    value={from}
                                    onChange={(e) => onChangeFrom(e.target.value)}
                                    max={to}
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
                                    value={to}
                                    onChange={(e) => onChangeTo(e.target.value)}
                                    min={from}
                                    max={todayYMD()}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <TagIcon className="inline h-4 w-4 mr-1" />
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

                {/* Provider Selection */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <BuildingOfficeIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Provider Selection</h3>
                        </div>
                    </div>
                    <div className="p-6">
                        {allProviders.length === 0 ? (
                            <p className="text-sm text-gray-500">No provider samples in this range.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {allProviders.map((p) => {
                                    const active = selectedProviders.includes(p);
                                    const score = latestScores[p];
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => toggleProvider(p)}
                                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                                                active
                                                    ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>{p}</span>
                                                {score !== undefined && (
                                                    <span className={`text-xs font-bold ${getScoreColor(score)}`}>
                                                        {score}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        onClick={() => setSelectedProviders(allProviders)}
                                        className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                                    >
                                        <CheckCircleIcon className="h-4 w-4" />
                                        Select All
                                    </button>
                                    <button
                                        onClick={() => setSelectedProviders([])}
                                        className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Time Series Chart */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <ChartPieIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">
                                    Reputation Over Time
                                </h3>
                            </div>
                            <div className="text-xs text-blue-100">
                                {activeDomain?.name}
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <ResponsiveContainer width="100%" height={320}>
                            <AreaChart data={series} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                                <defs>
                                    {selectedProviders.map((p, idx) => (
                                        <linearGradient key={p} id={`color${idx}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS[idx % CHART_COLORS.length]} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={CHART_COLORS[idx % CHART_COLORS.length]} stopOpacity={0.05}/>
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    tickMargin={10}
                                />
                                <YAxis
                                    domain={[0, 100]}
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
                                {selectedProviders.map((p, idx) => (
                                    <Area
                                        key={p}
                                        type="monotone"
                                        dataKey={p}
                                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                                        strokeWidth={2}
                                        fill={`url(#color${idx})`}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Latest Scores Bar Chart */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <StarIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">
                                Latest Provider Scores
                            </h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart
                                data={Object.entries(latestScores)
                                    .filter(([prov]) => selectedProviders.includes(prov))
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([provider, score]) => ({ provider, score }))}
                                margin={{ top: 10, right: 30, left: 0, bottom: 40 }}
                            >
                                <defs>
                                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="provider"
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Bar
                                    dataKey="score"
                                    name="Score"
                                    fill="url(#colorBar)"
                                    radius={[8, 8, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Raw Data Table */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <DocumentChartBarIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">
                                    Raw Sample Data
                                </h3>
                            </div>
                            <div className="text-xs text-gray-300">
                                {activeDomain?.name} • {domainItems.length} samples
                            </div>
                        </div>
                    </div>

                    {domainItems.length === 0 ? (
                        <div className="p-12 text-center">
                            <SparklesIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-lg font-semibold text-gray-900">No samples found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                No reputation samples available for this date range
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Provider
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Score
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Notes
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {domainItems
                                    .slice()
                                    .sort((a, b) => b.sampledAt.localeCompare(a.sampledAt))
                                    .map((r) => (
                                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex items-center gap-2">
                                                    <ClockIcon className="h-4 w-4 text-gray-400" />
                                                    {toDateLabel(r.sampledAt, 'full')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {r.provider || <span className="text-gray-400 italic">Unknown</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getScoreBadgeClass(r.score)}`}>
                                                        <StarSolid className="h-3 w-3 mr-1" />
                                                        {r.score}
                                                    </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {r.notes || <span className="text-gray-400">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}