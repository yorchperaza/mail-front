'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type DomainBrief = { id: number; domain: string | null };

// Destination payload coming from the backend (discriminated union)
type DestinationForward = { type: 'forward'; to: string[] };
type DestinationStore = { type: 'store'; notify?: string[] };
type DestinationStop = { type: 'stop' };
type DestinationOther = { type?: string; [key: string]: unknown };

type Destination = DestinationForward | DestinationStore | DestinationStop | DestinationOther;

type InboundRouteItem = {
    id: number;
    pattern: string | null;
    action: string | null; // "forward" | "store" | "stop" | null
    destination: Destination | null;
    spam_threshold: number | null;
    dkim_required: number | null; // 0|1|null
    tls_required: number | null;  // 0|1|null
    created_at: string | null;
    domain: { id: number; domain: string | null } | null;
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ----------------------------- Page ----------------------------- */

export default function InboundRoutesListPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();
    const domainFromUrl = search.get('domainId') || '';

    // Controlled inputs
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [domainId, setDomainId] = useState<string>(domainFromUrl);
    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);
    useEffect(() => setDomainId(domainFromUrl), [domainFromUrl]);

    // Data state
    const [data, setData] = useState<ApiListResponse<InboundRouteItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Domains for filter
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
        if (qFromUrl) sp.set('search', qFromUrl);
        if (domainFromUrl) sp.set('domainId', domainFromUrl);
        return `${backend}/companies/${hash}/inbound-routes?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl, domainFromUrl]);

    // Fetch routes
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load inbound routes (${res.status})`);
                const json: ApiListResponse<InboundRouteItem> = await res.json();
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
                    // Type the response to avoid `any`
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
        updateQuery({ search: searchTerm, domainId, page: 1 });
    }

    function clearFilters() {
        setSearchTerm('');
        setDomainId('');
        updateQuery({ search: undefined, domainId: undefined, page: 1 });
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this route?')) return;
        setDeletingId(id);
        try {
            const url = `${backend}/companies/${hash}/inbound-routes/${id}`;
            const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            setData(prev => prev
                ? { ...prev, items: prev.items.filter(i => i.id !== id), meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) } }
                : prev);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    const backHref   = `/dashboard/company/${hash}`;
    const createHref = `/dashboard/company/${hash}/inbound/routes/create`;
    const editHref   = (id: number) => `/dashboard/company/${hash}/inbound/routes/${id}`;

    const toLocale = (s?: string | null) => {
        if (!s) return '—';
        try { return new Date(s).toLocaleString(); } catch { return s; }
    };

    const yesNo = (v?: number | null) => (v === 1 ? 'Yes' : v === 0 ? 'No' : '—');

    const destSummary = (r: InboundRouteItem) => {
        const d = r.destination;
        if (!d || typeof d !== 'object') return '—';

        if ('type' in d) {
            switch (d.type) {
                case 'forward':
                    return `forward → ${Array.isArray(d.to) && d.to.length ? d.to.join(', ') : '(no destinations)'}`;
                case 'store':
                    return Array.isArray(d.notify) && d.notify.length ? `store & notify → ${d.notify.join(', ')}` : 'store';
                case 'stop':
                    return 'stop';
                default:
                    // Unknown typed destination
                    return JSON.stringify(d);
            }
        }
        // Object without a `type`
        return JSON.stringify(d);
    };

    if (loading) return <p className="p-6 text-center text-gray-600">Loading routes…</p>;
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
                <h1 className="text-2xl font-semibold">Inbound Routes</h1>
                <Link
                    href={createHref}
                    className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                >
                    <PlusIcon className="h-5 w-5 mr-1" /> New Route
                </Link>
            </div>

            {/* Toolbar */}
            <form onSubmit={onSubmitSearch} className="bg-white border rounded-lg p-3 flex items-center gap-2">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                        name="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search pattern or action…"
                        className="w-full pl-9 pr-9 py-2 rounded border border-gray-300"
                    />
                    {(searchTerm || domainId) && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                            aria-label="Clear filters"
                            title="Clear filters"
                        >
                            <XMarkIcon className="h-4 w-4 text-gray-500" />
                        </button>
                    )}
                </div>

                {/* Domain filter */}
                <label className="text-sm text-gray-600">Domain</label>
                <select
                    value={domainId}
                    onChange={(e) => setDomainId(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                    <option value="">All</option>
                    {domains.map(d => (
                        <option key={d.id} value={d.id}>{d.domain ?? `#${d.id}`}</option>
                    ))}
                </select>

                <label className="text-sm text-gray-600">Per page</label>
                <select
                    value={perPage}
                    onChange={(e) => updateQuery({ perPage: e.target.value, page: 1 })}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                    {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                </select>

                <button type="submit" className="px-3 py-2 rounded border bg-gray-50 hover:bg-gray-100 text-sm">Apply</button>

                <button
                    type="button"
                    onClick={clearFilters}
                    disabled={!qFromUrl && page === 1 && !domainFromUrl}
                    className="px-3 py-2 rounded border text-sm hover:bg-gray-50 disabled:opacity-50"
                    title="Clear"
                >
                    Clear
                </button>
            </form>

            {/* Table */}
            <div className="overflow-auto rounded-lg border bg-white shadow-sm">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                    <tr className="text-left">
                        <th className="px-3 py-2">Pattern</th>
                        <th className="px-3 py-2">Action</th>
                        <th className="px-3 py-2">Destination</th>
                        <th className="px-3 py-2">Spam Th.</th>
                        <th className="px-3 py-2">DKIM</th>
                        <th className="px-3 py-2">TLS</th>
                        <th className="px-3 py-2">Domain</th>
                        <th className="px-3 py-2 whitespace-nowrap">Created</th>
                        <th className="px-3 py-2"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                                No routes found.
                            </td>
                        </tr>
                    ) : items.map((r) => (
                        <tr key={r.id} className="border-t">
                            <td className="px-3 py-2">
                                <span className="font-mono text-xs break-all">{r.pattern || '—'}</span>
                            </td>
                            <td className="px-3 py-2">{r.action || '—'}</td>
                            <td className="px-3 py-2">
                                <span className="text-gray-700">{destSummary(r)}</span>
                            </td>
                            <td className="px-3 py-2">{r.spam_threshold ?? '—'}</td>
                            <td className="px-3 py-2">{yesNo(r.dkim_required)}</td>
                            <td className="px-3 py-2">{yesNo(r.tls_required)}</td>
                            <td className="px-3 py-2">{r.domain?.domain ?? (r.domain ? `#${r.domain.id}` : '—')}</td>
                            <td className="px-3 py-2">{toLocale(r.created_at)}</td>
                            <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <Link
                                        href={editHref(r.id)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                        title="Edit"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" /> Edit
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(r.id)}
                                        disabled={deletingId === r.id}
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
                                            deletingId === r.id ? 'text-red-400' : 'text-red-600 hover:bg-red-50'
                                        }`}
                                        title="Delete"
                                    >
                                        <TrashIcon className="h-4 w-4" /> Delete
                                    </button>
                                </div>
                            </td>
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
