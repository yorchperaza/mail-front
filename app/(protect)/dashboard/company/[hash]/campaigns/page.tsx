'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    TrashIcon,
    EyeIcon,
    FunnelIcon,
    ExclamationTriangleIcon,
    EnvelopeIcon,
    ChartBarIcon,
    CalendarDaysIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
    EnvelopeIcon as EnvelopeSolid,
    ChartBarIcon as ChartBarSolid,
    CalendarDaysIcon as CalendarSolid,
    UserGroupIcon as UserGroupSolid,
} from '@heroicons/react/24/solid';

/* ----------------------------- Types ----------------------------- */

type CampaignStatus =
    | 'draft'
    | 'scheduled'
    | 'sending'
    | 'paused'
    | 'completed'
    | 'cancelled';

type SendMode = 'immediate' | 'scheduled';
type TargetKind = 'list' | 'segment';

type CampaignRow = {
    id: number;
    name: string | null;
    subject: string | null;
    send_mode: SendMode;
    scheduled_at: string | null;
    target: TargetKind;
    status: CampaignStatus;
    created_at: string | null;
    template_id: number | null;
    domain_id: number | null;
    listGroup_id: number | null;
    segment_id: number | null;
    metrics: {
        sent: number;
        delivered: number;
        opens: number;
        clicks: number;
        bounces: number;
        complaints: number;
    };
};

type ApiPaged<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ----------------------------- Page ----------------------------- */

