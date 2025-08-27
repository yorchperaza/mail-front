'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    EyeIcon,
    PlayIcon,
    PauseIcon,
    PowerIcon,
    CheckCircleIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type AutomationStatus = 'draft' | 'active' | 'paused' | 'disabled';
type AutomationTrigger = 'time' | 'webhook' | 'event' | '' | string;

type AutomationRow = {
    id: number;
    name: string | null;
    trigger: string | null; // 'time' | 'webhook' | 'event' | null
    flow: Record<string, unknown> | null;
    status: AutomationStatus | null;
    last_run_at: string | null;
    created_at: string | null;
};

type ApiPaged<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ----------------------------- Page ----------------------------- */

export default function AutomationsIndexPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();
    const statusFromUrl = (search.get('status') || '').trim() as '' | AutomationStatus;
    const triggerFromUrl = (search.get('trigger') || '').trim() as '' | AutomationTrigger;

    // Controlled inputs
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [status, setStatus] = useState<'' | AutomationStatus>(statusFromUrl);
    const [trigger, setTrigger] = useState<'' | AutomationTrigger>(triggerFromUrl);
    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);
    useEffect(() => setStatus(statusFromUrl), [statusFromUrl]);
    useEffect(() => setTrigger(triggerFromUrl), [triggerFromUrl]);

    // Data
    const [data, setData] = useState<ApiPaged<AutomationRow> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [workingId, setWorkingId] = useState<number | null>(null);

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
        if (statusFromUrl) sp.set('status', statusFromUrl);
        if (triggerFromUrl) sp.set('trigger', triggerFromUrl);
        return `${backend}/companies/${hash}/automations?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl, statusFromUrl, triggerFromUrl]);

    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load automations (${res.status})`);
                const json: ApiPaged<AutomationRow> = await res.json();
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
        updateQuery({ search: searchTerm, status, trigger, page: 1 });
    }

    function clearFilters() {
        setSearchTerm('');
        setStatus('');
        setTrigger('');
        updateQuery({ search: undefined, status: undefined, trigger: undefined, page: 1 });
    }

    const backHref = `/dashboard/company/${hash}`;
    const createHref = `/dashboard/company/${hash}/automations/create`;

    const toLocale = (s?: string | null) => {
        if (!s) return '—';
        try { return new Date(s).toLocaleString(); } catch { return s; }
    };

    const statusBadge = (st: AutomationStatus) => {
        const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
        const map: Record<AutomationStatus, string> = {
            draft: 'bg-gray-100 text-gray-800',
            active: 'bg-emerald-100 text-emerald-800',
            paused: 'bg-yellow-100 text-yellow-800',
            disabled: 'bg-red-100 text-red-800',
        };
        return <span className={`${base} ${map[st]}`}>{st}</span>;
    };

    const summarizeFlow = (flow: Record<string, unknown> | null): string => {
        if (!flow || typeof flow !== 'object') return '—';
        const steps = Array.isArray((flow as Record<string, unknown>).steps) ? (flow as { steps: unknown[] }).steps.length : 0;
        const trg = (flow as Record<string, unknown>)['trigger'];
        const tType = trg && typeof trg === 'object' ? String((trg as Record<string, unknown>)['type'] ?? '') : '';
        return `${tType || 'unknown'} · ${steps} step${steps === 1 ? '' : 's'}`;
    };

    async function lifecycle(id: number, action: 'enable' | 'pause' | 'disable' | 'run') {
        setWorkingId(id);
        try {
            const res = await fetch(`${backend}/companies/${hash}/automations/${id}/${action}`, {
                method: 'POST',
                headers: authHeaders(),
            });
            const ok = action === 'run' ? res.ok : res.ok; // both return JSON
            if (!ok) throw new Error(`${action} failed (${res.status})`);
            const payload = await res.json();
            const updated: AutomationRow | null =
                action === 'run'
                    ? (payload.automation as AutomationRow | undefined) ?? null
                    : (payload as AutomationRow | null);

            setData(prev =>
                prev
                    ? {
                        ...prev,
                        items: prev.items.map(a => (a.id === id ? (updated ?? a) : a)),
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
        if (!confirm('Delete this automation?')) return;
        setWorkingId(id);
        try {
            const res = await fetch(`${backend}/companies/${hash}/automations/${id}`, {
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

    if (loading && !data) return <p className="p-6 text-center text-gray-600">Loading automations…</p>;
    if (err) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-600">{err}</p>
                <button onClick={() => router.push(backHref)} className="mt-3 inline-flex items-center px-3 py-2 rounded border">
                    <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back
                </button>
            </div>
        );
    }
    if (!data) return null;

    const { items, meta } = data;

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={() => router.push(backHref)} className="inline-flex items-center text-gray-600 hover:text-gray-800">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">Automations</h1>
                <Link href={createHref} className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900">
                    <PlusIcon className="h-5 w-5 mr-1" /> New Automation
                </Link>
            </div>

            {/* Toolbar */}
            <form onSubmit={onSubmitSearch} className="bg-white border rounded-lg p-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[240px]">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name, trigger, or flow JSON…"
                        className="w-full pl-9 pr-9 py-2 rounded border border-gray-300"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                            aria-label="Clear search"
                            title="Clear search"
                        >
                            <XMarkIcon className="h-4 w-4 text-gray-500" />
                        </button>
                    )}
                </div>

                <label className="text-sm text-gray-600">Status</label>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AutomationStatus | '')}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                    <option value="">All</option>
                    {(['draft', 'active', 'paused', 'disabled'] as AutomationStatus[]).map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                <label className="text-sm text-gray-600">Trigger</label>
                <select
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value as AutomationTrigger | '')}
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                    <option value="">All</option>
                    <option value="time">time</option>
                    <option value="webhook">webhook</option>
                    <option value="event">event</option>
                </select>

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
                    disabled={!qFromUrl && !statusFromUrl && !triggerFromUrl && page === 1}
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
                        <th className="px-3 py-2">Trigger</th>
                        <th className="px-3 py-2">Flow</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Last Run</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2 w-[360px]"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>
                                No automations found.
                            </td>
                        </tr>
                    ) : (
                        items.map((a) => (
                            <tr key={a.id} className="border-t">
                                <td className="px-3 py-2">{a.name || <span className="text-gray-500 italic">(unnamed)</span>}</td>
                                <td className="px-3 py-2">{a.trigger || '—'}</td>
                                <td className="px-3 py-2 text-gray-700">{summarizeFlow(a.flow)}</td>
                                <td className="px-3 py-2">
                                    {a.status ? statusBadge(a.status) : <span className="text-gray-500">—</span>}
                                </td>
                                <td className="px-3 py-2">{toLocale(a.last_run_at)}</td>
                                <td className="px-3 py-2">{toLocale(a.created_at)}</td>
                                <td className="px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                            href={`/dashboard/company/${hash}/automations/${a.id}`}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                                            title="Open automation"
                                        >
                                            <EyeIcon className="h-4 w-4" /> Open
                                        </Link>

                                        <button
                                            onClick={() => lifecycle(a.id, 'run')}
                                            disabled={workingId === a.id}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                                            title="Run now"
                                        >
                                            <PlayIcon className="h-4 w-4" />
                                            {workingId === a.id ? 'Running…' : 'Run'}
                                        </button>

                                        <button
                                            onClick={() => lifecycle(a.id, 'enable')}
                                            disabled={workingId === a.id || a.status === 'active'}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                                            title="Enable (set active)"
                                        >
                                            <CheckCircleIcon className="h-4 w-4" /> Enable
                                        </button>

                                        <button
                                            onClick={() => lifecycle(a.id, 'pause')}
                                            disabled={workingId === a.id || a.status === 'paused'}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                                            title="Pause"
                                        >
                                            <PauseIcon className="h-4 w-4" /> Pause
                                        </button>

                                        <button
                                            onClick={() => lifecycle(a.id, 'disable')}
                                            disabled={workingId === a.id || a.status === 'disabled'}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                                            title="Disable"
                                        >
                                            <PowerIcon className="h-4 w-4" /> Disable
                                        </button>

                                        <button
                                            onClick={() => handleDelete(a.id)}
                                            disabled={workingId === a.id}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded border text-red-600 hover:bg-red-50 disabled:opacity-50"
                                            title="Delete"
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
                    <span className="font-medium">{meta.totalPages}</span> · {meta.total} automations
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
