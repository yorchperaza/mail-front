'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    PlusIcon,
    ArrowLeftIcon,
    GlobeAltIcon,
} from '@heroicons/react/24/outline';

interface DomainBrief {
    id: number;
    domain: string | null;
    statusDomain: string | null;
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
                    setError('You don’t have access to this company’s domains.');
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

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-gray-500">Loading domains…</p>
        </div>
    );
    if (error) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="max-w-md text-center space-y-4">
                <p className="text-red-600">{error}</p>
                <button
                    onClick={() => router.push(`/dashboard/company/${hash}`)}
                    className="inline-flex items-center space-x-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                    <ArrowLeftIcon className="h-4 w-4"/><span>Back</span>
                </button>
            </div>
        </div>
    );

    // helper to pick badge colors
    const badgeClasses = (status: string|null) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'failed': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(`/dashboard/company/${hash}`)}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
                >
                    <ArrowLeftIcon className="h-5 w-5 text-gray-600"/><span className="sr-only">Back</span>
                </button>
                <h1 className="text-2xl font-semibold">Domains</h1>
                <Link
                    href={`/dashboard/company/${hash}/domain/new`}
                    className="inline-flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    <PlusIcon className="h-5 w-5"/><span>New Domain</span>
                </Link>
            </div>

            {/* Domain List or Empty State */}
            {domains.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-gray-50 rounded-lg">
                    <GlobeAltIcon className="h-12 w-12 text-gray-400" />
                    <h2 className="text-xl font-medium text-gray-700">No domains added yet</h2>
                    <p className="text-gray-500 text-center max-w-sm">
                        Domains let you manage DNS records, track verification status, and configure email policies.
                        Start by adding your first domain.
                    </p>
                    <Link
                        href={`/dashboard/company/${hash}/domain/new`}
                        className="inline-flex items-center px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        <PlusIcon className="h-5 w-5 mr-2"/> Add a Domain
                    </Link>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {domains.map(d => (
                        <Link
                            key={d.id}
                            href={`/dashboard/company/${hash}/domain/${d.id}`}
                            className="block bg-white rounded-lg shadow hover:shadow-lg transition p-6"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                    <GlobeAltIcon className="h-8 w-8 text-blue-500 mr-3" />
                                    <h3 className="text-lg font-semibold text-gray-800 truncate">
                                        {d.domain ?? '—'}
                                    </h3>
                                </div>
                                <span
                                    className={`inline-block px-2 py-1 text-xs font-medium rounded ${badgeClasses(d.statusDomain)}`}
                                >
                  {d.statusDomain ?? 'unknown'}
                </span>
                            </div>
                            <p className="text-sm text-gray-500">
                                Manage this domain’s settings and records.
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}