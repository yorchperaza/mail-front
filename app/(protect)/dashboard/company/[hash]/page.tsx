'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    GlobeAltIcon,
    SparklesIcon,
    BuildingOfficeIcon,
    PhoneIcon,
    MapPinIcon,
    UserGroupIcon,
    CreditCardIcon,
    PlusIcon,
    ArrowRightIcon,
    ExclamationTriangleIcon,
    DocumentDuplicateIcon,
    ShieldCheckIcon,
    ClockIcon,
    XCircleIcon,
    EnvelopeIcon,
    ServerIcon,
    ChartBarIcon,
    Cog6ToothIcon,
    BoltIcon,
} from '@heroicons/react/24/outline';
import {
    SparklesIcon as SparklesSolid,
    GlobeAltIcon as GlobeAltSolid,
    UserGroupIcon as UserGroupSolid,
} from '@heroicons/react/24/solid';
import copy from 'copy-to-clipboard';

/* ---------- Types ---------- */
interface UserBrief   { id: number; email: string; fullName: string | null }
interface DomainBrief { id: number; domain: string | null; statusDomain: string | null }
interface PlanBrief   { id?: number; name: string | null }
interface CompanyDetail {
    hash: string;
    name: string | null;
    phone_number: string | null;
    address: { street?: string; city?: string; zip?: string; country?: string } | null;
    users:   UserBrief[];
    plan?:   PlanBrief | null;
    domains?: DomainBrief[];
}

/* ---------- Components ---------- */
function StatCard({
                      title,
                      value,
                      subtitle,
                      icon,
                      color,
                      link,
                      linkText = "View all"
                  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'purple' | 'amber';
    link?: string;
    linkText?: string;
}) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        purple: 'from-purple-500 to-purple-600',
        amber: 'from-amber-500 to-amber-600',
    };

    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden group hover:shadow-lg transition-all">
            <div className={`bg-gradient-to-r ${colors[color]} p-4`}>
                <div className="flex items-center justify-between text-white">
                    {icon}
                    <span className="text-xs font-medium uppercase tracking-wider opacity-90">{title}</span>
                </div>
            </div>
            <div className="p-4">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                {subtitle && (
                    <div className="mt-1 text-sm text-gray-500">{subtitle}</div>
                )}
                {link && (
                    <Link
                        href={link}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 group-hover:gap-2 transition-all"
                    >
                        {linkText}
                        <ArrowRightIcon className="h-3 w-3" />
                    </Link>
                )}
            </div>
        </div>
    );
}

function DomainCard({ domain, hash }: { domain: DomainBrief; hash: string }) {
    const statusConfig = {
        active: {
            bgClass: 'bg-emerald-50',
            textClass: 'text-emerald-700',
            borderClass: 'border-emerald-200',
            dotClass: 'bg-emerald-500',
            icon: CheckCircleIcon,
        },
        pending: {
            bgClass: 'bg-amber-50',
            textClass: 'text-amber-700',
            borderClass: 'border-amber-200',
            dotClass: 'bg-amber-500',
            icon: ClockIcon,
        },
        failed: {
            bgClass: 'bg-red-50',
            textClass: 'text-red-700',
            borderClass: 'border-red-200',
            dotClass: 'bg-red-500',
            icon: XCircleIcon,
        },
        unknown: {
            bgClass: 'bg-gray-50',
            textClass: 'text-gray-700',
            borderClass: 'border-gray-200',
            dotClass: 'bg-gray-500',
            icon: ExclamationTriangleIcon,
        },
    };

    const status = statusConfig[domain.statusDomain as keyof typeof statusConfig] || statusConfig.unknown;
    const StatusIcon = status.icon;

    return (
        <Link
            href={`/dashboard/company/${hash}/domain/${domain.id}`}
            className={`block rounded-xl bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-lg hover:ring-indigo-200 transition-all overflow-hidden`}
        >
            <div className={`h-1 ${status.dotClass}`} />
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${status.bgClass}`}>
                            <GlobeAltIcon className={`h-5 w-5 ${status.textClass}`} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 text-sm truncate">
                                {domain.domain || 'Unknown Domain'}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">ID: {domain.id}</p>
                        </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.bgClass} ${status.textClass}`}>
                        <StatusIcon className="h-3 w-3" />
                        {domain.statusDomain || 'Unknown'}
                    </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                        <ServerIcon className="h-3 w-3" />
                        DNS Records
                    </div>
                    <div className="flex items-center gap-1">
                        <ShieldCheckIcon className="h-3 w-3" />
                        Security
                    </div>
                </div>
            </div>
        </Link>
    );
}

