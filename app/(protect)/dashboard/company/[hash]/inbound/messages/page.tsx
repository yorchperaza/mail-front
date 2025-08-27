'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Brush,
} from 'recharts';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type DomainBrief = { id: number; domain: string | null };

type InboundMessage = {
    id: number;
    from_email: string | null;
    subject: string | null;
    raw_mime_ref: string | null;
    spam_score: number | null;
    dkim_result: string | null;
    dmarc_result: string | null;
    arc_result: string | null;
    received_at: string | null; // ISO8601
    domain: { id: number; domain: string | null } | null;
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ----------------------------- Helpers ----------------------------- */

const toLocale = (s?: string | null) => {
    if (!s) return '—';
    try { return new Date(s).toLocaleString(); } catch { return s; }
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Build a YYYY-MM-DD key for chart bucketing */
const dayKey = (iso?: string | null): string => {
    if (!iso) return 'unknown';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'unknown';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

/* ----------------------------- Page ----------------------------- */

export default function InboundMessagesListPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = clamp(parseInt(search.get('perPage') || '25', 10) || 25, 1, 200);

    const qFromUrl       = (search.get('search') || '').trim();
    const domainFromUrl  = (search.get('domainId') || '').trim();
    const minSpamFromUrl = (search.get('minSpam') || '').trim();
    const maxSpamFromUrl = (search.get('maxSpam') || '').trim();
    const fromDateUrl    = (search.get('receivedFrom') || '').trim(); // e.g. 2025-01-31T00:00
    const toDateUrl      = (search.get('receivedTo') || '').trim();
    const dkimFromUrl    = (search.get('dkim') || '').trim();
    const dmarcFromUrl   = (search.get('dmarc') || '').trim();
    const arcFromUrl     = (search.get('arc') || '').trim();

    // Controlled inputs
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [domainId, setDomainId] = useState<string>(domainFromUrl);
    const [minSpam, setMinSpam] = useState<string>(minSpamFromUrl);
    const [maxSpam, setMaxSpam] = useState<string>(maxSpamFromUrl);
    const [receivedFrom, setReceivedFrom] = useState<string>(fromDateUrl);
    const [receivedTo, setReceivedTo] = useState<string>(toDateUrl);
    const [dkim, setDkim] = useState<string>(dkimFromUrl);
    const [dmarc, setDmarc] = useState<string>(dmarcFromUrl);
    const [arc, setArc] = useState<string>(arcFromUrl);

    // Advanced section toggle
    const [showAdvanced, setShowAdvanced] = useState<boolean>(
        Boolean(minSpamFromUrl || maxSpamFromUrl || fromDateUrl || toDateUrl || dkimFromUrl || dmarcFromUrl || arcFromUrl)
    );

    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);
    useEffect(() => setDomainId(domainFromUrl), [domainFromUrl]);
    useEffect(() => setMinSpam(minSpamFromUrl), [minSpamFromUrl]);
    useEffect(() => setMaxSpam(maxSpamFromUrl), [maxSpamFromUrl]);
    useEffect(() => setReceivedFrom(fromDateUrl), [fromDateUrl]);
    useEffect(() => setReceivedTo(toDateUrl), [toDateUrl]);
    useEffect(() => setDkim(dkimFromUrl), [dkimFromUrl]);
    useEffect(() => setDmarc(dmarcFromUrl), [dmarcFromUrl]);
    useEffect(() => setArc(arcFromUrl), [arcFromUrl]);

    // Data state
    const [data, setData] = useState<ApiListResponse<InboundMessage> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Domains for filter dropdown
    const [domains, setDomains] = useState<DomainBrief[]>([]);
    const [domainsErr, setDomainsErr] = useState<string | null>(null);

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const listUrl = useMemo(() => {
        const sp = new URLSearchParams();
        sp.set('page', String(page));
        sp.set('perPage', String(perPage));
        if (qFromUrl)       sp.set('search', qFromUrl);
        if (domainFromUrl)  sp.set('domainId', domainFromUrl);
        if (minSpamFromUrl) sp.set('minSpam', minSpamFromUrl);
        if (maxSpamFromUrl) sp.set('maxSpam', maxSpamFromUrl);
        if (fromDateUrl)    sp.set('receivedFrom', fromDateUrl);
        if (toDateUrl)      sp.set('receivedTo', toDateUrl);
        if (dkimFromUrl)    sp.set('dkim', dkimFromUrl);
        if (dmarcFromUrl)   sp.set('dmarc', dmarcFromUrl);
        if (arcFromUrl)     sp.set('arc', arcFromUrl);
        return `${backend}/companies/${hash}/inbound-messages?${sp.toString()}`;
    }, [
        backend, hash, page, perPage, qFromUrl, domainFromUrl, minSpamFromUrl,
        maxSpamFromUrl, fromDateUrl, toDateUrl, dkimFromUrl, dmarcFromUrl, arcFromUrl
    ]);

    // Fetch messages
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load inbound messages (${res.status})`);
                const json: ApiListResponse<InboundMessage> = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [listUrl]);

    // Fetch domains for filter dropdown
    useEffect(() => {
        let abort = false;
        (async () => {
            setDomainsErr(null);
            try {
                const url = `${backend}/companies/${hash}/domains`;
                const res = await fetch(url, { headers: authHeaders() });
                if (res.ok) {
                    const list = (await res.json()) as DomainBrief[];
                    const norm: DomainBrief[] = list.map(d => ({ id: d.id, domain: d.domain ?? null }));
                    if (!abort) setDomains(norm);
                } else {
                    if (!abort) setDomainsErr(`Failed to load domains (${res.status})`);
                }
            } catch (e) {
                if (!abort) setDomainsErr(e instanceof Error ? e.message : 'Failed to load domains');
            }
        })();
        return () => { abort = true; };
    }, [backend, hash]);

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
        updateQuery({
            search:       searchTerm,
            domainId:     domainId,
            minSpam:      minSpam,
            maxSpam:      maxSpam,
            receivedFrom: receivedFrom,
            receivedTo:   receivedTo,
            dkim,
            dmarc,
            arc,
            page: 1,
        });
    }

    function clearFilters() {
        setSearchTerm('');
        setDomainId('');
        setMinSpam('');
        setMaxSpam('');
        setReceivedFrom('');
        setReceivedTo('');
        setDkim('');
        setDmarc('');
        setArc('');
        updateQuery({
            search: undefined,
            domainId: undefined,
            minSpam: undefined,
            maxSpam: undefined,
            receivedFrom: undefined,
            receivedTo: undefined,
            dkim: undefined,
            dmarc: undefined,
            arc: undefined,
            page: 1
        });
    }

    // Remove an individual filter via chip X
    function clearOne(key: 'search'|'domainId'|'minSpam'|'maxSpam'|'receivedFrom'|'receivedTo'|'dkim'|'dmarc'|'arc') {
        const setters: Record<typeof key, () => void> = {
            search: () => setSearchTerm(''),
            domainId: () => setDomainId(''),
            minSpam: () => setMinSpam(''),
            maxSpam: () => setMaxSpam(''),
            receivedFrom: () => setReceivedFrom(''),
            receivedTo: () => setReceivedTo(''),
            dkim: () => setDkim(''),
            dmarc: () => setDmarc(''),
            arc: () => setArc(''),
        };
        setters[key]();
        updateQuery({ [key]: undefined, page: 1 });
    }

    const backHref = `/dashboard/company/${hash}`;

    /* ----------------------------- Chart data ----------------------------- */
    const chartPoints = useMemo(() => {
        const map = new Map<string, number>();
        (data?.items || []).forEach(m => {
            const k = dayKey(m.received_at);
            map.set(k, (map.get(k) || 0) + 1);
        });
        const arr = Array.from(map.entries())
            .filter(([k]) => k !== 'unknown')
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([date, count]) => ({ date, count }));
        return arr;
    }, [data]);

    // Simple SVG line chart
    const chartW = 800;
    const chartH = 160;
    const pad = 24;

    const counts = chartPoints.map(p => p.count);
    const maxV = counts.length ? Math.max(...counts) : 0;
    const minV = 0;

    const xScale = (i: number) =>
        pad + (chartPoints.length <= 1 ? 0 : (i * (chartW - 2 * pad)) / (chartPoints.length - 1));
    const yScale = (v: number) => {
        if (maxV === minV) return chartH - pad;
        const t = (v - minV) / (maxV - minV);
        return chartH - pad - t * (chartH - 2 * pad);
    };

    const linePath = (() => {
        if (chartPoints.length === 0) return '';
        return chartPoints
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(p.count).toFixed(1)}`)
            .join(' ');
    })();

    /* ----------------------------- Render ----------------------------- */

    if (loading) return <p className="p-6 text-center text-gray-600">Loading inbound messages…</p>;
    if (err) return (
        <div className="p-6 text-center">
            <p className="text-red-600">{err}</p>
            <button onClick={() => router.push(backHref)} className="mt-3 inline-flex items-center px-3 py-2 rounded border">
                <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back
            </button>
        </div>
    );
    if (!data) return null;

    const { items, meta } = data;

    // Active filter chips (computed from current controlled inputs)
    const chips: Array<{ key: Parameters<typeof clearOne>[0]; label: string }> = [];
    if (searchTerm)   chips.push({ key: 'search', label: `Search: ${searchTerm}` });
    if (domainId)     chips.push({ key: 'domainId', label: `Domain: ${domains.find(d => String(d.id) === domainId)?.domain ?? '#' + domainId}` });
    if (minSpam)      chips.push({ key: 'minSpam', label: `Min spam: ${minSpam}` });
    if (maxSpam)      chips.push({ key: 'maxSpam', label: `Max spam: ${maxSpam}` });
    if (receivedFrom) chips.push({ key: 'receivedFrom', label: `From: ${receivedFrom}` });
    if (receivedTo)   chips.push({ key: 'receivedTo', label: `To: ${receivedTo}` });
    if (dkim)         chips.push({ key: 'dkim', label: `DKIM: ${dkim}` });
    if (dmarc)        chips.push({ key: 'dmarc', label: `DMARC: ${dmarc}` });
    if (arc)          chips.push({ key: 'arc', label: `ARC: ${arc}` });

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={() => router.push(backHref)}
                    className="inline-flex items-center text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">Inbound Messages</h1>
                <div /> {/* balance */}
            </div>

            {/* Line chart card (Recharts) */}
            <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Volume over time</p>
                    <p className="text-xs text-gray-500">
                        Showing {items.length} of {meta.total} messages (current page with filters)
                    </p>
                </div>

                <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartPoints} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickMargin={8}
                                minTickGap={24}
                            />
                            <YAxis
                                allowDecimals={false}
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                width={32}
                            />
                            <Tooltip
                                formatter={(value) => [String(value), 'Messages']}
                                labelFormatter={(label) => `Date: ${label}`}
                                contentStyle={{ fontSize: 12 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="count"
                                stroke="#2563eb"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                            {/* Optional mini scrubber to explore long ranges */}
                            <Brush dataKey="date" height={20} stroke="#9ca3af" travellerWidth={8} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Inline legend-style chips for quick read */}
                <div className="mt-2 flex gap-3 flex-wrap text-xs text-gray-500">
                    {chartPoints.length === 0 ? (
                        <span>No data</span>
                    ) : (
                        chartPoints.map((p) => (
                            <span key={p.date} className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#2563eb' }} />
                                {p.date}: {p.count}
        </span>
                        ))
                    )}
                </div>
            </div>

            {/* Filters Card */}
            <form onSubmit={onSubmitSearch} className="bg-white border rounded-lg p-4 space-y-4">
                {/* Quick Filters Row */}
                <div className="grid gap-3 md:grid-cols-12">
                    {/* Search */}
                    <div className="md:col-span-6 relative">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-2 top-9 -translate-y-1/2" />
                        <input
                            name="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Subject, from address, MIME ref…"
                            className="w-full pl-9 pr-9 py-2 rounded border border-gray-300"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-9 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                                aria-label="Clear search"
                                title="Clear search"
                            >
                                <XMarkIcon className="h-4 w-4 text-gray-500" />
                            </button>
                        )}
                    </div>

                    {/* Domain */}
                    <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Domain</label>
                        <select
                            value={domainId}
                            onChange={(e) => setDomainId(e.target.value)}
                            className="w-full rounded border border-gray-300 px-2 py-2"
                        >
                            <option value="">All</option>
                            {domains.map(d => (
                                <option key={d.id} value={d.id}>{d.domain ?? `#${d.id}`}</option>
                            ))}
                        </select>
                    </div>

                    {/* Per page */}
                    <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Per page</label>
                        <select
                            value={perPage}
                            onChange={(e) => updateQuery({ perPage: e.target.value, page: 1 })}
                            className="w-full rounded border border-gray-300 px-2 py-2"
                        >
                            {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                </div>

                {/* Active filter chips */}
                {chips.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {chips.map(c => (
                            <span
                                key={c.key}
                                className="inline-flex items-center gap-2 rounded-full border bg-gray-50 px-3 py-1 text-xs"
                            >
                {c.label}
                                <button
                                    type="button"
                                    onClick={() => clearOne(c.key)}
                                    className="rounded-full hover:bg-gray-200 p-0.5"
                                    aria-label={`Clear ${c.key}`}
                                    title={`Clear ${c.key}`}
                                >
                  <XMarkIcon className="h-3.5 w-3.5 text-gray-600" />
                </button>
              </span>
                        ))}
                    </div>
                )}

                {/* Advanced toggle */}
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(v => !v)}
                        className="text-sm text-blue-700 hover:underline"
                    >
                        {showAdvanced ? 'Hide advanced filters' : 'Show advanced filters'}
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
                        >
                            Clear all
                        </button>
                        <button
                            type="submit"
                            className="px-3 py-2 rounded border bg-gray-50 hover:bg-gray-100 text-sm"
                        >
                            Apply
                        </button>
                    </div>
                </div>

                {/* Advanced Filters */}
                {showAdvanced && (
                    <div className="rounded-lg border bg-gray-50 p-3">
                        <div className="grid gap-3 md:grid-cols-12">
                            {/* Spam range */}
                            <fieldset className="md:col-span-4">
                                <legend className="text-xs font-medium text-gray-700 mb-2">Spam score</legend>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        value={minSpam}
                                        onChange={(e) => setMinSpam(e.target.value)}
                                        className="w-full rounded border border-gray-300 px-2 py-2"
                                        inputMode="decimal"
                                        placeholder="Min (e.g. 2.5)"
                                    />
                                    <input
                                        value={maxSpam}
                                        onChange={(e) => setMaxSpam(e.target.value)}
                                        className="w-full rounded border border-gray-300 px-2 py-2"
                                        inputMode="decimal"
                                        placeholder="Max (e.g. 5.0)"
                                    />
                                </div>
                            </fieldset>

                            {/* Received range */}
                            <fieldset className="md:col-span-5">
                                <legend className="text-xs font-medium text-gray-700 mb-2">Received between</legend>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="datetime-local"
                                        value={receivedFrom}
                                        onChange={(e) => setReceivedFrom(e.target.value)}
                                        className="w-full rounded border border-gray-300 px-2 py-2"
                                    />
                                    <input
                                        type="datetime-local"
                                        value={receivedTo}
                                        onChange={(e) => setReceivedTo(e.target.value)}
                                        className="w-full rounded border border-gray-300 px-2 py-2"
                                    />
                                </div>
                            </fieldset>

                            {/* Auth results */}
                            {/* Auth results */}
                            <fieldset className="md:col-span-3">
                                <legend className="text-xs font-medium text-gray-700 mb-2">Authentication</legend>
                                <div className="grid grid-cols-3 gap-2">
                                    {/* DKIM */}
                                    <select
                                        value={dkim}
                                        onChange={(e) => setDkim(e.target.value)}
                                        className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                                    >
                                        <option value="">Any</option>
                                        <option value="pass">Pass</option>
                                        <option value="fail">Fail</option>
                                        <option value="none">None</option>
                                    </select>

                                    {/* DMARC */}
                                    <select
                                        value={dmarc}
                                        onChange={(e) => setDmarc(e.target.value)}
                                        className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                                    >
                                        <option value="">Any</option>
                                        <option value="pass">Pass</option>
                                        <option value="fail">Fail</option>
                                        <option value="none">None</option>
                                    </select>

                                    {/* ARC */}
                                    <select
                                        value={arc}
                                        onChange={(e) => setArc(e.target.value)}
                                        className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                                    >
                                        <option value="">Any</option>
                                        <option value="pass">Pass</option>
                                        <option value="fail">Fail</option>
                                        <option value="none">None</option>
                                    </select>
                                </div>
                            </fieldset>

                        </div>
                    </div>
                )}
            </form>

            {/* Table */}
            <div className="overflow-auto rounded-lg border bg-white shadow-sm">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                    <tr className="text-left">
                        <th className="px-3 py-2">From</th>
                        <th className="px-3 py-2">Subject</th>
                        <th className="px-3 py-2 whitespace-nowrap">Spam</th>
                        <th className="px-3 py-2">DKIM</th>
                        <th className="px-3 py-2">DMARC</th>
                        <th className="px-3 py-2">ARC</th>
                        <th className="px-3 py-2">Domain</th>
                        <th className="px-3 py-2 whitespace-nowrap">Received</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={8}>
                                No inbound messages found.
                            </td>
                        </tr>
                    ) : items.map((m) => (
                        <tr key={m.id} className="border-t">
                            <td className="px-3 py-2">
                                <span className="font-mono text-xs break-all">{m.from_email ?? '—'}</span>
                            </td>
                            <td className="px-3 py-2">
                                <span className="text-gray-800">{m.subject ?? '—'}</span>
                            </td>
                            <td className="px-3 py-2">{m.spam_score ?? '—'}</td>
                            <td className="px-3 py-2">{m.dkim_result ?? '—'}</td>
                            <td className="px-3 py-2">{m.dmarc_result ?? '—'}</td>
                            <td className="px-3 py-2">{m.arc_result ?? '—'}</td>
                            <td className="px-3 py-2">{m.domain?.domain ?? (m.domain ? `#${m.domain.id}` : '—')}</td>
                            <td className="px-3 py-2">{toLocale(m.received_at)}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                    Page <span className="font-medium">{meta.page}</span> of{' '}
                    <span className="font-medium">{meta.totalPages}</span> · {meta.total} total
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => updateQuery({ page: Math.max(1, meta.page - 1) })}
                        disabled={meta.page <= 1}
                        className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50 text-sm"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => updateQuery({ page: Math.min(meta.totalPages, meta.page + 1) })}
                        disabled={meta.page >= meta.totalPages}
                        className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50 text-sm"
                    >
                        Next
                    </button>
                </div>
            </div>

            {domainsErr && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    {domainsErr}
                </p>
            )}
        </div>
    );
}
