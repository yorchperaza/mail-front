'use client';

import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Popover, Transition, Listbox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import {
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    PlusIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    PencilSquareIcon,
    PowerIcon,
    ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
    XCircleIcon as XCircleSolid,
    ChartBarIcon as ChartBarSolid,
} from '@heroicons/react/24/solid';

/* ========================= Types ========================= */

type WebhookStatus = 'active' | 'disabled' | (string & {});
type IsoString = string;

type WebhookRow = {
    id: number;
    url: string | null;
    events: string[] | null;
    status: WebhookStatus | null;
    batch_size?: number | null;
    max_retries?: number | null;
    retry_backoff?: string | null;
    created_at?: IsoString | null;
};

/* ========================= Event options ========================= */

type EventKey =
    | 'message.delivered'
    | 'message.bounced'
    | 'message.opened'
    | 'message.clicked'
    | 'tlsrpt.received'
    | 'dmarc.processed'
    | 'reputation.sampled';

const EVENT_OPTIONS: Array<{ key: EventKey; label: string; group: 'Messaging' | 'Compliance' }> = [
    { key: 'message.delivered', label: 'Message delivered', group: 'Messaging' },
    { key: 'message.bounced',   label: 'Message bounced',   group: 'Messaging' },
    { key: 'message.opened',    label: 'Message opened',    group: 'Messaging' },
    { key: 'message.clicked',   label: 'Message clicked',   group: 'Messaging' },
    { key: 'tlsrpt.received',   label: 'TLS-RPT received',  group: 'Compliance' },
    { key: 'dmarc.processed',   label: 'DMARC processed',   group: 'Compliance' },
    { key: 'reputation.sampled',label: 'Reputation sampled',group: 'Compliance' },
];

const STATUS_OPTIONS: Array<{ id: 'all' | 'active' | 'disabled'; label: string }> = [
    { id: 'all', label: 'All statuses' },
    { id: 'active', label: 'Active' },
    { id: 'disabled', label: 'Disabled' },
];

/* ========================= Helpers ========================= */

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const classNames = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

function authHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function fmtDate(iso?: string | null) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return String(iso);
    }
}

/* ========================= Headless UI Multi-Select (Popover) ========================= */

