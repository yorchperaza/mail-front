'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrashIcon, PlusIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

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

function safeDate(s?: string | null): string {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleString();
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
                // non-fatal
                console.error(e);
            }
        })();

        return () => {
            abort = true;
        };
    }, [domainEndpoint, authHeaders]);

    async function handleDelete(keyId: number) {
        if (!confirm('Are you sure you want to delete this API key?')) return;

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

    if (loading) return <p className="text-center mt-8">Loading API keys…</p>;
    if (error) return <p className="text-center mt-8 text-red-600">{error}</p>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(backHref)}
                    className="inline-flex items-center text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>

                <Link
                    href={createHref}
                    className="inline-flex items-center px-4 py-2 rounded text-white bg-blue-800 hover:bg-blue-900"
                >
                    <PlusIcon className="h-5 w-5 mr-1" /> Create Domain Key
                </Link>
            </div>

            <h1 className="text-2xl font-semibold">
                Domain Keys for{' '}
                <span className="text-blue-700">{domainDetail?.domain ?? `#${domainId}`}</span>
            </h1>

            {keys.length === 0 ? (
                <p className="text-gray-500">No API keys found for this domain.</p>
            ) : (
                <div className="space-y-4">
                    {keys.map((key) => (
                        <div
                            key={key.id}
                            className="flex items-center justify-between bg-white p-4 rounded border shadow-sm"
                        >
                            <div>
                                <p className="font-medium">
                                    {key.label ?? <span className="italic text-gray-500">(no label)</span>}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                  <span>
                    Prefix: <span className="font-mono">{key.prefix}</span>
                  </span>
                                    <span>
                    Scopes:{' '}
                                        {key.scopes.length ? key.scopes.join(', ') : <span className="text-gray-400">—</span>}
                  </span>
                                </div>
                                <p className="mt-1 text-xs text-gray-400">
                                    Created: {safeDate(key.created_at)}
                                    {key.last_used_at && <> · Last used: {safeDate(key.last_used_at)}</>}
                                    {key.revoked_at && <> · Revoked: {safeDate(key.revoked_at)}</>}
                                </p>
                            </div>

                            <button
                                onClick={() => handleDelete(key.id)}
                                disabled={deletingId === key.id}
                                className={`p-2 rounded ${
                                    deletingId === key.id ? 'text-red-400' : 'text-red-600 hover:bg-red-100'
                                }`}
                                title="Delete API key"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
