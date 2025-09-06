'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    EyeIcon,
    PencilSquareIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    PlusIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';

type MemberItem = {
    id: number;               // membership id
    subscribed_at: string | null;
    contact: {
        id: number;
        email: string | null;
        name: string | null;
        status: string | null;
    } | null;
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

type ListSummary = {
    id: number;
    name: string;
    created_at?: string | null;
    counts?: { contacts?: number | null; campaigns?: number | null };
};

// for the live search results
type ContactSearchItem = {
    id: number;
    email: string | null;
    name: string | null;
    status: string | null;
};

export default function ContactsByListPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash, listId } = useParams<{ hash: string; listId: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();

    // controlled search (page-local filter)
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);

    // UI/data
    const [listInfo, setListInfo] = useState<ListSummary | null>(null);
    const [data, setData] = useState<ApiListResponse<MemberItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);

    // force-refetch tick for members
    const [reloadTick, setReloadTick] = useState(0);
    const refreshMembers = () => setReloadTick(t => t + 1);

    // Add-members modal state
    const [addOpen, setAddOpen] = useState(false);
    const [pickQuery, setPickQuery] = useState('');
    const [pickDebounced, setPickDebounced] = useState('');
    const [pickLoading, setPickLoading] = useState(false);
    const [pickErr, setPickErr] = useState<string | null>(null);
    const [pickResults, setPickResults] = useState<ContactSearchItem[]>([]);
    const [pickSelected, setPickSelected] = useState<Set<number>>(new Set());
    const [addingBulk, setAddingBulk] = useState(false);
    const [addEmail, setAddEmail] = useState('');
    const [addingEmail, setAddingEmail] = useState(false);

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    // URLs
    const listInfoUrl = useMemo(
        () => `${backend}/companies/${hash}/lists/${listId}`,
        [backend, hash, listId]
    );

    const membersUrl = useMemo(() => {
        const sp = new URLSearchParams();
        sp.set('page', String(page));
        sp.set('perPage', String(perPage));
        // bump param so useEffect refires cleanly after additions
        sp.set('_r', String(reloadTick));
        return `${backend}/companies/${hash}/lists/${listId}/contacts?${sp.toString()}`;
    }, [backend, hash, listId, page, perPage, reloadTick]);

    // Fetch list info
    useEffect(() => {
        let abort = false;
        (async () => {
            try {
                const res = await fetch(listInfoUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load list (${res.status})`);
                const json: ListSummary = await res.json();
                if (!abort) setListInfo(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            }
        })();
        return () => { abort = true; };
    }, [listInfoUrl]);

    // Fetch members
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(membersUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load members (${res.status})`);
                const json: ApiListResponse<MemberItem> = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [membersUrl]);

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

    async function handleRemove(membershipId: number, contactId?: number | null) {
        if (!contactId) return;
        if (!confirm('Remove this contact from the list?')) return;
        setRemovingId(membershipId);
        try {
            const url = `${backend}/companies/${hash}/lists/${listId}/contacts/${contactId}`;
            const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok && res.status !== 204) throw new Error(`Remove failed (${res.status})`);
            // optimistic
            setData(prev => prev
                ? {
                    ...prev,
                    items: prev.items.filter(i => i.id !== membershipId),
                    meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) },
                }
                : prev
            );
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setRemovingId(null);
        }
    }

    // ——— Add-members modal logic ———

    // debounce search input for live results
    useEffect(() => {
        const t = setTimeout(() => setPickDebounced(pickQuery.trim()), 300);
        return () => clearTimeout(t);
    }, [pickQuery]);

    // fetch live results when modal open + debounced query changes
    useEffect(() => {
        if (!addOpen) return;
        let abort = false;
        (async () => {
            setPickErr(null);
            setPickLoading(true);
            try {
                const sp = new URLSearchParams();
                // show something even without query: small page.
                sp.set('page', '1');
                sp.set('perPage', pickDebounced ? '20' : '10');
                if (pickDebounced) sp.set('search', pickDebounced);
                const url = `${backend}/companies/${hash}/contacts?${sp.toString()}`;
                const res = await fetch(url, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Search failed (${res.status})`);
                const json: ApiListResponse<ContactSearchItem> = await res.json();

                // exclude contacts already in current table page
                const existingIds = new Set<number>(
                    (data?.items || [])
                        .map(m => m.contact?.id)
                        .filter((id): id is number => typeof id === 'number')
                );
                const results = (json.items || []).filter(c => !existingIds.has(c.id));
                if (!abort) setPickResults(results);
            } catch (e) {
                if (!abort) setPickErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setPickLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [addOpen, pickDebounced, backend, hash, data?.items]);

    function togglePick(id: number) {
        setPickSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    async function addSelectedToList() {
        if (pickSelected.size === 0) return;
        setAddingBulk(true);
        try {
            // POST each contact_id using addMember endpoint
            const ids = Array.from(pickSelected);
            for (const cid of ids) {
                const res = await fetch(`${backend}/companies/${hash}/lists/${listId}/contacts`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ contact_id: cid }),
                });
                if (!res.ok) throw new Error(`Failed to add contact #${cid} (${res.status})`);
                // we don't trust the response to be fully hydrated; we'll refetch below
            }

            // reset modal state
            setPickSelected(new Set());
            setPickQuery('');
            setAddOpen(false);

            // force a fresh server fetch so we show fully hydrated rows
            refreshMembers();

            // (optional) refresh list header/counts
            fetch(listInfoUrl, { headers: authHeaders() })
                .then(r => (r.ok ? r.json() : null))
                .then(json => json && setListInfo(json))
                .catch(() => {});
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setAddingBulk(false);
        }
    }

    async function addOneByEmail() {
        const email = addEmail.trim().toLowerCase();
        if (!email) return;
        setAddingEmail(true);
        try {
            const res = await fetch(`${backend}/companies/${hash}/lists/${listId}/contacts`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ email }),
            });
            if (!res.ok) throw new Error(`Failed to add ${email} (${res.status})`);
            // ignore payload; we will refetch to hydrate

            setAddEmail('');
            setAddOpen(false);

            // force a fresh server fetch
            refreshMembers();

            // (optional) refresh list header/counts
            fetch(listInfoUrl, { headers: authHeaders() })
                .then(r => (r.ok ? r.json() : null))
                .then(json => json && setListInfo(json))
                .catch(() => {});
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setAddingEmail(false);
        }
    }

    const backHref = `/dashboard/company/${hash}/lists`;
    const toLocale = (s?: string | null) => {
        if (!s) return '—';
        try { return new Date(s).toLocaleString(); } catch { return s; }
    };

    if (loading && !data) return <p className="p-6 text-center text-gray-600">Loading…</p>;
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

    // client-side filter for name/email/status over current page
    const filtered = items.filter(m => {
        if (!searchTerm) return true;
        const needle = searchTerm.toLowerCase();
        const c = m.contact;
        return (
            (c?.email || '').toLowerCase().includes(needle) ||
            (c?.name || '').toLowerCase().includes(needle) ||
            (c?.status || '').toLowerCase().includes(needle)
        );
    });

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
                <h1 className="text-2xl font-semibold">
                    List: <span className="text-gray-800">{listInfo?.name ?? `#${listId}`}</span>
                </h1>
                <button
                    onClick={() => setAddOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                >
                    <PlusIcon className="h-5 w-5 mr-1" /> Add members
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
                        placeholder="Filter this page (name, email, status)…"
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
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Subscribed</th>
                        <th className="px-3 py-2"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                                No contacts found in this page.
                            </td>
                        </tr>
                    ) : (
                        filtered.map((m) => {
                            const c = m.contact;
                            const email = c?.email ?? '';
                            return (
                                <tr key={m.id} className="border-t">
                                    <td className="px-3 py-2">
                                        {c?.name || <span className="text-gray-500 italic">(no name)</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="font-mono text-xs">{email || '—'}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-gray-700">{c?.status || '—'}</span>
                                    </td>
                                    <td className="px-3 py-2">{toLocale(m.subscribed_at)}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            {email ? (
                                                <>
                                                    <Link
                                                        href={`/dashboard/company/${hash}/contacts/detail?email=${encodeURIComponent(email)}`}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                                        title="View"
                                                    >
                                                        <EyeIcon className="h-4 w-4" /> View
                                                    </Link>
                                                    <Link
                                                        href={`/dashboard/company/${hash}/contacts/edit?email=${encodeURIComponent(email)}`}
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
                                                onClick={() => handleRemove(m.id, c?.id)}
                                                disabled={removingId === m.id}
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
                                                    removingId === m.id ? 'text-red-400' : 'text-red-600 hover:bg-red-50'
                                                }`}
                                                title="Remove from list"
                                            >
                                                <TrashIcon className="h-4 w-4" /> Remove
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                    Page <span className="font-medium">{meta.page}</span> of{' '}
                    <span className="font-medium">{meta.totalPages}</span>
                    {' '}· {meta.total} total memberships
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

            {/* Add Members Modal */}
            {addOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setAddOpen(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-lg shadow-lg p-5 space-y-4 border">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Add members to “{listInfo?.name ?? `#${listId}`}”</h2>
                            <button onClick={() => setAddOpen(false)} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Add by email (single quick add) */}
                        <div className="border rounded p-3 space-y-2">
                            <label className="block text-sm font-medium">Add by email</label>
                            <div className="flex gap-2">
                                <input
                                    value={addEmail}
                                    onChange={(e) => setAddEmail(e.target.value)}
                                    placeholder="user@example.com"
                                    className="flex-1 rounded border px-3 py-2"
                                />
                                <button
                                    onClick={addOneByEmail}
                                    disabled={addingEmail || !addEmail.trim()}
                                    className="inline-flex items-center px-3 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-60"
                                >
                                    <CheckIcon className="h-5 w-5 mr-1" />
                                    {addingEmail ? 'Adding…' : 'Add'}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">If the email doesn’t exist yet, it will be created and subscribed.</p>
                        </div>

                        {/* Live search & multi-select */}
                        <div className="border rounded p-3 space-y-3">
                            <div className="relative">
                                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                <input
                                    value={pickQuery}
                                    onChange={(e) => setPickQuery(e.target.value)}
                                    placeholder="Search existing contacts…"
                                    className="w-full pl-9 pr-9 py-2 rounded border border-gray-300"
                                />
                                {pickQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setPickQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                                        aria-label="Clear"
                                    >
                                        <XMarkIcon className="h-4 w-4 text-gray-500" />
                                    </button>
                                )}
                            </div>

                            {pickErr && <p className="text-sm text-red-600">{pickErr}</p>}
                            {pickLoading ? (
                                <p className="text-sm text-gray-600">Searching…</p>
                            ) : (
                                <div className="max-h-72 overflow-auto rounded border">
                                    {pickResults.length === 0 ? (
                                        <div className="p-4 text-sm text-gray-500">No results.</div>
                                    ) : (
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50">
                                            <tr className="text-left">
                                                <th className="px-3 py-2 w-10">{/* checkbox column */}</th>
                                                <th className="px-3 py-2">Name</th>
                                                <th className="px-3 py-2">Email</th>
                                                <th className="px-3 py-2">Status</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {pickResults.map(c => {
                                                const checked = pickSelected.has(c.id);
                                                return (
                                                    <tr key={c.id} className="border-t hover:bg-gray-50">
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => togglePick(c.id)}
                                                                aria-label={`Select ${c.email ?? c.name ?? c.id}`}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">{c.name || <span className="text-gray-500 italic">(no name)</span>}</td>
                                                        <td className="px-3 py-2"><span className="font-mono text-xs">{c.email ?? '—'}</span></td>
                                                        <td className="px-3 py-2">{c.status ?? '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                            {/**/}
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={() => setAddOpen(false)}
                                    className="px-4 py-2 rounded border hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={addSelectedToList}
                                    disabled={addingBulk || pickSelected.size === 0}
                                    className="inline-flex items-center px-4 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-60"
                                >
                                    <CheckIcon className="h-5 w-5 mr-1" />
                                    {addingBulk ? 'Adding…' : `Add ${pickSelected.size} selected`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
