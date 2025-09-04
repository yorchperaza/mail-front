"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    PieChart, Pie, Cell,
} from "recharts";

/* ================= Types (tolerant, no `any`) ================= */
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
    id: number; org: string | null; reportId: string | null;
    window: TlsRptWindow; summary: { success: number; failure: number };
    details: FailureDetail[] | null; receivedAt: IsoString | null;
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
const QUICK_RANGES = [7, 14, 30, 60, 90] as const;

function authHeaders(): HeadersInit {
    const token = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
function fmt(n?: number | null) { return n == null || Number.isNaN(n) ? "0" : new Intl.NumberFormat().format(n); }
function toDateLabel(iso?: string | null) { if (!iso) return "—"; try { return new Date(iso).toLocaleString(); } catch { return String(iso); } }
function todayYMD() { return new Date().toISOString().slice(0, 10); }

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
            if (c > 0) topFailures.push({ mx, count: c, reason: typeof d["result_reason_code"] === "string" ? d["result_reason_code"] : undefined });
        }
    }
    topFailures.sort((a, b) => b.count - a.count);
    return { success, failure, total: success + failure, byResultType, byReceivingMx, topFailures: topFailures.slice(0, 10) };
}

const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`animate-pulse rounded bg-gray-100 ${className || ""}`} />
);

