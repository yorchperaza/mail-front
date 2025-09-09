'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    GlobeAltIcon,
    TagIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
    PlusIcon
} from '@heroicons/react/24/outline';
import {
    KeyIcon as KeySolid,
    CheckCircleIcon as CheckCircleSolid,
    ClipboardDocumentIcon as ClipboardSolid
} from '@heroicons/react/24/solid';
import copy from 'copy-to-clipboard';

/* ----------------------------- Types ----------------------------- */
interface ApiError {
    error: true;
    message: string;
    fields?: Record<string, string>;
}

type DomainBrief = {
    id: number;
    domain: string | null;
};

const AVAILABLE_SCOPES = [
    { value: 'mail:send', label: 'Send Mail', description: 'Send individual emails' },
    { value: 'mail:send:list', label: 'Send to Lists', description: 'Send emails to mailing lists' },
    { value: 'mail:send:segment', label: 'Send to Segment', description: 'Send targeted campaigns' },
    { value: 'mail:read', label: 'Read Mail', description: 'Access email data and analytics' },
    { value: 'domains:list', label: 'List Domains', description: 'View domain configurations' },
    { value: 'users:manage', label: 'Manage Users', description: 'Add, edit, and remove users' },
];

/* ----------------------------- Helpers ---------------------------- */
function authHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ------------------------------ Page ------------------------------ */
export default function CreateDomainApiKeyPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();

    // form state
    const [label, setLabel] = useState('');
    const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);

    // domain selection (REQUIRED)
    const [domains, setDomains] = useState<DomainBrief[]>([]);
    const [domainId, setDomainId] = useState<number | null>(null);

    // ux
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState<ApiError | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [loadingDomains, setLoadingDomains] = useState(true);
    const [domainError, setDomainError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // load company's domains for the dropdown
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingDomains(true);
            setDomainError(null);
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains`,
                    { headers: authHeaders() }
                );
                if (res.status === 403) throw new Error('You don&#39;t have access to this company&#39;s domains.');
                if (!res.ok) throw new Error(`Failed to load domains (${res.status})`);
                const data = (await res.json()) as DomainBrief[];
                if (!cancelled) {
                    const items = Array.isArray(data) ? data : [];
                    setDomains(items);
                    // preselect if there's only one domain
                    if (items.length === 1) setDomainId(items[0].id);
                }
            } catch (e) {
                if (!cancelled) setDomainError(e instanceof Error ? e.message : 'Failed to load domains.');
            } finally {
                if (!cancelled) setLoadingDomains(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [hash]);

    const sortedDomains = useMemo(
        () => [...domains].sort((a, b) => (a.domain ?? '').localeCompare(b.domain ?? '')),
        [domains]
    );

    const toggleScope = (scope: string) => {
        setSelectedScopes((prev) =>
            prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
        );
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedScopes([]);
        } else {
            setSelectedScopes(AVAILABLE_SCOPES.map((s) => s.value));
        }
        setSelectAll((v) => !v);
    };

    const handleCopySecret = () => {
        if (secret) {
            copy(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setApiError(null);

        if (!domainId) {
            setApiError({ error: true, message: 'Please choose a domain', fields: { domain: 'Required' } });
            return;
        }
        if (!label.trim()) {
            setApiError({ error: true, message: 'Label is required', fields: { label: 'Required' } });
            return;
        }
        if (selectedScopes.length === 0) {
            setApiError({
                error: true,
                message: 'At least one scope must be selected',
                fields: { scopes: 'Select one or more' },
            });
            return;
        }

        setSaving(true);

        try {
            const payload = { label: label.trim(), scopes: selectedScopes };

            // Always domain-scoped
            const endpoint = `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains/${domainId}/apikeys`;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                let errJson: ApiError | null = null;
                try {
                    errJson = (await res.json()) as ApiError;
                } catch {}
                setApiError(errJson ?? { error: true, message: `Failed to create key (${res.status})` });
                setSaving(false);
                return;
            }

            const { secret: newSecret } = (await res.json()) as { secret: string };
            setSecret(newSecret);
        } catch (err) {
            setApiError({
                error: true,
                message: err instanceof Error ? err.message : 'Unexpected error',
            });
        } finally {
            setSaving(false);
        }
    }

    /* -------------------------- Secret screen -------------------------- */
    if (secret) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-2xl mx-auto p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">API Key Created Successfully</h1>
                            <p className="text-sm text-gray-500">Your new API key is ready to use</p>
                        </div>
                    </div>

                    {/* Success Card */}
                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
                            <div className="flex items-center gap-3 text-white">
                                <CheckCircleSolid className="h-6 w-6" />
                                <div>
                                    <h2 className="text-lg font-semibold">API Key Created</h2>
                                    <p className="text-sm text-green-100">Copy your secret now — you won&#39;t see it again</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Secret Display */}
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700">Your API Secret</label>
                                <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200">
                                    <code className="flex-1 font-mono text-sm break-all text-gray-900 bg-white px-3 py-2 rounded-lg border">{secret}</code>
                                    <button
                                        onClick={handleCopySecret}
                                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                                            copied
                                                ? 'bg-green-100 text-green-700 border border-green-200'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                                        }`}
                                        title="Copy to clipboard"
                                    >
                                        {copied ? (
                                            <>
                                                <CheckCircleSolid className="h-4 w-4" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <ClipboardSolid className="h-4 w-4" />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                                    Store this secret securely. For security reasons, it won&#39;t be shown again.
                                </p>
                            </div>

                            {/* Key Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                                <div>
                                    <span className="text-sm font-medium text-gray-500">Label</span>
                                    <p className="text-sm text-gray-900 font-medium">{label}</p>
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-gray-500">Domain</span>
                                    <p className="text-sm text-gray-900 font-medium">
                                        {domains.find(d => d.id === domainId)?.domain || 'Unknown'}
                                    </p>
                                </div>
                                <div className="md:col-span-2">
                                    <span className="text-sm font-medium text-gray-500">Scopes</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {selectedScopes.map((scope) => (
                                            <span key={scope} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                                                <ShieldCheckIcon className="h-3 w-3" />
                                                {AVAILABLE_SCOPES.find(s => s.value === scope)?.label || scope}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => router.push(`/dashboard/company/${hash}/settings/apikeys`)}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                                >
                                    <KeySolid className="h-4 w-4" />
                                    View All API Keys
                                </button>
                                <button
                                    onClick={() => {
                                        setSecret(null);
                                        setLabel('');
                                        setSelectedScopes([]);
                                        setSelectAll(false);
                                        setDomainId(domains.length === 1 ? domains[0].id : null);
                                        setCopied(false);
                                    }}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Create Another Key
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ------------------------------ Form ------------------------------ */
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-2xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back
                    </button>
                    <div className="h-8 w-px bg-gray-200" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Create API Key</h1>
                        <p className="text-sm text-gray-500">Generate a new API key for domain-specific access</p>
                    </div>
                </div>

                {/* Error Alert */}
                {apiError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                            <p className="text-red-800 font-medium">{apiError.message}</p>
                        </div>
                    </div>
                )}

                {/* Form Card */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                            <KeySolid className="h-5 w-5" />
                            <h2 className="text-lg font-semibold">API Key Configuration</h2>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Domain Selection */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                                <GlobeAltIcon className="h-4 w-4" />
                                Target Domain <span className="text-red-500">*</span>
                            </label>
                            {loadingDomains ? (
                                <div className="h-12 w-full animate-pulse rounded-lg bg-gray-100" />
                            ) : domainError ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                                    <div className="flex items-center gap-2 text-amber-900">
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                        <span className="text-sm">{domainError}</span>
                                    </div>
                                </div>
                            ) : domains.length === 0 ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                                    <div className="flex items-center gap-2 text-amber-900">
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                        <span className="text-sm">No domains available. Add a domain first.</span>
                                    </div>
                                </div>
                            ) : (
                                <select
                                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    value={domainId ?? ''}
                                    onChange={(e) => setDomainId(Number(e.target.value) || null)}
                                    required
                                >
                                    <option value="" disabled>
                                        Select a domain for this API key…
                                    </option>
                                    {sortedDomains.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.domain ?? `Domain #${d.id}`}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {apiError?.fields?.domain && (
                                <p className="mt-2 text-sm text-red-600">{apiError.fields.domain}</p>
                            )}
                        </div>

                        {/* Label */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                                <TagIcon className="h-4 w-4" />
                                API Key Label <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                placeholder="e.g. Production CI/CD Pipeline, Development Environment"
                                required
                            />
                            <p className="mt-1 text-xs text-gray-500">Give your API key a descriptive name to help identify its purpose</p>
                            {apiError?.fields?.label && (
                                <p className="mt-2 text-sm text-red-600">{apiError.fields.label}</p>
                            )}
                        </div>

                        {/* Scopes */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <ShieldCheckIcon className="h-4 w-4" />
                                    Permissions & Scopes <span className="text-red-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                                >
                                    {selectAll ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {AVAILABLE_SCOPES.map((scope) => {
                                    const isSelected = selectedScopes.includes(scope.value);
                                    return (
                                        <label
                                            key={scope.value}
                                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                                isSelected
                                                    ? 'border-indigo-200 bg-indigo-50 ring-1 ring-indigo-200'
                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleScope(scope.value)}
                                                className="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                            />
                                            <div className="flex-1">
                                                <span className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                                                    {scope.label}
                                                </span>
                                                <p className={`text-xs mt-0.5 ${isSelected ? 'text-indigo-700' : 'text-gray-500'}`}>
                                                    {scope.description}
                                                </p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            <p className="mt-2 text-xs text-gray-500">Select the permissions this API key should have. You can always create additional keys with different scopes.</p>
                            {apiError?.fields?.scopes && (
                                <p className="mt-2 text-sm text-red-600">{apiError.fields.scopes}</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => router.push(`/dashboard/company/${hash}/settings/apikeys`)}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving || loadingDomains || !!domainError || !domainId}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
                            >
                                {saving ? (
                                    <>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        Creating…
                                    </>
                                ) : (
                                    <>
                                        <KeySolid className="h-4 w-4" />
                                        Create API Key
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}