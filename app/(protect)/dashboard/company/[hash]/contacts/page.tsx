'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    PlusIcon,
    PencilSquareIcon,
    EyeIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    XMarkIcon,        // NEW
} from '@heroicons/react/24/outline';
import {ArrowDownTrayIcon} from "@heroicons/react/16/solid";

type ContactItem = {
    id: number;
    email: string | null;
    name: string | null;
    status: string | null;
    gdpr_consent_at: string | null;
    created_at: string | null;
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

export default function ContactsListPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();

    // 🔹 local state for controlled search input
    const [searchTerm, setSearchTerm] = useState(qFromUrl); // NEW: controlled
    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);   // keep in sync when URL changes

    // UI/data state
    const [data, setData] = useState<ApiListResponse<ContactItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [listCounts, setListCounts] = useState<Record<number, number>>({});

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
        return `${backend}/companies/${hash}/contacts?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl]);

    // Fetch contacts
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load contacts (${res.status})`);
                const json: ApiListResponse<ContactItem> = await res.json();
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
        updateQuery({ search: searchTerm, page: 1 }); // use controlled value
    }

    // 🔹 Clear filters/search helper
    function clearFilters() {
        setSearchTerm('');                 // clear input
        updateQuery({ search: undefined, page: 1 }); // drop from URL & reset page
        // (optional) also reset perPage: updateQuery({ search: undefined, page: 1, perPage: 25 })
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this contact?')) return;
        setDeletingId(id);
        try {
            const url = `${backend}/companies/${hash}/contacts/${id}`;
            const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            setData(prev => prev
                ? { ...prev, items: prev.items.filter(i => i.id !== id), meta: { ...prev.meta, total: prev.meta.total - 1 } }
                : prev);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    const backHref = `/dashboard/company/${hash}`;
    const createHref = `/dashboard/company/${hash}/contacts/create`;
    const importHref = `/dashboard/company/${hash}/contacts/import`;

    const toLocale = (s?: string | null) => {
        if (!s) return '—';
        try { return new Date(s).toLocaleString(); } catch { return s; }
    };

    if (loading) return <p className="p-6 text-center text-gray-600">Loading contacts…</p>;
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
                <h1 className="text-2xl font-semibold">Contacts</h1>
                <div className="flex items-center gap-3">

                    <Link
                        href={importHref}
                        className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                    >
                        {/* Replace with a new icon for Import Contacts */}
                        <ArrowDownTrayIcon className="h-5 w-5 mr-1" /> Import Contacts
                    </Link>
                    <Link
                        href={createHref}
                        className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                    >
                        <PlusIcon className="h-5 w-5 mr-1" /> New Contact
                    </Link>
                </div>
            </div>

            {/* Toolbar */}
            <form onSubmit={onSubmitSearch} className="bg-white border rounded-lg p-3 flex items-center gap-2">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                        name="search"
                        value={searchTerm}                          // controlled
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search name or email…"
                        className="w-full pl-9 pr-9 py-2 rounded border border-gray-300"
                    />
                    {/* inline clear “X” inside the input */}
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

                {/* 🔹 Clear all filters/search button */}
                <button
                    type="button"
                    onClick={clearFilters}
                    disabled={!qFromUrl && page === 1} // optional: disable when nothing to clear
                    className="px-3 py-2 rounded border text-sm hover:bg-gray-50 disabled:opacity-50"
                    title="Clear search"
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
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">GDPR Consent</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2"># of Lists</th>
                        <th className="px-3 py-2"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>
                                No contacts found.
                            </td>
                        </tr>
                    ) : (
                        items.map((c) => (
                            <tr key={c.id} className="border-t">
                                <td className="px-3 py-2">
                                    {c.name || <span className="text-gray-500 italic">(no name)</span>}
                                </td>
                                <td className="px-3 py-2">
                                    <span className="font-mono text-xs">{c.email || '—'}</span>
                                </td>
                                <td className="px-3 py-2">
                                    <span className="text-gray-700">{c.status || '—'}</span>
                                </td>
                                <td className="px-3 py-2">{toLocale(c.gdpr_consent_at)}</td>
                                <td className="px-3 py-2">{toLocale(c.created_at)}</td>
                                <td className="px-3 py-2">
                                    {typeof listCounts[c.id] === 'number' ? listCounts[c.id] : '—'}
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        {c.email ? (
                                            <>
                                                <Link
                                                    href={`/dashboard/company/${hash}/contacts/detail?email=${encodeURIComponent(c.email)}`}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                                    title="View"
                                                >
                                                    <EyeIcon className="h-4 w-4" /> View
                                                </Link>
                                                <Link
                                                    href={`/dashboard/company/${hash}/contacts/edit?email=${encodeURIComponent(c.email)}`}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                                    title="Edit"
                                                >
                                                    <PencilSquareIcon className="h-4 w-4" /> Edit
                                                </Link>
                                            </>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">no email</span>
                                        )}
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            disabled={deletingId === c.id}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
                                                deletingId === c.id ? 'text-red-400' : 'text-red-600 hover:bg-red-50'
                                            }`}
                                            title="Delete"
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