const SegButton: React.FC<{ active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }>
    = ({ active, disabled, onClick, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={[
            "px-2.5 py-1.5 text-xs rounded-md border",
            active ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50 border-gray-300 text-gray-700",
            disabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
    >
        {children}
    </button>
);

/* ================= Page ================= */
export default function CompanyTlsRptPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // segmented quick range; null === custom
    const [quick, setQuick] = useState<number | null>(30);

    const [from, setFrom] = useState<string>(() => {
        const d = new Date(); d.setUTCDate(d.getUTCDate() - (30 - 1));
        return d.toISOString().slice(0, 10);
    });
    const [to, setTo] = useState<string>(() => todayYMD());

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CompanyTlsRptResponse | null>(null);
    const [activeDomainId, setActiveDomainId] = useState<number | null>(null);

    // ---------- 1) Hydrate state from URL on first render ----------
    const didInitFromUrl = useRef(false);
    useEffect(() => {
        if (didInitFromUrl.current) return;
        didInitFromUrl.current = true;

        const sp = searchParams;
        const qStr = sp.get("q");
        const f = sp.get("from");
        const t = sp.get("to");
        const d = sp.get("domain");

        // quick range if valid
        if (qStr) {
            const qNum = Number(qStr);
            if (QUICK_RANGES.includes(qNum as (typeof QUICK_RANGES)[number])) {
                setQuick(qNum);
                const end = new Date();
                const start = new Date(); start.setUTCDate(start.getUTCDate() - (qNum - 1));
                setFrom(start.toISOString().slice(0, 10));
                setTo(end.toISOString().slice(0, 10));
            } else {
                setQuick(null);
            }
        }

        // custom dates override if both present
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

    // ---------- 2) Keep URL in sync with state (shareable) ----------
    useEffect(() => {
        // Build query: include only meaningful params
        const qs = new URLSearchParams();

        if (quick && QUICK_RANGES.includes(quick as (typeof QUICK_RANGES)[number])) {
            qs.set("q", String(quick));
        } else {
            // custom: encode explicit dates
            if (from) qs.set("from", from);
            if (to) qs.set("to", to);
        }

        if (activeDomainId != null) {
            qs.set("domain", String(activeDomainId));
        }

        // Avoid replacing with identical URL (prevents loops)
        const next = `${pathname}?${qs.toString()}`;
        const current = `${pathname}?${searchParams.toString()}`;
        if (next !== current) {
            router.replace(next, { scroll: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quick, from, to, activeDomainId, pathname]); // (intentionally not depending on searchParams to avoid loops)

    // ---------- 3) When quick changes, recompute dates ----------
    useEffect(() => {
        if (quick == null) return; // custom
        const end = new Date();
        const start = new Date(); start.setUTCDate(start.getUTCDate() - (quick - 1));
        setFrom(start.toISOString().slice(0, 10));
        setTo(end.toISOString().slice(0, 10));
    }, [quick]);

    // ---------- 4) Fetch ----------
    useEffect(() => {
        let aborted = false;
        (async () => {
            try {
                setLoading(true); setError(null);
                const url = `${backend}/companies/${hash}/reports/tlsrpt?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
                const res = await fetch(url, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed: ${res.status}`);
                const json: CompanyTlsRptResponse = await res.json();
                if (aborted) return;
                setData(json);

                // default domain if none selected from URL
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

    // Manual date changes => custom mode
    const onChangeFrom = (v: string) => { setFrom(v); setQuick(null); };
    const onChangeTo   = (v: string) => { setTo(v); setQuick(null); };
    const isCustom = quick == null;

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
        () => Object.entries(agg.byResultType).sort((a, b) => b[1] - a[1]).map(([result, count]) => ({ result, count })),
        [agg.byResultType]
    );

    const byMxBars = useMemo(
        () => Object.entries(agg.byReceivingMx).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([mx, count]) => ({ mx, count })),
        [agg.byReceivingMx]
    );

    const pieData = useMemo(() => ([
        { name: "Successful TLS", value: agg.success },
        { name: "Failed TLS", value: agg.failure },
    ]), [agg.success, agg.failure]);

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

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push(`/dashboard/company/${data.company.hash}`)} className="text-gray-600 hover:text-gray-800">← Back</button>
                    <h1 className="text-2xl font-semibold">TLS-RPT Reports</h1>
                    <span className="text-sm text-gray-500">{data.company.name || "Company"}</span>
                </div>
                <Link href={`/dashboard/company/${data.company.hash}`} className="text-blue-700 hover:underline">
                    Company Overview →
                </Link>
            </div>

            {/* Sticky toolbar: date pickers + segmented quick ranges */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="text-sm text-gray-600">Date range</div>
                    <input
                        type="date" value={from} onChange={(e) => onChangeFrom(e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                        max={to}
                    />
                    <span className="text-gray-400">→</span>
                    <input
                        type="date" value={to} onChange={(e) => onChangeTo(e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                        min={from}
                        max={todayYMD()}
                    />

                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-gray-500">Quick:</span>
                        {QUICK_RANGES.map(n => (
                            <SegButton
                                key={n}
                                active={!isCustom && quick === n}
                                onClick={() => setQuick(n)}
                                disabled={loading}
                            >
                                {n}d
                            </SegButton>
                        ))}
                        <SegButton active={isCustom} onClick={() => setQuick(null)} disabled={loading}>Custom</SegButton>
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

            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm text-gray-600">Total Sessions (reported)</div>
                    <div className="mt-1 text-2xl font-semibold">{fmt(agg.total)}</div>
                    <div className="mt-1 text-xs text-gray-500">{activeDomain?.name ?? "domain"}</div>
                </div>
                <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm text-gray-600">Successful TLS</div>
                    <div className="mt-1 text-2xl font-semibold">{fmt(agg.success)}</div>
                    <div className="mt-1 text-xs text-gray-500">Opportunistic or enforced success</div>
                </div>
                <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm text-gray-600">Failed TLS</div>
                    <div className="mt-1 text-2xl font-semibold">{fmt(agg.failure)}</div>
                    <div className="mt-1 text-xs text-gray-500">Handshake / policy / cert issues</div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Result types */}
                <div className="rounded-xl border bg-white p-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Fail result types</div>
                        <div className="text-xs text-gray-500">{activeDomain?.name ?? "domain"}</div>
                    </div>
                    <div className="mt-2 h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={byResultBars} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="result" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                                <Tooltip formatter={(v: unknown) => [String(v), "failures"]} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="count" name="Failures" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Success vs Fail pie */}
                <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm font-medium">Success vs Fail</div>
                    <div className="mt-2 h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} label>
                                    {pieData.map((_, i) => <Cell key={i} />)}
                                </Pie>
                                <Tooltip formatter={(v: unknown, n: unknown) => [String(v), String(n)]} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Top MX Failures */}
            <div className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Top receiving MX (failures)</div>
                    <div className="text-xs text-gray-500">{activeDomain?.name ?? "domain"}</div>
                </div>
                <div className="mt-2 h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byMxBars} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mx" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                            <Tooltip formatter={(v: unknown) => [String(v), "failures"]} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="count" name="Failures" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top failure list (compact) */}
            <div className="rounded-xl border bg-white p-4">
                <div className="text-sm font-medium mb-2">Top failure instances</div>
                {agg.topFailures.length === 0 ? (
                    <p className="text-sm text-gray-500">No failure details reported for this range.</p>
                ) : (
                    <ul className="divide-y">
                        {agg.topFailures.map((f, i) => (
                            <li key={`${f.mx}-${i}`} className="py-2 flex items-center justify-between">
                                <div className="min-w-0">
                                    <div className="font-medium text-gray-900 truncate">{f.mx}</div>
                                    <div className="text-xs text-gray-500 truncate">{f.reason ?? "—"}</div>
                                </div>
                                <div className="text-sm font-semibold">{fmt(f.count)}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Raw reports table */}
            <div className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Raw report windows ({activeDomain?.name || "domain"})</div>
                    <div className="text-xs text-gray-500">From {data.range.from} to {data.range.to}</div>
                </div>
                {domainReports.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-500">No TLS-RPT reports for this range.</p>
                ) : (
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                            <tr className="text-left text-gray-600 border-b">
                                <th className="py-2 pr-4">Reporter</th>
                                <th className="py-2 pr-4">Window</th>
                                <th className="py-2 pr-4">Success</th>
                                <th className="py-2 pr-4">Failure</th>
                                <th className="py-2 pr-4">Received</th>
                                <th className="py-2 pr-4">Report ID</th>
                            </tr>
                            </thead>
                            <tbody>
                            {domainReports.map((r) => (
                                <tr key={r.id} className="border-b last:border-0">
                                    <td className="py-2 pr-4">{r.org || "—"}</td>
                                    <td className="py-2 pr-4">{toDateLabel(r.window.start)} → {toDateLabel(r.window.end)}</td>
                                    <td className="py-2 pr-4">{fmt(r.summary?.success)}</td>
                                    <td className="py-2 pr-4">{fmt(r.summary?.failure)}</td>
                                    <td className="py-2 pr-4">{toDateLabel(r.receivedAt)}</td>
                                    <td className="py-2 pr-4 font-mono text-[11px] text-gray-500">{r.reportId ?? "—"}</td>
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
