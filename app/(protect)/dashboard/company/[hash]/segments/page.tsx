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
    PlayCircleIcon,
    XMarkIcon,
    EyeIcon, ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

type SegmentItem = {
    id: number;
    name: string;
    definition: Record<string, any> | null;
    materialized_count: number | null;
    last_built_at: string | null;
    hash?: string | null;
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

type BuildResponse = {
    segment: SegmentItem;
    matches: number;
    sample: Array<{ id: number; email: string | null; name: string | null; status: string | null }>;
    dryRun: boolean;
};

/* ---------------- UI helpers ---------------- */

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
    return (
        <span
            title={title}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700"
        >
      {children}
    </span>
    );
}

/** Render a definition into pretty chips/labels */
function DefinitionChips({ def }: { def: Record<string, any> | null }) {
    if (!def || Object.keys(def).length === 0) {
        return <span className="text-gray-400">—</span>;
    }

    const chips: React.ReactNode[] = [];

    if (def.status) {
        chips.push(<Chip key="status">Status: <b className="font-medium">{String(def.status)}</b></Chip>);
    }

    if (def.email_contains) {
        chips.push(
            <Chip key="email_contains" title="Email substring match">
                Email contains <code className="font-mono text-[11px]">{String(def.email_contains)}</code>
            </Chip>
        );
    }

    if (Array.isArray(def.in_list_ids) && def.in_list_ids.length) {
        chips.push(
            <Chip key="in_lists" title="Contact must be in any of these lists">
                In lists: <code className="font-mono text-[11px]">{def.in_list_ids.join(', ')}</code>
            </Chip>
        );
    }

    if (Array.isArray(def.not_in_list_ids) && def.not_in_list_ids.length) {
        chips.push(
            <Chip key="not_in_lists" title="Contact must NOT be in these lists">
                Not in lists: <code className="font-mono text-[11px]">{def.not_in_list_ids.join(', ')}</code>
            </Chip>
        );
    }

    if (typeof def.gdpr_consent === 'boolean') {
        chips.push(
            <Chip key="gdpr" title="Whether GDPR consent timestamp exists">
                GDPR consent: <b className={`font-medium ${def.gdpr_consent ? 'text-emerald-700' : 'text-rose-700'}`}>
                {def.gdpr_consent ? 'Yes' : 'No'}
            </b>
            </Chip>
        );
    }

    // fallback: any other fields become generic chips
    Object.entries(def)
        .filter(([k]) =>
            !['status', 'email_contains', 'in_list_ids', 'not_in_list_ids', 'gdpr_consent'].includes(k)
        )
        .forEach(([k, v]) => {
            chips.push(
                <Chip key={`extra_${k}`}>
                    {k}: <code className="font-mono text-[11px]">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</code>
                </Chip>
            );
        });

    if (chips.length === 0) return <span className="text-gray-400">—</span>;

    return <div className="flex flex-wrap gap-1.5">{chips}</div>;
}

/* ---------------- Page ---------------- */

export default function SegmentsListPage() {
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

    // data/ui state
    const [data, setData] = useState<ApiListResponse<SegmentItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [workingId, setWorkingId] = useState<number | null>(null); // build/delete in-flight

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
        return `${backend}/companies/${hash}/segments?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl]);

    const [copied, setCopied] = useState<string | null>(null);

    const maskHash = (h?: string | null) => {
        if (!h) return '—';
        const s = String(h);
        if (s.length <= 12) return s;
        return `${s.slice(0, 6)}…${s.slice(-4)}`;
    };
    const copyHash = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(value);
            setTimeout(() => setCopied(null), 1200);
        } catch {
            setCopied(null);
        }
    };

    // fetch
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load segments (${res.status})`);
                const json: ApiListResponse<SegmentItem> = await res.json();
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

    async function handleBuild(id: number) {
        if (!confirm('Build this segment now? This will re-compute the materialized count.')) return;
        setWorkingId(id);
        try {
            const res = await fetch(`${backend}/companies/${hash}/segments/${id}/build`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ dryRun: false }),
            });
            if (!res.ok) throw new Error(`Build failed (${res.status})`);
            const payload: BuildResponse = await res.json();
            setData(prev =>
                prev
                    ? {
                        ...prev,
                        items: prev.items.map(s => (s.id === id ? { ...s, ...payload.segment } : s)),
                    }
                    : prev
            );
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setWorkingId(null);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this segment?')) return;
        setWorkingId(id);
        try {
            const res = await fetch(`${backend}/companies/${hash}/segments/${id}`, {
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
            setWorkingId(null);
        }
    }

    const backHref = `/dashboard/company/${hash}`;
    const createHref = `/dashboard/company/${hash}/segments/create`;
    const toLocale = (s?: string | null) => {
        if (!s) return '—';
        try { return new Date(s).toLocaleString(); } catch { return s; }
    };

    if (loading && !data) return <p className="p-6 text-center text-gray-600">Loading segments…</p>;
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
                <h1 className="text-2xl font-semibold">Segments</h1>
                <Link
                    href={createHref}
                    className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                >
                    <PlusIcon className="h-5 w-5 mr-1" /> New Segment
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
                        placeholder="Search by segment name…"
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
                        <th className="px-3 py-2">Hash</th>
                        <th className="px-3 py-2">Definition</th>
                        <th className="px-3 py-2 w-32">Count</th>
                        <th className="px-3 py-2 w-56">Last Built</th>
                        <th className="px-3 py-2 w-[280px]"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                                No segments found.
                            </td>
                        </tr>
                    ) : items.map(s => (
                        <tr key={s.id} className="border-t align-top">
                            <td className="px-3 py-2">{s.name}</td>
                            <td className="px-3 py-2">
                                {s.hash ? (
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded border">
                                            {maskHash(s.hash)}
                                        </code>
                                        <button
                                            onClick={() => copyHash(s.hash!)}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border hover:bg-gray-50 text-xs"
                                            title="Copy full hash"
                                        >
                                            <ClipboardDocumentIcon className="h-4 w-4" />
                                            {copied === s.hash ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-gray-400">—</span>
                                )}
                            </td>
                            <td className="px-3 py-2">
                                <DefinitionChips def={s.definition} />
                            </td>
                            <td className="px-3 py-2">{typeof s.materialized_count === 'number' ? s.materialized_count : '—'}</td>
                            <td className="px-3 py-2">{toLocale(s.last_built_at)}</td>
                            <td className="px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Link
                                        href={`/dashboard/company/${hash}/segments/${s.id}/preview`}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                        title="Preview (read-only, paginated)"
                                    >
                                        <EyeIcon className="h-4 w-4" /> Preview
                                    </Link>
                                    <button
                                        onClick={() => handleBuild(s.id)}
                                        disabled={workingId === s.id}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                                        title="Build (materialize)"
                                    >
                                        <PlayCircleIcon className="h-4 w-4" />
                                        {workingId === s.id ? 'Building…' : 'Build'}
                                    </button>
                                    <Link
                                        href={`/dashboard/company/${hash}/segments/${s.id}/edit`}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                        title="Edit"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" /> Edit
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(s.id)}
                                        disabled={workingId === s.id}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded border text-red-600 hover:bg-red-50 disabled:opacity-50"
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
