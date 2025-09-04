'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    GlobeAltIcon,
    BuildingOffice2Icon,
    KeyIcon,
    MagnifyingGlassIcon,
    NoSymbolIcon,
    ClockIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type ApiKeyItem = {
    id: number;
    label: string | null;
    prefix: string;
    scopes: string[] | string | null;
    domain_id: number | null; // null => company-wide
    last_used_at: string | null; // ISO
    revoked_at: string | null;   // ISO
    created_at: string | null;   // ISO
};

type DomainBrief = { id: number; domain: string | null };
type KeysResponse = ApiKeyItem[];

type Grouped = Record<
    string,
    {
        title: string;
        subtitle?: string | null;
        icon: 'company' | 'domain';
        items: ApiKeyItem[];
    }
>;

/* ----------------------------- Helpers ----------------------------- */

function authHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function toArrayScopes(v: ApiKeyItem['scopes']): string[] {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string') {
        try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) return parsed.map(String);
        } catch { /* fall through to CSV */ }
        return v.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
}

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fromNow(iso: string | null): string {
    if (!iso) return 'never';
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return 'never';
    const diff = Date.now() - ts;
    const abs = Math.abs(diff);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 31536e6],
        ['month', 2592e6],
        ['week', 6048e5],
        ['day', 864e5],
        ['hour', 36e5],
        ['minute', 6e4],
        ['second', 1e3],
    ];
    for (const [unit, ms] of units) {
        const v = Math.round(abs / ms);
        if (v >= 1) return rtf.format(-Math.sign(diff) * v, unit);
    }
    return 'just now';
}

/* ------------------------------ Page ------------------------------ */

