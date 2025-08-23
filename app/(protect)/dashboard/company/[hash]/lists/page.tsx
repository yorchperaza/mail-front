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
    EyeIcon,
} from '@heroicons/react/24/outline';

type ListGroup = {
    id: number;
    name: string;
    created_at?: string | null;
    counts?: {
        contacts?: number | null;
        campaigns?: number | null;
    };
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

export default function ListsIndexPage() {
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

    // UI/data
    const [data, setData] = useState<ApiListResponse<ListGroup> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [creatingOpen, setCreatingOpen] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [creating, setCreating] = useState(false);

    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [renaming, setRenaming] = useState(false);

    const [deletingId, setDeletingId] = useState<number | null>(null);

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const listUrl = useMemo(() => {
        const sp = new URLSearchParams();
        sp.set('page', String(page));
        sp.set('perPage', String(perPage));
        sp.set('withCounts', '1');
        if (qFromUrl) sp.set('search', qFromUrl);
        return `${backend}/companies/${hash}/lists?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl]);

    // Fetch lists
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load lists (${res.status})`);
                const json: ApiListResponse<ListGroup> = await res.json();
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
        updateQuery({ search: searchTerm, page: 1 });
    }
    function clearFilters() {
        setSearchTerm('');
        updateQuery({ search: undefined, page: 1 });
    }

    const toLocale = (s?: string | null) => {
        if (!s) return '—';
        try { return new Date(s).toLocaleString(); } catch { return s; }
    };

    async function handleCreate() {
        if (!newListName.trim()) return;
        setCreating(true);
        try {
            const res = await fetch(`${backend}/companies/${hash}/lists`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ name: newListName.trim() }),
            });
            if (!res.ok) throw new Error(`Create failed (${res.status})`);
            const created: ListGroup = await res.json();
            // optimistic: prepend
            setData(prev => prev
                ? {
                    ...prev,
                    items: [created, ...prev.items],
                    meta: { ...prev.meta, total: prev.meta.total + 1 },
                }
                : prev
            );
            setNewListName('');
            setCreatingOpen(false);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setCreating(false);
        }
    }

    function openRename(g: ListGroup) {
        setRenamingId(g.id);
        setRenameValue(g.name);
    }
    async function handleRename() {
        const id = renamingId;
        if (!id || !renameValue.trim()) return;
        setRenaming(true);
        try {
            const res = await fetch(`${backend}/companies/${hash}/lists/${id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ name: renameValue.trim() }),
            });
            if (!res.ok) throw new Error(`Rename failed (${res.status})`);
            const updated: ListGroup = await res.json();
            setData(prev => prev
                ? { ...prev, items: prev.items.map(i => (i.id === id ? updated : i)) }
                : prev
            );
            setRenamingId(null);
            setRenameValue('');
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setRenaming(false);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this list? All its memberships will be removed.')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`${backend}/companies/${hash}/lists/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            setData(prev => prev
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

    if (loading && !data) return <p className="p-6 text-center text-gray-600">Loading lists…</p>;
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
                <h1 className="text-2xl font-semibold">Lists</h1>
                <button
                    onClick={() => setCreatingOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                >
                    <PlusIcon className="h-5 w-5 mr-1" /> New List
                </button>
            </div>

            {/* Toolbar */}
            <form onSubmit={onSubmitSearch} className="bg-white border rounded-lg p-3 flex items-center gap-2">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                        name="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by list name…"
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
                        <th className="px-3 py-2"># Contacts</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={4}>
                                No lists found.
                            </td>
                        </tr>
                    ) : (
                        items.map((g) => (
                            <tr key={g.id} className="border-t">
                                <td className="px-3 py-2">{g.name}</td>
                                <td className="px-3 py-2">{g.counts?.contacts ?? '—'}</td>
                                <td className="px-3 py-2">{toLocale(g.created_at)}</td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/dashboard/company/${hash}/lists/${g.id}/contacts`}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                            title="View contacts in this list"
                                        >
                                            <EyeIcon className="h-4 w-4" /> View Members
                                        </Link>
                                        <button
                                            onClick={() => openRename(g)}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                            title="Rename list"
                                        >
                                            <PencilSquareIcon className="h-4 w-4" /> Rename
                                        </button>
                                        <button
                                            onClick={() => handleDelete(g.id)}
                                            disabled={deletingId === g.id}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
                                                deletingId === g.id ? 'text-red-400' : 'text-red-600 hover:bg-red-50'
                                            }`}
                                            title="Delete list"
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
                    {' '}· {meta.total} lists
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

            {/* Create Modal */}
            {creatingOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setCreatingOpen(false)} />
                    <div className="relative bg-white w-full max-w-md rounded-lg shadow-lg p-5 space-y-4 border">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Create New List</h2>
                            <button onClick={() => setCreatingOpen(false)} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">List name</label>
                            <input
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                className="w-full rounded border px-3 py-2"
                                placeholder="e.g. Newsletter"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setCreatingOpen(false)} className="px-4 py-2 rounded border hover:bg-gray-50">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={creating || !newListName.trim()}
                                className="px-4 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-60"
                            >
                                {creating ? 'Creating…' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Modal */}
            {renamingId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setRenamingId(null)} />
                    <div className="relative bg-white w-full max-w-md rounded-lg shadow-lg p-5 space-y-4 border">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Rename List</h2>
                            <button onClick={() => setRenamingId(null)} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">New name</label>
                            <input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="w-full rounded border px-3 py-2"
                                placeholder="New list name"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setRenamingId(null)} className="px-4 py-2 rounded border hover:bg-gray-50">
                                Cancel
                            </button>
                            <button
                                onClick={handleRename}
                                disabled={renaming || !renameValue.trim()}
                                className="px-4 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-60"
                            >
                                {renaming ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
