'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    PlusIcon,
    ArrowLeftIcon,
    GlobeAltIcon,
    CheckCircleIcon,
    ClockIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    ServerIcon,
    ShieldCheckIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';
import {
    GlobeAltIcon as GlobeAltSolid,
} from '@heroicons/react/24/solid';

interface DomainBrief {
    id: number;
    domain: string | null;
    statusDomain: string | null;
}

function DomainCard({ domain, hash }: { domain: DomainBrief; hash: string }) {
    const statusConfig = {
        active: {
            bgClass: 'bg-emerald-50',
            textClass: 'text-emerald-700',
            borderClass: 'border-emerald-200',
            dotClass: 'bg-emerald-500',
            icon: CheckCircleIcon,
            headerClass: 'from-emerald-500 to-emerald-600',
        },
        pending: {
            bgClass: 'bg-amber-50',
            textClass: 'text-amber-700',
            borderClass: 'border-amber-200',
            dotClass: 'bg-amber-500',
            icon: ClockIcon,
            headerClass: 'from-amber-500 to-amber-600',
        },
        failed: {
            bgClass: 'bg-red-50',
            textClass: 'text-red-700',
            borderClass: 'border-red-200',
            dotClass: 'bg-red-500',
            icon: XCircleIcon,
            headerClass: 'from-red-500 to-red-600',
        },
        unknown: {
            bgClass: 'bg-gray-50',
            textClass: 'text-gray-700',
            borderClass: 'border-gray-200',
            dotClass: 'bg-gray-500',
            icon: ExclamationTriangleIcon,
            headerClass: 'from-gray-500 to-gray-600',
        },
    };

    const status = statusConfig[domain.statusDomain as keyof typeof statusConfig] || statusConfig.unknown;
    const StatusIcon = status.icon;

    return (
        <Link
            href={`/dashboard/company/${hash}/domain/${domain.id}`}
            className="group block rounded-xl bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-lg hover:ring-indigo-200 transition-all overflow-hidden"
        >
            {/* Domain Header */}
            <div className={`bg-gradient-to-r ${status.headerClass} p-4`}>
                <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-white/20 p-2">
                            <GlobeAltSolid className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white truncate">
                                {domain.domain || 'Unknown Domain'}
                            </h3>
                            <p className="text-xs text-white/80 mt-0.5">ID: {domain.id}</p>
                        </div>
                    </div>
                    <ArrowRightIcon className="h-4 w-4 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
            </div>

            {/* Domain Content */}
            <div className="p-5">
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${status.bgClass} ${status.textClass}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {domain.statusDomain || 'Unknown'}
                    </span>
                    <div className={`h-2 w-2 rounded-full ${status.dotClass}`} />
                </div>

                {/* Domain Features */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-lg bg-blue-50 p-3 text-center">
                        <div className="flex items-center justify-center mb-1">
                            <ServerIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="text-xs text-blue-600 font-medium">DNS Records</div>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-3 text-center">
                        <div className="flex items-center justify-center mb-1">
                            <ShieldCheckIcon className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="text-xs text-purple-600 font-medium">Security</div>
                    </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-500">
                    Manage DNS records, verification status, and email policies for this domain.
                </p>
            </div>
        </Link>
    );
}

function EmptyState({ hash }: { hash: string }) {
    return (
        <div className="text-center py-20">
            <div className="rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 p-8 w-32 h-32 mx-auto mb-8 flex items-center justify-center">
                <GlobeAltIcon className="h-16 w-16 text-blue-600" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">No domains configured</h3>
            <p className="text-gray-500 mb-8 max-w-lg mx-auto text-lg">
                Domains let you manage DNS records, track verification status, and configure email policies.
                Get started by adding your first domain.
            </p>
            <Link
                href={`/dashboard/company/${hash}/domain/new`}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
            >
                <PlusIcon className="h-6 w-6" />
                Add Your First Domain
            </Link>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-gray-200 rounded-full" />
                    <div className="h-8 w-32 bg-gray-200 rounded-lg" />
                </div>
                <div className="h-10 w-32 bg-gray-200 rounded-lg" />
            </div>

            {/* Cards Skeleton */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="h-20 bg-gray-200" />
                        <div className="p-5 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="h-6 w-20 bg-gray-200 rounded-full" />
                                <div className="h-2 w-2 bg-gray-200 rounded-full" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="h-12 bg-gray-100 rounded-lg" />
                                <div className="h-12 bg-gray-100 rounded-lg" />
                            </div>
                            <div className="h-4 w-full bg-gray-200 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ErrorState({ error, hash }: { error: string; hash: string }) {
    return (
        <div className="text-center py-20">
            <div className="rounded-full bg-red-100 p-8 w-32 h-32 mx-auto mb-8 flex items-center justify-center">
                <ExclamationTriangleIcon className="h-16 w-16 text-red-600" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">Unable to load domains</h3>
            <p className="text-gray-500 mb-8 max-w-lg mx-auto text-lg">{error}</p>
            <div className="flex items-center justify-center gap-4">
                <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-3 text-white font-medium hover:bg-gray-800 transition-colors"
                >
                    Try Again
                </button>
                <Link
                    href={`/dashboard/company/${hash}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-gray-700 font-medium ring-1 ring-gray-200 hover:bg-gray-50 transition-colors"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back to Company
                </Link>
            </div>
        </div>
    );
}

export default function DomainListPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const [domains, setDomains] = useState<DomainBrief[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string|null>(null);

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains`,
                    { headers: authHeaders() }
                );
                if (res.status === 403) {
                    setError('You don\'t have access to this company\'s domains.');
                    return;
                }
                if (!res.ok) {
                    throw new Error(`Failed to load domains: ${res.status}`);
                }
                setDomains(await res.json());
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load domains');
            } finally {
                setLoading(false);
            }
        })();
    }, [hash]);

    // Get status summary
    const statusSummary = domains.reduce((acc, domain) => {
        const status = domain.statusDomain || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto p-6">
                    <LoadingState />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto p-6">
                    <ErrorState error={error} hash={hash} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Company
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Domains</h1>
                            <p className="mt-1 text-sm text-gray-600">
                                Manage DNS records, verification, and email policies
                            </p>
                        </div>
                    </div>

                    <Link
                        href={`/dashboard/company/${hash}/domain/new`}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                    >
                        <PlusIcon className="h-5 w-5" />
                        Add Domain
                    </Link>
                </div>

                {/* Summary Stats */}
                {domains.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
                                <div className="flex items-center justify-between text-white">
                                    <GlobeAltIcon className="h-6 w-6" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Total</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="text-2xl font-bold text-gray-900">{domains.length}</div>
                                <div className="text-sm text-gray-500">Domains configured</div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4">
                                <div className="flex items-center justify-between text-white">
                                    <CheckCircleIcon className="h-6 w-6" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Active</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="text-2xl font-bold text-gray-900">{statusSummary.active || 0}</div>
                                <div className="text-sm text-gray-500">Verified domains</div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4">
                                <div className="flex items-center justify-between text-white">
                                    <ClockIcon className="h-6 w-6" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Pending</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="text-2xl font-bold text-gray-900">{statusSummary.pending || 0}</div>
                                <div className="text-sm text-gray-500">Awaiting verification</div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-red-500 to-red-600 p-4">
                                <div className="flex items-center justify-between text-white">
                                    <XCircleIcon className="h-6 w-6" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Issues</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="text-2xl font-bold text-gray-900">{(statusSummary.failed || 0) + (statusSummary.unknown || 0)}</div>
                                <div className="text-sm text-gray-500">Need attention</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Domain List or Empty State */}
                <section>
                    {domains.length === 0 ? (
                        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <EmptyState hash={hash} />
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-gray-900">All Domains</h2>
                                <p className="text-sm text-gray-500">
                                    {domains.length} {domains.length === 1 ? 'domain' : 'domains'}
                                </p>
                            </div>
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {domains.map(domain => (
                                    <DomainCard key={domain.id} domain={domain} hash={hash} />
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}