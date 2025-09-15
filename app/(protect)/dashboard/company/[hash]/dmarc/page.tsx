"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import {
    ArrowLeftIcon,
    ChartBarIcon,
    CalendarDaysIcon,
    ShieldCheckIcon,
    ShieldExclamationIcon,
    EnvelopeIcon,
    DocumentChartBarIcon,
    ClockIcon,
    GlobeAltIcon,
    FunnelIcon,
    ExclamationTriangleIcon,
    LockClosedIcon,
    UserGroupIcon,
    ChartPieIcon,
} from '@heroicons/react/24/outline';
import {
    ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    PieChart, Pie, Cell,
} from "recharts";

/* ================= Types ================= */
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

/* ================= Constants & Helpers ================= */
const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const QUICK_RANGES = [
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 14 Days', days: 14 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 60 Days', days: 60 },
    { label: 'Last 90 Days', days: 90 },
];

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#9ca3af'];

// --- Recharts helpers: avoid TS18048 & no-explicit-any ---
type PieLabelInput = { value?: number; percent?: number };

// Safe label for Pie slices
const pieSliceLabel = ({ value, percent }: PieLabelInput) => {
    const v = typeof value === "number" ? value : 0;
    const p = typeof percent === "number" ? percent * 100 : 0;
    return `${v.toLocaleString()} (${p.toFixed(0)}%)`;
};

// Safe tooltip formatter (no 'any')
const tooltipFormatter = (val: number | string) =>
    typeof val === "number" ? val.toLocaleString() : String(val);