function UserCard({ user }: { user: UserBrief }) {
    return (
        <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                    {user.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || user.email[0].toUpperCase()}
                </div>
                <div>
                    <p className="font-medium text-gray-900 text-sm">
                        {user.fullName || <span className="italic text-gray-500">No name</span>}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                    Active
                </span>
            </div>
        </div>
    );
}

/* ---------- Main Component ---------- */
export default function CompanyDetailPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const [company, setCompany] = useState<CompanyDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Domains state
    const [domains, setDomains] = useState<DomainBrief[]>([]);
    const [domainsLoading, setDomLoading] = useState(true);
    const [domainsError, setDomError] = useState<string | null>(null);

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    // Load company
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}`, { headers: authHeaders() });
                if (res.status === 403) { setError('You don\'t have access to this company.'); return; }
                if (!res.ok) throw new Error(`Failed to load company: ${res.status}`);

                const data = await res.json();
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

    // Load domains
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains`,
                    { headers: authHeaders() }
                );
                if (res.status === 403) { setDomError('You don\'t have access to this company\'s domains.'); return; }
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

    const handleCopy = () => {
        copy(company?.hash || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="h-64 rounded-xl bg-gray-200" />
                            <div className="h-64 rounded-xl bg-gray-200" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !company) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Company</h2>
                    </div>
                    <p className="text-gray-600">{error || 'Unknown error'}</p>
                    <button
                        onClick={() => router.push('/dashboard/company')}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Companies
                    </button>
                </div>
            </div>
        );
    }

    const { address } = company;
    const hasAddress = !!(address?.street || address?.city || address?.zip || address?.country);

    const planConfig = {
        'Free': { bgClass: 'bg-gray-100', textClass: 'text-gray-700', icon: SparklesIcon },
        'Starter': { bgClass: 'bg-blue-100', textClass: 'text-blue-700', icon: BoltIcon },
        'Professional': { bgClass: 'bg-purple-100', textClass: 'text-purple-700', icon: SparklesIcon },
        'Enterprise': { bgClass: 'bg-gradient-to-r from-amber-100 to-orange-100', textClass: 'text-orange-700', icon: SparklesSolid },
    };

    const currentPlan = company.plan?.name ?
        (planConfig[company.plan.name as keyof typeof planConfig] || {
            bgClass: 'bg-gradient-to-r from-amber-100 to-orange-100',
            textClass: 'text-orange-700',
            icon: SparklesIcon
        }) : {
            bgClass: 'bg-gray-100',
            textClass: 'text-gray-700',
            icon: SparklesIcon
        };
    const PlanIcon = currentPlan.icon;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard/company')}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold text-gray-900">
                                    {company.name || 'Untitled Company'}
                                </h1>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${currentPlan.bgClass} ${currentPlan.textClass}`}>
                                    <PlanIcon className="h-3.5 w-3.5" />
                                    {company.plan?.name || 'No Plan'}
                                </span>
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                    <span className="font-mono text-xs">{company.hash}</span>
                                    <button
                                        onClick={handleCopy}
                                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 transition-colors"
                                        title="Copy hash"
                                    >
                                        {copied ? (
                                            <>
                                                <CheckCircleIcon className="h-3 w-3 text-emerald-600" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <DocumentDuplicateIcon className="h-3 w-3" />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/dashboard/company/${hash}/messaging/messages`}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                        >
                            <EnvelopeIcon className="h-4 w-4" />
                            Messages
                        </Link>
                        <Link
                            href={`/dashboard/company/${hash}/contacts`}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                        >
                            <UserGroupIcon className="h-4 w-4" />
                            Contacts
                        </Link>
                        <Link
                            href={`/dashboard/company/${hash}/settings/billing`}
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white hover:from-amber-600 hover:to-orange-700 transition-all shadow-sm"
                        >
                            <CreditCardIcon className="h-4 w-4" />
                            Manage Plan
                        </Link>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        title="Domains"
                        value={domains.length}
                        subtitle={`${domains.filter(d => d.statusDomain === 'active').length} active`}
                        icon={<GlobeAltIcon className="h-5 w-5" />}
                        color="blue"
                        link={`/dashboard/company/${hash}/domain`}
                    />
                    <StatCard
                        title="Users"
                        value={company.users.length}
                        subtitle="Team members"
                        icon={<UserGroupIcon className="h-5 w-5" />}
                        color="emerald"
                        link={`/dashboard/company/${hash}/settings/users`}
                        linkText="Manage users"
                    />
                    <StatCard
                        title="Plan"
                        value={company.plan?.name || 'Free'}
                        subtitle="Current subscription"
                        icon={<SparklesIcon className="h-5 w-5" />}
                        color="purple"
                        link={`/dashboard/company/${hash}/settings/billing`}
                        linkText="Upgrade plan"
                    />
                    <StatCard
                        title="Status"
                        value="Active"
                        subtitle="Account standing"
                        icon={<CheckCircleIcon className="h-5 w-5" />}
                        color="amber"
                    />
                </div>

                {/* Company Info Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Company Information */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider">
                                <BuildingOfficeIcon className="h-5 w-5" />
                                Company Information
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</label>
                                <p className="mt-1 text-lg font-semibold text-gray-900">{company.name || 'Not specified'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</label>
                                    <div className="mt-1 flex items-center gap-2">
                                        <PhoneIcon className="h-4 w-4 text-gray-400" />
                                        <p className="text-sm text-gray-900">
                                            {company.phone_number || <span className="text-gray-400">Not provided</span>}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Company ID</label>
                                    <p className="mt-1 text-sm font-mono text-gray-900">{company.hash.slice(0, 12)}...</p>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Current Plan</label>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${currentPlan.bgClass} ${currentPlan.textClass}`}>
                                        <PlanIcon className="h-4 w-4" />
                                        {company.plan?.name || 'No Plan'}
                                    </span>
                                    <Link
                                        href={`/dashboard/company/${hash}/settings/billing`}
                                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                    >
                                        Change plan →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider">
                                <MapPinIcon className="h-5 w-5" />
                                Business Address
                            </h2>
                        </div>
                        <div className="p-6">
                            {hasAddress ? (
                                <div className="space-y-3">
                                    {address?.street && (
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Street</label>
                                            <p className="mt-1 text-sm text-gray-900">{address.street}</p>
                                        </div>
                                    )}
                                    {(address?.city || address?.zip) && (
                                        <div className="grid grid-cols-2 gap-4">
                                            {address?.city && (
                                                <div>
                                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">City</label>
                                                    <p className="mt-1 text-sm text-gray-900">{address.city}</p>
                                                </div>
                                            )}
                                            {address?.zip && (
                                                <div>
                                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Zip Code</label>
                                                    <p className="mt-1 text-sm text-gray-900">{address.zip}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {address?.country && (
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Country</label>
                                            <p className="mt-1 text-sm text-gray-900">{address.country}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <MapPinIcon className="mx-auto h-12 w-12 text-gray-300" />
                                    <p className="mt-2 text-sm text-gray-500">No address on file</p>
                                    <Link
                                        href={`/dashboard/company/${hash}/settings/company`}
                                        className="mt-3 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                    >
                                        Add address →
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Domains Section */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider">
                                <GlobeAltSolid className="h-5 w-5" />
                                Domains ({domains.length})
                            </h2>
                            <Link
                                href={`/dashboard/company/${hash}/domain`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-100 hover:text-white transition-colors"
                            >
                                View all domains
                                <ArrowRightIcon className="h-3 w-3" />
                            </Link>
                        </div>
                    </div>

                    <div className="p-6">
                        {domainsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : domainsError ? (
                            <div className="text-center py-8">
                                <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
                                <p className="mt-2 text-sm text-red-600">{domainsError}</p>
                            </div>
                        ) : domains.length === 0 ? (
                            <div className="text-center py-12">
                                <GlobeAltIcon className="mx-auto h-12 w-12 text-gray-300" />
                                <h3 className="mt-2 text-sm font-semibold text-gray-900">No domains configured</h3>
                                <p className="mt-1 text-sm text-gray-500">Get started by adding your first domain.</p>
                                <Link
                                    href={`/dashboard/company/${hash}/domain/new`}
                                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add Domain
                                </Link>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {domains.slice(0, 6).map(domain => (
                                    <DomainCard key={domain.id} domain={domain} hash={hash} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Users Section */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider">
                                <UserGroupSolid className="h-5 w-5" />
                                Team Members ({company.users.length})
                            </h2>
                            <Link
                                href={`/dashboard/company/${hash}/settings/users`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-purple-100 hover:text-white transition-colors"
                            >
                                Manage users
                                <ArrowRightIcon className="h-3 w-3" />
                            </Link>
                        </div>
                    </div>

                    <div className="p-6">
                        {company.users.length === 0 ? (
                            <div className="text-center py-12">
                                <UserGroupIcon className="mx-auto h-12 w-12 text-gray-300" />
                                <h3 className="mt-2 text-sm font-semibold text-gray-900">No users added</h3>
                                <p className="mt-1 text-sm text-gray-500">Invite team members to collaborate.</p>
                                <Link
                                    href={`/dashboard/company/${hash}/settings/users/invite`}
                                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Invite User
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {company.users.slice(0, 5).map(user => (
                                    <UserCard key={user.id} user={user} />
                                ))}
                                {company.users.length > 5 && (
                                    <div className="text-center pt-2">
                                        <Link
                                            href={`/dashboard/company/${hash}/settings/users`}
                                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                        >
                                            View all {company.users.length} users →
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Links */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        href={`/dashboard/company/${hash}/messaging/messages`}
                        className="group rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6 hover:shadow-lg hover:ring-indigo-200 transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="rounded-lg bg-blue-100 p-2">
                                        <EnvelopeIcon className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900">Email Messages</h3>
                                </div>
                                <p className="text-sm text-gray-500">View and manage email communications</p>
                            </div>
                            <ArrowRightIcon className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </div>
                    </Link>

                    <Link
                        href={`/dashboard/company/${hash}/usage`}
                        className="group rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6 hover:shadow-lg hover:ring-indigo-200 transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="rounded-lg bg-emerald-100 p-2">
                                        <ChartBarIcon className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900">Analytics</h3>
                                </div>
                                <p className="text-sm text-gray-500">Track performance and metrics</p>
                            </div>
                            <ArrowRightIcon className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </div>
                    </Link>

                    <Link
                        href={`/dashboard/company/${hash}/settings/billing`}
                        className="group rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6 hover:shadow-lg hover:ring-indigo-200 transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="rounded-lg bg-purple-100 p-2">
                                        <Cog6ToothIcon className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900">Settings</h3>
                                </div>
                                <p className="text-sm text-gray-500">Configure company preferences</p>
                            </div>
                            <ArrowRightIcon className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}