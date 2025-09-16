'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    CheckIcon,
    PlayCircleIcon,
    FunnelIcon,
    UserGroupIcon,
    EnvelopeIcon,
    ShieldCheckIcon,
    ListBulletIcon,
    ExclamationTriangleIcon,
    SparklesIcon,
    Cog6ToothIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';

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

const STATUS_CONFIG = {
    subscribed: {
        label: 'Subscribed',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
    },
    unsubscribed: {
        label: 'Unsubscribed',
        bgClass: 'bg-gray-50',
        textClass: 'text-gray-700',
        borderClass: 'border-gray-200',
    },
    bounced: {
        label: 'Bounced',
        bgClass: 'bg-red-50',
        textClass: 'text-red-700',
        borderClass: 'border-red-200',
    },
    complained: {
        label: 'Complained',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
    },
};

function toLocale(s?: string | null, format: 'full' | 'short' | 'date' = 'short') {
    if (!s) return '—';
    try {
        const date = new Date(s);
        if (format === 'full') {
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else if (format === 'date') {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }
        return date.toLocaleDateString();
    } catch {
        return s;
    }
}

export default function SegmentCreatePage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();

    // backend + auth
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    // lists (for in/not-in pickers)
    const listsUrl = useMemo(() => {
        if (!backend) return null;
        return `${backend}/companies/${hash}/lists?perPage=200`;
    }, [backend, hash]);

    const [lists, setLists] = useState<ListSummary[]>([]);
    const [listsErr, setListsErr] = useState<string | null>(null);
    const [listsLoading, setListsLoading] = useState(true);

    // Search state for lists
    const [inListSearch, setInListSearch] = useState('');
    const [notInListSearch, setNotInListSearch] = useState('');

    useEffect(() => {
        if (!listsUrl) return;
        let abort = false;
        (async () => {
            setListsErr(null);
            setListsLoading(true);
            try {
                const res = await fetch(listsUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load lists (${res.status})`);
                const json: ApiPaged<ListSummary> = await res.json();
                if (!abort) setLists(json.items || []);
            } catch (e) {
                if (!abort) setListsErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setListsLoading(false);
            }
        })();
        return () => {
            abort = true;
        };
    }, [listsUrl]);

    // form state
    const [segmentId, setSegmentId] = useState<number | null>(null);
    const [name, setName] = useState('');
    const [status, setStatus] = useState<string>('');
    const [emailContains, setEmailContains] = useState('');
    const [gdprConsent, setGdprConsent] = useState<'ignore' | 'true' | 'false'>('ignore');
    const [inListIds, setInListIds] = useState<number[]>([]);
    const [notInListIds, setNotInListIds] = useState<number[]>([]);

    // UI state
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);

    const [previewing, setPreviewing] = useState(false);
    const [previewErr, setPreviewErr] = useState<string | null>(null);
    const [preview, setPreview] = useState<BuildDryRunResponse | null>(null);

    const backHref = `/dashboard/company/${hash}/segments`;

    // Filter lists based on search
    const filteredInLists = useMemo(() => {
        if (!inListSearch) return lists;
        return lists.filter(l =>
            l.name.toLowerCase().includes(inListSearch.toLowerCase())
        );
    }, [lists, inListSearch]);

    const filteredNotInLists = useMemo(() => {
        if (!notInListSearch) return lists;
        return lists.filter(l =>
            l.name.toLowerCase().includes(notInListSearch.toLowerCase())
        );
    }, [lists, notInListSearch]);

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

    async function ensureCreatedOrPatched(): Promise<number> {
        if (!backend) throw new Error('Missing backend URL');

        const body = {
            name: name.trim(),
            definition: buildDefinition(),
        };
        if (!body.name) throw new Error('Please enter a segment name');

        if (segmentId == null) {
            // CREATE
            const res = await fetch(`${backend}/companies/${hash}/segments`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Create failed (${res.status})`);
            const s: Segment = await res.json();
            setSegmentId(s.id);
            return s.id;
        } else {
            // PATCH
            const res = await fetch(`${backend}/companies/${hash}/segments/${segmentId}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Save failed (${res.status})`);
            const s: Segment = await res.json();
            return s.id;
        }
    }

    async function onSaveOnly() {
        setSaveErr(null);
        setSaving(true);
        try {
            await ensureCreatedOrPatched();
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
            await ensureCreatedOrPatched();
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
            const id = await ensureCreatedOrPatched();
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

    // Calculate active filters count
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (status) count++;
        if (emailContains) count++;
        if (gdprConsent !== 'ignore') count++;
        if (inListIds.length > 0) count++;
        if (notInListIds.length > 0) count++;
        return count;
    }, [status, emailContains, gdprConsent, inListIds, notInListIds]);

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
                            <h1 className="text-2xl font-bold text-gray-900">Create Segment</h1>
                            <p className="text-sm text-gray-500">
                                Define filters to create a targeted contact segment
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onSaveOnly}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <CheckIcon className="h-4 w-4" />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={onSaveAndClose}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <CheckIcon className="h-4 w-4" />
                            Save & Close
                        </button>
                    </div>
                </div>

                {/* Basic Info */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <Cog6ToothIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Basic Information</h3>
                            </div>
                            {segmentId && (
                                <span className="text-xs text-indigo-100">
                                    Segment ID: #{segmentId}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="p-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Segment Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Active Subscribers in USA"
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <FunnelIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Segment Filters</h3>
                            </div>
                            <span className="text-xs text-purple-100">
                                {activeFiltersCount} active filter{activeFiltersCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Status */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <UserGroupIcon className="inline h-4 w-4 mr-1" />
                                    Contact Status
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">All statuses</option>
                                    <option value="subscribed">Subscribed</option>
                                    <option value="unsubscribed">Unsubscribed</option>
                                    <option value="bounced">Bounced</option>
                                    <option value="complained">Complained</option>
                                </select>
                                <p className="mt-1 text-xs text-gray-500">Filter by subscription status</p>
                            </div>

                            {/* Email contains */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <EnvelopeIcon className="inline h-4 w-4 mr-1" />
                                    Email Contains
                                </label>
                                <input
                                    value={emailContains}
                                    onChange={(e) => setEmailContains(e.target.value)}
                                    placeholder="@example.com"
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                                <p className="mt-1 text-xs text-gray-500">Case-insensitive substring</p>
                            </div>

                            {/* GDPR */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <ShieldCheckIcon className="inline h-4 w-4 mr-1" />
                                    GDPR Consent
                                </label>
                                <select
                                    value={gdprConsent}
                                    onChange={(e) => setGdprConsent(e.target.value as 'ignore' | 'true' | 'false')}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="ignore">Any consent status</option>
                                    <option value="true">Has consent</option>
                                    <option value="false">No consent</option>
                                </select>
                                <p className="mt-1 text-xs text-gray-500">Filter by GDPR consent</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* List Filters */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3">
                        <div className="flex items-center gap-2 text-white">
                            <ListBulletIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">List Membership</h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Include Lists */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-medium text-gray-700">
                                        Must be in ANY of these lists
                                    </label>
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                                        {inListIds.length} selected
                                    </span>
                                </div>

                                <div className="relative mb-3">
                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={inListSearch}
                                        onChange={(e) => setInListSearch(e.target.value)}
                                        placeholder="Search lists..."
                                        className="w-full pl-9 pr-9 py-2 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                    />
                                    {inListSearch && (
                                        <button
                                            onClick={() => setInListSearch('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2"
                                        >
                                            <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                        </button>
                                    )}
                                </div>

                                <div className="h-64 overflow-y-auto rounded-lg border border-gray-200">
                                    {listsLoading ? (
                                        <div className="p-4 text-center text-gray-500">Loading lists...</div>
                                    ) : listsErr ? (
                                        <div className="p-4 text-center text-red-600">{listsErr}</div>
                                    ) : filteredInLists.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500">
                                            {inListSearch ? 'No lists match your search' : 'No lists available'}
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-gray-100">
                                            {filteredInLists.map((l) => (
                                                <li
                                                    key={l.id}
                                                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={inListIds.includes(l.id)}
                                                        onChange={() => toggleInList(l.id)}
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm text-gray-900 truncate">
                                                            {l.name}
                                                        </div>
                                                        {l.counts?.contacts !== undefined && (
                                                            <div className="text-xs text-gray-500">
                                                                {l.counts.contacts} contacts
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    Leave empty to include all lists
                                </p>
                            </div>

                            {/* Exclude Lists */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-medium text-gray-700">
                                        Must NOT be in any of these lists
                                    </label>
                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                        {notInListIds.length} selected
                                    </span>
                                </div>

                                <div className="relative mb-3">
                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={notInListSearch}
                                        onChange={(e) => setNotInListSearch(e.target.value)}
                                        placeholder="Search lists..."
                                        className="w-full pl-9 pr-9 py-2 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                    />
                                    {notInListSearch && (
                                        <button
                                            onClick={() => setNotInListSearch('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2"
                                        >
                                            <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                        </button>
                                    )}
                                </div>

                                <div className="h-64 overflow-y-auto rounded-lg border border-gray-200">
                                    {listsLoading ? (
                                        <div className="p-4 text-center text-gray-500">Loading lists...</div>
                                    ) : listsErr ? (
                                        <div className="p-4 text-center text-red-600">{listsErr}</div>
                                    ) : filteredNotInLists.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500">
                                            {notInListSearch ? 'No lists match your search' : 'No lists available'}
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-gray-100">
                                            {filteredNotInLists.map((l) => (
                                                <li
                                                    key={l.id}
                                                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={notInListIds.includes(l.id)}
                                                        onChange={() => toggleNotInList(l.id)}
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm text-gray-900 truncate">
                                                            {l.name}
                                                        </div>
                                                        {l.counts?.contacts !== undefined && (
                                                            <div className="text-xs text-gray-500">
                                                                {l.counts.contacts} contacts
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    Leave empty to not exclude any lists
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={onPreviewDryRun}
                            disabled={previewing}
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <PlayCircleIcon className="h-4 w-4" />
                            {previewing ? 'Generating Preview...' : 'Preview Segment'}
                        </button>

                        {(saveErr || previewErr) && (
                            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                                <ExclamationTriangleIcon className="h-4 w-4" />
                                {saveErr || previewErr}
                            </div>
                        )}

                        {!segmentId && (
                            <span className="text-sm text-gray-500 italic">Not saved yet</span>
                        )}
                    </div>
                </div>

                {/* Preview Results */}
                {preview && (
                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <SparklesIcon className="h-5 w-5" />
                                    <h3 className="text-sm font-semibold uppercase tracking-wider">Preview Results</h3>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-indigo-100">
                                    <span>
                                        Matches: <span className="font-semibold text-white">{preview.matches.toLocaleString()}</span>
                                    </span>
                                    {preview.segment.last_built_at && (
                                        <span>Last built: {toLocale(preview.segment.last_built_at, 'full')}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {preview.sample.length === 0 ? (
                            <div className="p-12 text-center">
                                <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-lg font-semibold text-gray-900">No Matching Contacts</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    No contacts match the current filter criteria
                                </p>
                            </div>
                        ) : (
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
                                    {preview.sample.map((c) => {
                                        const statusConfig = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
                                        return (
                                            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {c.name || <span className="text-gray-400 italic">No name</span>}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="font-mono text-xs text-gray-600">
                                                            {c.email || '—'}
                                                        </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {statusConfig ? (
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.bgClass} ${statusConfig.textClass} border ${statusConfig.borderClass}`}>
                                                                {statusConfig.label}
                                                            </span>
                                                    ) : (
                                                        <span className="text-gray-500">{c.status || '—'}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <InformationCircleIcon className="h-4 w-4" />
                                <p>
                                    This is a preview showing a sample of matching contacts.
                                    Save the segment to use it in campaigns or perform a full build.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center text-sm text-gray-500">
                    <Link href={backHref} className="hover:text-gray-800">
                        ← Back to all segments
                    </Link>
                </div>
            </div>
        </div>
    );
}