const MultiSelectEvents: React.FC<{
    value: EventKey[];
    onChange: (v: EventKey[]) => void;
}> = ({ value, onChange }) => {
    const [q, setQ] = useState('');
    const selectedSet = useMemo(() => new Set(value), [value]);
    const selectedCount = value.length;

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        const items = EVENT_OPTIONS.filter(o =>
            !s || o.label.toLowerCase().includes(s) || o.key.toLowerCase().includes(s)
        );
        return {
            Messaging: items.filter(i => i.group === 'Messaging'),
            Compliance: items.filter(i => i.group === 'Compliance'),
        };
    }, [q]);

    function toggle(k: EventKey) {
        const next = new Set(selectedSet);
        if (next.has(k)) {
            next.delete(k);
        } else {
            next.add(k);
        }
        onChange(Array.from(next));
    }
    function selectAll() {
        onChange(EVENT_OPTIONS.map(o => o.key));
    }
    function selectNone() {
        onChange([]);
    }

    const preview = useMemo(() => {
        if (selectedCount === 0) return <span className="text-gray-500">All events</span>;
        const firstThree = value.slice(0, 3).map(k => EVENT_OPTIONS.find(e => e.key === k)?.label ?? k);
        const extra = Math.max(0, selectedCount - 3);
        return (
            <div className="flex flex-wrap gap-1">
                {firstThree.map((l, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-blue-50 text-blue-700 border-blue-200">
                        {l}
                    </span>
                ))}
                {extra > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-gray-50 text-gray-700 border-gray-200">
                        +{extra}
                    </span>
                )}
            </div>
        );
    }, [selectedCount, value]);

    return (
        <Popover className="relative">
            {({ open }) => (
                <>
                    <Popover.Button
                        className={classNames(
                            'inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                            open ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        )}
                    >
                        <span>Events Filter</span>
                        <span className="text-gray-400">•</span>
                        <span className="truncate max-w-[200px]">{preview}</span>
                        <svg className={classNames('h-4 w-4 text-gray-500 transition-transform', open && 'rotate-180')}
                             viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.19l3.71-3.96a.75.75 0 111.08 1.04l-4.24 4.53a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                    </Popover.Button>

                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                    >
                        <Popover.Panel className="absolute z-20 mt-2 w-[420px] rounded-xl border border-gray-200 bg-white shadow-xl focus:outline-none">
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={q}
                                            onChange={(e) => setQ(e.target.value)}
                                            placeholder="Search events…"
                                            className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                    </div>
                                    <button type="button" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50" onClick={selectAll}>
                                        All
                                    </button>
                                    <button type="button" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50" onClick={selectNone}>
                                        None
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-64 overflow-auto p-4 space-y-4">
                                {/* Messaging */}
                                <fieldset>
                                    <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Messaging Events</legend>
                                    <div className="grid grid-cols-1 gap-2">
                                        {filtered.Messaging.map(opt => {
                                            const checked = selectedSet.has(opt.key);
                                            return (
                                                <label key={opt.key} className={classNames(
                                                    'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all',
                                                    checked ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-white border-gray-200 hover:bg-gray-50'
                                                )}>
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                        checked={checked}
                                                        onChange={() => toggle(opt.key)}
                                                    />
                                                    <span className="font-medium">{opt.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </fieldset>

                                {/* Compliance */}
                                <fieldset>
                                    <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Compliance Events</legend>
                                    <div className="grid grid-cols-1 gap-2">
                                        {filtered.Compliance.map(opt => {
                                            const checked = selectedSet.has(opt.key);
                                            return (
                                                <label key={opt.key} className={classNames(
                                                    'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all',
                                                    checked ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-white border-gray-200 hover:bg-gray-50'
                                                )}>
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                        checked={checked}
                                                        onChange={() => toggle(opt.key)}
                                                    />
                                                    <span className="font-medium">{opt.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </fieldset>
                            </div>

                            <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                                <div className="text-xs text-gray-600">
                                    {selectedCount === 0 ? 'All events selected' : `${selectedCount} event${selectedCount === 1 ? '' : 's'} selected`}
                                </div>
                                <Popover.Button className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                                    Apply Filter
                                </Popover.Button>
                            </div>
                        </Popover.Panel>
                    </Transition>
                </>
            )}
        </Popover>
    );
};

/* ========================= Page ========================= */

export default function CompanyWebhooksListPage() {
    const { hash } = useParams<{ hash: string }>();
    const router = useRouter();

    const [rows, setRows] = useState<WebhookRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Filters
    const [q, setQ] = useState('');                     // URL contains
    const [status, setStatus] = useState<'all' | 'active' | 'disabled'>('all');
    const [selectedEvents, setSelectedEvents] = useState<EventKey[]>([]); // empty = all

    const [busyId, setBusyId] = useState<number | null>(null);

    const load = React.useCallback(async () => {
        try {
            setLoading(true);
            setErr(null);
            const res = await fetch(`${backend}/companies/${hash}/webhooks`, { headers: authHeaders() });
            if (!res.ok) throw new Error(`Load failed (${res.status})`);
            const json: WebhookRow[] = await res.json();
            setRows(json);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Failed to load webhooks');
        } finally {
            setLoading(false);
        }
    }, [hash]);

    useEffect(() => { void load(); }, [load]);

    const filtered = useMemo(() => {
        return rows.filter(r => {
            if (status !== 'all' && r.status !== status) return false;
            if (q && !(r.url ?? '').toLowerCase().includes(q.toLowerCase())) return false;

            if (selectedEvents.length > 0) {
                const list = (r.events ?? []) as string[];
                const hasAny = selectedEvents.some(ev => list.includes(ev));
                if (!hasAny) return false;
            }
            return true;
        });
    }, [rows, q, status, selectedEvents]);

    const total = rows.length;
    const active = useMemo(() => rows.filter(r => r.status === 'active').length, [rows]);

    async function toggleEnable(id: number, current: WebhookStatus | null) {
        try {
            setBusyId(id);
            const next = current === 'active' ? 'disabled' : 'active';
            const res = await fetch(`${backend}/companies/${hash}/webhooks/${id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ status: next }),
            });
            if (!res.ok) throw new Error(`Update failed (${res.status})`);
            await load();
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setBusyId(null);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="h-16 rounded-xl bg-gray-200" />
                        <div className="h-64 rounded-xl bg-gray-200" />
                    </div>
                </div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Webhooks</h2>
                    </div>
                    <p className="text-gray-600 mb-4">{err}</p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => void load()}
                            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 transition-colors"
                        >
                            Retry
                        </button>
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}`)}
                            className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Webhooks Integration</h1>
                            <p className="text-sm text-gray-500">
                                Configure real-time event notifications
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => void load()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
                        >
                            <ArrowPathIcon className="h-4 w-4" />
                            Refresh
                        </button>
                        <Link
                            href={`/dashboard/company/${hash}/webhooks/new`}
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                        >
                            <PlusIcon className="h-4 w-4" />
                            New Webhook
                        </Link>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-visible">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3">
                            <div className="flex items-center justify-between text-white">
                                <ChartBarSolid className="h-5 w-5" />
                                <span className="text-xs font-medium uppercase tracking-wider opacity-90">Total</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="text-2xl font-bold text-gray-900">{total}</div>
                            <div className="text-xs text-gray-500">Total webhooks</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-visible">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-3">
                            <div className="flex items-center justify-between text-white">
                                <CheckCircleSolid className="h-5 w-5" />
                                <span className="text-xs font-medium uppercase tracking-wider opacity-90">Active</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="text-2xl font-bold text-gray-900">{active}</div>
                            <div className="text-xs text-gray-500">Currently enabled</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-visible">
                        <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-3">
                            <div className="flex items-center justify-between text-white">
                                <XCircleSolid className="h-5 w-5" />
                                <span className="text-xs font-medium uppercase tracking-wider opacity-90">Disabled</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="text-2xl font-bold text-gray-900">{total - active}</div>
                            <div className="text-xs text-gray-500">Currently disabled</div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-visible">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <FunnelIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Filters & Search</h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* URL search */}
                            <div className="flex-1 min-w-[300px]">
                                <div className="relative">
                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        placeholder="Search webhook URLs…"
                                        className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Status (Headless UI Listbox) */}
                            <Listbox value={status} onChange={setStatus}>
                                {({ open }) => (
                                    <div className="relative w-48">
                                        <Listbox.Button className="relative w-full cursor-pointer rounded-lg border border-gray-300 bg-white py-3 pl-3 pr-8 text-left text-sm shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all">
                                            <span className="block truncate font-medium">{STATUS_OPTIONS.find(o => o.id === status)?.label}</span>
                                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                            </span>
                                        </Listbox.Button>

                                        <Transition
                                            show={open}
                                            as={Fragment}
                                            leave="transition ease-in duration-100"
                                            leaveFrom="opacity-100"
                                            leaveTo="opacity-0"
                                        >
                                            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                                {STATUS_OPTIONS.map(option => (
                                                    <Listbox.Option
                                                        key={option.id}
                                                        value={option.id}
                                                        className={({ active }) =>
                                                            classNames(
                                                                'relative cursor-pointer select-none py-2 pl-8 pr-3',
                                                                active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900'
                                                            )
                                                        }
                                                    >
                                                        {({ selected }) => (
                                                            <>
                                                                <span className={classNames('block truncate', selected ? 'font-medium' : 'font-normal')}>
                                                                    {option.label}
                                                                </span>
                                                                {selected ? (
                                                                    <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-indigo-600">
                                                                        <CheckIcon className="h-4 w-4" aria-hidden="true" />
                                                                    </span>
                                                                ) : null}
                                                            </>
                                                        )}
                                                    </Listbox.Option>
                                                ))}
                                            </Listbox.Options>
                                        </Transition>
                                    </div>
                                )}
                            </Listbox>

                            {/* Events multi-select */}
                            <MultiSelectEvents value={selectedEvents} onChange={setSelectedEvents} />

                            {(q || selectedEvents.length > 0 || status !== 'all') && (
                                <button
                                    onClick={() => { setQ(''); setSelectedEvents([]); setStatus('all'); }}
                                    className="ml-auto px-4 py-3 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-all"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Webhooks Table */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-visible">
                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-white">
                                <ChartBarIcon className="h-5 w-5" />
                                <h2 className="text-lg font-semibold">Configured Webhooks</h2>
                            </div>
                            <span className="text-sm text-emerald-100">
                                {filtered.length} webhook{filtered.length === 1 ? '' : 's'}
                            </span>
                        </div>
                    </div>

                    <div className="p-6">
                        {filtered.length === 0 ? (
                            <div className="text-center py-12">
                                <ChartBarSolid className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-lg font-semibold text-gray-900">
                                    {rows.length === 0 ? 'No webhooks configured' : 'No webhooks match your filters'}
                                </h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    {rows.length === 0
                                        ? 'Create your first webhook to receive real-time event notifications'
                                        : 'Try adjusting your search terms or filters'
                                    }
                                </p>
                                {rows.length === 0 && (
                                    <div className="mt-6">
                                        <Link
                                            href={`/dashboard/company/${hash}/webhooks/new`}
                                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                                        >
                                            <PlusIcon className="h-4 w-4" />
                                            Create Webhook
                                        </Link>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                    <tr className="text-left text-gray-600 border-b border-gray-200">
                                        <th className="py-3 px-4 font-semibold">URL</th>
                                        <th className="py-3 px-4 font-semibold">Events</th>
                                        <th className="py-3 px-4 font-semibold">Status</th>
                                        <th className="py-3 px-4 font-semibold">Batch Size</th>
                                        <th className="py-3 px-4 font-semibold">Max Retries</th>
                                        <th className="py-3 px-4 font-semibold">Backoff</th>
                                        <th className="py-3 px-4 font-semibold">Created</th>
                                        <th className="py-3 px-4 font-semibold w-32">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                    {filtered.map(w => {
                                        const isBusy = busyId === w.id;
                                        return (
                                            <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="py-3 px-4">
                                                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border">
                                                            {w.url || '—'}
                                                        </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {(w.events ?? []).length ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {(w.events ?? []).slice(0, 2).map((event, i) => (
                                                                <span key={i} className="inline-flex px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 border border-blue-200">
                                                                        {event}
                                                                    </span>
                                                            ))}
                                                            {(w.events ?? []).length > 2 && (
                                                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200">
                                                                        +{(w.events ?? []).length - 2}
                                                                    </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                        <span className={classNames(
                                                            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
                                                            w.status === 'active'
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : 'bg-gray-100 text-gray-700 border-gray-200'
                                                        )}>
                                                            {w.status === 'active' ? (
                                                                <CheckCircleIcon className="h-3 w-3" />
                                                            ) : (
                                                                <XCircleIcon className="h-3 w-3" />
                                                            )}
                                                            {w.status ?? '—'}
                                                        </span>
                                                </td>
                                                <td className="py-3 px-4 text-gray-600">{w.batch_size ?? '—'}</td>
                                                <td className="py-3 px-4 text-gray-600">{w.max_retries ?? '—'}</td>
                                                <td className="py-3 px-4 text-gray-600">{w.retry_backoff ?? '—'}</td>
                                                <td className="py-3 px-4 text-gray-600">{fmtDate(w.created_at)}</td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <Link
                                                            href={`/dashboard/company/${hash}/webhooks/${w.id}`}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all"
                                                        >
                                                            <PencilSquareIcon className="h-3 w-3" />
                                                            Edit
                                                        </Link>
                                                        <button
                                                            className={classNames(
                                                                'inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-all',
                                                                w.status === 'active'
                                                                    ? 'border-red-300 text-red-700 hover:bg-red-50'
                                                                    : 'border-green-300 text-green-700 hover:bg-green-50',
                                                                isBusy && 'opacity-50 cursor-not-allowed'
                                                            )}
                                                            onClick={() => toggleEnable(w.id, w.status)}
                                                            disabled={isBusy}
                                                        >
                                                            {isBusy ? (
                                                                <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                                                            ) : (
                                                                <PowerIcon className="h-3 w-3" />
                                                            )}
                                                            {w.status === 'active' ? 'Disable' : 'Enable'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}