function authHeaders(): HeadersInit {
    const token = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function fmt(n?: number|null) {
    return n == null || Number.isNaN(n) ? "0" : new Intl.NumberFormat().format(n);
}

function toDateLabel(iso?: string|null, format: 'full' | 'short' | 'date' = 'short') {
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

function todayYMD() {
    return new Date().toISOString().slice(0,10);
}

function isRecordArray(x: unknown): x is DmarcAggregateRecord[] {
    return Array.isArray(x);
}

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

    const passRate = total > 0 ? (passedAligned / total * 100) : 0;

    return { byOrg, byDisposition, passedAligned, failedSpf, failedDkim, total, passRate };
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

function PolicyBadge({ label, value }: { label: string; value: string | number | null | undefined }) {
    const displayValue = value ?? '—';
    const isStrict = value === 'reject' || value === 's' || value === 100;
    const isRelaxed = value === 'none' || value === 'r' || value === 0;

    return (
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
            isStrict ? 'bg-red-100 text-red-700 border border-red-200' :
                isRelaxed ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                    'bg-gray-100 text-gray-700 border border-gray-200'
        }`}>
            <span className="font-semibold">{label}:</span> {displayValue}
        </span>
    );
}

/* ================= Main Component ================= */
export default function CompanyDmarcReportPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    const [quick, setQuick] = useState<number | null>(30);
    const [from, setFrom] = useState<string>(() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 29);
        return d.toISOString().slice(0,10);
    });
    const [to, setTo] = useState<string>(() => todayYMD());

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string|null>(null);
    const [data, setData] = useState<CompanyDmarcResponse|null>(null);
    const [activeDomainId, setActiveDomainId] = useState<number|null>(null);

    // URL sync
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
                setFrom(start.toISOString().slice(0,10));
                setTo(end.toISOString().slice(0,10));
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

    useEffect(() => {
        const qs = new URLSearchParams();
        const validRange = QUICK_RANGES.find(r => r.days === quick);

        if (quick != null && validRange) {
            qs.set("q", String(quick));
        } else {
            if (from) qs.set("from", from);
            if (to)   qs.set("to", to);
        }
        if (activeDomainId != null) qs.set("domain", String(activeDomainId));

        const next = `${pathname}?${qs.toString()}`;
        const current = `${pathname}?${searchParams.toString()}`;
        if (next !== current) router.replace(next, { scroll: false });
    }, [quick, from, to, activeDomainId, pathname, searchParams, router]);

    useEffect(() => {
        if (quick == null) return;
        const end = new Date();
        const start = new Date();
        start.setUTCDate(start.getUTCDate() - (quick - 1));
        setFrom(start.toISOString().slice(0,10));
        setTo(end.toISOString().slice(0,10));
    }, [quick]);

    // Fetch data
    useEffect(() => {
        let aborted = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
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
        let passedAligned = 0, failedSpf = 0, failedDkim = 0, total = 0, passRate = 0;
        for (const r of domainReports) {
            const s = extractSourceStats(r.rows);
            total += s.total;
            passedAligned += s.passedAligned;
            failedSpf += s.failedSpf;
            failedDkim += s.failedDkim;
            for (const [k,v] of Object.entries(s.byOrg)) byOrg[k] = (byOrg[k] || 0) + v;
            for (const [k,v] of Object.entries(s.byDisposition)) byDisposition[k] = (byDisposition[k] || 0) + v;
        }
        passRate = total > 0 ? (passedAligned / total * 100) : 0;
        return { byOrg, byDisposition, passedAligned, failedSpf, failedDkim, total, passRate };
    }, [domainReports]);

    const orgBars: OrgBar[] =
        useMemo(() => Object.entries(agg.byOrg).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([org,count])=>({org,count})), [agg.byOrg]);

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

    const policy = (domainReports[0]?.policy || {}) as DmarcPolicy;

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
                        <h2 className="text-lg font-semibold">Error Loading DMARC Reports</h2>
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
                            <h1 className="text-2xl font-bold text-gray-900">DMARC Reports</h1>
                            <p className="text-sm text-gray-500">
                                {data.company.name || "Company"} • {domainReports.length} reports
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Messages Observed"
                        value={agg.total}
                        icon={<EnvelopeIcon className="h-5 w-5" />}
                        color="blue"
                        subtitle="From aggregate reports"
                    />
                    <StatCard
                        label="Pass (Aligned)"
                        value={agg.passedAligned}
                        icon={<ShieldCheckIcon className="h-5 w-5" />}
                        color="emerald"
                        subtitle="SPF & DKIM aligned"
                    />
                    <StatCard
                        label="Failed Auth"
                        value={agg.failedSpf + agg.failedDkim - agg.passedAligned}
                        icon={<ShieldExclamationIcon className="h-5 w-5" />}
                        color="red"
                        subtitle="SPF or DKIM failed"
                    />
                    <StatCard
                        label="Pass Rate"
                        value={`${agg.passRate.toFixed(1)}%`}
                        icon={<ChartBarIcon className="h-5 w-5" />}
                        color="amber"
                        subtitle="Authentication success"
                    />
                </div>

                {/* Policy Information */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <LockClosedIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">
                                DMARC Policy Configuration
                            </h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-wrap gap-2">
                            <PolicyBadge label="p" value={policy.p} />
                            <PolicyBadge label="sp" value={policy.sp} />
                            <PolicyBadge label="pct" value={policy.pct} />
                            <PolicyBadge label="adkim" value={policy.adkim} />
                            <PolicyBadge label="aspf" value={policy.aspf} />
                        </div>
                        <div className="mt-3 text-xs text-gray-500">
                            Policy enforcement settings for {activeDomain?.name || "domain"}
                        </div>
                    </div>
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
                                    <GlobeAltIcon className="inline h-4 w-4 mr-1" />
                                    Domain
                                </label>
                                <select
                                    value={activeDomainId != null ? String(activeDomainId) : ""}
                                    onChange={(e) => setActiveDomainId(Number(e.target.value))}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    {data.domains.map((d) => (
                                        <option key={d.id} value={String(d.id)}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pass/Fail Pie Chart */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <ChartPieIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">
                                    Authentication Results
                                </h3>
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
                                        label={pieSliceLabel}   // <-- instead of inline ({ value, percent }) => ...
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>

                                    <Tooltip formatter={tooltipFormatter} />

                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top Reporters Chart */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <UserGroupIcon className="h-5 w-5" />
                                    <h3 className="text-sm font-semibold uppercase tracking-wider">
                                        Top Reporters
                                    </h3>
                                </div>
                                <div className="text-xs text-blue-100">
                                    {fmt(agg.total)} messages
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={orgBars} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                                    <defs>
                                        <linearGradient id="colorOrg" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="org"
                                        tick={{ fontSize: 10, fill: '#6b7280' }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis
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
                                        dataKey="count"
                                        name="Messages"
                                        fill="url(#colorOrg)"
                                        radius={[8, 8, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Disposition Chart */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <DocumentChartBarIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">
                                    Policy Disposition
                                </h3>
                            </div>
                            <div className="text-xs text-amber-100">
                                As evaluated by receivers
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={dispBars} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                                <defs>
                                    <linearGradient id="colorDisp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="disposition"
                                    tick={{ fontSize: 11, fill: '#6b7280' }}
                                />
                                <YAxis
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
                                    dataKey="count"
                                    name="Messages"
                                    fill="url(#colorDisp)"
                                    radius={[8, 8, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Raw Reports Table */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <DocumentChartBarIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">
                                    Raw Report Windows
                                </h3>
                            </div>
                            <div className="text-xs text-gray-300">
                                {activeDomain?.name} • {domainReports.length} reports
                            </div>
                        </div>
                    </div>

                    {domainReports.length === 0 ? (
                        <div className="p-12 text-center">
                            <DocumentChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-lg font-semibold text-gray-900">No reports found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                No DMARC reports available for this date range
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
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
                                        Policy Settings
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {r.org || <span className="text-gray-400 italic">Unknown</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <ClockIcon className="h-4 w-4 text-gray-400" />
                                                {toDateLabel(r.window.start, 'date')} → {toDateLabel(r.window.end, 'date')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                <PolicyBadge label="p" value={r.policy?.p} />
                                                <PolicyBadge label="sp" value={r.policy?.sp} />
                                                <PolicyBadge label="pct" value={r.policy?.pct} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {toDateLabel(r.receivedAt, 'full')}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-400 font-mono truncate max-w-xs">
                                            {r.reportId || "—"}
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