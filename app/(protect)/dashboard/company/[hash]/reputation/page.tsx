"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    BarChart,
    Bar,
} from "recharts";

/* ================= Types ================= */

type Iso = string;

type HistoryItem = {
    id: number;
    provider: string | null;
    score: number;
    sampledAt: Iso; // ISO8601 from API
    notes: string | null;
};

type DomainBrief = { id: number; name: string };

type ReputationHistoryResponse = {
    company: { id: number; hash: string; name: string | null };
    range: { from: string; to: string };
    domains: DomainBrief[];
    history: Record<string, HistoryItem[]>; // key = domainId
};

type LinePoint = { date: string; [provider: string]: number | string };

/* ================= Helpers ================= */

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const QUICK_RANGES = [7, 14, 30, 60, 90] as const;

function authHeaders(): HeadersInit {
    const token = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
function todayYMD() { return new Date().toISOString().slice(0, 10); }
function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function fmt(n?: number | null) { return n == null || Number.isNaN(n) ? "0" : new Intl.NumberFormat().format(n); }

/** dedupe and keep order of first appearance */
function uniq<T>(arr: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const v of arr) {
        const k = JSON.stringify(v);
        if (!seen.has(k)) { seen.add(k); out.push(v); }
    }
    return out;
}

/** small pill button */
const SegButton: React.FC<{
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ active, disabled, onClick, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={[
            "px-2.5 py-1.5 text-xs rounded-md border transition",
            active ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50 border-gray-300 text-gray-700",
            disabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
    >
        {children}
    </button>
);

const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`animate-pulse rounded bg-gray-100 ${className || ""}`} />
);

/* ================= Page ================= */

