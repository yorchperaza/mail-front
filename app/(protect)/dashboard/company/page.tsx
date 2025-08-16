'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    PlusIcon,
    GlobeAltIcon,
    UsersIcon,
    RectangleStackIcon,
    CalendarDaysIcon,
    MapPinIcon,
    TagIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type PlanBrief = { id: number | null; name: string | null } | null;

type CompanyFull = {
    hash: string;
    name: string | null;
    status: boolean;
    statusText: string;       // "active" | "inactive"
    createdAt: string | null; // ISO
    // phone_number: string | null;  // removed from UI
    address: { street?: string; city?: string; zip?: string; country?: string } | null;
    plan: PlanBrief;
    counts: { domains: number; messages: number; users: number };
};

export default function CompaniesListPage() {
    const router = useRouter();
    const [companies, setCompanies] = useState<CompanyFull[]>([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState<string | null>(null);

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/list-full`, {
                    headers: authHeaders(),
                });
                if (res.status === 403 || res.status === 401) { setError('You don’t have access to these companies.'); return; }
                if (!res.ok) throw new Error(`Failed to load companies: ${res.status}`);
                const data: CompanyFull[] = await res.json();
                setCompanies(Array.isArray(data) ? data : []);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load companies');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const badgeClasses = (statusText: string) => {
        switch (statusText) {
            case 'active':   return 'bg-green-100 text-green-800';
            case 'inactive': return 'bg-gray-100 text-gray-800';
            default:         return 'bg-gray-100 text-gray-800';
        }
    };

    const StatusIcon = ({ statusText }: { statusText: string }) =>
        statusText === 'active'
            ? <CheckCircleIcon className="h-4 w-4 mr-1" />
            : <ExclamationTriangleIcon className="h-4 w-4 mr-1" />;

    const formatDate = (iso: string | null) => {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch { return '—'; }
    };

    const formatAddress = (addr: CompanyFull['address']) => {
        if (!addr) return null;
        const parts = [addr.street, addr.city, addr.zip, addr.country].filter(Boolean);
        if (parts.length === 0) return null;
        return parts.join(', ');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading companies…</p>
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
                        <ArrowLeftIcon className="h-4 w-4" /><span>Back</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8">
            {/* Header — matches your design language */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
                    >
                        <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
                        <span className="sr-only">Back</span>
                    </button>
                    <h1 className="text-3xl font-semibold">Companies</h1>
                </div>
                <Link
                    href="/dashboard/company/new"
                    className="inline-flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    <PlusIcon className="h-5 w-5" /><span>New Company</span>
                </Link>
            </div>

            {/* Empty state */}
            {companies.length === 0 ? (
                <section className="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center text-center space-y-3">
                    <GlobeAltIcon className="h-10 w-10 text-gray-400" />
                    <h2 className="text-base font-medium text-gray-700">No companies yet</h2>
                    <p className="text-gray-500 text-sm max-w-sm">
                        Create your first company to start managing users, domains, and activity.
                    </p>
                    <Link
                        href="/dashboard/company/new"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        <PlusIcon className="h-5 w-5 mr-2" />Create Company
                    </Link>
                </section>
            ) : (
                <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {companies.map((c) => {
                        const addr = formatAddress(c.address);
                        return (
                            <Link
                                key={c.hash}
                                href={`/dashboard/company/${c.hash}`}
                                className="block bg-white rounded-lg shadow p-6 hover:shadow-lg transition border"
                            >
                                {/* Top Row: name + status badge */}
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-semibold text-gray-800 truncate">
                                            {c.name || 'Untitled'}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1 inline-flex items-center">
                                            <CalendarDaysIcon className="h-4 w-4 mr-1" />
                                            Created {formatDate(c.createdAt)}
                                        </p>
                                    </div>
                                    <span
                                        className={`ml-3 inline-flex items-center px-2 py-1 text-[11px] font-medium rounded ${badgeClasses(c.statusText)}`}
                                    >
                    <StatusIcon statusText={c.statusText} />
                                        {c.statusText}
                  </span>
                                </div>

                                {/* KPI Row with icons */}
                                <div className="mt-4 grid grid-cols-3 gap-3">
                                    <div className="bg-gray-50 rounded p-3 text-center">
                                        <div className="flex items-center justify-center gap-1 text-gray-500 text-xs">
                                            <GlobeAltIcon className="h-4 w-4" /><span>Domains</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">{c.counts.domains}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded p-3 text-center">
                                        <div className="flex items-center justify-center gap-1 text-gray-500 text-xs">
                                            <RectangleStackIcon className="h-4 w-4" /><span>Messages</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">{c.counts.messages}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded p-3 text-center">
                                        <div className="flex items-center justify-center gap-1 text-gray-500 text-xs">
                                            <UsersIcon className="h-4 w-4" /><span>Users</span>
                                        </div>
                                        <p className="text-lg font-semibold mt-1">{c.counts.users}</p>
                                    </div>
                                </div>

                                {/* Details with icons */}
                                <div className="mt-4 space-y-2 text-sm text-gray-700">
                                    {c.plan?.name && (
                                        <p className="flex items-center">
                                            <TagIcon className="h-4 w-4 mr-2 text-gray-500" />
                                            <span className="text-gray-500 mr-1">Plan:</span> {c.plan.name}
                                        </p>
                                    )}
                                    {addr && (
                                        <p className="flex items-center truncate">
                                            <MapPinIcon className="h-4 w-4 mr-2 text-gray-500" />
                                            <span className="text-gray-500 mr-1">Address:</span>
                                            <span className="truncate">{addr}</span>
                                        </p>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </section>
            )}
        </div>
    );
}