export default function CampaignsIndexPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const search = useSearchParams();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();
    const statusFromUrl = (search.get('status') || '').trim() as '' | CampaignStatus;

    // Controlled inputs
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [status, setStatus] = useState<'' | CampaignStatus>(statusFromUrl);
    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);
    useEffect(() => setStatus(statusFromUrl), [statusFromUrl]);

    // Data
    const [data, setData] = useState<ApiPaged<CampaignRow> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

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
        return `${backend}/companies/${hash}/campaigns?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl, statusFromUrl]);

    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load campaigns (${res.status})`);
                const json: ApiPaged<CampaignRow> = await res.json();
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
        updateQuery({ search: searchTerm, status, page: 1 });
    }

    function clearFilters() {
        setSearchTerm('');
        setStatus('');
        updateQuery({ search: undefined, status: undefined, page: 1 });
    }

    const backHref = `/dashboard/company/${hash}`;
    const createHref = `/dashboard/company/${hash}/campaigns/create`;

    const toLocale = (s?: string | null) => {
        if (!s) return '—';
        try {
            return new Date(s).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return s;
        }
    };

    const badge = (st: CampaignStatus) => {
        const base = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border';
        const map: Record<CampaignStatus, string> = {
            draft: 'bg-gray-50 text-gray-700 border-gray-200',
            scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
            sending: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            paused: 'bg-yellow-50 text-yellow-700 border-yellow-200',
            completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            cancelled: 'bg-red-50 text-red-700 border-red-200',
        };
        return <span className={`${base} ${map[st]}`}>{st}</span>;
    };

    async function handleDelete(id: number) {
        if (!confirm('Delete this campaign?')) return;
        try {
            const res = await fetch(`${backend}/companies/${hash}/campaigns/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            // refetch or optimistic update
            setData(prev => prev ? {
                ...prev,
                items: prev.items.filter(i => i.id !== id),
                meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) },
            } : prev);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        }
    }

    // Calculate stats
    const stats = useMemo(() => {
        if (!data) return { total: 0, draft: 0, active: 0, completed: 0, totalSent: 0, totalOpens: 0 };

        const items = data.items;
        return {
            total: data.meta.total,
            draft: items.filter(c => c.status === 'draft').length,
            active: items.filter(c => ['scheduled', 'sending'].includes(c.status)).length,
            completed: items.filter(c => c.status === 'completed').length,
            totalSent: items.reduce((sum, c) => sum + c.metrics.sent, 0),
            totalOpens: items.reduce((sum, c) => sum + c.metrics.opens, 0),
        };
    }, [data]);

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-32 rounded-xl bg-gray-200" />
                            ))}
                        </div>
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
                        <h2 className="text-lg font-semibold">Error Loading Campaigns</h2>
                    </div>
                    <p className="text-gray-600 mb-4">{err}</p>
                    <button
                        onClick={() => router.push(backHref)}
                        className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { items, meta } = data;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
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
                            <h1 className="text-2xl font-bold text-gray-900">Email Campaigns</h1>
                            <p className="text-sm text-gray-500">
                                Create and manage your email marketing campaigns
                            </p>
                        </div>
                    </div>
                    <Link
                        href={createHref}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New Campaign
                    </Link>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3">
                            <div className="flex items-center justify-between text-white">
                                <EnvelopeSolid className="h-5 w-5" />
                                <span className="text-xs font-medium uppercase tracking-wider opacity-90">Total</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                            <div className="text-xs text-gray-500">Total campaigns</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-3">
                            <div className="flex items-center justify-between text-white">
                                <CalendarSolid className="h-5 w-5" />
                                <span className="text-xs font-medium uppercase tracking-wider opacity-90">Active</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="text-2xl font-bold text-gray-900">{stats.active}</div>
                            <div className="text-xs text-gray-500">Scheduled & sending</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-3">
                            <div className="flex items-center justify-between text-white">
                                <ChartBarSolid className="h-5 w-5" />
                                <span className="text-xs font-medium uppercase tracking-wider opacity-90">Sent</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="text-2xl font-bold text-gray-900">{stats.totalSent.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">Messages sent</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-3">
                            <div className="flex items-center justify-between text-white">
                                <UserGroupSolid className="h-5 w-5" />
                                <span className="text-xs font-medium uppercase tracking-wider opacity-90">Opens</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="text-2xl font-bold text-gray-900">{stats.totalOpens.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">Email opens</div>
                        </div>
                    </div>
                </div>

                {/* Search & Filters */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <FunnelIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Search & Filter</h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <form onSubmit={onSubmitSearch} className="flex flex-wrap items-center gap-4">
                            <div className="flex-1 min-w-[300px] relative">
                                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search by campaign name or subject…"
                                    className="w-full pl-10 pr-10 py-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                                        aria-label="Clear search"
                                        title="Clear search"
                                    >
                                        <XMarkIcon className="h-4 w-4 text-gray-500" />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Status:</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as CampaignStatus | '')}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                >
                                    <option value="">All statuses</option>
                                    {(['draft','scheduled','sending','paused','completed','cancelled'] as CampaignStatus[]).map(s =>
                                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                    )}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Per page:</label>
                                <select
                                    value={perPage}
                                    onChange={(e) => updateQuery({ perPage: e.target.value, page: 1 })}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                >
                                    {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    Apply
                                </button>
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    disabled={!qFromUrl && !statusFromUrl && page === 1}
                                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                    title="Clear all filters"
                                >
                                    Clear
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Campaigns Table */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-white">
                                <ChartBarIcon className="h-5 w-5" />
                                <h2 className="text-lg font-semibold">Campaign List</h2>
                            </div>
                            <span className="text-sm text-emerald-100">
                                {meta.total} campaign{meta.total === 1 ? '' : 's'}
                            </span>
                        </div>
                    </div>

                    <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                            <tr className="text-left">
                                <th className="px-4 py-3 font-semibold">Campaign Name</th>
                                <th className="px-4 py-3 font-semibold">Subject</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold">Target</th>
                                <th className="px-4 py-3 font-semibold">Send Mode</th>
                                <th className="px-4 py-3 font-semibold">Scheduled</th>
                                <th className="px-4 py-3 font-semibold">Created</th>
                                <th className="px-4 py-3 font-semibold whitespace-nowrap">Sent / Opens / Clicks</th>
                                <th className="px-4 py-3 font-semibold w-32">Actions</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                            {items.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-12 text-center text-gray-500" colSpan={9}>
                                        <div className="flex flex-col items-center">
                                            <EnvelopeSolid className="h-12 w-12 text-gray-400 mb-3" />
                                            <h3 className="text-lg font-semibold text-gray-900 mb-1">No campaigns found</h3>
                                            <p className="text-sm text-gray-500 mb-4">
                                                {qFromUrl || statusFromUrl ? 'Try adjusting your search or filters' : 'Create your first email campaign to get started'}
                                            </p>
                                            {!qFromUrl && !statusFromUrl && (
                                                <Link
                                                    href={createHref}
                                                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                                                >
                                                    <PlusIcon className="h-4 w-4" />
                                                    Create Campaign
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                items.map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900">
                                                {c.name || <span className="text-gray-400 italic">(unnamed campaign)</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{c.subject || '—'}</td>
                                        <td className="px-4 py-3">{badge(c.status)}</td>
                                        <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200">
                                                    {c.target === 'list' ? <UserGroupIcon className="h-3 w-3" /> : <ChartBarIcon className="h-3 w-3" />}
                                                    {c.target}
                                                </span>
                                        </td>
                                        <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                                    c.send_mode === 'immediate'
                                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                                                }`}>
                                                    {c.send_mode === 'immediate' ? <EnvelopeIcon className="h-3 w-3" /> : <CalendarDaysIcon className="h-3 w-3" />}
                                                    {c.send_mode}
                                                </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{toLocale(c.scheduled_at)}</td>
                                        <td className="px-4 py-3 text-gray-600">{toLocale(c.created_at)}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-xs text-gray-600">
                                                <div className="font-medium">{c.metrics.sent.toLocaleString()} sent</div>
                                                <div>{c.metrics.opens.toLocaleString()} opens • {c.metrics.clicks.toLocaleString()} clicks</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/dashboard/company/${hash}/campaigns/${c.id}`}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all"
                                                    title="View campaign"
                                                >
                                                    <EyeIcon className="h-3 w-3" />
                                                    View
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-red-300 text-xs font-medium text-red-700 hover:bg-red-50 transition-all"
                                                    title="Delete campaign"
                                                >
                                                    <TrashIcon className="h-3 w-3" />
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                {items.length > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-white shadow-sm ring-1 ring-gray-200 px-6 py-4">
                        <div className="text-sm text-gray-700">
                            Showing <span className="font-semibold">{((meta.page - 1) * meta.perPage) + 1}</span> to{' '}
                            <span className="font-semibold">{Math.min(meta.page * meta.perPage, meta.total)}</span> of{' '}
                            <span className="font-semibold">{meta.total.toLocaleString()}</span> campaigns
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => updateQuery({ page: Math.max(1, meta.page - 1) })}
                                disabled={meta.page <= 1}
                                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all bg-white text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ArrowLeftIcon className="h-4 w-4" />
                                Previous
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                                    const pageNum = i + 1;
                                    const isActive = pageNum === meta.page;

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => updateQuery({ page: pageNum })}
                                            className={`h-8 w-8 rounded-lg text-sm font-medium transition-all ${
                                                isActive
                                                    ? 'bg-indigo-500 text-white shadow-sm'
                                                    : 'bg-white text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => updateQuery({ page: Math.min(meta.totalPages, meta.page + 1) })}
                                disabled={meta.page >= meta.totalPages}
                                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all bg-white text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                                <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}