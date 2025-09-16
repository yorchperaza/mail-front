'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    EyeIcon,
    XMarkIcon,
    DocumentTextIcon,
    CodeBracketIcon,
    ClockIcon,
    ChartBarIcon,
    FunnelIcon,
    SparklesIcon,
    ExclamationTriangleIcon,
    DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';

type TemplateItem = {
    id: number;
    name: string | null;
    engine: string | null;     // 'raw' | 'handlebars' | 'mjml' | null
    version: number | null;
    html: string | null;
    text: string | null;
    created_at: string | null;
    usage?: {
        campaigns?: number | null;
    };
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ---------------- Engine Configuration ---------------- */
const ENGINE_CONFIG = {
    raw: {
        label: 'Raw',
        icon: DocumentTextIcon,
        bgClass: 'bg-gray-50',
        textClass: 'text-gray-700',
        borderClass: 'border-gray-200',
        dotClass: 'bg-gray-500',
    },
    handlebars: {
        label: 'Handlebars',
        icon: CodeBracketIcon,
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
        dotClass: 'bg-amber-500',
    },
    mjml: {
        label: 'MJML',
        icon: SparklesIcon,
        bgClass: 'bg-indigo-50',
        textClass: 'text-indigo-700',
        borderClass: 'border-indigo-200',
        dotClass: 'bg-indigo-500',
    },
};

function getEngineConfig(engine?: string | null) {
    return ENGINE_CONFIG[(engine || '').toLowerCase() as keyof typeof ENGINE_CONFIG] || {
        label: engine || 'Unknown',
        icon: DocumentTextIcon,
        bgClass: 'bg-gray-50',
        textClass: 'text-gray-700',
        borderClass: 'border-gray-200',
        dotClass: 'bg-gray-500',
    };
}

/* ---------------- Helpers ---------------- */
function cx(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(' ');
}

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

function StatCard({ label, value, icon, color }: {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'amber' | 'red';
}) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        red: 'from-red-500 to-red-600',
    };

    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className={`bg-gradient-to-r ${colors[color]} p-3`}>
                <div className="flex items-center justify-between text-white">
                    {icon}
                    <span className="text-xs font-medium uppercase tracking-wider opacity-90">{label}</span>
                </div>
            </div>
            <div className="p-4">
                <div className="text-2xl font-bold text-gray-900">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
            </div>
        </div>
    );
}

