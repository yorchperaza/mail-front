'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, CheckCircleIcon, ClipboardIcon } from '@heroicons/react/24/outline';
import copy from 'copy-to-clipboard';

type CreateResp = {
    credential: {
        id: number;
        username_prefix: string | null;
        username_render?: string;
        scopes: string[] | null;
        limits: { max_msgs_min: number | null; max_rcpt_msg: number | null } | null;
        ip_pool: number | null;
        created_at: string | null;
    };
    password: string | null;
};

export default function NewSmtpCredentialPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL as string | undefined;

    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);
    const [result, setResult] = React.useState<CreateResp | null>(null);
    const [copied, setCopied] = React.useState(false);

    const authHeaders = React.useCallback((): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    }, []);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!baseUrl) return;
        setBusy(true);
        setErr(null);
        setResult(null);

        const fd = new FormData(e.currentTarget);
        const payload = {
            username_prefix: (fd.get('username_prefix') as string)?.trim() || 'smtpuser',
            domain: (fd.get('domain_hint') as string)?.trim() || 'example.com',
            scopes: (fd.get('scopes') as string)?.split(/[,\s]+/).map(s => s.trim()).filter(Boolean) ?? ['submit'],
            max_msgs_min: Number(fd.get('max_msgs_min') || 0),
            max_rcpt_msg: Number(fd.get('max_rcpt_msg') || 100),
            ip_pool_id: fd.get('ip_pool_id') ? Number(fd.get('ip_pool_id')) : null,
        };

        try {
            const res = await fetch(`${baseUrl}/companies/${hash}/smtp-credentials`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`Create failed (${res.status})`);
            const j: CreateResp = await res.json();
            setResult(j);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    function copyPwd() {
        const pwd = result?.password;
        if (!pwd) return;
        if (copy(pwd)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        }
    }

    if (!baseUrl) return <p className="p-6 text-red-600">Backend URL not configured.</p>;

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(`/dashboard/company/${hash}/messaging/smtp`)}
                    className="inline-flex items-center text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">Create SMTP Credential</h1>
                <div />
            </div>

            {err && <p className="text-red-600">{err}</p>}

            {/* Result banner */}
            {result && (
                <div className="rounded-md border bg-emerald-50 p-3 text-sm">
                    <div className="font-medium">Credential created.</div>
                    <div className="mt-1">
                        Password (shown once): <code className="font-mono">{result.password ?? '—'}</code>
                        {' '}
                        <button
                            onClick={copyPwd}
                            className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ml-2 hover:bg-white"
                            title="Copy password"
                        >
                            {copied ? <CheckCircleIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <div className="mt-2">
                        <Link href={`/dashboard/company/${hash}/smtp`} className="text-blue-700 hover:underline">
                            Go to list →
                        </Link>
                    </div>
                </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-4 bg-white rounded-lg border p-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Username prefix</label>
                        <input name="username_prefix" placeholder="smtpuser" className="w-full rounded border px-2 py-1.5" />
                        <p className="text-xs text-gray-500 mt-1">Final username is {`<prefix>@<domain>`} when used per-domain.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Domain hint</label>
                        <input name="domain_hint" placeholder="example.com" className="w-full rounded border px-2 py-1.5" />
                        <p className="text-xs text-gray-500 mt-1">Only used to render the example username in responses.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Scopes (CSV)</label>
                        <input name="scopes" placeholder="submit" className="w-full rounded border px-2 py-1.5" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">IP Pool ID (optional)</label>
                        <input name="ip_pool_id" type="number" className="w-full rounded border px-2 py-1.5" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Max messages / minute</label>
                        <input name="max_msgs_min" type="number" min={0} defaultValue={0} className="w-full rounded border px-2 py-1.5" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Max recipients / message</label>
                        <input name="max_rcpt_msg" type="number" min={1} defaultValue={100} className="w-full rounded border px-2 py-1.5" />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => router.push(`/dashboard/company/${hash}/smtp`)}
                        className="px-4 py-2 rounded border hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy}
                        className="px-4 py-2 rounded bg-blue-700 text-white hover:bg-blue-800"
                    >
                        {busy ? 'Creating…' : 'Create'}
                    </button>
                </div>
            </form>
        </div>
    );
}
