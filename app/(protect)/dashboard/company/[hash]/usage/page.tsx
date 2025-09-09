'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ResponsiveContainer,
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Brush, ReferenceLine,
    BarChart, Bar,
} from 'recharts';
import {
    ArrowLeftIcon,
    ChartBarIcon,
    CalendarDaysIcon,
    ChartPieIcon,
    ArrowTrendingUpIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
    BoltIcon as BoltSolid,
    CalendarDaysIcon as CalendarDaysSolid,
} from '@heroicons/react/24/solid';

/* ========================= Types (tolerant) ========================= */

type UsageSummary = {
    quotas?: { dailyLimit?: number; monthlyLimit?: number };
    today?: { sent?: number; resetAt?: string | null };
    month?: { sent?: number; windowStart?: string | null; windowEnd?: string | null };
    monthlyCounter?: { key?: string; count?: number; updatedAt?: string | null };
    // NEW: tolerate backend v2 shape
    daily?: { count?: number; limit?: number };
    monthly?: { count?: number; limit?: number };
};

type DailyRow = { date: string; sent?: number; delivered?: number; bounced?: number; opens?: number; clicks?: number };
type MonthCompareRow = { month: string; sent?: number; count?: number };

/* ========================= Helpers ========================= */

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || '';

function clamp(n: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
    return Math.max(min, Math.min(max, n));
}
function fmtNum(n?: number | null) {
    if (n == null || Number.isNaN(n)) return '0';
    return new Intl.NumberFormat().format(n);
}
function fmtPct(n: number) {
    return `${clamp(n, 0, 100).toFixed(0)}%`;
}
function todayUtcYMD() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function ymdOffset(days: number) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/* Skeleton Loader */
const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`animate-pulse rounded-lg bg-gray-200 ${className || ''}`} />
);

/* Stat Card Component */
function StatCard({ label, value, limit, percentage, icon, color, subtitle }: {
    label: string;
    value: number;
    limit?: number;
    percentage?: number;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'indigo' | 'purple';
    subtitle?: string;
}) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        indigo: 'from-indigo-500 to-indigo-600',
        purple: 'from-purple-500 to-purple-600',
    };

    const progressColors = {
        blue: 'bg-blue-500',
        emerald: 'bg-emerald-500',
        indigo: 'bg-indigo-500',
        purple: 'bg-purple-500',
    };

    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden hover:shadow-lg transition-all">
            <div className={`bg-gradient-to-r ${colors[color]} p-3`}>
                <div className="flex items-center justify-between text-white">
                    {icon}
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-90">{label}</span>
                </div>
            </div>
            <div className="p-4">
                <div className="text-2xl font-bold text-gray-900">{fmtNum(value)}</div>
                {subtitle && (
                    <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
                )}
                {limit !== undefined && limit > 0 && (
                    <>
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                            <span>Limit</span>
                            <span className="font-medium">{fmtNum(limit)}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                                className={`h-full ${progressColors[color]} transition-all duration-500`}
                                style={{ width: `${clamp(percentage || 0, 0, 100)}%` }}
                            />
                        </div>
                        <div className="mt-1 text-right text-xs">
                            <span className={`font-medium ${percentage && percentage > 80 ? 'text-amber-600' : 'text-gray-600'}`}>
                                {fmtPct(percentage || 0)} used
                            </span>
                        </div>
                    </>
                )}
                {limit === 0 && (
                    <div className="mt-3 text-xs text-gray-400 italic">No limit set</div>
                )}
            </div>
        </div>
    );
}

/* ========================= Page ========================= */

