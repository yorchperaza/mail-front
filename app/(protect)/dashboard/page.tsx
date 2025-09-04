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
} from '@heroicons/react/24/outline';

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
type MeRedirect = { redirectTo: string };

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
                // me
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

                // companies (full)
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
            <div className="min-h-screen p-6">
                <div className="mx-auto max-w-5xl animate-pulse space-y-4">
                    <div className="h-7 w-64 bg-gray-200 rounded" />
                    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-40 rounded-2xl border bg-white" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="min-h-screen p-6 flex items-center justify-center">
                <p className="text-red-600">{err}</p>
            </div>
        );
    }

    if (!me) return null;

    return (
        <div className="min-h-screen p-6 bg-gray-50">
            <header className="mx-auto max-w-5xl mb-8">
                <h1 className="text-3xl font-bold">
                    Welcome, {me.fullName?.trim() || me.email}!
                </h1>
            </header>

            <section className="mx-auto max-w-5xl">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold">Your Companies</h2>

                    <Link
                        href="/dashboard/company/new"
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-3 py-2 text-white hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span>New company</span>
                    </Link>
                </div>

                {companies.length === 0 ? (
                    <p className="text-gray-500">You’re not part of any companies yet.</p>
                ) : (
                    <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                        {companies.map((c) => (
                            <li key={c.hash}>
                                <Link
                                    href={`/dashboard/company/${encodeURIComponent(c.hash)}`}
                                    className="block rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-md transition"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-lg font-semibold">
                                                {c.name ?? 'Untitled company'}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {c.plan?.name ? `Plan: ${c.plan.name}` : 'No plan'}
                                            </p>
                                        </div>
                                        <span
                                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                                c.status
                                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                                            }`}
                                            title={c.statusText}
                                        >
                      {c.status ? (
                          <CheckCircleIcon className="h-4 w-4" />
                      ) : (
                          <XCircleIcon className="h-4 w-4" />
                      )}
                                            {c.statusText ?? (c.status ? 'active' : 'inactive')}
                    </span>
                                    </div>

                                    <div className="mt-4 grid grid-cols-3 gap-2">
                                        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                                            <div className="flex items-center gap-1 text-gray-500">
                                                <GlobeAltIcon className="h-4 w-4" />
                                                Domains
                                            </div>
                                            <div className="mt-1 font-semibold">{c.counts.domains}</div>
                                        </div>
                                        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                                            <div className="flex items-center gap-1 text-gray-500">
                                                <EnvelopeIcon className="h-4 w-4" />
                                                Messages
                                            </div>
                                            <div className="mt-1 font-semibold">{c.counts.messages}</div>
                                        </div>
                                        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                                            <div className="flex items-center gap-1 text-gray-500">
                                                <UsersIcon className="h-4 w-4" />
                                                Users
                                            </div>
                                            <div className="mt-1 font-semibold">{c.counts.users}</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 text-xs text-gray-500">
                                        Created {formatDate(c.createdAt)}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
