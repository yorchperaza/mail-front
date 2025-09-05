'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
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
    { value: 'mail:send', label: 'Send Mail' },
    { value: 'mail:send:list', label: 'Send to Lists' },
    { value: 'mail:send:segment', label: 'Send to Segment' },
    { value: 'mail:read', label: 'Read Mail' },
    { value: 'domains:list', label: 'List Domains' },
    { value: 'users:manage', label: 'Manage Users' },
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
                if (res.status === 403) throw new Error('You don’t have access to this company’s domains.');
                if (!res.ok) throw new Error(`Failed to load domains (${res.status})`);
                const data = (await res.json()) as DomainBrief[];
                if (!cancelled) {
                    const items = Array.isArray(data) ? data : [];
                    setDomains(items);
                    // preselect if there’s only one domain
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
            <div className="max-w-xl mx-auto bg-white p-6 rounded-xl border shadow-sm">
                <button
                    onClick={() => router.back()}
                    className="inline-flex items-center mb-4 text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" />
                    Back
                </button>

                <h1 className="text-2xl font-semibold mb-2">API Key Created</h1>
                <p className="mb-3 text-sm text-gray-500">Copy your secret now — you won’t see it again.</p>

                <div className="flex items-center bg-gray-50 rounded-lg border p-3 mb-5">
                    <code className="flex-1 font-mono break-all">{secret}</code>
                    <button
                        onClick={() => copy(secret)}
                        className="ml-2 p-2 rounded hover:bg-gray-100"
                        title="Copy to clipboard"
                    >
                        <ClipboardDocumentIcon className="h-5 w-5 text-gray-600" />
                    </button>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => router.push(`/dashboard/company/${hash}/settings/apikeys`)}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                        Go to API keys
                    </button>
                    <button
                        onClick={() => {
                            setSecret(null);
                            setLabel('');
                            setSelectedScopes([]);
                        }}
                        className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                    >
                        Create another
                    </button>
                </div>
            </div>
        );
    }

    /* ------------------------------ Form ------------------------------ */
    return (
        <div className="max-w-xl mx-auto bg-white p-6 rounded-xl border shadow-sm">
            <button
                onClick={() => router.back()}
                className="inline-flex items-center mb-4 text-gray-600 hover:text-gray-800"
            >
                <ArrowLeftIcon className="h-5 w-5 mr-1" />
                Back
            </button>

            <h1 className="text-2xl font-semibold mb-6">Create Domain API Key</h1>

            {apiError && (
                <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700">
                    {apiError.message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Domain (required) */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Domain <span className="text-red-500">*</span>
                    </label>
                    {loadingDomains ? (
                        <div className="h-10 w-full animate-pulse rounded-lg bg-gray-100" />
                    ) : domainError ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {domainError}
                        </div>
                    ) : domains.length === 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            No domains available. Add a domain first.
                        </div>
                    ) : (
                        <select
                            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                            value={domainId ?? ''}
                            onChange={(e) => setDomainId(Number(e.target.value) || null)}
                            required
                        >
                            <option value="" disabled>
                                Select a domain…
                            </option>
                            {sortedDomains.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.domain ?? `Domain #${d.id}`}
                                </option>
                            ))}
                        </select>
                    )}
                    {apiError?.fields?.domain && (
                        <p className="mt-1 text-sm text-red-600">{apiError.fields.domain}</p>
                    )}
                </div>

                {/* Label */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Label <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="e.g. CI/CD token"
                        required
                    />
                    {apiError?.fields?.label && (
                        <p className="mt-1 text-sm text-red-600">{apiError.fields.label}</p>
                    )}
                </div>

                {/* Scopes */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium">Scopes</label>
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            {selectAll ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {AVAILABLE_SCOPES.map((scope) => (
                            <label key={scope.value} className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={selectedScopes.includes(scope.value)}
                                    onChange={() => toggleScope(scope.value)}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">{scope.label}</span>
                            </label>
                        ))}
                    </div>
                    {apiError?.fields?.scopes && (
                        <p className="mt-1 text-sm text-red-600">{apiError.fields.scopes}</p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => router.push(`/dashboard/company/${hash}/settings/apikeys`)}
                        className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || loadingDomains || !!domainError || !domainId}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {saving ? 'Creating…' : 'Create Key'}
                    </button>
                </div>
            </form>
        </div>
    );
}
