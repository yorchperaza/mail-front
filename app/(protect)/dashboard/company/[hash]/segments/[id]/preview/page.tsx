'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, PlayCircleIcon } from '@heroicons/react/24/outline';

/* ---------- Types ---------- */
type Definition = {
    status?: string;
    email_contains?: string;
    gdpr_consent?: boolean;
    in_list_ids?: number[];
    not_in_list_ids?: number[];
};

type Segment = {
    id: number;
    name: string;
    definition: Definition | null;
    materialized_count: number | null;
    last_built_at: string | null;
};

type ApiPaged<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

type PreviewRow = { id: number; email: string | null; name: string | null; status: string | null };

type ListSummary = { id: number; name: string };

/* ---------- Page ---------- */
export default function SegmentPreviewPage() {
    const router = useRouter();
    const params = useParams<{ hash: string; segmentId?: string; id?: string }>();
    const search = useSearchParams();

    const hash = params.hash ?? '';
    const rawId = params.segmentId ?? params.id ?? null;

    // Never coerce '' to 0
    const segmentId: number | null = (() => {
        if (rawId == null) return null;
        const s = String(rawId).trim();
        if (!s || s === 'undefined' || s === 'null') return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    })();

    // URL pagination
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        // NOTE: server sends user_id via middleware; this header is here in case you also check bearer
    };

    const backHref = `/dashboard/company/${hash}/segments`;

    /* ---------- Data: segment ---------- */
    const [segment, setSegment] = useState<Segment | null>(null);
    const [segErr, setSegErr] = useState<string | null>(null);
    const [segLoading, setSegLoading] = useState(false);

    const segUrl = useMemo(() => {
        if (!backend || !hash || segmentId == null) return null;
        return `${backend}/companies/${hash}/segments/${segmentId}`;
    }, [backend, hash, segmentId]);

    useEffect(() => {
        if (!backend) { setSegErr('Missing NEXT_PUBLIC_BACKEND_URL'); return; }
        if (!hash) { setSegErr('Missing company hash in route'); return; }
        if (segmentId == null) { setSegErr('Missing or invalid segment id'); return; }
        if (!segUrl) return;

        let abort = false;
        (async () => {
            setSegLoading(true);
            setSegErr(null);
            try {
                const res = await fetch(segUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load segment (${res.status})`);
                const s: Segment = await res.json();
                if (!abort) setSegment(s);
            } catch (e) {
                if (!abort) setSegErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setSegLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [segUrl, backend, hash, segmentId]);

    /* ---------- Data: lists for humanized rules ---------- */
    const [lists, setLists] = useState<ListSummary[]>([]);
    const [listsErr, setListsErr] = useState<string | null>(null);

    const listsUrl = useMemo(() => {
        if (!backend || !hash) return null;
        return `${backend}/companies/${hash}/lists?perPage=200`;
    }, [backend, hash]);

    useEffect(() => {
        if (!listsUrl) return;
        let abort = false;
        (async () => {
            setListsErr(null);
            try {
                const res = await fetch(listsUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load lists (${res.status})`);
                const json: ApiPaged<ListSummary> = await res.json();
                if (!abort) setLists(json.items || []);
            } catch (e) {
                if (!abort) setListsErr(e instanceof Error ? e.message : String(e));
            }
        })();
        return () => { abort = true; };
    }, [listsUrl]);

    const listName = (id: number) => lists.find(l => l.id === id)?.name ?? `#${id}`;

    /* ---------- Data: preview (paginated) ---------- */
    const [preview, setPreview] = useState<ApiPaged<PreviewRow> | null>(null);
    const [prevErr, setPrevErr] = useState<string | null>(null);
    const [prevLoading, setPrevLoading] = useState(false);

    const previewUrl = useMemo(() => {
        if (!backend || !hash || segmentId == null) return null;
        const sp = new URLSearchParams({ page: String(page), perPage: String(perPage) });
        return `${backend}/companies/${hash}/segments/${segmentId}/preview?` + sp.toString();
    }, [backend, hash, segmentId, page, perPage]);

    useEffect(() => {
        if (!previewUrl) return;
        let abort = false;
        (async () => {
            setPrevLoading(true);
            setPrevErr(null);
            try {
                const res = await fetch(previewUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load preview (${res.status})`);
                const json: ApiPaged<PreviewRow> = await res.json();
                if (!abort) setPreview(json);
            } catch (e) {
                if (!abort) setPrevErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setPrevLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [previewUrl]);

    /* ---------- Actions ---------- */
    const [building, setBuilding] = useState(false);
    const [buildErr, setBuildErr] = useState<string | null>(null);
    const [buildMsg, setBuildMsg] = useState<string | null>(null);

    async function handleBuildNow() {
        if (!backend || !hash || segmentId == null) return;
        if (!confirm('Build this segment now? This will update the materialized count.')) return;
        setBuilding(true);
        setBuildErr(null);
        setBuildMsg(null);
        try {
            const res = await fetch(`${backend}/companies/${hash}/segments/${segmentId}/build`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ dryRun: false }),
            });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload?.error || `Build failed (${res.status})`);

            // refresh segment header (count + last_built_at)
            setSegment(payload.segment as Segment);
            setBuildMsg(
                `Built: ${payload?.performed?.new_count ?? '—'} matches (Δ ${payload?.performed?.delta ?? '—'}).`
            );
        } catch (e) {
            setBuildErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBuilding(false);
            // keep the table as-is (preview endpoint is read-only)
        }
    }

    /* ---------- Helpers ---------- */
    const toLocale = (s?: string | null) => {
        if (!s) return '—';
        try { return new Date(s).toLocaleString(); } catch { return s; }
    };

    function updateQuery(partial: Record<string, unknown>) {
        const sp = new URLSearchParams(search.toString());
        Object.entries(partial).forEach(([k, v]) => {
            if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) sp.delete(k);
            else sp.set(k, String(v));
        });
        router.replace(`?${sp.toString()}`);
    }

    function ruleChips(def?: Definition | null) {
        if (!def || Object.keys(def).length === 0) {
            return <span className="inline-block text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">No filters</span>;
        }
        const chips: string[] = [];
        if (def.status) chips.push(`Status: ${def.status}`);
        if (def.email_contains) chips.push(`Email contains “${def.email_contains}”`);
        if ('gdpr_consent' in def) chips.push(def.gdpr_consent ? 'Has GDPR consent' : 'No GDPR consent');
        if (def.in_list_ids?.length) chips.push('In any of: ' + def.in_list_ids.map(listName).join(', '));
        if (def.not_in_list_ids?.length) chips.push('Not in: ' + def.not_in_list_ids.map(listName).join(', '));
        return (
            <div className="flex flex-wrap gap-2">
                {chips.map((c, i) => (
                    <span key={i} className="inline-block text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
            {c}
          </span>
                ))}
            </div>
        );
    }

    /* ---------- Render ---------- */
    if (segLoading && !segment) return <p className="p-6 text-center text-gray-600">Loading segment…</p>;
    if (segErr) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-600">{segErr}</p>
                <Link href={backHref} className="mt-3 inline-flex items-center px-3 py-2 rounded border">
                    <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back
                </Link>
            </div>
        );
    }
    if (!segment) return null;

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={() => router.push(backHref)} className="inline-flex items-center text-gray-600 hover:text-gray-800">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold truncate">{segment.name}</h1>
                    <div className="mt-1 text-sm text-gray-600">
                        Count: <span className="font-medium">{segment.materialized_count ?? '—'}</span>
                        {' '}· Last built: {toLocale(segment.last_built_at)}
                    </div>
                </div>
                <button
                    onClick={handleBuildNow}
                    disabled={building}
                    className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    title="Build (materialize count)"
                >
                    <PlayCircleIcon className="h-5 w-5 mr-1" />
                    {building ? 'Building…' : 'Build now'}
                </button>
            </div>

            {/* Rules */}
            <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Rules</h2>
                    {listsErr && <span className="text-sm text-red-600">{listsErr}</span>}
                </div>
                <div className="mt-2">{ruleChips(segment.definition)}</div>
                {buildErr && <div className="mt-2 text-sm text-red-600">{buildErr}</div>}
                {buildMsg && <div className="mt-2 text-sm text-green-700">{buildMsg}</div>}
            </div>

            {/* Preview table */}
            <div className="bg-white border rounded-lg">
                <div className="p-3 border-b flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Matching contacts</h2>
                    <div className="text-sm text-gray-600">
                        {preview?.meta
                            ? <>Page <span className="font-medium">{preview.meta.page}</span> / {preview.meta.totalPages} · {preview.meta.total} total</>
                            : prevLoading ? 'Loading…' : ''}
                    </div>
                </div>

                {prevErr ? (
                    <div className="p-4 text-red-600">{prevErr}</div>
                ) : (
                    <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                            <tr className="text-left">
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Email</th>
                                <th className="px-3 py-2">Status</th>
                            </tr>
                            </thead>
                            <tbody>
                            {prevLoading && !preview ? (
                                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={3}>Loading…</td></tr>
                            ) : !preview || preview.items.length === 0 ? (
                                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={3}>No matching contacts.</td></tr>
                            ) : (
                                preview.items.map((c) => (
                                    <tr key={c.id} className="border-t">
                                        <td className="px-3 py-2">{c.name || <span className="text-gray-500 italic">(no name)</span>}</td>
                                        <td className="px-3 py-2"><span className="font-mono text-xs">{c.email ?? '—'}</span></td>
                                        <td className="px-3 py-2">{c.status ?? '—'}</td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <div className="p-3 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        Per page:{' '}
                        <select
                            value={perPage}
                            onChange={(e) => updateQuery({ perPage: e.target.value, page: 1 })}
                            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                        >
                            {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
                            disabled={!preview || page <= 1}
                            className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50 text-sm"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => updateQuery({ page: Math.min(preview?.meta?.totalPages ?? page, page + 1) })}
                            disabled={!preview || page >= (preview.meta?.totalPages ?? 1)}
                            className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50 text-sm"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
                <Link href={backHref} className="text-sm text-gray-600 hover:text-gray-800">← Back to segments</Link>
                <div />
            </div>
        </div>
    );
}
