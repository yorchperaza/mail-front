'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    PlayCircleIcon,
    ClipboardDocumentIcon,
    UsersIcon,
    FunnelIcon,
    CalendarDaysIcon,
    HashtagIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    EnvelopeIcon,
    UserIcon,
    CheckIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
    ExclamationTriangleIcon as ExclamationTriangleSolid
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

type ApiPaged<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

type PreviewRow = { id: number; email: string | null; name: string | null; status: string | null };

type ListSummary = { id: number; name: string };

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type ChipColor = 'green' | 'blue' | 'emerald' | 'red' | 'indigo' | 'purple';

type Chip = {
    icon: IconComponent;
    label: string;
    color: ChipColor;
};

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
                `Built successfully: ${payload?.performed?.new_count ?? '—'} matches (change: ${payload?.performed?.delta ?? '—'})`
            );
        } catch (e) {
            setBuildErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBuilding(false);
        }
    }

    /* ---------- Hash helpers ---------- */
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


    /* ---------- Helpers ---------- */
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
            return (
                <div className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600">
                    <XMarkIcon className="h-3.5 w-3.5" />
                    No filters applied
                </div>
            );
        }

        const chips: Chip[] = [];

        const colorClasses: Record<ChipColor, string> = {
            green: 'bg-green-50 text-green-700 border-green-200',
            blue: 'bg-blue-50 text-blue-700 border-blue-200',
            emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            red: 'bg-red-50 text-red-700 border-red-200',
            indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            purple: 'bg-purple-50 text-purple-700 border-purple-200',
        };

        if (def.status) {
            chips.push({
                icon: CheckCircleIcon,
                label: `Status: ${def.status}`,
                color: 'green'
            });
        }
        if (def.email_contains) {
            chips.push({
                icon: EnvelopeIcon,
                label: `Email contains "${def.email_contains}"`,
                color: 'blue'
            });
        }
        if ('gdpr_consent' in def) {
            chips.push({
                icon: def.gdpr_consent ? CheckIcon : XMarkIcon,
                label: def.gdpr_consent ? 'Has GDPR consent' : 'No GDPR consent',
                color: def.gdpr_consent ? 'emerald' : 'red'
            });
        }
        if (def.in_list_ids?.length) {
            chips.push({
                icon: UsersIcon,
                label: 'In lists: ' + def.in_list_ids.map(listName).join(', '),
                color: 'indigo'
            });
        }
        if (def.not_in_list_ids?.length) {
            chips.push({
                icon: UsersIcon,
                label: 'Not in lists: ' + def.not_in_list_ids.map(listName).join(', '),
                color: 'purple'
            });
        }

        return (
            <div className="flex flex-wrap gap-2">
                {chips.map((chip, i) => {
                    const Icon = chip.icon;
                    return (
                        <span key={i} className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${colorClasses[chip.color as keyof typeof colorClasses]}`}>
                            <Icon className="h-3.5 w-3.5" />
                            {chip.label}
                        </span>
                    );
                })}
            </div>
        );
    }

    /* ---------- Loading State ---------- */
    if (segLoading && !segment) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-6xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-32 rounded-xl bg-gray-200" />
                            ))}
                        </div>
                        <div className="h-96 rounded-xl bg-gray-200" />
                    </div>
                </div>
            </div>
        );
    }

    /* ---------- Error State ---------- */
    if (segErr) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Segment</h2>
                    </div>
                    <p className="text-gray-600">{segErr}</p>
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

    if (!segment) return null;

    /* ---------- Main Render ---------- */
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-6xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(backHref)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Segments
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{segment.name}</h1>
                            <p className="text-sm text-gray-500">
                                Segment #{segmentId}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleBuildNow}
                        disabled={building}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {building ? (
                            <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Building...
                            </>
                        ) : (
                            <>
                                <PlayCircleIcon className="h-4 w-4" />
                                Build Now
                            </>
                        )}
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3">
                            <div className="flex items-center justify-between text-white">
                                <UsersIcon className="h-5 w-5" />
                                <span className="text-xs font-medium uppercase tracking-wider opacity-90">Total Matches</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="text-2xl font-bold text-gray-900">
                                {segment.materialized_count?.toLocaleString() ?? '—'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Contacts in segment</div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-3">
                            <div className="flex items-center justify-between text-white">
                                <CalendarDaysIcon className="h-5 w-5" />
                                <span className="text-xs font-medium uppercase tracking-wider opacity-90">Last Built</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="text-sm font-semibold text-gray-900">
                                {segment.last_built_at ? toLocale(segment.last_built_at) : 'Never'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Last updated</div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-3">
                            <div className="flex items-center justify-between text-white">
                                <HashtagIcon className="h-5 w-5" />
                                <span className="text-xs font-medium uppercase tracking-wider opacity-90">Segment Hash</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center gap-2">
                                <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                                    {maskHash(segment.hash)}
                                </code>
                                {segment.hash && (
                                    <button
                                        onClick={() => copyHash(segment.hash)}
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
                                                Copy
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Build Messages */}
                {buildErr && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                        <div className="flex gap-3">
                            <ExclamationTriangleSolid className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-red-900">Build Failed</h3>
                                <p className="mt-1 text-sm text-red-700">{buildErr}</p>
                            </div>
                        </div>
                    </div>
                )}
                {buildMsg && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                        <div className="flex gap-3">
                            <CheckCircleSolid className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-emerald-900">Build Successful</h3>
                                <p className="mt-1 text-sm text-emerald-700">{buildMsg}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Rules Section */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <FunnelIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Segment Rules</h3>
                            </div>
                            {listsErr && (
                                <span className="text-xs text-red-200 bg-red-900/20 px-2 py-1 rounded">
                                    {listsErr}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="p-6">
                        {ruleChips(segment.definition)}
                    </div>
                </div>

                {/* Contacts Table */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <UsersIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Matching Contacts</h3>
                            </div>
                            <div className="text-xs text-purple-100">
                                {preview?.meta ? (
                                    <>
                                        Page {preview.meta.page} of {preview.meta.totalPages} • {preview.meta.total.toLocaleString()} total
                                    </>
                                ) : prevLoading ? (
                                    'Loading...'
                                ) : (
                                    ''
                                )}
                            </div>
                        </div>
                    </div>

                    {prevErr ? (
                        <div className="p-6">
                            <div className="flex items-center gap-2 text-red-600">
                                <ExclamationTriangleIcon className="h-5 w-5" />
                                <p>{prevErr}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <UserIcon className="h-3.5 w-3.5" />
                                                Name
                                            </div>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <EnvelopeIcon className="h-3.5 w-3.5" />
                                                Email
                                            </div>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                                Status
                                            </div>
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                    {prevLoading && !preview ? (
                                        <tr>
                                            <td className="px-6 py-12 text-center text-gray-500" colSpan={3}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Loading contacts...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : !preview || preview.items.length === 0 ? (
                                        <tr>
                                            <td className="px-6 py-12 text-center text-gray-500" colSpan={3}>
                                                <UsersIcon className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                                                <p className="text-sm">No matching contacts found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        preview.items.map((contact) => (
                                            <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {contact.name || <span className="text-gray-400 italic">No name</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                                            <EnvelopeIcon className="h-3 w-3 text-gray-400" />
                                                            {contact.email ?? '—'}
                                                        </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                                            contact.status === 'active'
                                                                ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
                                                                : 'bg-gray-50 text-gray-700 ring-1 ring-gray-200'
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

                            {/* Pagination */}
                            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-gray-700">Per page:</label>
                                    <select
                                        value={perPage}
                                        onChange={(e) => updateQuery({ perPage: e.target.value, page: 1 })}
                                        className="rounded-lg border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    >
                                        {[10, 25, 50, 100, 200].map(n => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
                                        disabled={!preview || page <= 1}
                                        className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ArrowLeftIcon className="h-4 w-4" />
                                        Previous
                                    </button>

                                    <div className="flex items-center gap-1">
                                        <span className="text-sm text-gray-700">
                                            Page {page} of {preview?.meta?.totalPages ?? 1}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => updateQuery({ page: Math.min(preview?.meta?.totalPages ?? page, page + 1) })}
                                        disabled={!preview || page >= (preview.meta?.totalPages ?? 1)}
                                        className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Next
                                        <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}