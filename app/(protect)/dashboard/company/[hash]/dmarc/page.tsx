"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    PieChart, Pie, Cell,
} from "recharts";

/* ================= Types (tolerant) ================= */
type DmarcPolicy = { adkim?: string|null; aspf?: string|null; p?: string|null; sp?: string|null; pct?: number|null };
type DmarcWindow = { start: string|null; end: string|null };

type DmarcAggregateRecord = {
    count?: number;
    all?: { count?: number };
    org_name?: string;
    reporter?: string;
    provider?: string;
    policy_published?: { domain?: string };
    identifiers?: { header_from?: string };
    policy_evaluated?: { disposition?: string; dkim?: string; spf?: string };
    disposition?: string;
    dkim?: string;
    spf?: string;
};
type DmarcRows = DmarcAggregateRecord[] | { records?: DmarcAggregateRecord[] } | unknown;

type DmarcRow = {
    id: number;
    org: string|null;
    reportId: string|null;
    window: DmarcWindow;
    policy: DmarcPolicy;
    rows: DmarcRows;
    receivedAt: string|null;
};

type DomainBrief = { id: number; name: string };
type CompanyDmarcResponse = {
    company: { id: number; hash: string; name: string|null };
    range: { from: string; to: string };
    domains: DomainBrief[];
    reports: Record<string, DmarcRow[]>;
};

type OrgBar = { org: string; count: number };
type DispBar = { disposition: string; count: number };
type PieDatum = { name: "Pass (aligned)" | "SPF fail" | "DKIM fail" | "Other"; value: number };

/* ================= Helpers ================= */
const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const QUICK_RANGES = [7, 14, 30, 60, 90] as const;

