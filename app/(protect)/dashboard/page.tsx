'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    CheckCircleIcon,
    XCircleIcon,
    GlobeAltIcon,
    EnvelopeIcon,
    UsersIcon,
    PlusIcon,
    BuildingOfficeIcon,
    SparklesIcon,
    ArrowRightIcon,
    ExclamationTriangleIcon,
    CalendarIcon,
    BoltIcon,
} from '@heroicons/react/24/outline';
import {
    SparklesIcon as SparklesSolid,
} from '@heroicons/react/24/solid';

/* ----------------------------- Types ----------------------------- */

type CompanyCard = {
    hash: string;
    name: string | null;
    status: boolean;
    statusText?: string;
    createdAt?: string | null;
    plan?: { id?: number | null; name?: string | null } | null;
    counts: { domains: number; messages: number; users: number };
};

type Me = { id: number; email: string; fullName?: string | null };

/* ----------------------------- Utils ----------------------------- */

const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
        return new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
        }).format(new Date(iso));
    } catch {
        return '—';
    }
};

const n = (x: unknown, d = 0) =>
    typeof x === 'number' && Number.isFinite(x) ? x : d;

/* ----------------------------- Components ----------------------------- */

function CompanyCardComponent({ company }: { company: CompanyCard }) {
    const planConfig = {
        'Free': { bgClass: 'bg-gray-100', textClass: 'text-gray-700', icon: SparklesIcon },
        'Starter': { bgClass: 'bg-blue-100', textClass: 'text-blue-700', icon: BoltIcon },
        'Professional': { bgClass: 'bg-purple-100', textClass: 'text-purple-700', icon: SparklesIcon },
        'Enterprise': { bgClass: 'bg-gradient-to-r from-amber-100 to-orange-100', textClass: 'text-orange-700', icon: SparklesSolid },
    };

    const currentPlan = company.plan?.name ?
        (planConfig[company.plan.name as keyof typeof planConfig] || {
            bgClass: 'bg-gray-100',
            textClass: 'text-gray-700',
            icon: SparklesIcon
        }) : {
            bgClass: 'bg-gray-100',
            textClass: 'text-gray-700',
            icon: SparklesIcon
        };
    const PlanIcon = currentPlan.icon;

    return (
        <Link
            href={`/dashboard/company/${encodeURIComponent(company.hash)}`}
            className="group block rounded-xl bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-lg hover:ring-indigo-200 transition-all overflow-hidden"
        >
            {/* Company Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-4">
                <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-white/20 p-2">
                            <BuildingOfficeIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">
                                {company.name ?? 'Untitled Company'}
                            </h3>
                            <p className="text-xs text-indigo-100 mt-0.5">
                                ID: {company.hash.slice(0, 8)}...
                            </p>
                        </div>
                    </div>
                    <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                            company.status
                                ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30'
                                : 'bg-red-500/20 text-red-100 ring-1 ring-red-400/30'
                        }`}
                        title={company.statusText}
                    >
                        {company.status ? (
                            <CheckCircleIcon className="h-3 w-3" />
                        ) : (
                            <XCircleIcon className="h-3 w-3" />
                        )}
                        {company.statusText ?? (company.status ? 'Active' : 'Inactive')}
                    </span>
                </div>
            </div>

            {/* Company Content */}
            <div className="p-5">
                {/* Plan Badge */}
                <div className="flex items-center justify-between mb-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${currentPlan.bgClass} ${currentPlan.textClass}`}>
                        <PlanIcon className="h-3.5 w-3.5" />
                        {company.plan?.name || 'Free'}
                    </span>
                    <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg bg-blue-50 p-3 text-center">
                        <div className="flex items-center justify-center mb-1">
                            <GlobeAltIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="text-lg font-bold text-blue-900">{company.counts.domains}</div>
                        <div className="text-xs text-blue-600 font-medium">Domains</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3 text-center">
                        <div className="flex items-center justify-center mb-1">
                            <EnvelopeIcon className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="text-lg font-bold text-emerald-900">{company.counts.messages}</div>
                        <div className="text-xs text-emerald-600 font-medium">Messages</div>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-3 text-center">
                        <div className="flex items-center justify-center mb-1">
                            <UsersIcon className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="text-lg font-bold text-purple-900">{company.counts.users}</div>
                        <div className="text-xs text-purple-600 font-medium">Users</div>
                    </div>
                </div>

                {/* Created Date */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <CalendarIcon className="h-3 w-3" />
                    Created {formatDate(company.createdAt)}
                </div>
            </div>
        </Link>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-16">
            <div className="rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <BuildingOfficeIcon className="h-12 w-12 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No companies yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Get started by creating your first company. You&#39;ll be able to manage domains, users, and email communications.
            </p>
            <Link
                href="/dashboard/company/new"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-white font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
            >
                <PlusIcon className="h-5 w-5" />
                Create Your First Company
            </Link>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
                <div className="h-8 w-64 bg-gray-200 rounded-lg" />
                <div className="h-10 w-40 bg-gray-200 rounded-lg" />
            </div>

            {/* Cards Skeleton */}
            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="h-20 bg-gray-200" />
                        <div className="p-5 space-y-4">
                            <div className="flex justify-between">
                                <div className="h-6 w-20 bg-gray-200 rounded-full" />
                                <div className="h-4 w-4 bg-gray-200 rounded" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="h-16 bg-gray-100 rounded-lg" />
                                <div className="h-16 bg-gray-100 rounded-lg" />
                                <div className="h-16 bg-gray-100 rounded-lg" />
                            </div>
                            <div className="h-4 w-32 bg-gray-200 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ErrorState({ error }: { error: string }) {
    return (
        <div className="text-center py-16">
            <div className="rounded-full bg-red-100 p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <ExclamationTriangleIcon className="h-12 w-12 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Unable to load companies</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">{error}</p>
            <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-3 text-white font-medium hover:bg-gray-800 transition-colors"
            >
                Try Again
            </button>
        </div>
    );
}

/* ------------------------------ Page ------------------------------ */

export default function DashboardPage() {
    const router = useRouter();
    const [me, setMe] = useState<Me | null>(null);
    const [companies, setCompanies] = useState<CompanyCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    useEffect(() => {
        (async () => {
            try {
                // Load user data
                const meRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`, { headers: authHeaders() });
                const meJson: unknown = await meRes.json();
                if (!meRes.ok) throw new Error(`Failed to load user (${meRes.status})`);
                if (isObj(meJson) && typeof meJson.redirectTo === 'string') {
                    router.push(meJson.redirectTo);
                    return;
                }
                if (!isObj(meJson) || typeof meJson.id !== 'number' || typeof meJson.email !== 'string') {
                    throw new Error('Unexpected /auth/me response');
                }
                setMe({ id: meJson.id, email: meJson.email, fullName: (meJson.fullName as string) ?? null });

                // Load companies
                const cRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/list-full`, {
                    headers: authHeaders(),
                });
                if (!cRes.ok) throw new Error(`Failed to load companies (${cRes.status})`);
                const raw: unknown = await cRes.json();
                const arr = Array.isArray(raw) ? raw : [];
                const parsed: CompanyCard[] = arr
                    .map((v) => {
                        if (!isObj(v)) return null;
                        const hash = typeof v.hash === 'string' ? v.hash : null;
                        const name = typeof v.name === 'string' ? v.name : null;
                        const status = Boolean(v.status);
                        const statusText =
                            typeof v.statusText === 'string'
                                ? v.statusText
                                : status
                                    ? 'active'
                                    : 'inactive';
                        const createdAt =
                            typeof v.createdAt === 'string' ? v.createdAt : null;
                        const plan = isObj(v.plan)
                            ? { id: (v.plan.id as number) ?? null, name: (v.plan.name as string) ?? null }
                            : null;
                        const countsObj = isObj(v.counts) ? v.counts : {};
                        const counts = {
                            domains: n(countsObj.domains),
                            messages: n(countsObj.messages),
                            users: n(countsObj.users),
                        };
                        if (!hash) return null;
                        return { hash, name, status, statusText, createdAt, plan, counts };
                    })
                    .filter(Boolean) as CompanyCard[];

                setCompanies(parsed);
            } catch (e) {
                setErr(e instanceof Error ? e.message : 'Something went wrong');
            } finally {
                setLoading(false);
            }
        })();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto p-6">
                    <LoadingState />
                </div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto p-6">
                    <ErrorState error={err} />
                </div>
            </div>
        );
    }

    if (!me) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-8">
                {/* Header */}
                <header>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900">
                                Welcome back, {me.fullName?.trim() || me.email.split('@')[0]}!
                            </h1>
                            <p className="mt-2 text-lg text-gray-600">
                                Manage your companies and grow your business
                            </p>
                        </div>
                        <Link
                            href="/dashboard/company/new"
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-white font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                        >
                            <PlusIcon className="h-5 w-5" />
                            New Company
                        </Link>
                    </div>
                </header>

                {/* Summary Stats */}
                {companies.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
                                <div className="flex items-center justify-between text-white">
                                    <BuildingOfficeIcon className="h-6 w-6" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Companies</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="text-2xl font-bold text-gray-900">{companies.length}</div>
                                <div className="text-sm text-gray-500">Total organizations</div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4">
                                <div className="flex items-center justify-between text-white">
                                    <GlobeAltIcon className="h-6 w-6" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Domains</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="text-2xl font-bold text-gray-900">
                                    {companies.reduce((sum, c) => sum + c.counts.domains, 0)}
                                </div>
                                <div className="text-sm text-gray-500">Active domains</div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4">
                                <div className="flex items-center justify-between text-white">
                                    <EnvelopeIcon className="h-6 w-6" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Messages</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="text-2xl font-bold text-gray-900">
                                    {companies.reduce((sum, c) => sum + c.counts.messages, 0)}
                                </div>
                                <div className="text-sm text-gray-500">Total messages</div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4">
                                <div className="flex items-center justify-between text-white">
                                    <UsersIcon className="h-6 w-6" />
                                    <span className="text-xs font-medium uppercase tracking-wider">Team</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="text-2xl font-bold text-gray-900">
                                    {companies.reduce((sum, c) => sum + c.counts.users, 0)}
                                </div>
                                <div className="text-sm text-gray-500">Team members</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Companies Section */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Your Companies</h2>
                        {companies.length > 0 && (
                            <p className="text-sm text-gray-500">
                                {companies.length} {companies.length === 1 ? 'company' : 'companies'}
                            </p>
                        )}
                    </div>

                    {companies.length === 0 ? (
                        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <EmptyState />
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                            {companies.map((company) => (
                                <CompanyCardComponent key={company.hash} company={company} />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}