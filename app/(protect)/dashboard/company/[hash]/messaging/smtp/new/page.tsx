'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    ClipboardIcon,
    ChevronUpDownIcon,
    MagnifyingGlassIcon,
    LinkIcon,
} from '@heroicons/react/24/outline';
import { Combobox, Transition } from '@headlessui/react';
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

type IpPoolBrief = { id: number; name: string | null };

function classNames(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(' ');
}

export default function NewSmtpCredentialPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL as string | undefined;

    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);
    const [result, setResult] = React.useState<CreateResp | null>(null);
    const [copied, setCopied] = React.useState(false);

    // IP pools state
    const [pools, setPools] = React.useState<IpPoolBrief[] | null>(null);
    const [poolsErr, setPoolsErr] = React.useState<string | null>(null);
    const [selectedPool, setSelectedPool] = React.useState<IpPoolBrief | null>(null);
    const [query, setQuery] = React.useState('');

    const authHeaders = React.useCallback((): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    }, []);

    const requestNewPoolHref = `/dashboard/company/${hash}/ip-pools`;

    // --- Load IP pools (try hash route, fallback to legacy) ---
    React.useEffect(() => {
        if (!baseUrl || !hash) return;

        let abort = false;

        async function loadPools() {
            setPoolsErr(null);
            setPools(null);
            try {
                // Preferred (by hash)
                const urls = [
                    `${baseUrl}/ippools-brief/companies/${hash}`,
                ];

                let loaded: IpPoolBrief[] | null = null;
                for (const url of urls) {
                    const res = await fetch(url, { headers: authHeaders() });
                    if (res.ok) {
                        loaded = (await res.json()) as IpPoolBrief[];
                        break;
                    }
                }

                if (!abort) {
                    if (loaded) {
                        setPools(loaded);
                        if (loaded.length === 1) setSelectedPool(loaded[0]);
                    } else {
                        setPools([]);
                        setPoolsErr('No IP pools API available.');
                    }
                }
            } catch (e) {
                if (!abort) {
                    setPoolsErr(e instanceof Error ? e.message : String(e));
                    setPools([]);
                }
            }
        }

        loadPools();
        return () => {
            abort = true;
        };
    }, [authHeaders, baseUrl, hash]);

    const filteredPools =
        query.trim() === ''
            ? pools ?? []
            : (pools ?? []).filter((p) => {
                const name = (p.name || `Pool #${p.id}`).toLowerCase();
                const q = query.toLowerCase();
                return name.includes(q) || String(p.id).includes(q);
            });

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!baseUrl) return;
        setBusy(true);
        setErr(null);
        setResult(null);

        const fd = new FormData(e.currentTarget);
        const ipPoolFromHidden = fd.get('ip_pool_id');
        const ipPoolId = ipPoolFromHidden ? Number(ipPoolFromHidden) : null;

        const payload = {
            username_prefix: (fd.get('username_prefix') as string)?.trim() || 'smtpuser',
            domain: (fd.get('domain_hint') as string)?.trim() || 'example.com',
            scopes:
                (fd.get('scopes') as string)
                    ?.split(/[,\s]+/)
                    .map((s) => s.trim())
                    .filter(Boolean) ?? ['submit'],
            max_msgs_min: Number(fd.get('max_msgs_min') || 0),
            max_rcpt_msg: Number(fd.get('max_rcpt_msg') || 0),
            ip_pool_id: ipPoolId, // selected or null
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
                        Password (shown once): <code className="font-mono">{result.password ?? '—'}</code>{' '}
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
            <form onSubmit={onSubmit} className="space-y-5 bg-white rounded-lg border p-5 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Username prefix</label>
                        <input name="username_prefix" placeholder="smtpuser" className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                        <p className="text-xs text-gray-500 mt-1">Final username is {`<prefix>@<domain>`} when used per-domain.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Domain hint</label>
                        <input name="domain_hint" placeholder="example.com" className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                        <p className="text-xs text-gray-500 mt-1">Only used to render the example username in responses.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Scopes (CSV)</label>
                        <input name="scopes" placeholder="submit" className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </div>

                    {/* IP Pool – Modern searchable picker */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium mb-1">IP Pool</label>
                            <Link
                                href={requestNewPoolHref}
                                className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                                title="Request a new IP pool"
                            >
                                <LinkIcon className="h-4 w-4" />
                                Request new IP pool
                            </Link>
                        </div>

                        {poolsErr && <div className="text-xs text-red-600 mb-1">{poolsErr}</div>}

                        {pools === null ? (
                            <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm text-gray-500">
                                <MagnifyingGlassIcon className="h-4 w-4" /> Loading pools…
                            </div>
                        ) : (pools?.length ?? 0) > 0 ? (
                            <>
                                {/* Hidden input to submit the selected id */}
                                <input type="hidden" name="ip_pool_id" value={selectedPool?.id ?? ''} />

                                <Combobox value={selectedPool} onChange={setSelectedPool} nullable>
                                    <div className="relative">
                                        <div className="relative w-full cursor-default overflow-hidden rounded border bg-white text-left focus-within:ring-2 focus-within:ring-blue-500/30">
                                            <Combobox.Input
                                                className="w-full border-0 px-3 py-2 focus:outline-none"
                                                displayValue={(p: IpPoolBrief | null) => (p ? p.name || `Pool #${p.id}` : '')}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder="Search pools…"
                                            />
                                            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                                                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                                            </Combobox.Button>
                                        </div>

                                        <Transition
                                            leave="transition ease-in duration-100"
                                            leaveFrom="opacity-100"
                                            leaveTo="opacity-0"
                                        >
                                            <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none text-sm">
                                                {filteredPools.length === 0 ? (
                                                    <div className="px-3 py-2 text-gray-500">No matches</div>
                                                ) : (
                                                    filteredPools.map((p) => (
                                                        <Combobox.Option
                                                            key={p.id}
                                                            value={p}
                                                            className={({ active }) =>
                                                                classNames(
                                                                    active ? 'bg-blue-50 text-blue-900' : 'text-gray-900',
                                                                    'cursor-default select-none py-2 pl-3 pr-3'
                                                                )
                                                            }
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="truncate">{p.name || `Pool #${p.id}`}</span>
                                                                <span className="ml-2 text-xs text-gray-500">#{p.id}</span>
                                                            </div>
                                                        </Combobox.Option>
                                                    ))
                                                )}

                                                {/* Footer action inside the dropdown */}
                                                <div className="mt-1 border-t pt-1">
                                                    <Link
                                                        href={requestNewPoolHref}
                                                        className="flex items-center gap-2 px-3 py-2 text-blue-700 hover:bg-blue-50"
                                                    >
                                                        <LinkIcon className="h-4 w-4" />
                                                        Request a new IP pool
                                                    </Link>
                                                </div>
                                            </Combobox.Options>
                                        </Transition>
                                    </div>
                                </Combobox>
                            </>
                        ) : (
                            <div className="rounded border p-3">
                                <div className="text-sm text-gray-600">No IP pools found.</div>
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        name="ip_pool_id"
                                        type="number"
                                        placeholder="Enter pool id (optional)"
                                        className="w-40 rounded border px-3 py-2"
                                    />
                                    <Link
                                        href={requestNewPoolHref}
                                        className="text-sm text-blue-700 hover:underline"
                                        title="Request a new IP pool"
                                    >
                                        Request new IP pool →
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Max messages / minute</label>
                        <input
                            name="max_msgs_min"
                            type="number"
                            min={0}
                            defaultValue={0}
                            className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Max recipients / message</label>
                        <input
                            name="max_rcpt_msg"
                            type="number"
                            min={0}
                            defaultValue={0}
                            className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
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
                    <button type="submit" disabled={busy} className="px-4 py-2 rounded bg-blue-700 text-white hover:bg-blue-800">
                        {busy ? 'Creating…' : 'Create'}
                    </button>
                </div>
            </form>
        </div>
    );
}
