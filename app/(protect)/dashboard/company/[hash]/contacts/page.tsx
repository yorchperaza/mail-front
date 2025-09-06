'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    PlusIcon,
    PencilSquareIcon,
    EyeIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    UserGroupIcon,
    ShieldCheckIcon,
    CalendarIcon,
    ArrowDownTrayIcon,
    FunnelIcon,
    CheckCircleIcon,
    TableCellsIcon,
    Squares2X2Icon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
} from '@heroicons/react/24/solid';

type ContactItem = {
    id: number;
    email: string | null;
    name: string | null;
    status: string | null;
    gdpr_consent_at: string | null;
    created_at: string | null;
};

type ApiListResponse<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

/* ---------- Components ---------- */
function StatCard({
                      label,
                      value,
                      change,
                      icon,
                      color
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
                <div className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</div>
                {change !== undefined && (
                    <div className={`mt-1 text-xs ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% from last month
                    </div>
                )}
            </div>
        </div>
    );
}

function ContactCard({ contact, hash, onDelete, isDeleting }: {
    contact: ContactItem;
    hash: string;
    onDelete: (id: number) => void;
    isDeleting: boolean;
}) {
    const hasGdpr = !!contact.gdpr_consent_at;
    const statusConfig = {
        active: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
        pending: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
        inactive: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' },
    };
    const status = statusConfig[contact.status as keyof typeof statusConfig] || statusConfig.inactive;

    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-lg hover:ring-indigo-200 transition-all overflow-hidden">
            <div className={`h-1 ${status.dot}`} />
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                            {contact.name?.charAt(0).toUpperCase() || contact.email?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">
                                {contact.name || <span className="italic text-gray-400">No name</span>}
                            </h3>
                            <p className="text-xs text-gray-500 truncate font-mono">
                                {contact.email || 'No email'}
                            </p>
                        </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${status.bg} ${status.text}`}>
                        <span className={`mr-1 h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {contact.status || 'Inactive'}
                    </span>
                </div>

                <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                        <ShieldCheckIcon className={`h-3.5 w-3.5 ${hasGdpr ? 'text-emerald-500' : 'text-gray-400'}`} />
                        <span className={hasGdpr ? 'text-emerald-700' : 'text-gray-500'}>
                            {hasGdpr ? 'GDPR Consented' : 'No GDPR consent'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="h-3.5 w-3.5 text-gray-400" />
                        <span>{toLocale(contact.created_at, 'short')}</span>
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1">
                    {contact.email && (
                        <>
                            <Link
                                href={`/dashboard/company/${hash}/contacts/detail?email=${encodeURIComponent(contact.email)}`}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition-colors"
                            >
                                <EyeIcon className="h-3.5 w-3.5" />
                                View
                            </Link>
                            <Link
                                href={`/dashboard/company/${hash}/contacts/edit?email=${encodeURIComponent(contact.email)}`}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-blue-100 hover:bg-blue-200 text-xs font-medium text-blue-700 transition-colors"
                            >
                                <PencilSquareIcon className="h-3.5 w-3.5" />
                                Edit
                            </Link>
                        </>
                    )}
                    <button
                        onClick={() => onDelete(contact.id)}
                        disabled={isDeleting}
                        className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            isDeleting
                                ? 'bg-red-50 text-red-400 cursor-not-allowed'
                                : 'bg-red-100 hover:bg-red-200 text-red-700'
                        }`}
                    >
                        <TrashIcon className="h-3.5 w-3.5" />
                        {isDeleting ? '...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function toLocale(s?: string | null, format: 'full' | 'short' = 'full') {
    if (!s) return '—';
    try {
        const date = new Date(s);
        if (format === 'short') {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return s;
    }
}

/* ---------- Main Component ---------- */
export default function ContactsListPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    // URL state
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));
    const qFromUrl = (search.get('search') || '').trim();

    // Local state
    const [searchTerm, setSearchTerm] = useState(qFromUrl);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [data, setData] = useState<ApiListResponse<ContactItem> | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);

    const listUrl = useMemo(() => {
        const sp = new URLSearchParams();
        sp.set('page', String(page));
        sp.set('perPage', String(perPage));
        if (qFromUrl) sp.set('search', qFromUrl);
        return `${backend}/companies/${hash}/contacts?${sp.toString()}`;
    }, [backend, hash, page, perPage, qFromUrl]);

    // Fetch contacts
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load contacts (${res.status})`);
                const json: ApiListResponse<ContactItem> = await res.json();
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
        updateQuery({ search: searchTerm, page: 1 });
    }

    function clearFilters() {
        setSearchTerm('');
        updateQuery({ search: undefined, page: 1 });
    }

    async function handleDelete(id: number) {
        if (!confirm('Are you sure you want to delete this contact?')) return;
        setDeletingId(id);
        try {
            const url = `${backend}/companies/${hash}/contacts/${id}`;
            const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            setData(prev => prev
                ? { ...prev, items: prev.items.filter(i => i.id !== id), meta: { ...prev.meta, total: prev.meta.total - 1 } }
                : prev);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    const backHref = `/dashboard/company/${hash}`;
    const createHref = `/dashboard/company/${hash}/contacts/create`;
    const importHref = `/dashboard/company/${hash}/contacts/import`;

    // Calculate stats
    const stats = useMemo(() => {
        if (!data) return { active: 0, withGdpr: 0, thisMonth: 0 };
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        return {
            active: data.items.filter(c => c.status === 'active').length,
            withGdpr: data.items.filter(c => !!c.gdpr_consent_at).length,
            thisMonth: data.items.filter(c => {
                if (!c.created_at) return false;
                const d = new Date(c.created_at);
                return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
            }).length,
        };
    }, [data]);

    // Loading state
    if (loading) {
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
                        <h2 className="text-lg font-semibold">Error Loading Contacts</h2>
                    </div>
                    <p className="text-gray-600">{err}</p>
                    <button
                        onClick={() => router.push(backHref)}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Company
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
                            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
                            <p className="text-sm text-gray-500">
                                {meta.total.toLocaleString()} total contacts
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                        >
                            {viewMode === 'grid' ? (
                                <>
                                    <TableCellsIcon className="h-4 w-4" />
                                    Table View
                                </>
                            ) : (
                                <>
                                    <Squares2X2Icon className="h-4 w-4" />
                                    Grid View
                                </>
                            )}
                        </button>
                        <Link
                            href={importHref}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            Import
                        </Link>
                        <Link
                            href={createHref}
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                        >
                            <PlusIcon className="h-4 w-4" />
                            New Contact
                        </Link>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Contacts"
                        value={meta.total}
                        icon={<UserGroupIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="Active"
                        value={stats.active}
                        icon={<CheckCircleIcon className="h-5 w-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="GDPR Consented"
                        value={stats.withGdpr}
                        icon={<ShieldCheckIcon className="h-5 w-5" />}
                        color="purple"
                    />
                    <StatCard
                        label="Added This Month"
                        value={stats.thisMonth}
                        icon={<CalendarIcon className="h-5 w-5" />}
                        color="amber"
                    />
                </div>

                {/* Search & Filters */}
                <form onSubmit={onSubmitSearch} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <FunnelIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Search & Filter</h3>
                            </div>
                            {qFromUrl && (
                                <span className="text-xs text-purple-100">
                                    Showing results for &quot;{qFromUrl}&quot;
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search by name or email..."
                                    className="w-full rounded-lg border-gray-300 pl-10 pr-10 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 hover:bg-gray-100"
                                    >
                                        <XMarkIcon className="h-4 w-4 text-gray-400" />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Per page:</label>
                                <select
                                    value={perPage}
                                    onChange={(e) => updateQuery({ perPage: e.target.value, page: 1 })}
                                    className="rounded-lg border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    {[10, 25, 50, 100, 200].map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={clearFilters}
                                disabled={!qFromUrl}
                                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Clear
                            </button>

                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                            >
                                <MagnifyingGlassIcon className="h-4 w-4" />
                                Search
                            </button>
                        </div>
                    </div>
                </form>

                {/* Content */}
                {items.length === 0 ? (
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-12">
                        <div className="text-center">
                            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-lg font-semibold text-gray-900">No contacts found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {qFromUrl ? 'Try adjusting your search terms' : 'Get started by adding your first contact'}
                            </p>
                            {!qFromUrl && (
                                <Link
                                    href={createHref}
                                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add Contact
                                </Link>
                            )}
                        </div>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* Grid View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {items.map(contact => (
                            <ContactCard
                                key={contact.id}
                                contact={contact}
                                hash={hash}
                                onDelete={handleDelete}
                                isDeleting={deletingId === contact.id}
                            />
                        ))}
                    </div>
                ) : (
                    /* Table View */
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <table className="w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Contact
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden lg:table-cell">
                                    Status
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    GDPR
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden md:table-cell">
                                    Created
                                </th>
                                <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Actions
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {items.map(contact => {
                                const hasGdpr = !!contact.gdpr_consent_at;
                                const statusConfig = {
                                    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
                                    pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
                                    inactive: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
                                };
                                const status = statusConfig[contact.status as keyof typeof statusConfig] || statusConfig.inactive;

                                return (
                                    <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-shrink-0">
                                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-semibold text-xs">
                                                        {contact.name?.charAt(0).toUpperCase() || contact.email?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium text-gray-900 truncate">
                                                        {contact.name || <span className="italic text-gray-400">No name</span>}
                                                    </div>
                                                    <div className="text-xs text-gray-500 font-mono truncate">
                                                        {contact.email || '—'}
                                                    </div>
                                                    {/* Show status on mobile */}
                                                    <div className="mt-1 lg:hidden">
                                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
                                                                <span className={`mr-1 h-1.5 w-1.5 rounded-full ${status.dot}`} />
                                                                {contact.status || 'Inactive'}
                                                            </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 hidden lg:table-cell">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
                                                    <span className={`mr-1 h-1.5 w-1.5 rounded-full ${status.dot}`} />
                                                    {contact.status || 'Inactive'}
                                                </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center text-xs">
                                                {hasGdpr ? (
                                                    <CheckCircleSolid className="h-4 w-4 text-emerald-500" title="GDPR Consented" />
                                                ) : (
                                                    <XMarkIcon className="h-4 w-4 text-gray-400" title="No GDPR consent" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-xs text-gray-500 hidden md:table-cell">
                                            {toLocale(contact.created_at, 'short')}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {contact.email ? (
                                                    <>
                                                        <Link
                                                            href={`/dashboard/company/${hash}/contacts/detail?email=${encodeURIComponent(contact.email)}`}
                                                            className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                                                            title="View"
                                                        >
                                                            <EyeIcon className="h-3.5 w-3.5 text-gray-600" />
                                                        </Link>
                                                        <Link
                                                            href={`/dashboard/company/${hash}/contacts/edit?email=${encodeURIComponent(contact.email)}`}
                                                            className="p-1.5 rounded-md bg-blue-100 hover:bg-blue-200 transition-colors"
                                                            title="Edit"
                                                        >
                                                            <PencilSquareIcon className="h-3.5 w-3.5 text-blue-600" />
                                                        </Link>
                                                    </>
                                                ) : null}
                                                <button
                                                    onClick={() => handleDelete(contact.id)}
                                                    disabled={deletingId === contact.id}
                                                    className={`p-1.5 rounded-md transition-colors ${
                                                        deletingId === contact.id
                                                            ? 'bg-red-50 text-red-400 cursor-not-allowed'
                                                            : 'bg-red-100 hover:bg-red-200'
                                                    }`}
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="h-3.5 w-3.5 text-red-600" />
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

                {/* Pagination */}
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
            </div>
        </div>
    );
}