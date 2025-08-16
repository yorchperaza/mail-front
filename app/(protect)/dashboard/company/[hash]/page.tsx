'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    ClipboardIcon,
    CheckIcon,
    GlobeAltIcon,
} from '@heroicons/react/24/outline';
import copy from 'copy-to-clipboard';

/* ---------- Types ---------- */
interface UserBrief   { id: number; email: string; fullName: string | null }
interface DomainBrief { id: number; domain: string | null; statusDomain: string | null }
interface CompanyDetail {
    hash: string;
    name: string | null;
    phone_number: string | null;
    address: { street?: string; city?: string; zip?: string; country?: string } | null;
    users:   UserBrief[];
    // domains on the company payload are ignored here; we fetch from /domains endpoint
    domains?: DomainBrief[];
}

export default function CompanyDetailPage() {
    const router                 = useRouter();
    const { hash }               = useParams<{ hash: string }>();
    const [company, setCompany]  = useState<CompanyDetail | null>(null);
    const [loading, setLoading]  = useState(true);
    const [error,   setError]    = useState<string | null>(null);
    const [copied,  setCopied]   = useState(false);

    // Domains state (fetched from /companies/{hash}/domains)
    const [domains, setDomains]           = useState<DomainBrief[]>([]);
    const [domainsLoading, setDomLoading] = useState(true);
    const [domainsError, setDomError]     = useState<string | null>(null);

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    // Load company
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}`, { headers: authHeaders() });
                if (res.status === 403) { setError('You don’t have access to this company.'); return; }
                if (!res.ok) throw new Error(`Failed to load company: ${res.status}`);

                const data = await res.json();
                // reassemble JSON fragments if address came as an array
                if (Array.isArray(data.address)) {
                    try {
                        const joined = data.address.join(',');
                        data.address = JSON.parse(joined);
                    } catch {
                        data.address = null;
                    }
                }
                setCompany(data);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load company');
            } finally {
                setLoading(false);
            }
        })();
    }, [hash]);

    // Load domains from /companies/{hash}/domains
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains`,
                    { headers: authHeaders() }
                );
                if (res.status === 403) { setDomError('You don’t have access to this company’s domains.'); return; }
                if (!res.ok) throw new Error(`Failed to load domains: ${res.status}`);
                const data: DomainBrief[] = await res.json();
                setDomains(data);
            } catch (e) {
                setDomError(e instanceof Error ? e.message : 'Failed to load domains');
            } finally {
                setDomLoading(false);
            }
        })();
    }, [hash]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-gray-500">Loading company…</p>
        </div>
    );
    if (error || !company) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="max-w-md text-center space-y-4">
                <p className="text-red-600">{error || 'Unknown error'}</p>
                <button onClick={() => router.push('/dashboard/company')}
                        className="inline-flex items-center space-x-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                    <ArrowLeftIcon className="h-4 w-4"/><span>Back</span>
                </button>
            </div>
        </div>
    );

    const { address } = company;
    const hasAddress  = !!(address?.street || address?.city || address?.zip || address?.country);

    const handleCopy = () => {
        copy(company.hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
    };

    const badgeClasses = (status: string | null) => {
        switch (status) {
            case 'active':  return 'bg-green-100 text-green-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'failed':  return 'bg-red-100 text-red-800';
            default:        return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center space-x-3">
                <button onClick={() => router.back()}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100">
                    <ArrowLeftIcon className="h-5 w-5 text-gray-600"/><span className="sr-only">Back</span>
                </button>
                <h1 className="text-3xl font-semibold">{company.name || 'Untitled'}</h1>
            </div>

            {/* Company Info */}
            <section className="bg-white rounded-lg shadow p-6 space-y-4">
                <h2 className="text-lg font-medium">Company Info</h2>
                <div className="grid gap-y-2 sm:grid-cols-2">
                    {/* Hash */}
                    <div className="flex items-start sm:items-center gap-2">
                        <span className="block text-sm text-gray-500">Hash</span>
                        <code className="font-mono text-xs bg-gray-100 rounded px-2 py-1 break-all sm:break-normal max-w-[12rem] sm:max-w-none truncate">
                            {company.hash}
                        </code>
                        <button onClick={handleCopy}
                                className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-200"
                                title="Copy hash">
                            {copied
                                ? <CheckIcon className="h-4 w-4 text-green-600"/>
                                : <ClipboardIcon className="h-4 w-4 text-gray-600"/>}
                        </button>
                    </div>

                    {/* Phone */}
                    {company.phone_number && (
                        <div>
                            <span className="block text-sm text-gray-500">Phone</span>
                            {company.phone_number}
                        </div>
                    )}

                    {/* Address */}
                    {hasAddress && (
                        <div className="sm:col-span-2">
                            <span className="block text-sm text-gray-500">Address</span>
                            <address className="not-italic leading-tight">
                                {address?.street && <>{address.street}<br/></>}
                                {(address?.city || address?.zip) && (
                                    <>
                                        {address.city}{address.city && address.zip ? ', ' : ''}
                                        {address.zip}<br/>
                                    </>
                                )}
                                {address?.country}
                            </address>
                        </div>
                    )}
                </div>
            </section>

            {/* Users */}
            <section className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-medium mb-4">Users</h2>
                {company.users.length === 0 ? (
                    <p className="text-gray-500 text-sm">No users found.</p>
                ) : (
                    <ul className="divide-y">
                        {company.users.map(u => (
                            <li key={u.id} className="py-2">
                                <p className="font-medium">
                                    {u.fullName ?? <span className="italic text-gray-500">No name</span>}
                                </p>
                                <p className="text-sm text-gray-500">{u.email}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Domains (fetched from /companies/{hash}/domains) */}
            <section className="bg-white rounded-lg shadow p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-medium">Domains</h2>
                    <Link
                        href={`/dashboard/company/${hash}/domain`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                        View all domains →
                    </Link>
                </div>

                {domainsLoading ? (
                    <p className="text-gray-500 text-sm">Loading domains…</p>
                ) : domainsError ? (
                    <p className="text-red-600 text-sm">{domainsError}</p>
                ) : domains.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3 bg-gray-50 rounded-lg">
                        <GlobeAltIcon className="h-10 w-10 text-gray-400" />
                        <h3 className="text-base font-medium text-gray-700">No domains added yet</h3>
                        <p className="text-gray-500 text-sm text-center max-w-sm">
                            Domains let you manage DNS records, track verification status, and configure email policies.
                        </p>
                        <Link
                            href={`/dashboard/company/${hash}/domain/new`}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                            Add a Domain
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {domains.slice(0, 6).map(d => (
                            <Link
                                key={d.id}
                                href={`/dashboard/company/${hash}/domain/${d.id}`}
                                className="block bg-white rounded-lg border shadow-sm hover:shadow-lg transition p-6"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center">
                                        <GlobeAltIcon className="h-7 w-7 text-blue-500 mr-3" />
                                        <h3 className="text-base font-semibold text-gray-800 truncate">
                                            {d.domain ?? '—'}
                                        </h3>
                                    </div>
                                    <span className={`inline-block px-2 py-1 text-[11px] font-medium rounded ${badgeClasses(d.statusDomain)}`}>
                    {d.statusDomain ?? 'unknown'}
                  </span>
                                </div>
                                <p className="text-sm text-gray-500">Manage this domain’s settings and records.</p>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}