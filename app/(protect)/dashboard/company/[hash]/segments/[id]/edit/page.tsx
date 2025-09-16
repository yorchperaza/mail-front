'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    CheckIcon,
    ClipboardDocumentIcon,
    PencilSquareIcon,
    FunnelIcon,
    UsersIcon,
    EnvelopeIcon,
    ShieldCheckIcon,
    ListBulletIcon,
    XMarkIcon,
    SparklesIcon,
    HashtagIcon,
    BeakerIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
    ExclamationTriangleIcon as ExclamationTriangleSolid,
    InformationCircleIcon as InformationCircleSolid
} from '@heroicons/react/24/solid';

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
    hash?: string | null;
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
    const params = useParams<{ hash: string; segmentId?: string; id?: string }>();
    const hash = params.hash ?? '';
    const rawId = params.segmentId ?? params.id ?? null;

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
    const [segmentHash, setSegmentHash] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [status, setStatus] = useState<string>('');
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

                setSegmentId(s.id);
                setSegmentHash(s.hash ?? null);
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
    const [saveSuccess, setSaveSuccess] = useState(false);
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

        setName(s.name ?? body.name);
        setSegmentId(s.id);
        setSegmentHash(s.hash ?? segmentHash ?? null);
        return s.id;
    }

    async function onSaveOnly() {
        setSaveErr(null);
        setSaveSuccess(false);
        setSaving(true);
        try {
            await savePatchOnly();
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            setSaveErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    async function onSaveAndClose() {
        setSaveErr(null);
        setSaving(true);
        try {
            await savePatchOnly();
            router.push(backHref);
        } catch (e) {
            setSaveErr(e instanceof Error ? e.message : String(e));
            setSaving(false);
        }
    }

    async function onPreviewDryRun() {
        setPreviewErr(null);
        setPreview(null);
        setPreviewing(true);
        try {
            const id = await savePatchOnly();
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
            return new Date(s).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return s;
        }
    };

    /* ---------- Hash UI helpers ---------- */
    const [copied, setCopied] = useState(false);
    const maskHash = (h?: string | null) => {
        if (!h) return '—';
        const s = String(h);
        if (s.length <= 12) return s;
        return `${s.slice(0, 6)}…${s.slice(-4)}`;
    };

    async function copyHash(full?: string | null) {
        if (!full) return;
        try {
            await navigator.clipboard.writeText(full);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            setCopied(false);
        }
    }

    /* ---------- Loading State ---------- */
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-5xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="rounded-xl bg-gray-200 h-48" />
                        <div className="rounded-xl bg-gray-200 h-64" />
                    </div>
                </div>
            </div>
        );
    }

    /* ---------- Error State ---------- */
    if (loadErr) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Segment</h2>
                    </div>
                    <p className="text-gray-600">{loadErr}</p>
                    <Link
                        href={backHref}
                        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to Segments
                    </Link>
                </div>
            </div>
        );
    }

    /* ---------- Main Render ---------- */
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-5xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(backHref)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Edit Segment</h1>
                            <p className="text-sm text-gray-500">
                                Segment #{segmentId}
                                {segmentHash && (
                                    <span className="ml-2">
                                        • Hash: <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{maskHash(segmentHash)}</code>
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onSaveOnly}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {saving ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <CheckIcon className="h-4 w-4" />
                                    Save
                                </>
                            )}
                        </button>
                        <button
                            onClick={onSaveAndClose}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <CheckCircleIcon className="h-4 w-4" />
                            Save & Close
                        </button>
                    </div>
                </div>

                {/* Success/Error Messages */}
                {saveSuccess && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                        <div className="flex gap-3">
                            <CheckCircleSolid className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-emerald-900">Saved Successfully</h3>
                                <p className="mt-1 text-sm text-emerald-700">Your segment has been updated.</p>
                            </div>
                        </div>
                    </div>
                )}
                {saveErr && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                        <div className="flex gap-3">
                            <ExclamationTriangleSolid className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-red-900">Save Failed</h3>
                                <p className="mt-1 text-sm text-red-700">{saveErr}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Basic Information */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <PencilSquareIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Basic Information</h3>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <SparklesIcon className="h-4 w-4 text-gray-400" />
                                Segment Name
                                <span className="text-red-500">*</span>
                            </label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Active US Subscribers"
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Filter Criteria */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <FunnelIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Filter Criteria</h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Status Filter */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <CheckCircleIcon className="h-4 w-4 text-gray-400" />
                                    Contact Status
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">All statuses</option>
                                    <option value="subscribed">✅ Subscribed</option>
                                    <option value="unsubscribed">❌ Unsubscribed</option>
                                    <option value="bounced">⚠️ Bounced</option>
                                    <option value="complained">🚫 Complained</option>
                                </select>
                                <p className="mt-1 text-xs text-gray-500">Filter contacts by their subscription status</p>
                            </div>

                            {/* Email Contains */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                                    Email Contains
                                </label>
                                <input
                                    value={emailContains}
                                    onChange={(e) => setEmailContains(e.target.value)}
                                    placeholder="@example.com"
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                                <p className="mt-1 text-xs text-gray-500">Case-insensitive substring match</p>
                            </div>

                            {/* GDPR Consent */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <ShieldCheckIcon className="h-4 w-4 text-gray-400" />
                                    GDPR Consent
                                </label>
                                <select
                                    value={gdprConsent}
                                    onChange={(e) => setGdprConsent(e.target.value as 'ignore' | 'true' | 'false')}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="ignore">All contacts</option>
                                    <option value="true">✅ Has consent</option>
                                    <option value="false">❌ No consent</option>
                                </select>
                                <p className="mt-1 text-xs text-gray-500">Filter by GDPR consent status</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* List Membership */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <ListBulletIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">List Membership</h3>
                            </div>
                            {listsErr && (
                                <span className="text-xs text-red-200 bg-red-900/20 px-2 py-1 rounded">
                                    {listsErr}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Include Lists */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                        <UserGroupIcon className="h-4 w-4 text-emerald-500" />
                                        Must be in ANY of these lists
                                    </label>
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                        {inListIds.length} selected
                                    </span>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-gray-50 max-h-60 overflow-y-auto">
                                    {lists.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-gray-500">
                                            <ListBulletIcon className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                                            No lists available
                                        </div>
                                    ) : (
                                        <div className="p-2">
                                            {lists.map((list) => (
                                                <label
                                                    key={list.id}
                                                    className={`flex items-center gap-3 rounded-lg p-2 cursor-pointer transition-all hover:bg-white ${
                                                        inListIds.includes(list.id) ? 'bg-emerald-50 ring-1 ring-emerald-200' : ''
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={inListIds.includes(list.id)}
                                                        onChange={() => toggleInList(list.id)}
                                                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className={`text-sm ${inListIds.includes(list.id) ? 'font-medium text-emerald-900' : 'text-gray-700'}`}>
                                                        {list.name}
                                                    </span>
                                                    {list.counts?.contacts && (
                                                        <span className="ml-auto text-xs text-gray-500">
                                                            {list.counts.contacts.toLocaleString()} contacts
                                                        </span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    Contacts must be in at least one selected list
                                </p>
                            </div>

                            {/* Exclude Lists */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                        <XMarkIcon className="h-4 w-4 text-red-500" />
                                        Must NOT be in any of these lists
                                    </label>
                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                                        {notInListIds.length} selected
                                    </span>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-gray-50 max-h-60 overflow-y-auto">
                                    {lists.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-gray-500">
                                            <ListBulletIcon className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                                            No lists available
                                        </div>
                                    ) : (
                                        <div className="p-2">
                                            {lists.map((list) => (
                                                <label
                                                    key={list.id}
                                                    className={`flex items-center gap-3 rounded-lg p-2 cursor-pointer transition-all hover:bg-white ${
                                                        notInListIds.includes(list.id) ? 'bg-red-50 ring-1 ring-red-200' : ''
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={notInListIds.includes(list.id)}
                                                        onChange={() => toggleNotInList(list.id)}
                                                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                    />
                                                    <span className={`text-sm ${notInListIds.includes(list.id) ? 'font-medium text-red-900' : 'text-gray-700'}`}>
                                                        {list.name}
                                                    </span>
                                                    {list.counts?.contacts && (
                                                        <span className="ml-auto text-xs text-gray-500">
                                                            {list.counts.contacts.toLocaleString()} contacts
                                                        </span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    Contacts will be excluded if in any selected list
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Section */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onPreviewDryRun}
                        disabled={previewing || !segmentId}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {previewing ? (
                            <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Previewing...
                            </>
                        ) : (
                            <>
                                <BeakerIcon className="h-4 w-4" />
                                Preview Results
                            </>
                        )}
                    </button>

                    {segmentHash && (
                        <div className="ml-auto flex items-center gap-2">
                            <HashtagIcon className="h-4 w-4 text-gray-400" />
                            <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                                {maskHash(segmentHash)}
                            </code>
                            <button
                                onClick={() => copyHash(segmentHash)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                                    copied
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {copied ? (
                                    <>
                                        <CheckIcon className="h-3 w-3" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <ClipboardDocumentIcon className="h-3 w-3" />
                                        Copy Hash
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {previewErr && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                        <div className="flex gap-3">
                            <ExclamationTriangleSolid className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-red-900">Preview Failed</h3>
                                <p className="mt-1 text-sm text-red-700">{previewErr}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Preview Results */}
                {preview && (
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <BeakerIcon className="h-5 w-5" />
                                    <h3 className="text-sm font-semibold uppercase tracking-wider">Preview Results</h3>
                                </div>
                                <div className="text-sm text-emerald-100">
                                    {preview.matches.toLocaleString()} matches
                                    {preview.segment.last_built_at && (
                                        <> • Last built: {toLocale(preview.segment.last_built_at)}</>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Status
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {preview.sample.length === 0 ? (
                                    <tr>
                                        <td className="px-6 py-12 text-center text-gray-500" colSpan={3}>
                                            <UsersIcon className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                                            <p className="text-sm">No matching contacts in sample</p>
                                        </td>
                                    </tr>
                                ) : (
                                    preview.sample.map((contact) => (
                                        <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {contact.name || <span className="text-gray-400 italic">No name</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                                        {contact.email ?? '—'}
                                                    </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                                        contact.status === 'active'
                                                            ? 'bg-green-50 text-green-700'
                                                            : 'bg-gray-50 text-gray-700'
                                                    }`}>
                                                        {contact.status ?? '—'}
                                                    </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-blue-50 border-t border-blue-200 px-6 py-4">
                            <div className="flex gap-3">
                                <InformationCircleSolid className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold">This is a preview only</p>
                                    <p className="mt-1">
                                        Changes are saved automatically when you preview. To update the full segment count,
                                        run a complete build from the segments list page.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}