/* ---------------- Main Component ---------------- */
export default function TemplatesListPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();

    // State
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);

    const [data, setData] = useState<ApiListResponse<TemplateItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

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
        return `${backend}/companies/${hash}/templates?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl]);

    // Fetch data
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load templates (${res.status})`);
                const json: ApiListResponse<TemplateItem> = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [listUrl]);

    // URL updater
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
        updateQuery({ search: searchTerm, page: 1 });
    }

    function clearFilters() {
        setSearchTerm('');
        updateQuery({ search: undefined, page: 1 });
    }

    async function handleDelete(id: number) {
        if (!confirm('Are you sure you want to delete this template?')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`${backend}/companies/${hash}/templates/${id}`, {
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
            setDeletingId(null);
        }
    }

    const backHref = `/dashboard/company/${hash}`;
    const createHref = `/dashboard/company/${hash}/templates/create`;

    // Calculate stats
    const engineStats = useMemo(() => {
        if (!data) return { raw: 0, handlebars: 0, mjml: 0 };
        return data.items.reduce((acc, item) => {
            const engine = (item.engine || 'raw').toLowerCase();
            if (engine in acc) acc[engine as keyof typeof acc]++;
            return acc;
        }, { raw: 0, handlebars: 0, mjml: 0 });
    }, [data]);

    const totalCampaigns = useMemo(() => {
        if (!data) return 0;
        return data.items.reduce((sum, item) => sum + (item.usage?.campaigns || 0), 0);
    }, [data]);

    // Loading state
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
                        <div className="h-96 rounded-xl bg-gray-200" />
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (err) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Templates</h2>
                    </div>
                    <p className="text-gray-600">{err}</p>
                    <button
                        onClick={() => router.push(backHref)}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
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
                            Back to Dashboard
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
                            <p className="text-sm text-gray-500">
                                {meta.total} total templates
                            </p>
                        </div>
                    </div>
                    <Link
                        href={createHref}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New Template
                    </Link>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Templates"
                        value={meta.total}
                        icon={<DocumentDuplicateIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="Raw HTML"
                        value={engineStats.raw}
                        icon={<DocumentTextIcon className="h-5 w-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="Handlebars"
                        value={engineStats.handlebars}
                        icon={<CodeBracketIcon className="h-5 w-5" />}
                        color="amber"
                    />
                    <StatCard
                        label="Total Campaigns"
                        value={totalCampaigns}
                        icon={<ChartBarIcon className="h-5 w-5" />}
                        color="red"
                    />
                </div>

                {/* Search & Filters */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <FunnelIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Search & Filters</h3>
                            </div>
                            <div className="text-xs text-purple-100">
                                {qFromUrl ? '1 active filter' : 'No active filters'}
                            </div>
                        </div>
                    </div>

                    <form onSubmit={onSubmitSearch} className="p-6">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative flex-1 min-w-[300px]">
                                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    name="search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search by name or engine..."
                                    className="w-full pl-10 pr-10 py-2 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => { setSearchTerm(''); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100"
                                        aria-label="Clear search"
                                    >
                                        <XMarkIcon className="h-4 w-4 text-gray-500" />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Per page:</label>
                                <select
                                    value={perPage}
                                    onChange={(e) => updateQuery({ perPage: e.target.value, page: 1 })}
                                    className="rounded-lg border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                                >
                                    <MagnifyingGlassIcon className="h-4 w-4" />
                                    Apply
                                </button>
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    disabled={!qFromUrl}
                                    className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Table */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    {items.length === 0 ? (
                        <div className="p-12 text-center">
                            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-lg font-semibold text-gray-900">No templates found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {qFromUrl ? 'Try adjusting your search terms' : 'Get started by creating your first template'}
                            </p>
                            <Link
                                href={createHref}
                                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Create Template
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Template Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Engine
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Version
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Created
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Usage
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Actions
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {items.map(t => {
                                    const engineConfig = getEngineConfig(t.engine);
                                    const EngineIcon = engineConfig.icon;

                                    return (
                                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {t.name || <span className="text-gray-400 italic">Untitled Template</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${engineConfig.bgClass} ${engineConfig.textClass} border ${engineConfig.borderClass}`}>
                                                        <EngineIcon className="h-3 w-3" />
                                                        {engineConfig.label}
                                                    </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                v{t.version || '1'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex items-center gap-2">
                                                    <ClockIcon className="h-4 w-4 text-gray-400" />
                                                    {toLocale(t.created_at, 'date')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {typeof t.usage?.campaigns === 'number' && t.usage.campaigns > 0 ? (
                                                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                                            {t.usage.campaigns} campaign{t.usage.campaigns === 1 ? '' : 's'}
                                                        </span>
                                                ) : (
                                                    <span className="text-sm text-gray-400">Unused</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/dashboard/company/${hash}/templates/${t.id}`}
                                                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                                        title="View"
                                                    >
                                                        <EyeIcon className="h-3.5 w-3.5" />
                                                        View
                                                    </Link>
                                                    <Link
                                                        href={`/dashboard/company/${hash}/templates/${t.id}/edit`}
                                                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <PencilSquareIcon className="h-3.5 w-3.5" />
                                                        Edit
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(t.id)}
                                                        disabled={deletingId === t.id}
                                                        className={cx(
                                                            'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                                                            deletingId === t.id
                                                                ? 'bg-red-50 text-red-400 cursor-not-allowed'
                                                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                        )}
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="h-3.5 w-3.5" />
                                                        {deletingId === t.id ? 'Deleting...' : 'Delete'}
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

                {/* Pagination */}
                {items.length > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-white shadow-sm ring-1 ring-gray-200 px-6 py-4">
                        <div className="text-sm text-gray-700">
                            Showing <span className="font-semibold">{((meta.page - 1) * meta.perPage) + 1}</span> to{' '}
                            <span className="font-semibold">{Math.min(meta.page * meta.perPage, meta.total)}</span> of{' '}
                            <span className="font-semibold">{meta.total.toLocaleString()}</span> results
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => updateQuery({ page: Math.max(1, meta.page - 1) })}
                                disabled={meta.page <= 1}
                                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                                {meta.totalPages > 5 && (
                                    <>
                                        <span className="px-2 text-gray-400">...</span>
                                        <button
                                            onClick={() => updateQuery({ page: meta.totalPages })}
                                            className={`h-8 px-2 rounded-lg text-sm font-medium transition-all ${
                                                meta.page === meta.totalPages
                                                    ? 'bg-indigo-500 text-white shadow-sm'
                                                    : 'bg-white text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200'
                                            }`}
                                        >
                                            {meta.totalPages}
                                        </button>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={() => updateQuery({ page: Math.min(meta.totalPages, meta.page + 1) })}
                                disabled={meta.page >= meta.totalPages}
                                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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