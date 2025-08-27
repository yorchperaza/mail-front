'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, CheckIcon, PlayCircleIcon } from '@heroicons/react/24/outline';

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

type ListSummary = {
    id: number;
    name: string;
    created_at?: string | null;
    counts?: { contacts?: number | null; campaigns?: number | null };
};

type ApiPaged<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

type BuildDryRunResponse = {
    segment: Segment;
    matches: number;
    sample: Array<{ id: number; email: string | null; name: string | null; status: string | null }>;
    dryRun: boolean;
};

/* ---------- Component ---------- */
export default function SegmentEditPage() {
    const router = useRouter();

    // Accept either /segments/[segmentId]/edit or /segments/[id]/edit
    const params = useParams<{ hash: string; segmentId?: string; id?: string }>();
    const hash = params.hash ?? '';
    const rawId = params.segmentId ?? params.id ?? null;

    // NEVER coerce '' to 0
    const segmentIdFromRoute: number | null = (() => {
        if (rawId == null) return null;
        const s = String(rawId).trim();
        if (s === '' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    })();

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    /* ---------- Lists (for in/not-in pickers) ---------- */
    const listsUrl = useMemo(() => {
        if (!backend || !hash) return null;
        return `${backend}/companies/${hash}/lists?perPage=200`;
    }, [backend, hash]);

    const [lists, setLists] = useState<ListSummary[]>([]);
    const [listsErr, setListsErr] = useState<string | null>(null);

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
        return () => {
            abort = true;
        };
    }, [listsUrl]);

    /* ---------- Form state ---------- */
    const [segmentId, setSegmentId] = useState<number | null>(segmentIdFromRoute);
    const [name, setName] = useState('');
    const [status, setStatus] = useState<string>(''); // '' = ignore
    const [emailContains, setEmailContains] = useState('');
    const [gdprConsent, setGdprConsent] = useState<'ignore' | 'true' | 'false'>('ignore');
    const [inListIds, setInListIds] = useState<number[]>([]);
    const [notInListIds, setNotInListIds] = useState<number[]>([]);

    /* ---------- Load segment ---------- */
    const segmentUrl = useMemo(() => {
        if (!backend || !hash || segmentIdFromRoute == null) return null;
        return `${backend}/companies/${hash}/segments/${segmentIdFromRoute}`;
    }, [backend, hash, segmentIdFromRoute]);

    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!backend) {
            setLoadErr('Missing NEXT_PUBLIC_BACKEND_URL');
            return;
        }
        if (!hash) {
            setLoadErr('Missing company hash in route');
            return;
        }
        if (segmentIdFromRoute == null) {
            setLoadErr('Missing or invalid segment id in route');
            return;
        }
        if (!segmentUrl) return;

        let abort = false;
        setLoading(true);
        setLoadErr(null);

        (async () => {
            try {
                const res = await fetch(segmentUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load segment (${res.status})`);
                const s: Segment = await res.json();
                if (abort) return;

                // hydrate form
                setSegmentId(s.id);
                setName(s.name ?? '');

                const def: Definition = s.definition ?? {};
                setStatus(typeof def.status === 'string' ? def.status : '');
                setEmailContains(typeof def.email_contains === 'string' ? def.email_contains : '');
                setGdprConsent(typeof def.gdpr_consent === 'boolean' ? (def.gdpr_consent ? 'true' : 'false') : 'ignore');
                setInListIds(Array.isArray(def.in_list_ids) ? def.in_list_ids.map(Number) : []);
                setNotInListIds(Array.isArray(def.not_in_list_ids) ? def.not_in_list_ids.map(Number) : []);
            } catch (e) {
                if (!abort) setLoadErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();

        return () => {
            abort = true;
        };
    }, [segmentUrl, backend, hash, segmentIdFromRoute]);

    /* ---------- UI state ---------- */
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [previewErr, setPreviewErr] = useState<string | null>(null);
    const [preview, setPreview] = useState<BuildDryRunResponse | null>(null);

    const backHref = `/dashboard/company/${hash}/segments`;

    /* ---------- Helpers ---------- */
    function buildDefinition(): Definition {
        const def: Definition = {};
        if (status.trim() !== '') def.status = status.trim();
        if (emailContains.trim() !== '') def.email_contains = emailContains.trim();
        if (gdprConsent !== 'ignore') def.gdpr_consent = gdprConsent === 'true';
        if (inListIds.length > 0) def.in_list_ids = inListIds;
        if (notInListIds.length > 0) def.not_in_list_ids = notInListIds;
        return def;
    }

    function toggleInList(id: number) {
        setInListIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
        setNotInListIds((prev) => prev.filter((x) => x !== id));
    }
    function toggleNotInList(id: number) {
        setNotInListIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
        setInListIds((prev) => prev.filter((x) => x !== id));
    }

    async function savePatchOnly() {
        if (!backend) throw new Error('Missing backend URL');
        if (!hash) throw new Error('Missing company hash');
        if (!segmentId) throw new Error('Missing segment id');

        const body = {
            name: name.trim(),
            definition: buildDefinition(),
        };
        if (!body.name) throw new Error('Please enter a segment name');

        const res = await fetch(`${backend}/companies/${hash}/segments/${segmentId}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        const s: Segment = await res.json();

        // reflect server response
        setName(s.name ?? body.name);
        setSegmentId(s.id);
        return s.id;
    }

    async function onSaveOnly() {
        setSaveErr(null);
        setSaving(true);
        try {
            await savePatchOnly();
        } catch (e) {
            setSaveErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    async function onSaveAndClose() {
        await onSaveOnly();
        router.push(backHref);
    }

    async function onPreviewDryRun() {
        setPreviewErr(null);
        setPreview(null);
        setPreviewing(true);
        try {
            const id = await savePatchOnly(); // ensure latest changes are saved
            const res = await fetch(`${backend}/companies/${hash}/segments/${id}/build`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ dryRun: true }),
            });
            if (!res.ok) throw new Error(`Preview failed (${res.status})`);
            const json: BuildDryRunResponse = await res.json();
            setPreview(json);
        } catch (e) {
            setPreviewErr(e instanceof Error ? e.message : String(e));
        } finally {
            setPreviewing(false);
        }
    }

    const toLocale = (s?: string | null) => {
        if (!s) return '—';
        try {
            return new Date(s).toLocaleString();
        } catch {
            return s;
        }
    };

    /* ---------- Render ---------- */
    if (loading) return <p className="p-6 text-center text-gray-600">Loading segment…</p>;
    if (loadErr) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-600">{loadErr}</p>
                <Link href={backHref} className="mt-3 inline-flex items-center px-3 py-2 rounded border">
                    <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={() => router.push(backHref)} className="inline-flex items-center text-gray-600 hover:text-gray-800">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">Edit Segment</h1>
                <div className="flex gap-2">
                    <button
                        onClick={onSaveOnly}
                        disabled={saving}
                        className="px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                        title="Save (stay on page)"
                    >
                        <CheckIcon className="h-5 w-5 inline-block mr-1" />
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                        onClick={onSaveAndClose}
                        disabled={saving}
                        className="px-4 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-60"
                        title="Save and go back"
                    >
                        Save & Close
                    </button>
                </div>
            </div>

            {/* Basic info */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Segment name</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Subscribed US customers"
                        className="w-full rounded border px-3 py-2"
                    />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded border px-3 py-2">
                            <option value="">(ignore)</option>
                            <option value="subscribed">subscribed</option>
                            <option value="unsubscribed">unsubscribed</option>
                            <option value="bounced">bounced</option>
                            <option value="complained">complained</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Leave blank to ignore this filter.</p>
                    </div>

                    {/* Email contains */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Email contains</label>
                        <input
                            value={emailContains}
                            onChange={(e) => setEmailContains(e.target.value)}
                            placeholder="@example.com"
                            className="w-full rounded border px-3 py-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">Case-insensitive substring filter.</p>
                    </div>

                    {/* GDPR */}
                    <div>
                        <label className="block text-sm font-medium mb-1">GDPR consent</label>
                        <select
                            value={gdprConsent}
                            onChange={(e) => setGdprConsent(e.target.value as 'ignore' | 'true' | 'false')}
                            className="w-full rounded border px-3 py-2"
                        >
                            <option value="ignore">(ignore)</option>
                            <option value="true">true (has consent)</option>
                            <option value="false">false (no consent)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Lists pickers */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                    {/* in_list_ids */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium mb-2">Must be in ANY of these lists</label>
                            <span className="text-xs text-gray-500">{inListIds.length} selected</span>
                        </div>
                        <div className="max-h-60 overflow-auto border rounded">
                            {listsErr ? (
                                <div className="p-3 text-sm text-red-600">{listsErr}</div>
                            ) : lists.length === 0 ? (
                                <div className="p-3 text-sm text-gray-500">No lists.</div>
                            ) : (
                                <ul className="divide-y">
                                    {lists.map((l) => (
                                        <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={inListIds.includes(l.id)}
                                                onChange={() => toggleInList(l.id)}
                                                aria-label={`in: ${l.name}`}
                                            />
                                            <span>{l.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">If empty, this condition is ignored.</p>
                    </div>

                    {/* not_in_list_ids */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium mb-2">Must NOT be in any of these lists</label>
                            <span className="text-xs text-gray-500">{notInListIds.length} selected</span>
                        </div>
                        <div className="max-h-60 overflow-auto border rounded">
                            {listsErr ? (
                                <div className="p-3 text-sm text-red-600">{listsErr}</div>
                            ) : lists.length === 0 ? (
                                <div className="p-3 text-sm text-gray-500">No lists.</div>
                            ) : (
                                <ul className="divide-y">
                                    {lists.map((l) => (
                                        <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={notInListIds.includes(l.id)}
                                                onChange={() => toggleNotInList(l.id)}
                                                aria-label={`not-in: ${l.name}`}
                                            />
                                            <span>{l.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">If empty, this condition is ignored.</p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onPreviewDryRun}
                    disabled={previewing || !segmentId}
                    className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                >
                    <PlayCircleIcon className="h-5 w-5 mr-1" />
                    {previewing ? 'Previewing…' : 'Preview (dry run)'}
                </button>
                {saveErr && <span className="text-sm text-red-600">{saveErr}</span>}
                {previewErr && <span className="text-sm text-red-600">{previewErr}</span>}
                <div className="ml-auto text-sm text-gray-500">
                    {segmentId ? (
                        <>
                            Segment ID: <span className="font-mono">{segmentId}</span>
                        </>
                    ) : (
                        '—'
                    )}
                </div>
            </div>

            {/* Preview results */}
            {preview && (
                <div className="bg-white border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Preview</h2>
                        <div className="text-sm text-gray-600">
                            Matches: <span className="font-medium">{preview.matches}</span>
                            {preview.segment.last_built_at && <> · Last built: {toLocale(preview.segment.last_built_at)}</>}
                        </div>
                    </div>
                    <div className="overflow-auto rounded border">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                            <tr className="text-left">
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Email</th>
                                <th className="px-3 py-2">Status</th>
                            </tr>
                            </thead>
                            <tbody>
                            {preview.sample.length === 0 ? (
                                <tr>
                                    <td className="px-3 py-6 text-center text-gray-500" colSpan={3}>
                                        No matching contacts in sample.
                                    </td>
                                </tr>
                            ) : (
                                preview.sample.map((c) => (
                                    <tr key={c.id} className="border-t">
                                        <td className="px-3 py-2">
                                            {c.name || <span className="text-gray-500 italic">(no name)</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="font-mono text-xs">{c.email ?? '—'}</span>
                                        </td>
                                        <td className="px-3 py-2">{c.status ?? '—'}</td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>

                    <div className="text-sm text-gray-600">
                        This is a dry run. Use <b>Save</b> to persist definition changes. You can run a full build from the list page.
                    </div>
                </div>
            )}

            {/* Footer nav */}
            <div className="flex items-center justify-between">
                <Link href={backHref} className="text-sm text-gray-600 hover:text-gray-800">
                    ← Back to segments
                </Link>
                <div />
            </div>
        </div>
    );
}
