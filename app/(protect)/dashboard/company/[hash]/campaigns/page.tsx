'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    TrashIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type CampaignStatus =
    | 'draft'
    | 'scheduled'
    | 'sending'
    | 'paused'
    | 'completed'
    | 'cancelled';

type SendMode = 'immediate' | 'scheduled';
type TargetKind = 'list' | 'segment';

type CampaignRow = {
    id: number;
    name: string | null;
    subject: string | null;
    send_mode: SendMode;
    scheduled_at: string | null;
    target: TargetKind;
    status: CampaignStatus;
    created_at: string | null;
    template_id: number | null;
    domain_id: number | null;
    listGroup_id: number | null;
    segment_id: number | null;
    metrics: {
        sent: number;
        delivered: number;
        opens: number;
        clicks: number;
        bounces: number;
        complaints: number;
    };
};

type ApiPaged<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ----------------------------- Page ----------------------------- */

export default function CampaignsIndexPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const search = useSearchParams();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();
    const statusFromUrl = (search.get('status') || '').trim() as '' | CampaignStatus;

    // Controlled inputs
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [status, setStatus] = useState<'' | CampaignStatus>(statusFromUrl);
    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);
    useEffect(() => setStatus(statusFromUrl), [statusFromUrl]);

    // Data
    const [data, setData] = useState<ApiPaged<CampaignRow> | null>(null);
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
        if (statusFromUrl) sp.set('status', statusFromUrl);
        return `${backend}/companies/${hash}/campaigns?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl, statusFromUrl]);

    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load campaigns (${res.status})`);
                const json: ApiPaged<CampaignRow> = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [listUrl]);

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
        updateQuery({ search: searchTerm, status, page: 1 });
    }

    function clearFilters() {
        setSearchTerm('');
        setStatus('');
        updateQuery({ search: undefined, status: undefined, page: 1 });
    }

    const backHref = `/dashboard/company/${hash}`;
    const createHref = `/dashboard/company/${hash}/campaigns/create`;

    const toLocale = (s?: string | null) => {
        if (!s) return '—';
        try { return new Date(s).toLocaleString(); } catch { return s; }
    };

    const badge = (st: CampaignStatus) => {
        const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
        const map: Record<CampaignStatus, string> = {
            draft: 'bg-gray-100 text-gray-800',
            scheduled: 'bg-blue-100 text-blue-800',
            sending: 'bg-indigo-100 text-indigo-800',
            paused: 'bg-yellow-100 text-yellow-800',
            completed: 'bg-emerald-100 text-emerald-800',
            cancelled: 'bg-red-100 text-red-800',
        };
        return <span className={`${base} ${map[st]}`}>{st}</span>;
    };

    async function handleDelete(id: number) {
        if (!confirm('Delete this campaign?')) return;
        try {
            const res = await fetch(`${backend}/companies/${hash}/campaigns/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            // refetch or optimistic update
            setData(prev => prev ? {
                ...prev,
                items: prev.items.filter(i => i.id !== id),
                meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) },
            } : prev);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        }
    }

    if (loading && !data) return <p className="p-6 text-center text-gray-600">Loading campaigns…</p>;
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
                <h1 className="text-2xl font-semibold">Campaigns</h1>
                <Link
                    href={createHref}
                    className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                >
                    <PlusIcon className="h-5 w-5 mr-1" /> New Campaign
                </Link>
            </div>

            {/* Toolbar */}
            <form onSubmit={onSubmitSearch} className="bg-white border rounded-lg p-3 flex items-center gap-2">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name or subject…"
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

                <label className="text-sm text-gray-600">Status</label>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CampaignStatus | '')}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                    <option value="">All</option>
                    {(['draft','scheduled','sending','paused','completed','cancelled'] as CampaignStatus[]).map(s =>
                        <option key={s} value={s}>{s}</option>
                    )}
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
                    disabled={!qFromUrl && !statusFromUrl && page === 1}
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
                        <th className="px-3 py-2">Subject</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Target</th>
                        <th className="px-3 py-2">Send mode</th>
                        <th className="px-3 py-2">Scheduled</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2 whitespace-nowrap">Sent / Opens / Clicks</th>
                        <th className="px-3 py-2"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                                No campaigns found.
                            </td>
                        </tr>
                    ) : (
                        items.map((c) => (
                            <tr key={c.id} className="border-t">
                                <td className="px-3 py-2">{c.name || <span className="text-gray-500 italic">(unnamed)</span>}</td>
                                <td className="px-3 py-2">{c.subject || '—'}</td>
                                <td className="px-3 py-2">{badge(c.status)}</td>
                                <td className="px-3 py-2">{c.target}</td>
                                <td className="px-3 py-2">{c.send_mode}</td>
                                <td className="px-3 py-2">{toLocale(c.scheduled_at)}</td>
                                <td className="px-3 py-2">{toLocale(c.created_at)}</td>
                                <td className="px-3 py-2">
                                    {c.metrics.sent} / {c.metrics.opens} / {c.metrics.clicks}
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/dashboard/company/${hash}/campaigns/${c.id}`}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                            title="Open campaign"
                                        >
                                            <EyeIcon className="h-4 w-4" /> Open
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border text-red-600 hover:bg-red-50"
                                            title="Delete campaign"
                                        >
                                            <TrashIcon className="h-4 w-4" /> Delete
                                        </button>
                                    </div>
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
                    Page <span className="font-medium">{meta.page}</span> of{' '}
                    <span className="font-medium">{meta.totalPages}</span> · {meta.total} campaigns
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