export default function CompanyReputationPage() {
    const { hash } = useParams<{ hash: string }>();
    const router = useRouter();
    const pathname = usePathname();
    const search = useSearchParams();

    // ---- state seeded from URL
    const urlFrom = search.get("from");
    const urlTo = search.get("to");
    const urlQuick = search.get("quick");
    const urlDomainId = search.get("domainId");
    const urlProviders = search.get("providers"); // csv

    const initialQuick: number | null =
        urlQuick === null ? 30 : (urlQuick === "custom" ? null : Number(urlQuick) || 30);

    const [quick, setQuick] = useState<number | null>(initialQuick);
    const [from, setFrom] = useState<string>(() => {
        if (urlFrom) return urlFrom;
        const d = new Date(); d.setUTCDate(d.getUTCDate() - ((initialQuick ?? 30) - 1));
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

    // ---- keep URL in sync when state changes
    useEffect(() => {
        const params = new URLSearchParams(search.toString());

        params.set("from", from);
        params.set("to", to);
        params.set("quick", quick == null ? "custom" : String(quick));
        if (activeDomainId != null) params.set("domainId", String(activeDomainId)); else params.delete("domainId");
        if (selectedProviders.length) params.set("providers", selectedProviders.join(",")); else params.delete("providers");

        router.replace(`${pathname}?${params.toString()}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [from, to, quick, activeDomainId, selectedProviders]);

    // ---- recompute range when quick changes (unless custom)
    useEffect(() => {
        if (quick == null) return; // custom
        const end = new Date();
        const start = new Date();
        start.setUTCDate(start.getUTCDate() - (quick - 1));
        setFrom(ymd(start));
        setTo(ymd(end));
    }, [quick]);

    // ---- fetch
    useEffect(() => {
        let aborted = false;
        (async () => {
            try {
                setLoading(true); setError(null);
                const url = `${backend}/companies/${hash}/reputation/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
                const res = await fetch(url, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed: ${res.status}`);
                const json: ReputationHistoryResponse = await res.json();
                if (aborted) return;
                setData(json);
                // default domain if none chosen or invalid
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

    // ---- derive current domain history & provider list
    const domainItems: HistoryItem[] = useMemo(() => {
        if (!data || activeDomainId == null) return [];
        return data.history[String(activeDomainId)] ?? [];
    }, [data, activeDomainId]);

    const allProviders: string[] = useMemo(() => {
        const ps = domainItems.map(i => i.provider ?? "unknown");
        return uniq(ps);
    }, [domainItems]);

    // if URL didn’t provide providers, auto-set after first load
    useEffect(() => {
        if (selectedProviders.length === 0 && allProviders.length > 0) {
            setSelectedProviders(allProviders.slice(0, 3)); // preselect a few
        }
    }, [allProviders, selectedProviders.length]);

    // ---- charts data
    const series: LinePoint[] = useMemo(() => {
        // group by day (YYYY-MM-DD) and provider
        const byDay: Record<string, Record<string, number>> = {};
        for (const it of domainItems) {
            const day = it.sampledAt.slice(0, 10);
            const prov = it.provider ?? "unknown";
            byDay[day] ??= {};
            // last sample of the day for provider wins (or average; here: last)
            byDay[day][prov] = it.score;
        }
        const days = Object.keys(byDay).sort(); // chronological
        return days.map(d => ({ date: d, ...byDay[d] }));
    }, [domainItems]);

    const latestScores = useMemo(() => {
        const latest: Record<string, number> = {};
        for (const prov of allProviders) {
            // find most recent for provider
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

    /* ============== UI callbacks ============== */

    const onChangeFrom = (v: string) => { setFrom(v); setQuick(null); };
    const onChangeTo = (v: string) => { setTo(v); setQuick(null); };

    const toggleProvider = (p: string) => {
        setSelectedProviders(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    };

    /* ============== Render ============== */

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-64" />
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

    if (error || !data) {
        return (
            <div className="max-w-xl mx-auto p-6 text-center space-y-4">
                <p className="text-red-700 bg-red-50 border border-red-200 p-3 rounded">{error || "Failed to load."}</p>
                <button onClick={() => location.reload()} className="px-3 py-2 rounded bg-blue-600 text-white text-sm">Retry</button>
            </div>
        );
    }

    const activeDomain = data.domains.find(d => d.id === activeDomainId) ?? null;

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push(`/dashboard/company/${data.company.hash}`)} className="text-gray-600 hover:text-gray-800">← Back</button>
                    <h1 className="text-2xl font-semibold">Reputation Reports</h1>
                    <span className="text-sm text-gray-500">{data.company.name || "Company"}</span>
                </div>
                <Link href={`/dashboard/company/${data.company.hash}`} className="text-blue-700 hover:underline">Company Overview →</Link>
            </div>

            {/* Toolbar */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="text-sm text-gray-600">Date range</div>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => onChangeFrom(e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                        max={to}
                    />
                    <span className="text-gray-400">→</span>
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => onChangeTo(e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                        min={from}
                        max={todayYMD()}
                    />

                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-gray-500">Quick:</span>
                        {QUICK_RANGES.map(n => (
                            <SegButton key={n} active={quick === n} onClick={() => setQuick(n)} disabled={loading}>{n}d</SegButton>
                        ))}
                        <SegButton active={quick === null} onClick={() => setQuick(null)} disabled={loading}>Custom</SegButton>
                    </div>
                </div>
            </div>

            {/* Domain tabs */}
            <div className="flex flex-wrap gap-2">
                {data.domains.length === 0 ? (
                    <span className="text-sm text-gray-500">No domains in this company.</span>
                ) : (
                    data.domains.map(d => {
                        const active = activeDomainId === d.id;
                        return (
                            <button
                                key={d.id}
                                onClick={() => setActiveDomainId(d.id)}
                                className={[
                                    "px-3 py-1.5 rounded-full text-sm border transition",
                                    active ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
                                ].join(" ")}
                            >
                                {d.name}
                            </button>
                        );
                    })
                )}
            </div>

            {/* Provider filters */}
            <div className="rounded-xl border bg-white p-4">
                <div className="text-sm font-medium mb-2">Providers</div>
                {allProviders.length === 0 ? (
                    <p className="text-sm text-gray-500">No provider samples in this range.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {allProviders.map(p => {
                            const active = selectedProviders.includes(p);
                            return (
                                <button
                                    key={p}
                                    onClick={() => toggleProvider(p)}
                                    className={[
                                        "px-2.5 py-1.5 text-xs rounded-md border transition",
                                        active ? "bg-gray-900 text-white border-gray-900"
                                            : "bg-white hover:bg-gray-50 border-gray-300 text-gray-700",
                                    ].join(" ")}
                                >
                                    {p}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setSelectedProviders(allProviders)}
                            className="px-2.5 py-1.5 text-xs rounded-md border bg-white hover:bg-gray-50 text-gray-700"
                        >
                            Select all
                        </button>
                        <button
                            onClick={() => setSelectedProviders([])}
                            className="px-2.5 py-1.5 text-xs rounded-md border bg-white hover:bg-gray-50 text-gray-700"
                        >
                            Clear
                        </button>
                    </div>
                )}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm text-gray-600">Latest average score</div>
                    <div className="mt-1 text-2xl font-semibold">{fmt(avgLatest)}</div>
                    <div className="mt-1 text-xs text-gray-500">{activeDomain?.name ?? "domain"}</div>
                </div>
                <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm text-gray-600">Providers tracked</div>
                    <div className="mt-1 text-2xl font-semibold">{fmt(allProviders.length)}</div>
                    <div className="mt-1 text-xs text-gray-500">In selected range</div>
                </div>
                <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm text-gray-600">Samples</div>
                    <div className="mt-1 text-2xl font-semibold">{fmt(domainItems.length)}</div>
                    <div className="mt-1 text-xs text-gray-500">Total rows</div>
                </div>
            </div>

            {/* Time series */}
            <div className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Reputation over time</div>
                    <div className="text-xs text-gray-500">{activeDomain?.name ?? "domain"}</div>
                </div>
                <div className="mt-2 h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} domain={[0, 100]} tick={{ fontSize: 11 }} width={40} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {selectedProviders.map(p => (
                                <Line key={p} type="monotone" dataKey={p} name={p} dot={false} strokeWidth={2} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Latest snapshot (bar) */}
            <div className="rounded-xl border bg-white p-4">
                <div className="text-sm font-medium mb-2">Latest scores (by provider)</div>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={Object.entries(latestScores)
                                .filter(([prov]) => selectedProviders.includes(prov))
                                .sort((a, b) => b[1] - a[1])
                                .map(([prov, score]) => ({ provider: prov, score }))}
                            margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="provider" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                            <YAxis allowDecimals={false} domain={[0, 100]} tick={{ fontSize: 11 }} width={40} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="score" name="Score" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Raw table */}
            <div className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Raw samples ({activeDomain?.name || "domain"})</div>
                    <div className="text-xs text-gray-500">From {data.range.from} to {data.range.to}</div>
                </div>
                {domainItems.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-500">No reputation samples for this range.</p>
                ) : (
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                            <tr className="text-left text-gray-600 border-b">
                                <th className="py-2 pr-4">Date</th>
                                <th className="py-2 pr-4">Provider</th>
                                <th className="py-2 pr-4">Score</th>
                                <th className="py-2 pr-4">Notes</th>
                            </tr>
                            </thead>
                            <tbody>
                            {domainItems
                                .slice()
                                .sort((a, b) => a.sampledAt.localeCompare(b.sampledAt))
                                .map((r) => (
                                    <tr key={r.id} className="border-b last:border-0">
                                        <td className="py-2 pr-4">{new Date(r.sampledAt).toLocaleString()}</td>
                                        <td className="py-2 pr-4">{r.provider ?? "—"}</td>
                                        <td className="py-2 pr-4">{r.score}</td>
                                        <td className="py-2 pr-4">{r.notes ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
