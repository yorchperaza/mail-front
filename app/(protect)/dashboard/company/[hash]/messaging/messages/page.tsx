'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

/* ========================= Types ========================= */

type MessageItem = {
    id: number;
    company_id: number;
    domain_id: number | null;
    domainName: string | null;
    from: { email: string; name: string | null };
    replyTo: string | null;
    subject: string | null;
    createdAt: string | null;
    queuedAt: string | null;
    sentAt: string | null;
    state: 'queued' | 'sent' | 'failed' | 'preview' | 'queue_failed' | string | null;
    messageId: string | null;
};

type ApiResponse = {
    meta: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        sort: 'created_at' | 'queued_at' | 'sent_at';
        order: 'asc' | 'desc';
        filters: Record<string, unknown>;
    };
    items: MessageItem[];
};

type DomainItem = {
    id: number;
    domain: string;
    statusDomain: string | number | null;
};

/* ========================= Helpers ========================= */

const STATES = ['queued', 'sent', 'failed', 'preview', 'queue_failed'] as const;

const STATE_LABEL: Record<string, string> = {
    queued: 'Queued',
    sent: 'Sent',
    failed: 'Failed',
    preview: 'Preview',
    queue_failed: 'Queue Failed',
};

function toLocale(s?: string | null) {
    if (!s) return '—';
    try { return new Date(s).toLocaleString(); } catch { return s; }
}

function badgeClass(state?: string | null) {
    const s = (state || '').toLowerCase();
    if (s === 'sent') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (s === 'queued' || s === 'preview') return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'failed' || s === 'queue_failed') return 'bg-red-50 text-red-700 ring-red-200';
    return 'bg-gray-50 text-gray-600 ring-gray-200';
}

/* Build query string from an object, dropping empty values */
function buildQuery(params: Record<string, unknown>) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (typeof v === 'string' && v.trim() === '') return;
        if (Array.isArray(v)) {
            if (v.length === 0) return;
            sp.set(k, v.join(','));
            return;
        }
        sp.set(k, String(v));
    });
    return sp.toString();
}

