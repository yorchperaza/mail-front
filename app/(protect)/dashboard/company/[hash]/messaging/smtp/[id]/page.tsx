'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    TrashIcon,
    CheckCircleIcon,
    ClipboardIcon,
} from '@heroicons/react/24/outline';
import copy from 'copy-to-clipboard';

type Cred = {
    id: number;
    username_prefix: string | null;
    scopes: string[] | null;
    limits: { max_msgs_min: number | null; max_rcpt_msg: number | null } | null;
    ip_pool: number | null;
    created_at: string | null;
    username_render?: string;
};

type RotateResp = { credential: Cred; password: string | null };

export default function SmtpCredentialDetailPage() {
    const router = useRouter();
    const { hash, id } = useParams<{ hash: string; id: string }>();
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL as string | undefined;

    const [cred, setCred] = React.useState<Cred | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [err, setErr] = React.useState<string | null>(null);

    const [saving, setSaving] = React.useState(false);
    const [rotating, setRotating] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [lastPassword, setLastPassword] = React.useState<string | null>(null);
    const [copied, setCopied] = React.useState(false);

    const authHeaders = React.useCallback((): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    }, []);

    const getUrl = React.useMemo(() => {
        if (!baseUrl) return null;
        return `${baseUrl}/companies/${hash}/smtp-credentials/${id}`;
    }, [baseUrl, hash, id]);

    React.useEffect(() => {
        if (!getUrl) return;
        let abort = false;

        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(getUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load credential (${res.status})`);
                const j: Cred = await res.json();
                if (!abort) setCred(j);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();

        return () => { abort = true; };
    }, [getUrl, authHeaders]);

    async function onSave(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!baseUrl) return;
        if (!cred) return;
        setSaving(true);
        setErr(null);

        const fd = new FormData(e.currentTarget);
        const payload = {
            scopes: (fd.get('scopes') as string)?.split(/[,\s]+/).map(s => s.trim()).filter(Boolean) ?? [],
            max_msgs_min: Number(fd.get('max_msgs_min') || 0),
            max_rcpt_msg: Number(fd.get('max_rcpt_msg') || 100),
            ip_pool_id: fd.get('ip_pool_id') ? Number(fd.get('ip_pool_id')) : null,
        };

        try {
            const res = await fetch(getUrl!, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`Save failed (${res.status})`);
            const j: Cred = await res.json();
            setCred(j);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    async function rotate() {
        if (!baseUrl) return;
        setRotating(true);
        setLastPassword(null);
        try {
            const res = await fetch(`${baseUrl}/companies/${hash}/smtp-credentials/${id}/rotate`, {
                method: 'POST',
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error(`Rotate failed (${res.status})`);
            const j: RotateResp = await res.json();
            setCred(j.credential);
            setLastPassword(j.password ?? null);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setRotating(false);
        }
    }

    async function onDelete() {
        if (!baseUrl) return;
        if (!confirm('Delete this credential?')) return;
        setDeleting(true);
        try {
            const res = await fetch(`${baseUrl}/companies/${hash}/smtp-credentials/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            router.push(`/dashboard/company/${hash}/smtp`);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
            setDeleting(false);
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
    if (loading) return <p className="p-6 text-gray-600">Loading…</p>;
    if (err || !cred) return <p className="p-6 text-red-600">{err || 'Not found'}</p>;

    const scopesStr = cred.scopes?.join(', ') ?? '';
    const maxMsgs = cred.limits?.max_msgs_min ?? 0;
    const maxRcpt = cred.limits?.max_rcpt_msg ?? 100;

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(`/dashboard/company/${hash}/messaging/smtp`)}
                    className="inline-flex items-center text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">Credential #{cred.id}</h1>
                <div />
            </div>

            {/* Rotate banner */}
            {lastPassword && (
                <div className="rounded-md border bg-amber-50 p-3 text-sm flex items-center justify-between">
                    <div>
                        New password (shown once): <code className="font-mono">{lastPassword}</code>
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

            <div className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <div className="text-xs text-gray-500">Username prefix</div>
                        <div className="text-sm font-mono">{cred.username_prefix ?? '—'}</div>
                        <div className="text-xs text-gray-500 mt-1">Rendered username</div>
                        <div className="text-sm font-mono">{cred.username_render ?? '—'}</div>
                        <div className="text-xs text-gray-500 mt-1">Created</div>
                        <div className="text-sm">{cred.created_at ? new Date(cred.created_at).toLocaleString() : '—'}</div>
                    </div>

                    <form onSubmit={onSave} className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Scopes (CSV)</label>
                            <input
                                name="scopes"
                                defaultValue={scopesStr}
                                className="w-full rounded border px-2 py-1.5"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Max msgs/min</label>
                                <input
                                    name="max_msgs_min"
                                    type="number"
                                    min={0}
                                    defaultValue={maxMsgs}
                                    className="w-full rounded border px-2 py-1.5"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Max rcpt/msg</label>
                                <input
                                    name="max_rcpt_msg"
                                    type="number"
                                    min={1}
                                    defaultValue={maxRcpt}
                                    className="w-full rounded border px-2 py-1.5"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">IP Pool ID (optional)</label>
                            <input
                                name="ip_pool_id"
                                type="number"
                                defaultValue={cred.ip_pool ?? undefined}
                                className="w-full rounded border px-2 py-1.5"
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded bg-blue-700 px-3 py-2 text-white hover:bg-blue-800"
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                                type="button"
                                onClick={rotate}
                                disabled={rotating}
                                className="inline-flex items-center gap-1 rounded border px-3 py-2 hover:bg-gray-50"
                            >
                                <ArrowPathIcon className={`h-4 w-4 ${rotating ? 'animate-spin' : ''}`} />
                                Rotate password
                            </button>
                            <button
                                type="button"
                                onClick={onDelete}
                                disabled={deleting}
                                className="inline-flex items-center gap-1 rounded border px-3 py-2 text-red-700 hover:bg-red-50"
                            >
                                <TrashIcon className="h-4 w-4" />
                                Delete
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div>
                <Link href={`/dashboard/company/${hash}/smtp`} className="text-blue-700 hover:underline">
                    ← Back to credentials
                </Link>
            </div>
        </div>
    );
}