export default function CompanyUsagePage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();

    // token: undefined (initializing) | null | string
    const [token, setToken] = useState<string | null | undefined>(undefined);
    useEffect(() => {
        const t = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        setToken(t ?? null);
    }, []);

    const [summary, setSummary] = useState<UsageSummary | null>(null);
    const [daily, setDaily] = useState<DailyRow[]>([]);
    const [monthly, setMonthly] = useState<MonthCompareRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Date window for daily series (default: last 30d)
    const [rangeDays, setRangeDays] = useState(30);
    const to = todayUtcYMD();
    const from = ymdOffset(-(rangeDays - 1));

    const baseHeaders: HeadersInit = useMemo(
        () => ({
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }),
        [token]
    );

    // Fetch everything — only after token is known (even if it's null).
    useEffect(() => {
        if (token === undefined) return; // still initializing
        let aborted = false;

        async function run() {
            try {
                setLoading(true);
                setErr(null);

                const summaryUrl = `${backend}/usage-summary/companies/${hash}`;
                const dailyUrl   = `${backend}/usage-daily/companies/${hash}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
                const compareUrl = `${backend}/usage-compare/companies/${hash}?months=6`;

                const [sRes, dRes, mRes] = await Promise.all([
                    fetch(summaryUrl, { headers: baseHeaders }),
                    fetch(dailyUrl,   { headers: baseHeaders }),
                    fetch(compareUrl, { headers: baseHeaders }),
                ]);

                if (!sRes.ok) throw new Error(`Summary failed (${sRes.status})`);
                if (!dRes.ok) throw new Error(`Daily failed (${dRes.status})`);
                if (!mRes.ok) throw new Error(`Monthly compare failed (${mRes.status})`);

                const [sJson, dJson, mJson] = await Promise.all([sRes.json(), dRes.json(), mRes.json()]);

                if (aborted) return;

                // ---- Tolerant parsing for daily ----
                const parsedDaily: DailyRow[] = Array.isArray(dJson)
                    ? dJson
                    : dJson && dJson.series && typeof dJson.series === 'object'
                        ? Object.entries(dJson.series).map(([date, sent]) => ({ date, sent: Number(sent) || 0 }))
                        : [];

                // ---- Tolerant parsing for compare (months) ----
                const parsedMonthly: MonthCompareRow[] = Array.isArray(mJson)
                    ? mJson
                    : mJson && mJson.months && typeof mJson.months === 'object'
                        ? Object.entries(mJson.months).map(([ymd, val]) => ({
                            month: (ymd as string).slice(0, 7), // "YYYY-MM-01" -> "YYYY-MM"
                            sent: Number(val) || 0,
                        }))
                        : [];

                setSummary(sJson ?? {});
                setDaily(parsedDaily);
                setMonthly(parsedMonthly);
            } catch (e) {
                if (!aborted) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!aborted) setLoading(false);
            }
        }

        run();
        return () => { aborted = true; };
    }, [hash, baseHeaders, from, to, token]);

    // ===== Derived values (must run every render) =====
    const dailyLimit =
        summary?.quotas?.dailyLimit ??
        summary?.daily?.limit ??
        0;

    const monthlyLimit =
        summary?.quotas?.monthlyLimit ??
        summary?.monthly?.limit ??
        0;

    const sentToday =
        summary?.today?.sent ??
        summary?.daily?.count ??
        0;

    const sentThisMonth =
        (summary?.monthlyCounter?.count ?? null) ??
        (summary?.month?.sent ?? null) ??
        (summary?.monthly?.count ?? 0);

    const pctDay = dailyLimit > 0 ? (sentToday / dailyLimit) * 100 : 0;
    const pctMonth = monthlyLimit > 0 ? (sentThisMonth / monthlyLimit) * 100 : 0;

    const dailyChart = useMemo(() => {
        const rows = daily.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
        return rows.map(r => ({
            date: r.date,
            sent: r.sent ?? 0,
            delivered: r.delivered ?? 0,
            bounced: r.bounced ?? 0,
        }));
    }, [daily]);

    const monthlyBars = useMemo(() => {
        const rows = monthly.slice().sort((a, b) => (a.month < b.month ? -1 : 1));
        return rows.map(r => ({
            month: r.month,
            sent: r.sent ?? r.count ?? 0,
        }));
    }, [monthly]);

    const effectiveLoading = token === undefined || loading;

    /* ========================= Render ========================= */

    if (effectiveLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-10 w-48" />
                        <Skeleton className="h-10 w-40" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-36 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-96 rounded-xl" />
                    <Skeleton className="h-96 rounded-xl" />
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
                        <h2 className="text-lg font-semibold">Error Loading Usage</h2>
                    </div>
                    <p className="text-gray-600">{err}</p>
                    <div className="mt-6 flex gap-3">
                        <button
                            onClick={() => location.reload()}
                            className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                        >
                            Retry
                        </button>
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}`)}
                            className="flex-1 rounded-lg bg-white px-4 py-2 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            Back to Dashboard
                        </button>
                    </div>
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
                            <h1 className="text-2xl font-bold text-gray-900">Usage Analytics</h1>
                            <p className="text-sm text-gray-500">
                                Monitor daily & monthly email volume and limits
                            </p>
                        </div>
                    </div>
                    <Link
                        href={`/dashboard/company/${hash}/messaging/messages`}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                    >
                        View Messages
                        <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                    </Link>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        label="Today's Usage"
                        value={sentToday}
                        limit={dailyLimit}
                        percentage={pctDay}
                        icon={<CalendarDaysSolid className="h-5 w-5" />}
                        color="blue"
                        subtitle={summary?.today?.resetAt ? `Resets ${new Date(summary.today.resetAt).toLocaleTimeString()}` : undefined}
                    />
                    <StatCard
                        label="This Month"
                        value={sentThisMonth}
                        limit={monthlyLimit}
                        percentage={pctMonth}
                        icon={<ChartPieIcon className="h-5 w-5" />}
                        color="emerald"
                        subtitle={summary?.monthlyCounter?.updatedAt ? `Updated ${new Date(summary.monthlyCounter.updatedAt).toLocaleTimeString()}` : undefined}
                    />
                    <StatCard
                        label="Daily Limit"
                        value={dailyLimit}
                        icon={<BoltSolid className="h-5 w-5" />}
                        color="indigo"
                        subtitle="Per 24 hours"
                    />
                    <StatCard
                        label="Monthly Limit"
                        value={monthlyLimit}
                        icon={<ArrowTrendingUpIcon className="h-5 w-5" />}
                        color="purple"
                        subtitle="Rolling 30 days"
                    />
                </div>

                {/* Warning Alerts */}
                {pctDay > 80 && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                        <div className="flex items-center gap-3">
                            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-amber-800">Daily Limit Warning</h3>
                                <p className="text-sm text-amber-700 mt-1">
                                    You&#39;ve used {fmtPct(pctDay)} of your daily limit. Consider spreading sends throughout the day.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {pctMonth > 80 && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                        <div className="flex items-center gap-3">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-red-800">Monthly Limit Warning</h3>
                                <p className="text-sm text-red-700 mt-1">
                                    You&#39;ve used {fmtPct(pctMonth)} of your monthly limit. Consider upgrading your plan for higher limits.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Daily area chart */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <ChartBarIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">
                                    Daily Volume Trend
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-indigo-100">Quick range:</span>
                                {[7, 14, 30, 60, 90].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setRangeDays(n)}
                                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                            rangeDays === n
                                                ? 'bg-white/20 text-white ring-1 ring-white/30'
                                                : 'text-indigo-100 hover:bg-white/10'
                                        }`}
                                    >
                                        {n}d
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <ResponsiveContainer width="100%" height={320}>
                            <AreaChart data={dailyChart} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                                <defs>
                                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    tickMargin={10}
                                    minTickGap={24}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    width={50}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                    formatter={(v: number | string, name: string): [string, string] => [fmtNum(Number(v)), name]}
                                    labelFormatter={(label: string) => `Date: ${label}`}
                                />
                                {dailyLimit > 0 && (
                                    <ReferenceLine
                                        y={dailyLimit}
                                        stroke="#ef4444"
                                        strokeDasharray="5 5"
                                        strokeWidth={2}
                                        label={{
                                            value: `Daily limit (${fmtNum(dailyLimit)})`,
                                            position: 'insideTopRight',
                                            fill: '#ef4444',
                                            fontSize: 11,
                                            fontWeight: 600
                                        }}
                                    />
                                )}
                                <Area
                                    type="monotone"
                                    dataKey="sent"
                                    name="Recipients"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#sentGrad)"
                                    activeDot={{ r: 5, fill: '#6366f1' }}
                                />
                                <Brush
                                    dataKey="date"
                                    height={25}
                                    stroke="#9ca3af"
                                    fill="#f9fafb"
                                    travellerWidth={8}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Monthly comparison bar chart */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <CalendarDaysIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">
                                    Monthly Comparison
                                </h3>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-100">
                                <InformationCircleIcon className="h-4 w-4" />
                                <span className="text-xs">Last 6 months</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={monthlyBars} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                                <defs>
                                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.7}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    tickMargin={10}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                    width={50}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                    }}
                                    formatter={(v: number | string): [string, string] => [fmtNum(Number(v)), 'Recipients']}
                                    labelFormatter={(label: string) => `Month: ${label}`}
                                />
                                {monthlyLimit > 0 && (
                                    <ReferenceLine
                                        y={monthlyLimit}
                                        stroke="#ef4444"
                                        strokeDasharray="5 5"
                                        strokeWidth={2}
                                        label={{
                                            value: `Monthly limit (${fmtNum(monthlyLimit)})`,
                                            position: 'insideTopRight',
                                            fill: '#ef4444',
                                            fontSize: 11,
                                            fontWeight: 600
                                        }}
                                    />
                                )}
                                <Bar
                                    dataKey="sent"
                                    name="Recipients Sent"
                                    fill="url(#barGrad)"
                                    radius={[8, 8, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Usage Tips */}
                <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-6">
                    <div className="flex items-start gap-3">
                        <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-blue-900">Usage Tips</h3>
                            <ul className="mt-2 space-y-1 text-sm text-blue-800">
                                <li className="flex items-start gap-2">
                                    <CheckCircleIcon className="h-4 w-4 text-blue-600 mt-0.5" />
                                    <span>Your daily limit resets at midnight UTC</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircleIcon className="h-4 w-4 text-blue-600 mt-0.5" />
                                    <span>Monthly limits are calculated on a rolling 30-day window</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircleIcon className="h-4 w-4 text-blue-600 mt-0.5" />
                                    <span>Contact support to upgrade limits or discuss custom plans</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}