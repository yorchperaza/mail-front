'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    KeyIcon,
    MagnifyingGlassIcon,
    NoSymbolIcon,
    ClockIcon,
    TrashIcon,
    PlusIcon,
    ExclamationTriangleIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import {
    KeyIcon as KeySolid,
    BuildingOffice2Icon as BuildingSolid,
    GlobeAltIcon as GlobeSolid,
} from '@heroicons/react/24/solid';

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
    try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed.map(String);
    } catch { /* fall through to CSV */
    }
    return v.split(',').map(s => s.trim()).filter(Boolean);
}

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
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
            if (d) {
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
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="h-16 rounded-xl bg-gray-200" />
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-32 rounded-xl bg-gray-200" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading API Keys</h2>
                    </div>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => router.back()}
                        className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Dashboard
                    </button>
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
                            onClick={() => router.back()}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
                            <p className="text-sm text-gray-500">
                                Manage access tokens for your applications
                            </p>
                        </div>
                    </div>
                    <Link
                        href={`/dashboard/company/${hash}/settings/apikeys/new`}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Create API Key
                    </Link>
                </div>

                {/* Search */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <MagnifyingGlassIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Search & Filter</h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Search by label, prefix, scope, or domain…"
                                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Groups */}
                {groupsOrder.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-12">
                        <div className="text-center">
                            <KeySolid className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-lg font-semibold text-gray-900">No API keys found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {q ? 'Try adjusting your search terms' : 'Create your first API key to get started'}
                            </p>
                            {!q && (
                                <div className="mt-6">
                                    <Link
                                        href={`/dashboard/company/${hash}/settings/apikeys/new`}
                                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Create API Key
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupsOrder.map((gkey) => {
                            const group = grouped[gkey];
                            const isCompany = group.icon === 'company';

                            return (
                                <section key={gkey} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                                    <div className={`px-6 py-4 ${isCompany ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 text-white">
                                                {isCompany ? (
                                                    <BuildingSolid className="h-5 w-5" />
                                                ) : (
                                                    <GlobeSolid className="h-5 w-5" />
                                                )}
                                                <div>
                                                    <h2 className="text-lg font-semibold">{group.title}</h2>
                                                    {group.subtitle && (
                                                        <p className="text-sm text-white/80">{group.subtitle}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-sm text-white/80">
                                                {group.items.length} key{group.items.length === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        <div className="space-y-4">
                                            {group.items.map((k) => {
                                                const scopes = toArrayScopes(k.scopes);
                                                const revoked = !!k.revoked_at;

                                                return (
                                                    <div key={k.id} className="rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50/50 to-white p-4 hover:shadow-sm transition-all">
                                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                                            {/* Left: label + prefix + scopes */}
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <KeyIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                                    <p className={`font-semibold text-lg ${revoked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                                        {k.label || 'Untitled API Key'}
                                                                    </p>
                                                                    {revoked && (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 border border-red-200">
                                                                            <NoSymbolIcon className="h-3 w-3" />
                                                                            Revoked
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="text-sm text-gray-600 mb-3">
                                                                    <span className="text-gray-500">Key prefix:</span>
                                                                    <code className="ml-2 rounded-md bg-gray-100 px-2 py-1 text-xs font-mono border">{k.prefix}***</code>
                                                                </div>

                                                                {/* Scopes */}
                                                                {scopes.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {scopes.map((s, i) => (
                                                                            <span
                                                                                key={`${k.id}-scope-${i}`}
                                                                                className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200"
                                                                            >
                                                                                <ShieldCheckIcon className="h-3 w-3 mr-1" />
                                                                                {s}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Right: timestamps + delete */}
                                                            <div className="flex items-center gap-4 shrink-0">
                                                                <div className="text-sm text-gray-500 text-right">
                                                                    <div className="flex items-center gap-1.5 justify-end mb-1">
                                                                        <ClockIcon className="h-4 w-4" />
                                                                        <span className="font-medium">Last used:</span>
                                                                        <span>{fromNow(k.last_used_at)}</span>
                                                                    </div>
                                                                    <div className="text-xs text-gray-400">
                                                                        Created: {fmtDate(k.created_at)}
                                                                    </div>
                                                                </div>

                                                                <button
                                                                    onClick={() => handleDelete(k.id)}
                                                                    disabled={deletingId === k.id}
                                                                    className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-all"
                                                                    title="Delete API key"
                                                                >
                                                                    <TrashIcon className="h-4 w-4" />
                                                                    {deletingId === k.id ? 'Deleting…' : 'Delete'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}