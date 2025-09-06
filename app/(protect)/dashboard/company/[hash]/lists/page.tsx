'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    EyeIcon,
    ClipboardDocumentIcon,
    CheckCircleIcon,
    FunnelIcon,
    ChartBarIcon,
    QueueListIcon,
    UserGroupIcon,
    CalendarDaysIcon,
    FolderIcon,
} from '@heroicons/react/24/outline';

/* Recharts */
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';

type ListGroup = {
    id: number;
    name: string;
    created_at?: string | null;
    hash?: string | null;
    counts?: {
        contacts?: number | null;
        campaigns?: number | null;
    };
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ---------- Components ---------- */
function Toast({
                   kind = 'info',
                   text,
                   onClose,
               }: {
    kind?: 'info' | 'success' | 'error';
    text: string;
    onClose: () => void;
}) {
    const styles = {
        success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        error: 'bg-rose-50 border-rose-200 text-rose-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    return (
        <div
            className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border px-4 py-3 shadow-lg ${styles[kind]}`}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{text}</span>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1 hover:bg-white/40 transition-colors"
                    aria-label="Close"
                    title="Close"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function CopyButton({ text, small = false }: { text: string; small?: boolean }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            onClick={async (e) => {
                e.stopPropagation();
                try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                } catch {
                    // Fallback
                    const el = document.createElement('textarea');
                    el.value = text;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }
            }}
            className={`inline-flex items-center gap-1 rounded-lg transition-colors ${
                small
                    ? 'px-1.5 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700'
                    : 'px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title="Copy to clipboard"
        >
            {copied ? (
                <>
                    <CheckCircleIcon className="h-3 w-3" />
                    Copied
                </>
            ) : (
                <>
                    <ClipboardDocumentIcon className="h-3 w-3" />
                    Copy
                </>
            )}
        </button>
    );
}

function StatCard({
                      label,
                      value,
                      change,
                      icon,
                      color,
                  }: {
    label: string;
    value: number | string;
    change?: number;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'amber' | 'purple';
}) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        purple: 'from-purple-500 to-purple-600',
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
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                {change !== undefined && (
                    <div className={`mt-1 text-xs ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% from previous
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ListsIndexPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();

    // State
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [data, setData] = useState<ApiListResponse<ListGroup> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);

    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [renaming, setRenaming] = useState(false);
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
        sp.set('withCounts', '1');
        if (qFromUrl) sp.set('search', qFromUrl);
        return `${backend}/companies/${hash}/lists?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl]);

    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);

    // Fetch lists
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load lists (${res.status})`);
                const json: ApiListResponse<ListGroup> = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [listUrl]);

    function showToast(kind: 'info' | 'success' | 'error', text: string) {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 3000);
    }

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

    function openRename(g: ListGroup) {
        setRenamingId(g.id);
        setRenameValue(g.name);
    }

    async function handleRename() {
        const id = renamingId;
        if (!id || !renameValue.trim()) return;
        setRenaming(true);
        try {
            const res = await fetch(`${backend}/companies/${hash}/lists/${id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ name: renameValue.trim() }),
            });
            if (!res.ok) throw new Error(`Rename failed (${res.status})`);
            const updated: ListGroup = await res.json();
            setData(prev => prev
                ? { ...prev, items: prev.items.map(i => (i.id === id ? updated : i)) }
                : prev
            );
            setRenamingId(null);
            setRenameValue('');
            showToast('success', 'List renamed successfully');
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to rename list');
        } finally {
            setRenaming(false);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this list? All its memberships will be removed. This action cannot be undone.')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`${backend}/companies/${hash}/lists/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            setData(prev => prev
                ? {
                    ...prev,
                    items: prev.items.filter(i => i.id !== id),
                    meta: { ...prev.meta, total: Math.max(0, prev.meta.total - 1) },
                }
                : prev
            );
            showToast('success', 'List deleted successfully');
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to delete list');
        } finally {
            setDeletingId(null);
        }
    }

    const backHref = `/dashboard/company/${hash}`;

    const maskHash = (h?: string | null) => {
        if (!h) return '—';
        const s = String(h);
        if (s.length <= 12) return s;
        return `${s.slice(0, 6)}…${s.slice(-4)}`;
    };

    // Calculate stats
    const stats = useMemo(() => {
        const items = data?.items ?? [];
        const totalContacts = items.reduce((sum, list) => sum + (list.counts?.contacts || 0), 0);
        const avgSize = items.length > 0 ? Math.round(totalContacts / items.length) : 0;
        const emptyLists = items.filter(list => !list.counts?.contacts || list.counts.contacts === 0).length;

        return {
            total: items.length,
            totalContacts,
            avgSize,
            emptyLists
        };
    }, [data]);

    // Chart data - top 10 lists by size
    const chartData = useMemo(() => {
        const items = data?.items ?? [];
        return items
            .filter(list => (list.counts?.contacts || 0) > 0)
            .map(list => ({
                name: list.name.length > 15 ? list.name.substring(0, 15) + '...' : list.name,
                contacts: list.counts?.contacts || 0,
            }))
            .sort((a, b) => b.contacts - a.contacts)
            .slice(0, 10);
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
                        <div className="h-96 rounded-xl bg-gray-200" />
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
                        <XMarkIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Lists</h2>
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
                {toast && <Toast kind={toast.kind} text={toast.text} onClose={() => setToast(null)} />}

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
                            <h1 className="text-2xl font-bold text-gray-900">Contact Lists</h1>
                            <p className="text-sm text-gray-500">
                                {meta.total} {meta.total === 1 ? 'list' : 'lists'} total
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push(`/dashboard/company/${hash}/lists/create`)}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm"
                    >
                        <PlusIcon className="h-5 w-5" />
                        New List
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Lists"
                        value={stats.total}
                        icon={<QueueListIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="Total Contacts"
                        value={stats.totalContacts.toLocaleString()}
                        icon={<UserGroupIcon className="h-5 w-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="Average Size"
                        value={stats.avgSize.toLocaleString()}
                        icon={<ChartBarIcon className="h-5 w-5" />}
                        color="purple"
                    />
                    <StatCard
                        label="Empty Lists"
                        value={stats.emptyLists}
                        icon={<FolderIcon className="h-5 w-5" />}
                        color="amber"
                    />
                </div>

                {/* Chart */}
                {chartData.length > 0 && (
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <ChartBarIcon className="h-5 w-5" />
                                    <h3 className="text-sm font-semibold uppercase tracking-wider">
                                        Top Lists by Contact Count
                                    </h3>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 11, fill: '#6b7280' }}
                                        tickMargin={10}
                                        angle={-45}
                                        textAnchor="end"
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: '#6b7280' }}
                                        tickMargin={10}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <Bar dataKey="contacts" fill="#6366f1" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Search/Filter Bar */}
                <form onSubmit={onSubmitSearch} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <FunnelIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Search & Filters</h3>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    name="search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search by list name…"
                                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            clearFilters();
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                                        aria-label="Clear search"
                                        title="Clear search"
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
                                disabled={!qFromUrl && page === 1}
                                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </form>

                {/* Table */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Name
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Hash
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Contacts
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Created
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Actions
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {items.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-12 text-center text-gray-500" colSpan={5}>
                                        <QueueListIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No lists found</h3>
                                        <p className="text-sm text-gray-500">Create your first list to get started</p>
                                    </td>
                                </tr>
                            ) : (
                                items.map((g) => (
                                    <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900">{g.name}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {g.hash ? (
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded-lg border font-mono">
                                                        {maskHash(g.hash)}
                                                    </code>
                                                    <CopyButton text={g.hash} small />
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {g.counts?.contacts ? (
                                                <span className="inline-flex items-center gap-1">
                                                        <UserGroupIcon className="h-4 w-4 text-gray-400" />
                                                        <span className="font-medium">{g.counts.contacts.toLocaleString()}</span>
                                                    </span>
                                            ) : (
                                                <span className="text-gray-400">0</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                                                {toLocale(g.created_at)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/dashboard/company/${hash}/lists/${g.id}/contacts`}
                                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                                    title="View members"
                                                >
                                                    <EyeIcon className="h-3.5 w-3.5" />
                                                    View Members
                                                </Link>
                                                <button
                                                    onClick={() => openRename(g)}
                                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 transition-colors"
                                                    title="Rename"
                                                >
                                                    <PencilSquareIcon className="h-3.5 w-3.5" />
                                                    Rename
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(g.id)}
                                                    disabled={deletingId === g.id}
                                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 transition-colors disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="h-3.5 w-3.5" />
                                                    {deletingId === g.id ? 'Deleting…' : 'Delete'}
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
                <div className="flex items-center justify-between rounded-xl bg-white shadow-sm ring-1 ring-gray-200 px-6 py-4">
                    <div className="text-sm text-gray-700">
                        Showing <span className="font-semibold">{((meta.page - 1) * meta.perPage) + 1}</span> to{' '}
                        <span className="font-semibold">{Math.min(meta.page * meta.perPage, meta.total)}</span> of{' '}
                        <span className="font-semibold">{meta.total}</span> results
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

                {/* Rename Modal */}
                {renamingId !== null && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRenamingId(null)} />
                        <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl border">
                            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4 rounded-t-xl">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-white">Rename List</h2>
                                    <button
                                        onClick={() => setRenamingId(null)}
                                        className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                                        aria-label="Close"
                                    >
                                        <XMarkIcon className="h-5 w-5 text-white" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        New name
                                    </label>
                                    <input
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        placeholder="Enter new list name"
                                        autoFocus
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        onClick={() => setRenamingId(null)}
                                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleRename}
                                        disabled={renaming || !renameValue.trim()}
                                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                    >
                                        {renaming ? 'Saving…' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}