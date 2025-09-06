'use client';

import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Popover, Transition, Listbox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';

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
const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={classNames('animate-pulse rounded bg-gray-100', className)} />
);
function fmtDate(iso?: string | null) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return String(iso); }
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
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-gray-50">
                        {l}
                    </span>
                ))}
                {extra > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-gray-50">
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
                            'inline-flex items-center gap-2 px-3 py-1.5 rounded border text-sm',
                            open ? 'border-gray-400 bg-gray-50' : 'hover:bg-gray-50'
                        )}
                    >
                        <span className="text-gray-700">Events</span>
                        <span className="text-gray-400">•</span>
                        <span className="truncate max-w-[240px]">{preview}</span>
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
                        <Popover.Panel className="absolute z-20 mt-2 w-[420px] rounded-lg border bg-white shadow-lg focus:outline-none">
                            <div className="p-3 border-b">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={q}
                                            onChange={(e) => setQ(e.target.value)}
                                            placeholder="Search events…"
                                            className="w-full border rounded pl-8 pr-2 py-1.5 text-sm"
                                        />
                                        <svg className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path fillRule="evenodd" d="M8.5 3a5.5 5.5 0 013.995 9.295l3.1 3.1a.75.75 0 11-1.06 1.06l-3.1-3.1A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd"/>
                                        </svg>
                                    </div>
                                    <button type="button" className="px-2 py-1.5 rounded border text-xs hover:bg-gray-50" onClick={selectAll}>
                                        All
                                    </button>
                                    <button type="button" className="px-2 py-1.5 rounded border text-xs hover:bg-gray-50" onClick={selectNone}>
                                        None
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-64 overflow-auto p-3 space-y-4">
                                {/* Messaging */}
                                <fieldset>
                                    <legend className="text-[11px] font-medium text-gray-500 mb-2">Messaging</legend>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {filtered.Messaging.map(opt => {
                                            const checked = selectedSet.has(opt.key);
                                            return (
                                                <label key={opt.key} className={classNames(
                                                    'flex items-center gap-2 rounded border px-3 py-2 text-sm cursor-pointer',
                                                    checked ? 'bg-blue-50 border-blue-500' : 'bg-white hover:bg-gray-50'
                                                )}>
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4"
                                                        checked={checked}
                                                        onChange={() => toggle(opt.key)}
                                                    />
                                                    <span>{opt.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </fieldset>

                                {/* Compliance */}
                                <fieldset>
                                    <legend className="text-[11px] font-medium text-gray-500 mb-2">Compliance</legend>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {filtered.Compliance.map(opt => {
                                            const checked = selectedSet.has(opt.key);
                                            return (
                                                <label key={opt.key} className={classNames(
                                                    'flex items-center gap-2 rounded border px-3 py-2 text-sm cursor-pointer',
                                                    checked ? 'bg-blue-50 border-blue-500' : 'bg-white hover:bg-gray-50'
                                                )}>
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4"
                                                        checked={checked}
                                                        onChange={() => toggle(opt.key)}
                                                    />
                                                    <span>{opt.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </fieldset>
                            </div>

                            <div className="p-3 border-t flex items-center justify-between">
                                <div className="text-xs text-gray-500">
                                    {selectedCount === 0 ? 'All events selected' : `${selectedCount} selected`}
                                </div>
                                <Popover.Button className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700">
                                    Apply
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
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-64" />
                    <Skeleton className="h-5 w-28" />
                </div>
                <Skeleton className="h-10" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (err) {
        return (
            <div className="max-w-xl mx-auto p-6 text-center space-y-4">
                <p className="text-red-700 bg-red-50 border border-red-200 p-3 rounded">{err}</p>
                <button onClick={() => void load()} className="px-3 py-2 rounded bg-blue-600 text-white text-sm">Retry</button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push(`/dashboard/company/${hash}`)} className="text-gray-600 hover:text-gray-800">← Back</button>
                    <h1 className="text-2xl font-semibold">Integration · Webhooks</h1>
                    <span className="text-sm text-gray-500">{active}/{total} active</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => void load()} className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50">Refresh</button>
                    <Link
                        href={`/dashboard/company/${hash}/webhooks/new`}
                        className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                        New Webhook
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="rounded-lg border bg-white p-3">
                <div className="flex flex-wrap items-center gap-3">
                    {/* URL search */}
                    <div className="relative">
                        <input
                            type="text"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search URL…"
                            className="border rounded pl-9 pr-2 py-1.5 text-sm w-64"
                        />
                        <svg className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M8.5 3a5.5 5.5 0 013.995 9.295l3.1 3.1a.75.75 0 11-1.06 1.06l-3.1-3.1A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd"/>
                        </svg>
                    </div>

                    {/* Status (Headless UI Listbox) */}
                    <Listbox value={status} onChange={setStatus}>
                        {({ open }) => (
                            <div className="relative w-48">
                                <Listbox.Button className="relative w-full cursor-pointer rounded border bg-white py-1.5 pl-3 pr-8 text-left text-sm shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <span className="block truncate">{STATUS_OPTIONS.find(o => o.id === status)?.label}</span>
                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                        <ChevronUpDownIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                                    </span>
                                </Listbox.Button>

                                <Transition
                                    show={open}
                                    as={Fragment}
                                    leave="transition ease-in duration-100"
                                    leaveFrom="opacity-100"
                                    leaveTo="opacity-0"
                                >
                                    <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                        {STATUS_OPTIONS.map(option => (
                                            <Listbox.Option
                                                key={option.id}
                                                value={option.id}
                                                className={({ active }) =>
                                                    classNames(
                                                        'relative cursor-pointer select-none py-2 pl-8 pr-3',
                                                        active ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                                                    )
                                                }
                                            >
                                                {({ selected }) => (
                                                    <>
                                                        <span className={classNames('block truncate', selected ? 'font-medium' : 'font-normal')}>
                                                            {option.label}
                                                        </span>
                                                        {selected ? (
                                                            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-blue-600">
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
                            className="ml-auto px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border bg-white">
                <div className="px-4 py-3 border-b text-sm font-medium">Webhooks ({filtered.length})</div>
                {filtered.length === 0 ? (
                    <div className="p-6 text-sm text-gray-500">No webhooks match your filters.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                            <tr className="text-left text-gray-600 border-b">
                                <th className="py-2 px-4">URL</th>
                                <th className="py-2 px-4">Events</th>
                                <th className="py-2 px-4">Status</th>
                                <th className="py-2 px-4">Batch</th>
                                <th className="py-2 px-4">Retries</th>
                                <th className="py-2 px-4">Backoff</th>
                                <th className="py-2 px-4">Created</th>
                                <th className="py-2 px-4 w-64">Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map(w => {
                                const isBusy = busyId === w.id;
                                return (
                                    <tr key={w.id} className="border-b last:border-0">
                                        <td className="py-2 px-4">{w.url || '—'}</td>
                                        <td className="py-2 px-4">{(w.events ?? []).length ? (w.events ?? []).join(', ') : '—'}</td>
                                        <td className="py-2 px-4">
                                                <span className={classNames(
                                                    'inline-flex px-2 py-0.5 rounded text-xs border',
                                                    w.status === 'active'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-gray-100 text-gray-700 border-gray-200'
                                                )}>
                                                    {w.status ?? '—'}
                                                </span>
                                        </td>
                                        <td className="py-2 px-4">{w.batch_size ?? '—'}</td>
                                        <td className="py-2 px-4">{w.max_retries ?? '—'}</td>
                                        <td className="py-2 px-4">{w.retry_backoff ?? '—'}</td>
                                        <td className="py-2 px-4">{fmtDate(w.created_at)}</td>
                                        <td className="py-2 px-4">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/dashboard/company/${hash}/webhooks/${w.id}`}
                                                    className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
                                                >
                                                    Edit
                                                </Link>
                                                <button
                                                    className="px-2 py-1 rounded border text-xs hover:bg-gray-50 disabled:opacity-50"
                                                    onClick={() => toggleEnable(w.id, w.status)}
                                                    disabled={isBusy}
                                                >
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
    );
}
