'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    EyeIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

type TemplateItem = {
    id: number;
    name: string | null;
    engine: string | null;     // 'raw' | 'handlebars' | 'mjml' | null
    version: number | null;
    html: string | null;       // not displayed here; just in shape
    text: string | null;       // not displayed here; just in shape
    created_at: string | null; // ISO
    usage?: {
        campaigns?: number | null;
    };
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ---------------- helpers ---------------- */

function cx(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(' ');
}

function EngineBadge({ engine }: { engine: string | null }) {
    if (!engine) return <span className="text-gray-400">—</span>;
    const tone =
        engine === 'raw'
            ? 'bg-gray-100 text-gray-800 border-gray-200'
            : engine === 'handlebars'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : engine === 'mjml'
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    : 'bg-gray-50 text-gray-700 border-gray-200';

    return (
        <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs', tone)}>
      {engine}
    </span>
    );
}

function toLocale(s?: string | null) {
    if (!s) return '—';
    try { return new Date(s).toLocaleString(); } catch { return s; }
}

/* ---------------- page ---------------- */

export default function TemplatesListPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();

    // controlled search
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);

    // data/ui
    const [data, setData] = useState<ApiListResponse<TemplateItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    // list URL
    const listUrl = useMemo(() => {
        const sp = new URLSearchParams();
        sp.set('page', String(page));
        sp.set('perPage', String(perPage));
        if (qFromUrl) sp.set('search', qFromUrl);
        return `${backend}/companies/${hash}/templates?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl]);

    // fetch
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load templates (${res.status})`);
                const json: ApiListResponse<TemplateItem> = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [listUrl]);

    // url updater
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

    async function handleDelete(id: number) {
        if (!confirm('Delete this template?')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`${backend}/companies/${hash}/templates/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            setData(prev =>
                prev
                    ? {
                        ...prev,
                        items: prev.items.filter(i => i.id !== id),
                        meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) },
                    }
                    : prev
            );
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    const backHref = `/dashboard/company/${hash}`;
    const createHref = `/dashboard/company/${hash}/templates/create`;

    if (loading && !data) return <p className="p-6 text-center text-gray-600">Loading templates…</p>;
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
                <h1 className="text-2xl font-semibold">Templates</h1>
                <Link
                    href={createHref}
                    className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                >
                    <PlusIcon className="h-5 w-5 mr-1" /> New Template
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
                        placeholder="Search by name or engine…"
                        className="w-full pl-9 pr-9 py-2 rounded border border-gray-300"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={clearFilters}
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
                        <th className="px-3 py-2 w-36">Engine</th>
                        <th className="px-3 py-2 w-24">Version</th>
                        <th className="px-3 py-2 w-40">Created</th>
                        <th className="px-3 py-2 w-40">Used in</th>
                        <th className="px-3 py-2 w-[280px]"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>
                                No templates found.
                            </td>
                        </tr>
                    ) : items.map(t => (
                        <tr key={t.id} className="border-t align-top">
                            <td className="px-3 py-2">{t.name || <span className="text-gray-400">(untitled)</span>}</td>
                            <td className="px-3 py-2"><EngineBadge engine={t.engine} /></td>
                            <td className="px-3 py-2">{t.version ?? '—'}</td>
                            <td className="px-3 py-2">{toLocale(t.created_at)}</td>
                            <td className="px-3 py-2">
                                {typeof t.usage?.campaigns === 'number' ? `${t.usage.campaigns} campaign${t.usage.campaigns === 1 ? '' : 's'}` : '—'}
                            </td>
                            <td className="px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Link
                                        href={`/dashboard/company/${hash}/templates/${t.id}`}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                        title="View"
                                    >
                                        <EyeIcon className="h-4 w-4" /> View
                                    </Link>
                                    <Link
                                        href={`/dashboard/company/${hash}/templates/${t.id}/edit`}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                        title="Edit"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" /> Edit
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(t.id)}
                                        disabled={deletingId === t.id}
                                        className={cx(
                                            'inline-flex items-center gap-1 px-2 py-1 rounded border',
                                            deletingId === t.id ? 'text-red-400' : 'text-red-600 hover:bg-red-50'
                                        )}
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
                    <span className="font-medium">{meta.totalPages}</span>
                    {' '}· {meta.total} total
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
