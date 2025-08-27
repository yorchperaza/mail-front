'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    PlusIcon,
    ArrowLeftIcon,
    ServerStackIcon,
    XMarkIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type Company = { id: number; name: string | null };

type IpPoolRow = {
    id: number;
    name: string | null;
    ips: string[] | null;
    reputation_score: number | null;
    warmup_state: string | null;
    created_at: string | null; // ISO
};

type ApiPaged<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

type Urgency = 'low' | 'normal' | 'high' | 'urgent';

/* ----------------------------- Helpers ----------------------------- */

const joinUrl = (base: string, path: string) =>
    `${(base || '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/* ----------------------------- Page ----------------------------- */

export default function CompanyIpPoolsPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    // company
    const [company, setCompany] = useState<Company | null>(null);
    const [companyErr, setCompanyErr] = useState<string | null>(null);

    // list state
    const [data, setData] = useState<ApiPaged<IpPoolRow> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // request modal
    const [openModal, setOpenModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [requestOk, setRequestOk] = useState<string | null>(null);

    // request form fields (minimal)
    const [mode, setMode] = useState<'single' | 'multiple'>('single');
    const [name, setName] = useState('');         // for single
    const [prefix, setPrefix] = useState('Pool'); // for multiple
    const [count, setCount] = useState<number>(2);
    const [urgency, setUrgency] = useState<Urgency>('normal');
    const [notes, setNotes] = useState('');

    const authz = authHeaders();

    // your existing listing route (company scoped)
    const listUrl = useMemo(() => {
        const sp = new URLSearchParams({ page: '1', perPage: '50' });
        return `${backend}/ippools-companies/${hash}?${sp.toString()}`;
    }, [backend, hash]);

    // load company
    useEffect(() => {
        if (!backend || !hash) return;
        let abort = false;

        (async () => {
            try {
                const url = joinUrl(backend, `/companies/${hash}`);
                const res = await fetch(url, { headers: authz });
                if (!res.ok) throw new Error(`Failed to load company (${res.status})`);
                const c: Company = await res.json();
                if (!abort) setCompany(c);
            } catch (e) {
                if (!abort) setCompanyErr(e instanceof Error ? e.message : 'Failed to load company');
            }
        })();

        return () => { abort = true; };
    }, [backend, hash]);

    // load pools
    useEffect(() => {
        if (!backend || !hash) return;
        let abort = false;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(listUrl, { headers: authz });
                if (res.status === 403) {
                    setError('You don’t have access to this company’s IP pools.');
                    return;
                }
                if (!res.ok) throw new Error(`Failed to load IP pools: ${res.status}`);
                const json: ApiPaged<IpPoolRow> = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setError(e instanceof Error ? e.message : 'Failed to load IP pools');
            } finally {
                if (!abort) setLoading(false);
            }
        })();

        return () => { abort = true; };
    }, [listUrl, backend, hash]);

    const backHref = `/dashboard/company/${hash}`;
    const showHref = (id: number) => `/dashboard/company/${hash}/ip-pools/${id}`;

    const ipsSummary = (ips: string[] | null | undefined) =>
        Array.isArray(ips) && ips.length > 0 ? `${ips.length} IP${ips.length === 1 ? '' : 's'}` : '—';

    const warmupBadge = (state: string | null | undefined) => {
        const s = (state ?? '').toLowerCase();
        const base = 'inline-block px-2 py-0.5 text-xs font-medium rounded';
        switch (s) {
            case 'ready':       return <span className={`${base} bg-green-100 text-green-800`}>ready</span>;
            case 'warming':     return <span className={`${base} bg-yellow-100 text-yellow-800`}>warming</span>;
            case 'not_started': return <span className={`${base} bg-gray-100 text-gray-800`}>not_started</span>;
            case 'paused':      return <span className={`${base} bg-orange-100 text-orange-800`}>paused</span>;
            default:            return <span className={`${base} bg-gray-100 text-gray-800`}>—</span>;
        }
    };

    const fmtDate = (iso: string | null | undefined) =>
        iso ? new Date(iso).toLocaleString() : '—';

    const resetModal = () => {
        setMode('single');
        setName('');
        setPrefix('Pool');
        setCount(2);
        setUrgency('normal');
        setNotes('');
        setSaveError(null);
    };

    /* ----------------------------- Submit REQUEST (not create) ----------------------------- */

    async function submitRequest() {
        if (!backend) { setSaveError('Missing backend URL'); return; }
        if (!company?.id) { setSaveError(companyErr || 'Missing company'); return; }

        // rudimentary validation
        if (mode === 'single' && !name.trim()) {
            setSaveError('Please enter a pool name.');
            return;
        }
        if (mode === 'multiple') {
            if (!prefix.trim()) { setSaveError('Please enter a name prefix.'); return; }
            if (!Number.isFinite(count) || count < 2 || count > 100) {
                setSaveError('Count must be between 2 and 100.');
                return;
            }
        }
        if (!notes.trim()) {
            setSaveError('Please add notes/justification.');
            return;
        }

        const requestUrl = joinUrl(backend, `/companies/${hash}/ip-pool-requests`);

        // Minimal payload for ops/admins to fulfill (no IPs / reputation / warmup / startAt)
        const payload =
            mode === 'single'
                ? {
                    mode: 'single' as const,
                    companyId: company.id,
                    name: name.trim(),
                    urgency,
                    notes: notes.trim(),
                }
                : {
                    mode: 'multiple' as const,
                    companyId: company.id,
                    prefix: prefix.trim(),
                    count,
                    urgency,
                    notes: notes.trim(),
                };

        setSaving(true);
        setSaveError(null);

        try {
            const res = await fetch(requestUrl, {
                method: 'POST',
                headers: authz,
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                let msg = `Request failed (${res.status})`;
                try {
                    const js = await res.json();
                    msg = js?.error || js?.message || msg;
                } catch {}
                throw new Error(msg);
            }

            setOpenModal(false);
            resetModal();
            setRequestOk('Your request has been submitted. Our team will review and create the pool(s).');
            // No list refresh here because nothing is created yet.
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Request failed');
        } finally {
            setSaving(false);
        }
    }

    /* ----------------------------- UI states ----------------------------- */

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading IP pools…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="max-w-md text-center space-y-4">
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={() => router.push(backHref)}
                        className="inline-flex items-center space-x-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                        <ArrowLeftIcon className="h-4 w-4"/><span>Back</span>
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;
    const { items } = data;

    /* ----------------------------- Render ----------------------------- */

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(backHref)}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
                >
                    <ArrowLeftIcon className="h-5 w-5 text-gray-600"/><span className="sr-only">Back</span>
                </button>
                <h1 className="text-2xl font-semibold">
                    IP Pools {company?.name ? <span className="text-gray-500">· {company.name}</span> : null}
                </h1>
                <button
                    onClick={() => setOpenModal(true)}
                    className="inline-flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    <PlusIcon className="h-5 w-5"/><span>Request IP Pools</span>
                </button>
            </div>

            {/* Success banner after a request */}
            {requestOk && (
                <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-green-800">
                    <InformationCircleIcon className="h-5 w-5 mt-0.5" />
                    <div className="flex-1">{requestOk}</div>
                    <button className="text-green-800/80" onClick={() => setRequestOk(null)}>Dismiss</button>
                </div>
            )}

            {/* List / Empty state */}
            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-gray-50 rounded-lg">
                    <ServerStackIcon className="h-12 w-12 text-gray-400" />
                    <h2 className="text-xl font-medium text-gray-700">No IP pools yet</h2>
                    <p className="text-gray-500 text-center max-w-sm">
                        Request new IP pools for this company. Our team will provision them and they’ll appear here.
                    </p>
                    <button
                        onClick={() => setOpenModal(true)}
                        className="inline-flex items-center px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        <PlusIcon className="h-5 w-5 mr-2"/> Request IP Pools
                    </button>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map(p => (
                        <Link
                            key={p.id}
                            href={showHref(p.id)}
                            className="block bg-white rounded-lg shadow hover:shadow-lg transition p-6"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        {p.name ?? '(unnamed)'}
                                    </h3>
                                    <div className="mt-1 text-sm text-gray-500">
                                        {ipsSummary(p.ips)} · Rep: {p.reputation_score ?? '—'}
                                    </div>
                                </div>
                                {warmupBadge(p.warmup_state)}
                            </div>
                            <div className="mt-4 text-sm text-gray-500">
                                Created: {fmtDate(p.created_at)}
                            </div>
                            <div className="mt-4">
                <span className="inline-flex items-center text-blue-700 text-sm">
                  View details →
                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* ---------------- Modal: Request Pools (NOT creating) ---------------- */}
            {openModal && (
                <div className="fixed inset-0 z-50">
                    {/* backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => (!saving ? setOpenModal(false) : null)}
                    />
                    {/* dialog */}
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
                            {/* header */}
                            <div className="flex items-center justify-between border-b px-4 py-3">
                                <h2 className="text-lg font-semibold">Request IP Pool{mode === 'multiple' ? 's' : ''}</h2>
                                <button
                                    className="p-2 rounded hover:bg-gray-100"
                                    onClick={() => (!saving ? setOpenModal(false) : null)}
                                    aria-label="Close"
                                >
                                    <XMarkIcon className="h-5 w-5 text-gray-600" />
                                </button>
                            </div>

                            {/* body */}
                            <div className="p-4 space-y-4">
                                {/* Mode */}
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium">Mode</label>
                                    <div className="flex items-center gap-2">
                                        <label className="inline-flex items-center gap-1 text-sm">
                                            <input
                                                type="radio"
                                                name="mode"
                                                value="single"
                                                checked={mode === 'single'}
                                                onChange={() => setMode('single')}
                                            />
                                            Single
                                        </label>
                                        <label className="inline-flex items-center gap-1 text-sm">
                                            <input
                                                type="radio"
                                                name="mode"
                                                value="multiple"
                                                checked={mode === 'multiple'}
                                                onChange={() => setMode('multiple')}
                                            />
                                            Multiple
                                        </label>
                                    </div>
                                </div>

                                {/* Single fields */}
                                {mode === 'single' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Pool name <span className="text-red-600">*</span>
                                        </label>
                                        <input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full rounded border px-3 py-2"
                                            placeholder="e.g. Transactional – US East"
                                        />
                                    </div>
                                )}

                                {/* Multiple fields */}
                                {mode === 'multiple' && (
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium mb-1">
                                                Name prefix <span className="text-red-600">*</span>
                                            </label>
                                            <input
                                                value={prefix}
                                                onChange={(e) => setPrefix(e.target.value)}
                                                className="w-full rounded border px-3 py-2"
                                                placeholder="e.g. Transactional Pool"
                                            />
                                            <p className="mt-1 text-xs text-gray-500">
                                                Ops will number them automatically (e.g., “Transactional Pool 1”, “Transactional Pool 2”, …).
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">
                                                Count <span className="text-red-600">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min={2}
                                                max={100}
                                                value={count}
                                                onChange={(e) => setCount(Math.max(2, Math.min(100, Number(e.target.value) || 2)))}
                                                className="w-full rounded border px-3 py-2"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Urgency */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">Urgency</label>
                                    <select
                                        value={urgency}
                                        onChange={(e) => setUrgency(e.target.value as Urgency)}
                                        className="w-full rounded border px-3 py-2"
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Notes / Justification <span className="text-red-600">*</span>
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Explain why these pool(s) are needed, traffic type, timelines, regions, etc."
                                        className="w-full rounded border px-3 py-2"
                                    />
                                </div>

                                {saveError && (
                                    <div className="rounded bg-red-50 text-red-700 px-3 py-2 text-sm">
                                        {saveError}
                                    </div>
                                )}
                            </div>

                            {/* footer */}
                            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                                <button
                                    className="px-4 py-2 rounded border hover:bg-gray-50"
                                    onClick={() => (!saving ? (setOpenModal(false), resetModal()) : null)}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                    onClick={submitRequest}
                                    disabled={saving}
                                >
                                    {saving ? 'Submitting…' : mode === 'single' ? 'Submit Request' : `Submit Request (${count})`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ---------------- /Modal ---------------- */}
        </div>
    );
}
