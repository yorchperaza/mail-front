'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ResponsiveContainer,
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Brush, ReferenceLine,
    BarChart, Bar, Legend,
} from 'recharts';

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

/* Quick little skeleton */
const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`animate-pulse rounded bg-gray-100 ${className || ''}`} />
);

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
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-5 w-40" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                </div>
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
            </div>
        );
    }

    if (err) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-red-700 bg-red-50 border border-red-200 p-3 rounded">
                    Failed to load usage: {err}
                </p>
                <button
                    className="mt-4 px-3 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 text-sm"
                    onClick={() => location.reload()}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(`/dashboard/company/${hash}`)}
                        className="inline-flex items-center text-gray-600 hover:text-gray-800"
                    >
                        ← Back
                    </button>
                    <h1 className="text-2xl font-semibold">Usage</h1>
                    <span className="text-sm text-gray-500">Daily & Monthly recipients count</span>
                </div>
                <Link href={`/dashboard/company/${hash}`} className="text-blue-700 hover:underline">
                    Company Overview →
                </Link>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Today */}
                <div className="rounded-lg border bg-white p-4">
                    <div className="text-sm text-gray-600">Today</div>
                    <div className="mt-1 text-2xl font-semibold">{fmtNum(sentToday)}</div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>Daily limit</span>
                        <span>{dailyLimit > 0 ? fmtNum(dailyLimit) : '—'}</span>
                    </div>
                    <div className="mt-2 h-2 rounded bg-gray-100 overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${clamp(pctDay, 0, 100)}%` }} />
                    </div>
                    <div className="mt-1 text-right text-xs text-gray-500">
                        {dailyLimit > 0 ? fmtPct(pctDay) : 'no limit set'}
                    </div>
                </div>

                {/* Month */}
                <div className="rounded-lg border bg-white p-4">
                    <div className="text-sm text-gray-600">This Month</div>
                    <div className="mt-1 text-2xl font-semibold">{fmtNum(sentThisMonth)}</div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>Monthly limit</span>
                        <span>{monthlyLimit > 0 ? fmtNum(monthlyLimit) : '—'}</span>
                    </div>
                    <div className="mt-2 h-2 rounded bg-gray-100 overflow-hidden">
                        <div className="h-full bg-emerald-600" style={{ width: `${clamp(pctMonth, 0, 100)}%` }} />
                    </div>
                    <div className="mt-1 text-right text-xs text-gray-500">
                        {monthlyLimit > 0 ? fmtPct(pctMonth) : 'no limit set'}
                    </div>
                    {summary?.monthlyCounter?.updatedAt && (
                        <div className="mt-2 text-xs text-gray-400">
                            Counter updated {new Date(summary.monthlyCounter.updatedAt).toLocaleString()}
                        </div>
                    )}
                </div>

                {/* Limits quick glance */}
                <div className="rounded-lg border bg-white p-4">
                    <div className="text-sm text-gray-600">Plan Limits</div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded border p-2">
                            <div className="text-gray-500 text-xs">Daily</div>
                            <div className="font-medium">{dailyLimit > 0 ? fmtNum(dailyLimit) : '—'}</div>
                        </div>
                        <div className="rounded border p-2">
                            <div className="text-gray-500 text-xs">Monthly</div>
                            <div className="font-medium">{monthlyLimit > 0 ? fmtNum(monthlyLimit) : '—'}</div>
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-500">Based on your company plan & overrides.</div>
                </div>
            </div>

            {/* Daily area chart */}
            <div className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Daily volume (recipients)</div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Quick range:</span>
                        {[7, 14, 30, 60, 90].map(n => (
                            <button
                                key={n}
                                onClick={() => setRangeDays(n)}
                                className={`px-2 py-1 rounded border ${rangeDays === n ? 'bg-gray-900 text-white border-gray-900' : 'hover:bg-gray-50'}`}
                            >
                                {n}d
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-2 h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                            <defs>
                                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.6}/>
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} tickMargin={8} minTickGap={24} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={40} />
                            <Tooltip
                                contentStyle={{ fontSize: 12 }}
                                formatter={(v: number | string, name: string): [string, string] => [String(v), name]}
                                labelFormatter={(label: string) => `Date: ${label}`}
                            />
                            {dailyLimit > 0 && (
                                <ReferenceLine
                                    y={dailyLimit}
                                    stroke="#ef4444"
                                    strokeDasharray="4 4"
                                    label={{ value: 'Daily limit', position: 'insideTopRight', fill: '#ef4444', fontSize: 11 }}
                                />
                            )}
                            <Area
                                type="monotone"
                                dataKey="sent"
                                name="Sent"
                                stroke="#2563eb"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#sentGrad)"
                                activeDot={{ r: 4 }}
                            />
                            <Brush dataKey="date" height={22} stroke="#9ca3af" travellerWidth={8} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Monthly comparison bar chart */}
            <div className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Recent months (recipients)</div>
                    <div className="text-xs text-gray-500">Uses the authoritative monthly counter when available.</div>
                </div>

                <div className="mt-2 h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyBars} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} tickMargin={8} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={40} />
                            <Tooltip
                                contentStyle={{ fontSize: 12 }}
                                formatter={(v: number | string): [string, string] => [String(v), 'Sent']}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="sent" name="Sent (recipients)" stroke="#111827" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