function authHeaders(): HeadersInit {
    const token = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
function fmt(n?: number|null) { return n == null || Number.isNaN(n) ? "0" : new Intl.NumberFormat().format(n); }
function toDateLabel(iso?: string|null) { if (!iso) return "—"; try { return new Date(iso).toLocaleString(); } catch { return String(iso); } }
function todayYMD() { return new Date().toISOString().slice(0,10); }
function isRecordArray(x: unknown): x is DmarcAggregateRecord[] { return Array.isArray(x); }

function extractSourceStats(rowsAny: DmarcRows) {
    const byOrg: Record<string, number> = {};
    const byDisposition: Record<string, number> = {};
    let passedAligned = 0, failedSpf = 0, failedDkim = 0, total = 0;

    let rows: DmarcAggregateRecord[] = [];
    if (isRecordArray(rowsAny)) rows = rowsAny;
    else if (rowsAny && typeof rowsAny === "object" && isRecordArray((rowsAny as { records?: unknown }).records)) {
        rows = (rowsAny as { records: DmarcAggregateRecord[] }).records;
    }

    for (const r of rows) {
        const count = Number(r?.count ?? r?.all?.count ?? 0) || 0;
        total += count;

        const org =
            r?.org_name ?? r?.reporter ?? r?.provider ??
            r?.policy_published?.domain ?? r?.identifiers?.header_from ?? "unknown";
        byOrg[String(org)] = (byOrg[String(org)] || 0) + count;

        const disp = String(r?.policy_evaluated?.disposition ?? r?.disposition ?? "none");
        byDisposition[disp] = (byDisposition[disp] || 0) + count;

        const dkimRes = String(r?.policy_evaluated?.dkim ?? r?.dkim ?? "none");
        const spfRes  = String(r?.policy_evaluated?.spf  ?? r?.spf  ?? "none");
        const dkimPass = /pass/i.test(dkimRes);
        const spfPass  = /pass/i.test(spfRes);
        if (dkimPass && spfPass) passedAligned += count;
        if (!spfPass)  failedSpf  += count;
        if (!dkimPass) failedDkim += count;
    }

    return { byOrg, byDisposition, passedAligned, failedSpf, failedDkim, total };
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
export default function CompanyDmarcReportPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // selected quick range; null = custom
    const [quick, setQuick] = useState<number | null>(30);

    const [from, setFrom] = useState<string>(() => {
        const d = new Date(); d.setUTCDate(d.getUTCDate() - (30 - 1));
        return d.toISOString().slice(0,10);
    });
    const [to, setTo] = useState<string>(() => todayYMD());

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string|null>(null);
    const [data, setData] = useState<CompanyDmarcResponse|null>(null);
    const [activeDomainId, setActiveDomainId] = useState<number|null>(null);

    /* ---------- 1) Hydrate from URL on first render ---------- */
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
            if (QUICK_RANGES.includes(qNum as (typeof QUICK_RANGES)[number])) {
                setQuick(qNum);
                const end = new Date();
                const start = new Date(); start.setUTCDate(start.getUTCDate() - (qNum - 1));
                setFrom(start.toISOString().slice(0,10));
                setTo(end.toISOString().slice(0,10));
            } else {
                setQuick(null);
            }
        }
        if (f && t) { setFrom(f); setTo(t); setQuick(null); }

        if (d) {
            const id = Number(d);
            if (!Number.isNaN(id)) setActiveDomainId(id);
        }
    }, [searchParams]);

    /* ---------- 2) Keep URL synced with state (shareable) ---------- */
    useEffect(() => {
        const qs = new URLSearchParams();

        if (quick != null && QUICK_RANGES.includes(quick as (typeof QUICK_RANGES)[number])) {
            qs.set("q", String(quick));
        } else {
            if (from) qs.set("from", from);
            if (to)   qs.set("to", to);
        }
        if (activeDomainId != null) qs.set("domain", String(activeDomainId));

        const next = `${pathname}?${qs.toString()}`;
        const current = `${pathname}?${searchParams.toString()}`;
        if (next !== current) router.replace(next, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quick, from, to, activeDomainId, pathname]);

    /* ---------- 3) Quick range recompute ---------- */
    useEffect(() => {
        if (quick == null) return;
        const end = new Date();
        const start = new Date(); start.setUTCDate(start.getUTCDate() - (quick - 1));
        setFrom(start.toISOString().slice(0,10));
        setTo(end.toISOString().slice(0,10));
    }, [quick]);

    /* ---------- 4) Fetch ---------- */
    useEffect(() => {
        let aborted = false;
        (async () => {
            try {
                setLoading(true); setError(null);
                const url = `${backend}/companies/${hash}/reports/dmarc?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
                const res = await fetch(url, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed: ${res.status}`);
                const json: CompanyDmarcResponse = await res.json();
                if (aborted) return;
                setData(json);
                setActiveDomainId(prev => prev ?? json.domains?.[0]?.id ?? null);
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to load DMARC data";
                if (!aborted) setError(msg);
            } finally {
                if (!aborted) setLoading(false);
            }
        })();
        return () => { aborted = true; };
    }, [hash, from, to]);

    // manual date => custom
    const onChangeFrom = (v: string) => { setFrom(v); setQuick(null); };
    const onChangeTo   = (v: string) => { setTo(v);   setQuick(null); };
    const isCustom = quick == null;

    const activeDomain = useMemo(
        () => (data && activeDomainId != null ? data.domains.find(d => d.id === activeDomainId) ?? null : null),
        [data, activeDomainId]
    );

    const domainReports: DmarcRow[] = useMemo(() => {
        if (!data || activeDomainId == null) return [];
        return data.reports?.[String(activeDomainId)] || [];
    }, [data, activeDomainId]);

    const agg = useMemo(() => {
        const byOrg: Record<string, number> = {};
        const byDisposition: Record<string, number> = {};
        let passedAligned = 0, failedSpf = 0, failedDkim = 0, total = 0;
        for (const r of domainReports) {
            const s = extractSourceStats(r.rows);
            total += s.total; passedAligned += s.passedAligned; failedSpf += s.failedSpf; failedDkim += s.failedDkim;
            for (const [k,v] of Object.entries(s.byOrg)) byOrg[k] = (byOrg[k] || 0) + v;
            for (const [k,v] of Object.entries(s.byDisposition)) byDisposition[k] = (byDisposition[k] || 0) + v;
        }
        return { byOrg, byDisposition, passedAligned, failedSpf, failedDkim, total };
    }, [domainReports]);

    const orgBars: OrgBar[] =
        useMemo(() => Object.entries(agg.byOrg).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([org,count])=>({org,count})), [agg.byOrg]);

    const dispBars: DispBar[] =
        useMemo(() => Object.entries(agg.byDisposition).sort((a,b)=>b[1]-a[1]).map(([disposition,count])=>({disposition,count})), [agg.byDisposition]);

    const pieData: PieDatum[] = useMemo(() => {
        const pass = agg.passedAligned;
        const spfFail = Math.max(agg.failedSpf - pass, 0);
        const dkimFail = Math.max(agg.failedDkim - pass, 0);
        const other = Math.max(agg.total - (pass + spfFail + dkimFail), 0);
        return [
            { name: "Pass (aligned)", value: pass },
            { name: "SPF fail", value: spfFail },
            { name: "DKIM fail", value: dkimFail },
            { name: "Other", value: other },
        ];
    }, [agg]);

    /* ================ Render ================ */
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

    const policy = (domainReports[0]?.policy || {}) as DmarcPolicy;

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push(`/dashboard/company/${data.company.hash}`)} className="text-gray-600 hover:text-gray-800">← Back</button>
                    <h1 className="text-2xl font-semibold">DMARC Reports</h1>
                    <span className="text-sm text-gray-500">{data.company.name || "Company"}</span>
                </div>
                <Link href={`/dashboard/company/${data.company.hash}`} className="text-blue-700 hover:underline">Company Overview →</Link>
            </div>

            {/* Sticky toolbar */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="text-sm text-gray-600">Date range</div>
                    <input type="date" value={from} onChange={(e)=>onChangeFrom(e.target.value)} className="border rounded px-2 py-1 text-sm" max={to} />
                    <span className="text-gray-400">→</span>
                    <input type="date" value={to} onChange={(e)=>onChangeTo(e.target.value)} className="border rounded px-2 py-1 text-sm" min={from} max={todayYMD()} />

                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-gray-500">Quick:</span>
                        {QUICK_RANGES.map(n => (
                            <SegButton key={n} active={!isCustom && quick === n} onClick={()=> setQuick(n)} disabled={loading}>{n}d</SegButton>
                        ))}
                        <SegButton active={isCustom} onClick={()=> setQuick(null)} disabled={loading}>Custom</SegButton>
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
            {(() => {
                const p = policy;
                const cards = [
                    { label: "Messages observed", value: fmt(agg.total),           sub: "From DMARC aggregate reports" },
                    { label: "Pass (aligned SPF & DKIM)", value: fmt(agg.passedAligned), sub: "Strict pass (both mechanisms)" },
                    { label: "Policy", value: `p=${p.p ?? "—"}  sp=${p.sp ?? "—"}  pct=${p.pct ?? "—"}`, sub: `adkim=${p.adkim ?? "—"}  aspf=${p.aspf ?? "—"}` },
                ];
                return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {cards.map((c,i)=>(
                            <div key={i} className="rounded-xl border bg-white p-4">
                                <div className="text-sm text-gray-600">{c.label}</div>
                                <div className="mt-1 text-2xl font-semibold tracking-tight">{c.value}</div>
                                <div className="mt-1 text-xs text-gray-500">{c.sub}</div>
                            </div>
                        ))}
                    </div>
                );
            })()}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top reporters */}
                <div className="rounded-xl border bg-white p-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Top reporters / providers</div>
                        <div className="text-xs text-gray-500">{activeDomain?.name ?? "domain"} · {fmt(agg.total)} msgs</div>
                    </div>
                    <div className="mt-2 h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={orgBars} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="org" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                                <Tooltip formatter={(value: number) => [String(value), "count"] as [string, string]} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="count" name="Messages" radius={[6,6,0,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pass/Fail pie */}
                <div className="rounded-xl border bg-white p-4">
                    <div className="text-sm font-medium">Pass vs Fail buckets</div>
                    <div className="mt-2 h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} label>
                                    {pieData.map((_, i) => <Cell key={i} />)}
                                </Pie>
                                <Tooltip formatter={(value: number, name: string) => [String(value), name] as [string, string]} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Disposition */}
            <div className="rounded-xl border bg-white p-4">
                <div className="text-sm font-medium">Disposition (as evaluated by receivers)</div>
                <div className="mt-2 h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dispBars} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="disposition" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                            <Tooltip formatter={(value: number) => [String(value), "count"] as [string, string]} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="count" name="Messages" radius={[6,6,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Raw table */}
            <div className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Raw report windows ({activeDomain?.name || "domain"})</div>
                    <div className="text-xs text-gray-500">From {data.range.from} to {data.range.to}</div>
                </div>
                {domainReports.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-500">No DMARC reports for this range.</p>
                ) : (
                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                            <tr className="text-left text-gray-600 border-b">
                                <th className="py-2 pr-4">Reporter</th>
                                <th className="py-2 pr-4">Window</th>
                                <th className="py-2 pr-4">Policy</th>
                                <th className="py-2 pr-4">Pct</th>
                                <th className="py-2 pr-4">Received</th>
                                <th className="py-2 pr-4">Report ID</th>
                            </tr>
                            </thead>
                            <tbody>
                            {domainReports.map((r) => (
                                <tr key={r.id} className="border-b last:border-0">
                                    <td className="py-2 pr-4">{r.org || "—"}</td>
                                    <td className="py-2 pr-4">{toDateLabel(r.window.start)} → {toDateLabel(r.window.end)}</td>
                                    <td className="py-2 pr-4">p={r.policy?.p ?? "—"}, sp={r.policy?.sp ?? "—"}, adkim={r.policy?.adkim ?? "—"}, aspf={r.policy?.aspf ?? "—"}</td>
                                    <td className="py-2 pr-4">{r.policy?.pct ?? "—"}</td>
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