export default function CompanyApiKeysPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [keys, setKeys] = useState<ApiKeyItem[]>([]);
    const [domains, setDomains] = useState<DomainBrief[]>([]);
    const [q, setQ] = useState('');
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // fetch keys + domains
    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const [kRes, dRes] = await Promise.all([
                    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/apikeys`, { headers: authHeaders() }),
                    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains`, { headers: authHeaders() }),
                ]);

                if (kRes.status === 403 || dRes.status === 403) throw new Error('You do not have access to this company.');
                if (!kRes.ok) throw new Error(`Failed to load API keys (${kRes.status})`);
                if (!dRes.ok) throw new Error(`Failed to load domains (${dRes.status})`);

                const kData = (await kRes.json()) as KeysResponse;
                const dData = (await dRes.json()) as DomainBrief[];

                if (!cancelled) {
                    setKeys(Array.isArray(kData) ? kData : []);
                    setDomains(Array.isArray(dData) ? dData : []);
                }
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load data.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [hash]);

    const domainNameById = useMemo(() => {
        const map = new Map<number, string>();
        for (const d of domains) {
            if (d && typeof d.id === 'number') {
                map.set(d.id, d.domain ?? `Domain #${d.id}`);
            }
        }
        return map;
    }, [domains]);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return keys;
        return keys.filter(k => {
            const label = (k.label ?? '').toLowerCase();
            const prefix = k.prefix.toLowerCase();
            const scopes = toArrayScopes(k.scopes).join(' ').toLowerCase();
            const domain = k.domain_id ? (domainNameById.get(k.domain_id)?.toLowerCase() ?? '') : 'company';
            return [label, prefix, scopes, domain].some(s => s.includes(needle));
        });
    }, [q, keys, domainNameById]);

    // group by domain (null => company-wide)
    const grouped: Grouped = useMemo(() => {
        const g: Grouped = {};
        for (const k of filtered) {
            const key = k.domain_id == null ? 'company' : String(k.domain_id);
            if (!g[key]) {
                g[key] = k.domain_id == null
                    ? { title: 'Company-wide', subtitle: 'Usable across all verified domains', icon: 'company', items: [] }
                    : { title: domainNameById.get(k.domain_id) ?? `Domain #${k.domain_id}`, subtitle: null, icon: 'domain', items: [] };
            }
            g[key].items.push(k);
        }
        for (const bucket of Object.values(g)) {
            bucket.items.sort((a, b) => {
                const ar = a.revoked_at ? 1 : 0;
                const br = b.revoked_at ? 1 : 0;
                if (ar !== br) return ar - br;
                const al = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
                const bl = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
                if (al !== bl) return bl - al;
                const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
                const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
                return bc - ac;
            });
        }
        return g;
    }, [filtered, domainNameById]);

    const groupsOrder = useMemo(() => {
        const keys = Object.keys(grouped);
        return keys.sort((a, b) => {
            if (a === 'company') return -1;
            if (b === 'company') return 1;
            return (grouped[a].title || '').localeCompare(grouped[b].title || '');
        });
    }, [grouped]);

    async function handleDelete(id: number) {
        const ok = window.confirm('Delete this API key? This cannot be undone.');
        if (!ok) return;
        setDeletingId(id);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/apikeys/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (res.status !== 204) {
                const text = await res.text().catch(() => '');
                throw new Error(text || `Failed to delete key (${res.status})`);
            }
            // Optimistic: remove from local state
            setKeys(prev => prev.filter(k => k.id !== id));
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to delete key.');
        } finally {
            setDeletingId(null);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading API keys…</p>
            </div>
        );
    }
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="max-w-md text-center space-y-4">
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center space-x-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        <span>Back</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
                    >
                        <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
                        <span className="sr-only">Back</span>
                    </button>
                    <h1 className="text-3xl font-semibold">API Keys</h1>
                </div>
                <Link
                    href={`/dashboard/company/${hash}/settings/apikeys/new`}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                    <KeyIcon className="h-5 w-5" />
                    Create key
                </Link>
            </div>

            {/* Search */}
            <div className="bg-white rounded-lg border shadow-sm p-4">
                <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search by label, prefix, scope, or domain…"
                        className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                </div>
            </div>

            {/* Groups */}
            {groupsOrder.length === 0 ? (
                <div className="bg-white rounded-lg border shadow-sm p-8 text-center text-gray-600">
                    No API keys yet.
                </div>
            ) : (
                <div className="space-y-8">
                    {groupsOrder.map((gkey) => {
                        const group = grouped[gkey];
                        return (
                            <section key={gkey} className="bg-white rounded-lg border shadow-sm p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                      {group.icon === 'company' ? (
                          <BuildingOffice2Icon className="h-5 w-5 text-gray-600" />
                      ) : (
                          <GlobeAltIcon className="h-5 w-5 text-blue-600" />
                      )}
                    </span>
                                        <div>
                                            <h2 className="text-lg font-semibold">{group.title}</h2>
                                            {group.subtitle && (
                                                <p className="text-sm text-gray-500">{group.subtitle}</p>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-sm text-gray-500">{group.items.length} key{group.items.length === 1 ? '' : 's'}</span>
                                </div>

                                <ul className="mt-4 divide-y">
                                    {group.items.map((k) => {
                                        const scopes = toArrayScopes(k.scopes);
                                        const revoked = !!k.revoked_at;

                                        return (
                                            <li key={k.id} className="py-4">
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                    {/* Left: label + prefix (no copy) */}
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className={`font-medium ${revoked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                                {k.label || 'Untitled key'}
                                                            </p>
                                                            {revoked && (
                                                                <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
                                  <NoSymbolIcon className="h-3.5 w-3.5" />
                                  Revoked
                                </span>
                                                            )}
                                                        </div>

                                                        <div className="mt-1 text-sm text-gray-600">
                                                            <span className="text-gray-500 mr-1">Prefix:</span>
                                                            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{k.prefix}</code>
                                                        </div>

                                                        {/* Scopes */}
                                                        {scopes.length > 0 && (
                                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                                {scopes.map((s, i) => (
                                                                    <span
                                                                        key={`${k.id}-scope-${i}`}
                                                                        className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                                                                    >
                                    {s}
                                  </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right: timestamps + delete */}
                                                    <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                                                        <div className="text-sm text-gray-500 text-right">
                                                            <div className="flex items-center gap-1 justify-end">
                                                                <ClockIcon className="h-4 w-4" />
                                                                <span>Last used: {fromNow(k.last_used_at)}</span>
                                                            </div>
                                                            <div className="mt-0.5">Created: {fmtDate(k.created_at)}</div>
                                                        </div>

                                                        <button
                                                            onClick={() => handleDelete(k.id)}
                                                            disabled={deletingId === k.id}
                                                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                                                            title="Delete API key"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                            {deletingId === k.id ? 'Deleting…' : 'Delete'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
