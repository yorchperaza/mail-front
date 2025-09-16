'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    GlobeAltIcon,
    ExclamationTriangleIcon,
    PlusIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type ApiError = { error: true; message: string; fields?: Record<string, string> };

/* --------------------------- UI Helpers -------------------------- */

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
    } as const;

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

function GradientSection({
                             icon,
                             title,
                             from,
                             to,
                             children,
                         }: {
    icon: React.ReactNode;
    title: string;
    from: string;
    to: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className={`bg-gradient-to-r ${from} ${to} px-6 py-4`}>
                <div className="flex items-center gap-2 text-white">
                    {icon}
                    <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
                </div>
            </div>
            <div className="p-6 space-y-4">{children}</div>
        </div>
    );
}

/* ---------------------------- Utilities -------------------------- */

const DOMAIN_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

/* ---------------------------- Page ------------------------------- */

export default function CreateDomainPage() {
    const router = useRouter();
    const params = useParams<{ hash: string }>();
    const hash = params.hash;

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const backHref = `/dashboard/company/${hash}/domain`;

    // Form state
    const [domain, setDomain] = useState('');
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState<ApiError | null>(null);
    const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);

    const showToast = (kind: 'info' | 'success' | 'error', text: string) => {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 3000);
    };

    const domainErr = useMemo(() => {
        const v = domain.trim();
        if (!v) return 'Domain is required';
        if (!DOMAIN_RE.test(v)) return 'Enter a valid domain (e.g. example.com)';
        return null;
    }, [domain]);

    const canSubmit = useMemo(() => !saving && !domainErr && !!domain.trim(), [saving, domainErr, domain]);

    async function onCreate() {
        if (!backend) return setApiError({ error: true, message: 'Missing backend URL' });
        if (domainErr) return;

        setSaving(true);
        setApiError(null);

        try {
            const res = await fetch(`${backend}/companies/${hash}/domains`, {
                method: 'POST',
                headers: authHeaders(),

                body: JSON.stringify({ domain: domain.trim().toLowerCase() }),
            });

            if (res.type === 'opaqueredirect') {
                // fallback if API does a cross-origin redirect we can't read
                router.push(`/dashboard/company/${hash}/domain`);
                return;
            }

            if (!res.ok) {
                const isJson = res.headers.get('content-type')?.includes('application/json');
                const errJson: ApiError =
                    (isJson ? await res.json().catch(() => null) : null) ||
                    ({ error: true, message: `Create failed (${res.status})` } as ApiError);
                setApiError(errJson);
                showToast('error', errJson.message || 'Create failed');
                return;
            }

            const payload = (await res.json()) as { id?: number };
            if (!payload?.id) {
                router.push(`/dashboard/company/${hash}/domain`);
                return;
            }

            router.push(`/dashboard/company/${hash}/domain/${payload.id}?tab=records`);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setApiError({ error: true, message });
            showToast('error', message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-3xl mx-auto p-6 space-y-6">
                {toast && <Toast kind={toast.kind} text={toast.text} onClose={() => setToast(null)} />}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(backHref)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Domains
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Add New Domain</h1>
                            <p className="text-sm text-gray-500">Connect a sending domain and verify DNS</p>
                        </div>
                    </div>
                </div>

                {/* Create Domain */}
                <GradientSection icon={<GlobeAltIcon className="h-5 w-5" />} title="Domain Details" from="from-blue-500" to="to-blue-600">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <GlobeAltIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                            Domain *
                        </label>
                        <input
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            placeholder="example.com"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            inputMode="url"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            disabled={saving}
                        />
                        {domainErr && (
                            <p className="mt-2 text-sm text-rose-700 flex items-start gap-2">
                                <ExclamationTriangleIcon className="h-4 w-4 mt-0.5" /> {domainErr}
                            </p>
                        )}
                    </div>

                    {apiError && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 flex items-start gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4 text-rose-600 mt-0.5" />
                            <div className="text-sm text-rose-800">{apiError.message}</div>
                        </div>
                    )}

                    <button
                        onClick={onCreate}
                        disabled={!canSubmit}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    >
                        <PlusIcon className="h-5 w-5" />
                        {saving ? 'Adding…' : 'Add Domain'}
                    </button>

                </GradientSection>

                {/* Helpful link */}
                <div className="flex justify-between">
                    <Link href={backHref} className="text-sm text-gray-600 hover:text-gray-800 transition-colors">
                        ← Back to all domains
                    </Link>
                </div>
            </div>
        </div>
    );
}
