'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    TrashIcon,
    PencilSquareIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type CompanyMini = { id: number; name: string | null } | null;

type IpPoolRow = {
    id: number;
    name: string | null;
    ips: string[] | null;
    reputation_score: number | null;
    warmup_state: string | null;
    created_at: string | null; // ISO
    company: CompanyMini;
};

type ApiPaged<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ----------------------------- Page ----------------------------- */

export default function IpPoolsIndexPage() {
    const router = useRouter();
    const search = useSearchParams();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));

    const qFromUrl           = (search.get('search') || '').trim();
    const warmupFromUrl      = (search.get('warmupState') || '').trim();
    const companyIdFromUrl   = (search.get('companyId') || '').trim();
    const minRepFromUrl      = (search.get('minReputation') || '').trim();
    const maxRepFromUrl      = (search.get('maxReputation') || '').trim();
    const createdFromFromUrl = (search.get('createdFrom') || '').trim();
    const createdToFromUrl   = (search.get('createdTo') || '').trim();

    // Controlled inputs
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [warmup, setWarmup] = useState(warmupFromUrl);
    const [companyId, setCompanyId] = useState(companyIdFromUrl);
    const [minRep, setMinRep] = useState(minRepFromUrl);
    const [maxRep, setMaxRep] = useState(maxRepFromUrl);
    const [createdFrom, setCreatedFrom] = useState(createdFromFromUrl); // yyyy-mm-dd
    const [createdTo, setCreatedTo] = useState(createdToFromUrl);

    // Sync inputs when URL changes externally
    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);
    useEffect(() => setWarmup(warmupFromUrl), [warmupFromUrl]);
    useEffect(() => setCompanyId(companyIdFromUrl), [companyIdFromUrl]);
    useEffect(() => setMinRep(minRepFromUrl), [minRepFromUrl]);
    useEffect(() => setMaxRep(maxRepFromUrl), [maxRepFromUrl]);
    useEffect(() => setCreatedFrom(createdFromFromUrl), [createdFromFromUrl]);
    useEffect(() => setCreatedTo(createdToFromUrl), [createdToFromUrl]);

    // Data
    const [data, setData] = useState<ApiPaged<IpPoolRow> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const listUrl = useMemo(() => {
        const sp = new URLSearchParams();
        sp.set('page', String(page));
        sp.set('perPage', String(perPage));
        if (qFromUrl)           sp.set('search', qFromUrl);
        if (warmupFromUrl)      sp.set('warmupState', warmupFromUrl);
        if (companyIdFromUrl)   sp.set('companyId', companyIdFromUrl);
        if (minRepFromUrl)      sp.set('minReputation', minRepFromUrl);
        if (maxRepFromUrl)      sp.set('maxReputation', maxRepFromUrl);
        if (createdFromFromUrl) sp.set('createdFrom', createdFromFromUrl);
        if (createdToFromUrl)   sp.set('createdTo', createdToFromUrl);
        return `${backend}/ippools?${sp.toString()}`;
    }, [
        backend, page, perPage,
        qFromUrl, warmupFromUrl, companyIdFromUrl, minRepFromUrl, maxRepFromUrl,
        createdFromFromUrl, createdToFromUrl
    ]);

    useEffect(() => {
        if (!backend) { setErr('Missing backend URL'); setLoading(false); return; }
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load IP pools (${res.status})`);
                const json: ApiPaged<IpPoolRow> = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [listUrl, backend]);

    /* --------------------------- URL helpers --------------------------- */

    function replaceUrl(partial: Record<string, unknown>) {
        const sp = new URLSearchParams(search.toString());
        Object.entries(partial).forEach(([k, v]) => {
            if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) sp.delete(k);
            else sp.set(k, String(v));
        });
        // Always reset to page 1 when filters change
        if (partial.page === undefined) sp.set('page', '1');
        router.replace(`?${sp.toString()}`);
    }

    // Debounced live search while typing
    useEffect(() => {
        const t = setTimeout(() => {
            replaceUrl({ search: searchTerm });
        }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    function applyFilters() {
        replaceUrl({
            warmupState: warmup,
            companyId,
            minReputation: minRep,
            maxReputation: maxRep,
            createdFrom,
            createdTo,
        });
    }

    function clearAll() {
        setSearchTerm('');
        setWarmup('');
        setCompanyId('');
        setMinRep('');
        setMaxRep('');
        setCreatedFrom('');
        setCreatedTo('');
        replaceUrl({
            search: undefined,
            warmupState: undefined,
            companyId: undefined,
            minReputation: undefined,
            maxReputation: undefined,
            createdFrom: undefined,
            createdTo: undefined,
            page: 1,
        });
    }

    /* --------------------------- UI helpers --------------------------- */

    const backHref   = `/admin`;
    const createHref = `/admin/ip-pools/create`;
    const editHref   = (id: number) => `/admin/ip-pools/${id}`;

    const fmtDate = (iso: string | null | undefined) =>
        iso ? new Date(iso).toLocaleString() : '—';

    const ipsSummary = (ips: string[] | null | undefined) =>
        Array.isArray(ips) && ips.length > 0 ? `${ips.length} IP${ips.length === 1 ? '' : 's'}` : '—';

    async function handleDelete(id: number) {
        if (!confirm('Delete this IP pool?')) return;
        try {
            const res = await fetch(`${backend}/ippools/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            setData(prev => prev ? {
                ...prev,
                items: prev.items.filter(i => i.id !== id),
                meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) },
            } : prev);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        }
    }

    if (loading && !data) return <p className="p-6 text-center text-gray-600">Loading IP pools…</p>;
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
                <h1 className="text-2xl font-semibold">IP Pools</h1>
                <Link
                    href={createHref}
                    className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                >
                    <PlusIcon className="h-5 w-5 mr-1" /> New IP Pool
                </Link>
            </div>

            {/* Toolbar (live search + filters) */}
            <div className="bg-white border rounded-lg p-3 space-y-3">
                {/* Live search */}
                <div className="relative">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by pool name, IP, or company…"
                        className="w-full pl-9 pr-9 py-2 rounded border border-gray-300"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                            aria-label="Clear search"
                            title="Clear search"
                        >
                            <XMarkIcon className="h-4 w-4 text-gray-500" />
                        </button>
                    )}
                </div>

                {/* Advanced filters */}
                <div className="grid md:grid-cols-6 gap-2">
                    <div className="md:col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">Warmup</label>
                        <select
                            value={warmup}
                            onChange={(e) => setWarmup(e.target.value)}
                            className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                        >
                            <option value="">(any)</option>
                            <option value="not_started">not_started</option>
                            <option value="warming">warming</option>
                            <option value="ready">ready</option>
                            <option value="paused">paused</option>
                        </select>
                    </div>

                    <div className="">
                        <label className="block text-xs text-gray-600 mb-1">Company ID</label>
                        <input
                            inputMode="numeric"
                            value={companyId}
                            onChange={(e) => setCompanyId(e.target.value.replace(/[^\d]/g, ''))}
                            placeholder="e.g. 42"
                            className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                        />
                    </div>

                    <div className="">
                        <label className="block text-xs text-gray-600 mb-1">Min Reputation</label>
                        <input
                            inputMode="numeric"
                            value={minRep}
                            onChange={(e) => setMinRep(e.target.value.replace(/[^\d]/g, ''))}
                            placeholder="0–100"
                            className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                        />
                    </div>

                    <div className="">
                        <label className="block text-xs text-gray-600 mb-1">Max Reputation</label>
                        <input
                            inputMode="numeric"
                            value={maxRep}
                            onChange={(e) => setMaxRep(e.target.value.replace(/[^\d]/g, ''))}
                            placeholder="0–100"
                            className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                        />
                    </div>

                    <div className="">
                        <label className="block text-xs text-gray-600 mb-1">Created from</label>
                        <input
                            type="date"
                            value={createdFrom}
                            onChange={(e) => setCreatedFrom(e.target.value)}
                            className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                        />
                    </div>

                    <div className="">
                        <label className="block text-xs text-gray-600 mb-1">Created to</label>
                        <input
                            type="date"
                            value={createdTo}
                            onChange={(e) => setCreatedTo(e.target.value)}
                            className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                        />
                    </div>
                </div>

                {/* Filter actions */}
                <div className="flex items-center gap-2 justify-end">
                    <label className="text-sm text-gray-600">Per page</label>
                    <select
                        value={perPage}
                        onChange={(e) => replaceUrl({ perPage: e.target.value, page: 1 })}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                        {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>

                    <button
                        type="button"
                        onClick={applyFilters}
                        className="px-3 py-2 rounded border bg-gray-50 hover:bg-gray-100 text-sm"
                    >
                        Apply filters
                    </button>
                    <button
                        type="button"
                        onClick={clearAll}
                        className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
                        title="Clear all"
                    >
                        Clear all
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-auto rounded-lg border bg-white shadow-sm">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                    <tr className="text-left">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2 whitespace-nowrap">IPs</th>
                        <th className="px-3 py-2 whitespace-nowrap">Reputation</th>
                        <th className="px-3 py-2 whitespace-nowrap">Warmup</th>
                        <th className="px-3 py-2">Company</th>
                        <th className="px-3 py-2 whitespace-nowrap">Created</th>
                        <th className="px-3 py-2"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>
                                No IP pools found.
                            </td>
                        </tr>
                    ) : items.map((p) => (
                        <tr key={p.id} className="border-t">
                            <td className="px-3 py-2">
                                {p.name || <span className="text-gray-500 italic">(unnamed)</span>}
                            </td>
                            <td className="px-3 py-2">{ipsSummary(p.ips)}</td>
                            <td className="px-3 py-2">{p.reputation_score ?? '—'}</td>
                            <td className="px-3 py-2">{p.warmup_state ?? '—'}</td>
                            <td className="px-3 py-2">
                                {p.company ? (
                                    <>
                                        {p.company.name ?? `(ID ${p.company.id})`}
                                        <span className="text-xs text-gray-500 ml-1">#{p.company.id}</span>
                                    </>
                                ) : '—'}
                            </td>
                            <td className="px-3 py-2">{fmtDate(p.created_at)}</td>
                            <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <Link
                                        href={editHref(p.id)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                        title="Edit"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" /> Edit
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(p.id)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded border text-red-600 hover:bg-red-50"
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
                    <span className="font-medium">{meta.totalPages}</span> · {meta.total} pools
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => replaceUrl({ page: Math.max(1, meta.page - 1) })}
                        disabled={meta.page <= 1}
                        className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50 text-sm"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => replaceUrl({ page: Math.min(meta.totalPages, meta.page + 1) })}
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