function fmtDate(d: Date) {
    // yyyy-mm-dd for <input type="date">
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/* ========================= Page ========================= */

export default function CompanyMessagesPage() {
    const router = useRouter();
    const pathname = usePathname();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // domains
    const [domains, setDomains] = useState<DomainItem[]>([]);
    const [domainsLoading, setDomainsLoading] = useState(true);
    const [domainsErr, setDomainsErr] = useState<string | null>(null);

    // UI state: show/hide advanced filters
    const [showAdvanced, setShowAdvanced] = useState(false);

    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    // ---- URL → state ----
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const sort = (search.get('sort') || 'created_at') as 'created_at' | 'queued_at' | 'sent_at';
    const order = (search.get('order') || 'desc') as 'asc' | 'desc';

    const domain_id = search.get('domain_id') || '';
    // DATE-ONLY inputs (no time). Hours are separate.
    const date_from = search.get('date_from') || '';
    const date_to = search.get('date_to') || '';
    const hour_from = search.get('hour_from') || '';
    const hour_to = search.get('hour_to') || '';
    const state = search.get('state') || '';
    const fromLike = search.get('from') || '';
    const toLike = search.get('to') || '';
    const subjectLike = search.get('subject') || '';
    const message_id = search.get('message_id') || '';
    const has_opens = search.get('has_opens') || '';
    const has_clicks = search.get('has_clicks') || '';

    const qs = useMemo(
        () =>
            buildQuery({
                page, perPage, sort, order,
                domain_id, date_from, date_to, hour_from, hour_to,
                state, from: fromLike, to: toLike, subject: subjectLike, message_id,
                has_opens, has_clicks,
            }),
        [page, perPage, sort, order, domain_id, date_from, date_to, hour_from, hour_to, state, fromLike, toLike, subjectLike, message_id, has_opens, has_clicks],
    );

    const listUrl = `${backend}/companies/${hash}/messages?${qs}`;
    const domainsUrl = `${backend}/companies/${hash}/domains`;

    // ---- Fetch messages ----
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
                if (!res.ok) throw new Error(`Failed to load messages (${res.status})`);
                const json: ApiResponse = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [listUrl, token]);

    // ---- Fetch domains ----
    useEffect(() => {
        let abort = false;
        (async () => {
            setDomainsLoading(true);
            setDomainsErr(null);
            try {
                const res = await fetch(domainsUrl, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
                if (!res.ok) throw new Error(`Failed to load domains (${res.status})`);
                const json: DomainItem[] = await res.json();
                if (!abort) setDomains(json);
            } catch (e) {
                if (!abort) setDomainsErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setDomainsLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [domainsUrl, token]);

    // ---- Helpers ----
    function updateQuery(partial: Record<string, unknown>, resetPage = false) {
        const sp = new URLSearchParams(search.toString());
        Object.entries(partial).forEach(([k, v]) => {
            if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
                sp.delete(k);
            } else {
                sp.set(k, String(v));
            }
        });
        if (resetPage) sp.set('page', '1');
        router.replace(`${pathname}?${sp.toString()}`);
    }

    function submitFilters(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);

        const selectedStates = Array.from(fd.getAll('state')).map(String);
        const compiledState = selectedStates.join(',');

        updateQuery({
            domain_id: (fd.get('domain_id') as string) || '',
            date_from: (fd.get('date_from') as string) || '',
            date_to: (fd.get('date_to') as string) || '',
            hour_from: (fd.get('hour_from') as string) || '',
            hour_to: (fd.get('hour_to') as string) || '',
            state: compiledState || '',
            from: (fd.get('from') as string) || '',
            to: (fd.get('to') as string) || '',
            subject: (fd.get('subject') as string) || '',
            message_id: (fd.get('message_id') as string) || '',
            has_opens: (fd.get('has_opens') as string) || '',
            has_clicks: (fd.get('has_clicks') as string) || '',
        }, true);
    }

    function clearFilters() {
        setShowAdvanced(false);
        updateQuery({ page: 1, perPage, sort, order, domain_id: '', date_from: '', date_to: '', hour_from: '', hour_to: '', state: '', from: '', to: '', subject: '', message_id: '', has_opens: '', has_clicks: '' }, false);
    }

    function fmtDateUTC(d: Date) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    const formKey = search.toString();


    function applyQuickRange(days: number) {
        // build UTC “from/to” covering whole days
        const now = new Date();
        const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));           // today (UTC)
        const from = new Date(to); from.setUTCDate(to.getUTCDate() - (days - 1));                           // N days back
        updateQuery(
            { date_from: fmtDateUTC(from), date_to: fmtDateUTC(to) },
            true // reset page
        );
    }

    // ---- Render ----
    if (loading) return <p className="p-6 text-center text-gray-600">Loading messages…</p>;
    if (err) return <p className="p-6 text-center text-red-600">{err}</p>;
    if (!data) return null;

    const { items, meta } = data;

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(`/dashboard/company/${hash}`)}
                        className="inline-flex items-center text-gray-600 hover:text-gray-800"
                    >
                        <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                    </button>
                    <h1 className="text-2xl font-semibold">Messages</h1>
                    <span className="text-sm text-gray-500">Total: {meta.total}</span>
                </div>
                <Link href={`/dashboard/company/${hash}`} className="text-blue-700 hover:underline">
                    Company Overview →
                </Link>
            </div>

            {/* Filters */}
            <form key={formKey} onSubmit={submitFilters} className="bg-white rounded-lg border p-4 space-y-4 shadow-sm">
                {/* Top row: domain, dates, quick ranges */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Domain */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Domain</label>
                        <select
                            name="domain_id"
                            defaultValue={domain_id}
                            disabled={domainsLoading || !!domainsErr}
                            className="w-full rounded border border-gray-300 px-2 py-1.5"
                        >
                            <option value="">All domains</option>
                            {domains.map((d) => (
                                <option key={d.id} value={String(d.id)}>{d.domain}</option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                            {domainsLoading ? 'Loading domains…' : domainsErr ? `Could not load domains: ${domainsErr}` : 'Filter by a specific domain or show all.'}
                        </p>
                    </div>

                    {/* Dates (date-only) */}
                    <div>
                        <label className="block text-sm font-medium mb-1">From (date)</label>
                        <input
                            type="date"
                            name="date_from"
                            defaultValue={date_from}
                            className="w-full rounded border border-gray-300 px-2 py-1.5"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">To (date)</label>
                        <input
                            type="date"
                            name="date_to"
                            defaultValue={date_to}
                            className="w-full rounded border border-gray-300 px-2 py-1.5"
                        />
                    </div>

                    {/* Quick ranges */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Quick range</label>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => applyQuickRange(1)} className="px-2 py-1 rounded border text-xs hover:bg-gray-50">Today</button>
                            <button type="button" onClick={() => applyQuickRange(7)} className="px-2 py-1 rounded border text-xs hover:bg-gray-50">Last 7d</button>
                            <button type="button" onClick={() => applyQuickRange(30)} className="px-2 py-1 rounded border text-xs hover:bg-gray-50">Last 30d</button>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">Sets date range; adjust hours below if needed.</p>
                    </div>
                </div>

                {/* Hours + State + Sorting */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Hours */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium mb-1">Hour From</label>
                            <select name="hour_from" defaultValue={hour_from} className="w-full rounded border border-gray-300 px-2 py-1.5">
                                <option value="">Any</option>
                                {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Hour To</label>
                            <select name="hour_to" defaultValue={hour_to} className="w-full rounded border border-gray-300 px-2 py-1.5">
                                <option value="">Any</option>
                                {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* States */}
                    <div className="md:col-span-2">
                        <div className="block text-sm font-medium mb-1">State</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                            {STATES.map((s) => {
                                const isChecked = (state || '').split(',').map((x) => x.trim()).filter(Boolean).includes(s);
                                return (
                                    <label key={s} className="inline-flex items-center gap-2 text-sm border rounded px-2 py-1">
                                        <input type="checkbox" name="state" value={s} defaultChecked={isChecked} className="h-4 w-4" />
                                        <span className="capitalize">{STATE_LABEL[s]}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sorting */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium mb-1">Sort</label>
                            <select value={sort} onChange={(e) => updateQuery({ sort: e.target.value }, true)} className="w-full rounded border border-gray-300 px-2 py-1.5">
                                <option value="created_at">Created at</option>
                                <option value="queued_at">Queued at</option>
                                <option value="sent_at">Sent at</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Order</label>
                            <select value={order} onChange={(e) => updateQuery({ order: e.target.value }, true)} className="w-full rounded border border-gray-300 px-2 py-1.5">
                                <option value="desc">Desc</option>
                                <option value="asc">Asc</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Advanced filters (collapsible) */}
                <div className="rounded-md border bg-gray-50/60">
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((v) => !v)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{showAdvanced ? 'Hide' : 'Show'} advanced filters</span>
                        <span className="text-gray-500">{showAdvanced ? '▲' : '▼'}</span>
                    </button>

                    {showAdvanced && (
                        <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">From contains</label>
                                <input name="from" defaultValue={fromLike} className="w-full rounded border border-gray-300 px-2 py-1.5" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">To contains</label>
                                <input name="to" defaultValue={toLike} className="w-full rounded border border-gray-300 px-2 py-1.5" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Subject contains</label>
                                <input name="subject" defaultValue={subjectLike} className="w-full rounded border border-gray-300 px-2 py-1.5" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Message-ID (exact)</label>
                                <input name="message_id" defaultValue={message_id} className="w-full rounded border border-gray-300 px-2 py-1.5" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Has opens</label>
                                <select name="has_opens" defaultValue={has_opens} className="w-full rounded border border-gray-300 px-2 py-1.5">
                                    <option value="">Any</option>
                                    <option value="1">Yes</option>
                                    <option value="0">No</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Has clicks</label>
                                <select name="has_clicks" defaultValue={has_clicks} className="w-full rounded border border-gray-300 px-2 py-1.5">
                                    <option value="">Any</option>
                                    <option value="1">Yes</option>
                                    <option value="0">No</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions (sticky on large screens) */}
                <div className="flex items-center justify-between gap-3 sticky bottom-0 bg-white py-2">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Per page</label>
                        <select
                            value={perPage}
                            onChange={(e) => updateQuery({ perPage: e.target.value, page: 1 })}
                            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                        >
                            {[10, 25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 text-sm"
                        >
                            Clear
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 text-sm"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            </form>

            {/* Table */}
            <div className="overflow-auto rounded-lg border bg-white shadow-sm">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                    <tr className="text-left">
                        <th className="px-3 py-2">Domain</th>
                        <th className="px-3 py-2">From</th>
                        <th className="px-3 py-2">Subject</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2">Queued</th>
                        <th className="px-3 py-2">Sent</th>
                        <th className="px-3 py-2">State</th>
                        <th className="px-3 py-2">Message-ID</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                                No messages found with the current filters.
                            </td>
                        </tr>
                    ) : (
                        items.map((m) => (
                            <tr
                                key={m.id}
                                className="border-t hover:bg-gray-50 cursor-pointer"
                                onClick={() =>
                                    router.push(
                                        `/dashboard/company/${hash}/messaging/messages/${encodeURIComponent(
                                            m.messageId || ''
                                        )}`
                                    )
                                }
                            >
                                <td className="px-3 py-2">
                                    {m.domainName ? (
                                        <Link href={`/dashboard/company/${hash}/domain/${m.domain_id}`} className="text-blue-700 hover:underline">
                                            {m.domainName}
                                        </Link>
                                    ) : <span className="text-gray-500">—</span>}
                                </td>
                                <td className="px-3 py-2">
                                    <div className="text-sm">{m.from.name || <span className="italic text-gray-500">(no name)</span>}</div>
                                    <div className="text-xs text-gray-600 font-mono">{m.from.email}</div>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="max-w-[28rem] truncate">{m.subject || <span className="text-gray-500">—</span>}</div>
                                </td>
                                <td className="px-3 py-2">{toLocale(m.createdAt)}</td>
                                <td className="px-3 py-2">{toLocale(m.queuedAt)}</td>
                                <td className="px-3 py-2">{toLocale(m.sentAt)}</td>
                                <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${badgeClass(m.state)}`}>
                      {STATE_LABEL[m.state ?? ''] || (m.state || '—')}
                    </span>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="max-w-[22rem] truncate font-mono text-xs text-gray-700">{m.messageId || '—'}</div>
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                    Page <span className="font-medium">{meta.page}</span> of <span className="font-medium">{meta.totalPages}</span>
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
        </div>
    );
}
