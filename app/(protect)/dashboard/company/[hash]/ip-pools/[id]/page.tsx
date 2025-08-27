'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    TrashIcon,
    ClipboardIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type CompanyMini = { id: number; name: string | null } | null;

type IpPool = {
    id: number;
    name: string | null;
    ips: string[] | null;
    reputation_score: number | null;
    warmup_state: string | null;
    created_at: string | null; // ISO
    company?: CompanyMini;
};

/* ----------------------------- Helpers ----------------------------- */

const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

const ipsCount = (ips?: string[] | null) =>
    Array.isArray(ips) && ips.length ? `${ips.length} IP${ips.length === 1 ? '' : 's'}` : '—';

const badgeForWarmup = (state?: string | null) => {
    const s = (state ?? '').toLowerCase();
    const base = 'inline-block px-2 py-0.5 text-xs font-medium rounded';
    switch (s) {
        case 'ready':
            return <span className={`${base} bg-green-100 text-green-800`}>ready</span>;
        case 'warming':
            return <span className={`${base} bg-yellow-100 text-yellow-800`}>warming</span>;
        case 'not_started':
            return <span className={`${base} bg-gray-100 text-gray-800`}>not_started</span>;
        case 'paused':
            return <span className={`${base} bg-orange-100 text-orange-800`}>paused</span>;
        default:
            return <span className={`${base} bg-gray-100 text-gray-800`}>—</span>;
    }
};

const joinUrl = (base: string, path: string) =>
    `${(base || '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/* ----------------------------- Page ----------------------------- */

export default function CompanyIpPoolDetailPage() {
    const router = useRouter();
    const { hash, id } = useParams<{ hash: string; id: string }>();

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };
    const authz = authHeaders();

    const [pool, setPool] = useState<IpPool | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const backHref = useMemo(() => `/dashboard/company/${hash}/ip-pools`, [hash]);

    const showUrl = useMemo(() => {
        // hash-based endpoint (recommended; matches your "list by company hash")
        return joinUrl(backend, `/companies/${hash}/ippools/${id}`);
    }, [backend, hash, id]);

    async function load() {
        if (!backend || !hash || !id) return;
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch(showUrl, { headers: authz });
            if (!res.ok) throw new Error(`Failed to load IP pool (${res.status})`);
            const js: IpPool = await res.json();
            setPool(js);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Failed to load IP pool');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showUrl]);

    async function onDelete() {
        if (!backend || !hash || !id) return;
        if (!confirm('Delete this IP pool? This cannot be undone.')) return;

        try {
            setDeleting(true);
            const url = joinUrl(backend, `/companies/${hash}/ippools/${id}`);
            const res = await fetch(url, { method: 'DELETE', headers: authz });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            router.push(backHref);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Delete failed');
        } finally {
            setDeleting(false);
        }
    }

    function copyIpsToClipboard() {
        const ips = pool?.ips ?? [];
        if (!ips.length) return;
        navigator.clipboard.writeText(ips.join('\n')).then(
            () => alert('IPs copied to clipboard'),
            () => alert('Failed to copy IPs'),
        );
    }

    /* ----------------------------- UI states ----------------------------- */

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500 flex items-center gap-2">
                    <ArrowPathIcon className="h-5 w-5 animate-spin" /> Loading IP pool…
                </p>
            </div>
        );
    }

    if (err || !pool) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="max-w-md text-center space-y-4">
                    <p className="text-red-600">{err || 'IP pool not found'}</p>
                    <button
                        onClick={() => router.push(backHref)}
                        className="inline-flex items-center space-x-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        <span>Back</span>
                    </button>
                </div>
            </div>
        );
    }

    const companyName = pool.company?.name ?? null;
    const companyId = pool.company?.id ?? null;

    /* ----------------------------- Render ----------------------------- */

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            {/* Header / Breadcrumbs */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(backHref)}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
                        title="Back"
                    >
                        <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
                    </button>
                    <div className="text-sm text-gray-500">
                        <Link href={`/dashboard/company/${hash}`} className="hover:underline">
                            {companyName ?? `Company${companyId ? ` #${companyId}` : ''}`}
                        </Link>{' '}
                        /{' '}
                        <Link href={backHref} className="hover:underline">
                            IP Pools
                        </Link>{' '}
                        / <span className="text-gray-700">Pool #{pool.id}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        className="px-3 py-1.5 rounded border hover:bg-gray-50 text-sm inline-flex items-center gap-1"
                        title="Refresh"
                    >
                        <ArrowPathIcon className="h-4 w-4" />
                        Refresh
                    </button>
                    <button
                        onClick={onDelete}
                        disabled={deleting}
                        className="px-3 py-1.5 rounded border text-red-600 hover:bg-red-50 text-sm inline-flex items-center gap-1 disabled:opacity-60"
                        title="Delete"
                    >
                        <TrashIcon className="h-4 w-4" />
                        Delete
                    </button>
                </div>
            </div>

            {/* Card */}
            <div className="bg-white rounded-lg border shadow-sm p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">
                            {pool.name ?? <span className="text-gray-500 italic">(unnamed)</span>}
                        </h1>
                        <div className="mt-1 text-sm text-gray-500">
                            Pool ID: <span className="font-mono">{pool.id}</span>
                        </div>
                        {companyName && (
                            <div className="mt-1 text-sm text-gray-500">
                                Company: <span className="font-medium">{companyName}</span>
                                {companyId ? <span className="text-xs text-gray-400 ml-1">#{companyId}</span> : null}
                            </div>
                        )}
                    </div>
                    <div>{badgeForWarmup(pool.warmup_state)}</div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Reputation</div>
                        <div className="mt-1 text-lg">
                            {typeof pool.reputation_score === 'number' ? pool.reputation_score : '—'}
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-500">IPs</div>
                        <div className="mt-1 text-lg">{ipsCount(pool.ips)}</div>
                    </div>
                    <div className="bg-gray-50 rounded p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Created</div>
                        <div className="mt-1 text-lg">{fmtDateTime(pool.created_at)}</div>
                    </div>
                </div>

                {/* IP list */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-medium">IP Addresses</h2>
                        <button
                            onClick={copyIpsToClipboard}
                            disabled={!pool.ips || pool.ips.length === 0}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border text-sm hover:bg-gray-50 disabled:opacity-60"
                        >
                            <ClipboardIcon className="h-4 w-4" />
                            Copy
                        </button>
                    </div>
                    {pool.ips && pool.ips.length > 0 ? (
                        <div className="rounded border overflow-hidden">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-700">
                                <tr className="text-left">
                                    <th className="px-3 py-2 w-24">#</th>
                                    <th className="px-3 py-2">IP</th>
                                </tr>
                                </thead>
                                <tbody>
                                {pool.ips.map((ip, idx) => (
                                    <tr key={`${ip}-${idx}`} className="border-t">
                                        <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                                        <td className="px-3 py-2 font-mono">{ip}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No IPs in this pool.</p>
                    )}
                </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between">
                <Link href={backHref} className="text-sm text-gray-600 hover:text-gray-800">
                    ← Back to IP pools
                </Link>
            </div>
        </div>
    );
}
