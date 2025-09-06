'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    TrashIcon,
    PlusIcon,
    ArrowLeftIcon,
    KeyIcon,
    ClockIcon,
    CalendarIcon,
    ShieldCheckIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    InformationCircleIcon,
    CommandLineIcon,
} from '@heroicons/react/24/outline';
import {
    KeyIcon as KeySolid,
} from '@heroicons/react/24/solid';

export type KeysTabProps = {
    backendUrl: string;
    companyHash: string;
    domainId: number;
    authHeaders: () => HeadersInit;
};

type ApiKeyRaw = {
    id: number;
    label: string | null;
    prefix: string;
    scopes: string[] | string | null;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
    domain_id?: number | null;
};

type ApiKey = Omit<ApiKeyRaw, 'scopes'> & { scopes: string[] };

type DomainDetail = {
    id: number;
    domain: string;
    hash: string;
    company: { id: number; name: string; hash: string };
};

function formatDate(s?: string | null, format: 'full' | 'short' = 'full'): string {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;

    if (format === 'short') {
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }

    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getTimeAgo(dateStr?: string | null): string {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

function KeyCard({
                     apiKey,
                     onDelete,
                     isDeleting
                 }: {
    apiKey: ApiKey;
    onDelete: (id: number) => void;
    isDeleting: boolean;
}) {
    const isRevoked = !!apiKey.revoked_at;
    const isRecent = apiKey.last_used_at &&
        (new Date().getTime() - new Date(apiKey.last_used_at).getTime()) < 7 * 24 * 60 * 60 * 1000;

    return (
        <div className={`rounded-xl bg-white shadow-sm ring-1 overflow-hidden transition-all hover:shadow-lg ${
            isRevoked ? 'ring-red-200 bg-red-50/30' : 'ring-gray-200 hover:ring-indigo-200'
        }`}>
            <div className={`h-1 ${isRevoked ? 'bg-red-500' : isRecent ? 'bg-emerald-500' : 'bg-gray-300'}`} />

            <div className="p-5">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                        <div className={`rounded-lg p-2 ${
                            isRevoked ? 'bg-red-100' : 'bg-indigo-100'
                        }`}>
                            <KeyIcon className={`h-5 w-5 ${
                                isRevoked ? 'text-red-600' : 'text-indigo-600'
                            }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-base font-semibold text-gray-900">
                                    {apiKey.label || <span className="italic text-gray-400">Unnamed Key</span>}
                                </h3>
                                {isRevoked && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                        <XCircleIcon className="h-3 w-3" />
                                        Revoked
                                    </span>
                                )}
                                {!isRevoked && isRecent && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                        <CheckCircleIcon className="h-3 w-3" />
                                        Active
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <CommandLineIcon className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-600">Prefix:</span>
                                    <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-900">
                                        {apiKey.prefix}
                                    </code>
                                </div>

                                <div className="flex items-start gap-2">
                                    <ShieldCheckIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <span className="text-sm text-gray-600">Scopes:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {apiKey.scopes.length > 0 ? (
                                            apiKey.scopes.map((scope, idx) => (
                                                <span
                                                    key={idx}
                                                    className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200"
                                                >
                                                    {scope}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-gray-400">No scopes defined</span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <CalendarIcon className="h-3.5 w-3.5" />
                                        <div>
                                            <span className="text-gray-400">Created:</span>
                                            <span className="ml-1 font-medium text-gray-600">
                                                {formatDate(apiKey.created_at, 'short')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <ClockIcon className="h-3.5 w-3.5" />
                                        <div>
                                            <span className="text-gray-400">Last used:</span>
                                            <span className="ml-1 font-medium text-gray-600">
                                                {getTimeAgo(apiKey.last_used_at)}
                                            </span>
                                        </div>
                                    </div>

                                    {apiKey.revoked_at && (
                                        <div className="flex items-center gap-2 text-xs text-red-600">
                                            <XCircleIcon className="h-3.5 w-3.5" />
                                            <div>
                                                <span className="text-red-400">Revoked:</span>
                                                <span className="ml-1 font-medium">
                                                    {formatDate(apiKey.revoked_at, 'short')}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => onDelete(apiKey.id)}
                        disabled={isDeleting}
                        className={`ml-3 p-2 rounded-lg transition-all ${
                            isDeleting
                                ? 'bg-red-50 text-red-400 cursor-not-allowed'
                                : 'bg-red-100 text-red-600 hover:bg-red-200 hover:scale-105'
                        }`}
                        title="Delete API key"
                    >
                        <TrashIcon className={`h-5 w-5 ${isDeleting ? 'animate-pulse' : ''}`} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function KeysTab({
                                    backendUrl,
                                    companyHash,
                                    domainId,
                                    authHeaders,
                                }: KeysTabProps) {
    const router = useRouter();

    const [keys, setKeys] = React.useState<ApiKey[]>([]);
    const [domainDetail, setDomainDetail] = React.useState<DomainDetail | null>(null);

    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [deletingId, setDeletingId] = React.useState<number | null>(null);

    const listEndpoint = React.useMemo(
        () => `${backendUrl}/companies/${companyHash}/domains/${domainId}/apikeys`,
        [backendUrl, companyHash, domainId],
    );

    const domainEndpoint = React.useMemo(
        () => `${backendUrl}/companies/${companyHash}/domains/${domainId}`,
        [backendUrl, companyHash, domainId],
    );

    // Load keys
    React.useEffect(() => {
        let abort = false;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(listEndpoint, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load API keys (${res.status})`);
                const data: ApiKeyRaw[] = await res.json();

                const normalized: ApiKey[] = (data || []).map((k) => {
                    let scopes: string[] = [];
                    if (Array.isArray(k.scopes)) {
                        scopes = k.scopes.map(String).map((s) => s.trim()).filter(Boolean);
                    } else if (typeof k.scopes === 'string') {
                        scopes = k.scopes.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
                    }
                    return { ...k, scopes };
                });

                if (!abort) setKeys(normalized);
            } catch (e) {
                if (!abort) setError(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();

        return () => {
            abort = true;
        };
    }, [listEndpoint, authHeaders]);

    // Load domain details
    React.useEffect(() => {
        let abort = false;

        (async () => {
            try {
                const res = await fetch(domainEndpoint, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load domain (${res.status})`);
                const data: DomainDetail = await res.json();
                if (!abort) setDomainDetail(data);
            } catch (e) {
                console.error(e);
            }
        })();

        return () => {
            abort = true;
        };
    }, [domainEndpoint, authHeaders]);

    async function handleDelete(keyId: number) {
        if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) return;

        setDeletingId(keyId);
        try {
            const deleteUrl = `${backendUrl}/companies/${companyHash}/domains/${domainId}/apikeys/${keyId}`;
            const res = await fetch(deleteUrl, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) throw new Error(`Delete failed (${res.status})`);
            setKeys((arr) => arr.filter((k) => k.id !== keyId));
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    const backHref = `/dashboard/company/${companyHash}/domain/${domainId}`;
    const createHref = `/dashboard/company/${companyHash}/domain/${domainId}/apikeys/create`;

    // Loading state
    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-600">Loading API keys...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-center max-w-md">
                    <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
                    <h3 className="mt-2 text-lg font-semibold text-gray-900">Error Loading Keys</h3>
                    <p className="mt-1 text-sm text-red-600">{error}</p>
                    <button
                        onClick={() => router.push(backHref)}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Calculate stats
    const activeKeys = keys.filter(k => !k.revoked_at).length;
    const revokedKeys = keys.filter(k => k.revoked_at).length;
    const recentlyUsed = keys.filter(k => {
        if (!k.last_used_at || k.revoked_at) return false;
        return (new Date().getTime() - new Date(k.last_used_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
    }).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-white">
                            <KeySolid className="h-6 w-6" />
                            <div>
                                <h2 className="text-lg font-semibold">
                                    API Keys for {domainDetail?.domain || `Domain #${domainId}`}
                                </h2>
                                <p className="text-xs text-indigo-100 mt-0.5">
                                    Manage authentication keys for API access
                                </p>
                            </div>
                        </div>
                        <Link
                            href={createHref}
                            className="inline-flex items-center gap-2 rounded-lg bg-white/20 backdrop-blur px-4 py-2 text-sm font-medium text-white hover:bg-white/30 transition-all"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Create New Key
                        </Link>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="bg-gray-50 px-6 py-3 border-t border-indigo-400/20">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{activeKeys}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Active Keys</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-emerald-600">{recentlyUsed}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Recently Used</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-red-600">{revokedKeys}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Revoked</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Note */}
            {keys.length > 0 && (
                <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4 border border-blue-200">
                    <InformationCircleIcon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                        <strong>Security Note:</strong> API keys provide programmatic access to your domain.
                        Keep them secure and revoke any keys that are no longer needed.
                        Keys that haven&#39;t been used in over 90 days should be reviewed for removal.
                    </div>
                </div>
            )}

            {/* Keys List */}
            {keys.length === 0 ? (
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-12">
                    <div className="text-center">
                        <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <KeyIcon className="h-6 w-6 text-gray-400" />
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-gray-900">No API Keys</h3>
                        <p className="mt-2 text-sm text-gray-500">
                            Get started by creating your first API key for this domain.
                        </p>
                        <Link
                            href={createHref}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Create Your First Key
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {keys.map((key) => (
                        <KeyCard
                            key={key.id}
                            apiKey={key}
                            onDelete={handleDelete}
                            isDeleting={deletingId === key.id}
                        />
                    ))}
                </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
                <button
                    onClick={() => router.push(backHref)}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back to Domain
                </button>

                {keys.length > 0 && (
                    <Link
                        href={createHref}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Add Another Key
                    </Link>
                )}
            </div>
        </div>
    );
}