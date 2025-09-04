'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    PlusIcon,
    TrashIcon,
    KeyIcon,
    ClipboardIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import copy from 'copy-to-clipboard';

type Cred = {
    id: number;
    username_prefix: string | null;
    scopes: string[] | null;
    limits: { max_msgs_min: number | null; max_rcpt_msg: number | null } | null;
    ip_pool: number | null;
    created_at: string | null;
    username_render?: string; // included by controller
};

type ListResp = { items: Cred[]; total: number };

export default function CompanySmtpListPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL as string | undefined;

    const [data, setData] = React.useState<ListResp | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [err, setErr] = React.useState<string | null>(null);
    const [rotatingId, setRotatingId] = React.useState<number | null>(null);
    const [deletingId, setDeletingId] = React.useState<number | null>(null);
    const [lastPassword, setLastPassword] = React.useState<string | null>(null);
    const [copied, setCopied] = React.useState(false);

    const authHeaders = React.useCallback((): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    }, []);

    const listUrl = React.useMemo(() => {
        if (!baseUrl) return null;
        return `${baseUrl}/companies/${hash}/smtp-credentials`;
    }, [baseUrl, hash]);

    React.useEffect(() => {
        if (!listUrl) return;
        let abort = false;

        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(listUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load credentials (${res.status})`);
                const json: ListResp = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();

        return () => { abort = true; };
    }, [listUrl, authHeaders]);

    async function rotatePassword(id: number) {
        if (!baseUrl) return;
        setRotatingId(id);
        setLastPassword(null);
        try {
            const res = await fetch(`${baseUrl}/companies/${hash}/smtp-credentials/${id}/rotate`, {
                method: 'POST',
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error(`Rotate failed (${res.status})`);
            const j = await res.json();
            setLastPassword(j?.password ?? null);
            // Soft refresh list to update created_at/limits (unchanged) — not required
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setRotatingId(null);
        }
    }

    async function deleteCred(id: number) {
        if (!baseUrl) return;
        if (!confirm('Are you sure you want to delete this SMTP credential?')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`${baseUrl}/companies/${hash}/smtp-credentials/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            setData((prev) => prev ? { ...prev, items: prev.items.filter(i => i.id !== id), total: prev.total - 1 } : prev);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    function copyPwd() {
        if (!lastPassword) return;
        if (copy(lastPassword)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        }
    }

    if (!baseUrl) return <p className="p-6 text-red-600">Backend URL not configured.</p>;
    if (loading) return <p className="p-6 text-gray-600">Loading SMTP credentials…</p>;
    if (err) return <p className="p-6 text-red-600">{err}</p>;

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(`/dashboard/company/${hash}`)}
                    className="inline-flex items-center text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">SMTP Credentials</h1>
            </div>

            {/* Password toast (after rotate/create) */}
            {lastPassword && (
                <div className="rounded-md border bg-amber-50 p-3 text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <KeyIcon className="h-5 w-5" />
                        <span>
              New password (shown once): <code className="font-mono">{lastPassword}</code>
            </span>
                    </div>
                    <button
                        onClick={copyPwd}
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-white"
                        title="Copy password"
                    >
                        {copied ? <CheckCircleIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="overflow-auto rounded-lg border bg-white shadow-sm">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                    <tr className="text-left">
                        <th className="px-3 py-2">Prefix</th>
                        <th className="px-3 py-2">Rendered Username</th>
                        <th className="px-3 py-2">Scopes</th>
                        <th className="px-3 py-2">Limits</th>
                        <th className="px-3 py-2">IP Pool</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {data?.items.length ? data.items.map((c) => (
                        <tr key={c.id} className="border-t">
                            <td className="px-3 py-2">{c.username_prefix ?? '—'}</td>
                            <td className="px-3 py-2 font-mono">{c.username_render ?? '—'}</td>
                            <td className="px-3 py-2">{c.scopes?.length ? c.scopes.join(', ') : '—'}</td>
                            <td className="px-3 py-2">
                                {c.limits ? `msgs/min: ${c.limits.max_msgs_min ?? 0}, rcpt/msg: ${c.limits.max_rcpt_msg ?? 0}` : '—'}
                            </td>
                            <td className="px-3 py-2">{c.ip_pool ?? '—'}</td>
                            <td className="px-3 py-2">{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</td>
                            <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <Link
                                        href={`/dashboard/company/${hash}/messaging/smtp/${c.id}`}
                                        className="text-blue-700 hover:underline"
                                    >
                                        View
                                    </Link>
                                    <button
                                        onClick={() => rotatePassword(c.id)}
                                        disabled={rotatingId === c.id}
                                        className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-gray-50"
                                    >
                                        <ArrowPathIcon className={`h-4 w-4 ${rotatingId === c.id ? 'animate-spin' : ''}`} />
                                        Rotate
                                    </button>
                                    <button
                                        onClick={() => deleteCred(c.id)}
                                        disabled={deletingId === c.id}
                                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-red-700 hover:bg-red-50"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={7} className="px-3 py-6 text-center text-gray-600">No credentials yet.</td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
