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

type PlanRow = {
    id: number;
    name: string | null;
    monthlyPrice: number | null;       // decimal as number
    includedMessages: number | null;
    averagePricePer1K: number | null;  // decimal as number
    features: Record<string, unknown> | unknown[] | null;
};

type ApiPaged<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ----------------------------- Page ----------------------------- */

export default function PlansIndexPage() {
    const router = useRouter();
    const search = useSearchParams();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();

    // Controlled inputs
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);

    // Data
    const [data, setData] = useState<ApiPaged<PlanRow> | null>(null);
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
        if (qFromUrl) sp.set('search', qFromUrl);
        return `${backend}/plans?${sp.toString()}`;
    }, [backend, page, perPage, qFromUrl]);

    useEffect(() => {
        if (!backend) { setErr('Missing backend URL'); setLoading(false); return; }
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load plans (${res.status})`);
                const json: ApiPaged<PlanRow> = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [listUrl, backend]);

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
        updateQuery({ search: searchTerm, page: 1 });
    }

    function clearFilters() {
        setSearchTerm('');
        updateQuery({ search: undefined, page: 1 });
    }

    const backHref = `/admin`;                    // adjust if needed
    const createHref = `/admin/plans/create`;     // your create page
    const editHref   = (id: number) => `/admin/plans/${id}`;

    const fmtMoney = (n: number | null | undefined) =>
        typeof n === 'number' ? `$${n.toFixed(2)}` : '—';

    const fmtNum = (n: number | null | undefined) =>
        typeof n === 'number' ? n.toLocaleString() : '—';

    const featureCount = (f: PlanRow['features']) => {
        if (!f) return 0;
        return Array.isArray(f) ? f.length : typeof f === 'object' ? Object.keys(f).length : 0;
    };

    async function handleDelete(id: number) {
        if (!confirm('Delete this plan?')) return;
        try {
            const res = await fetch(`${backend}/plans/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            // optimistic update
            setData(prev => prev ? {
                ...prev,
                items: prev.items.filter(i => i.id !== id),
                meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) },
            } : prev);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        }
    }

    if (loading && !data) return <p className="p-6 text-center text-gray-600">Loading plans…</p>;
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
                <h1 className="text-2xl font-semibold">Plans</h1>
                <Link
                    href={createHref}
                    className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                >
                    <PlusIcon className="h-5 w-5 mr-1" /> New Plan
                </Link>
            </div>

            {/* Toolbar */}
            <form onSubmit={onSubmitSearch} className="bg-white border rounded-lg p-3 flex items-center gap-2">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by plan name…"
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
                    disabled={!qFromUrl && page === 1}
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
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2 whitespace-nowrap">Monthly price</th>
                        <th className="px-3 py-2 whitespace-nowrap">Included messages</th>
                        <th className="px-3 py-2 whitespace-nowrap">Avg. $ / 1K</th>
                        <th className="px-3 py-2 whitespace-nowrap">Features (count)</th>
                        <th className="px-3 py-2"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>
                                No plans found.
                            </td>
                        </tr>
                    ) : items.map((p) => (
                        <tr key={p.id} className="border-t">
                            <td className="px-3 py-2">{p.name || <span className="text-gray-500 italic">(unnamed)</span>}</td>
                            <td className="px-3 py-2">{fmtMoney(p.monthlyPrice)}</td>
                            <td className="px-3 py-2">{fmtNum(p.includedMessages)}</td>
                            <td className="px-3 py-2">{fmtMoney(p.averagePricePer1K)}</td>
                            <td className="px-3 py-2">{featureCount(p.features)}</td>
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
                    <span className="font-medium">{meta.totalPages}</span> · {meta.total} plans
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
