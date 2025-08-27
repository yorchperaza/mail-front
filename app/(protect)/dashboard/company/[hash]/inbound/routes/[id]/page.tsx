'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type Company = { id: number; name: string | null };
type DomainBrief = { id: number; domain: string | null };

type ExpressionType =
    | 'match_header'
    | 'match_recipient'
    | 'match_sender'
    | 'catch_all';

type DestinationForward = { type: 'forward'; to: string[]; meta?: { priority?: number; description?: string } };
type DestinationStore   = { type: 'store';   notify: string[]; meta?: { priority?: number; description?: string } };
type Destination = DestinationForward | DestinationStore;

type InboundRoute = {
    id: number;
    pattern: string | null;
    action: 'forward' | 'store' | 'stop' | null;
    destination: Destination | null;
    spam_threshold: number | null;
    dkim_required: number | null; // 0|1|null
    tls_required: number | null;  // 0|1|null
    created_at: string | null;
    domain: { id: number; domain: string | null } | null;
};

/* ----------------------------- Helpers ----------------------------- */

const joinUrl = (base: string, path: string) =>
    `${(base || '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

const splitCSV = (s: string): string[] =>
    s.split(',').map(x => x.trim()).filter(Boolean);

const toCSV = (a?: string[]) => (Array.isArray(a) ? a.join(', ') : '');

const isNumber = (s: string) => s.trim() !== '' && !isNaN(Number(s));

/** Build backend `pattern` from the Mailgun-like expression UI */
function buildPattern(
    type: ExpressionType,
    opts: { headerName?: string; headerValue?: string; recipient?: string; sender?: string }
): string {
    switch (type) {
        case 'match_header': {
            const name = (opts.headerName || '').trim();
            const val  = (opts.headerValue || '').trim();
            return `header:${name}=${val}`;
        }
        case 'match_recipient': {
            const rcpt = (opts.recipient || '').trim();
            return `rcpt:${rcpt}`;
        }
        case 'match_sender': {
            const snd = (opts.sender || '').trim();
            return `sender:${snd}`;
        }
        case 'catch_all':
        default:
            return '*';
    }
}

/** Parse a saved pattern into expression UI fields */
function parsePattern(pattern?: string | null): {
    type: ExpressionType;
    headerName: string;
    headerValue: string;
    recipient: string;
    sender: string;
} {
    const p = (pattern || '').trim();
    if (p === '' || p === '*') {
        return { type: 'catch_all', headerName: '', headerValue: '', recipient: '', sender: '' };
    }
    if (p.startsWith('header:')) {
        const rest = p.slice('header:'.length);
        const idx = rest.indexOf('=');
        const name = idx >= 0 ? rest.slice(0, idx) : rest;
        const val  = idx >= 0 ? rest.slice(idx + 1) : '';
        return { type: 'match_header', headerName: name, headerValue: val, recipient: '', sender: '' };
    }
    if (p.startsWith('rcpt:')) {
        return { type: 'match_recipient', headerName: '', headerValue: '', recipient: p.slice('rcpt:'.length), sender: '' };
    }
    if (p.startsWith('sender:')) {
        return { type: 'match_sender', headerName: '', headerValue: '', recipient: '', sender: p.slice('sender:'.length) };
    }
    // default fallback
    return { type: 'catch_all', headerName: '', headerValue: '', recipient: '', sender: '' };
}

/* ----------------------------- Page ----------------------------- */

export default function InboundRouteEditLikeCreatePage() {
    const router = useRouter();
    const { hash, id } = useParams<{ hash: string; id: string }>();
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    /* ----------- load company + domains + route ----------- */
    const [company, setCompany] = useState<Company | null>(null);
    const [domains, setDomains] = useState<DomainBrief[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState<string | null>(null);

    // Scope
    const [domainId, setDomainId] = useState<number | ''>('');

    // Expression
    const [exprType, setExprType] = useState<ExpressionType>('match_header');
    const [headerName, setHeaderName] = useState('');
    const [headerValue, setHeaderValue] = useState('');
    const [recipient, setRecipient] = useState(''); // for rcpt
    const [sender, setSender] = useState('');       // for sender

    // Actions (toggles)
    const [forwardOn, setForwardOn] = useState(false);
    const [storeOn, setStoreOn]     = useState(false);
    const [stopOn, setStopOn]       = useState(false);

    // Action payloads
    const [forwardDestinations, setForwardDestinations] = useState(''); // CSV
    const [storeNotifyUrls, setStoreNotifyUrls]         = useState(''); // CSV

    // Priority / Description
    const [priority, setPriority] = useState<string>('0');
    const [description, setDescription] = useState('');

    // Constraints
    const [spamThreshold, setSpamThreshold] = useState<string>(''); // optional number
    const [dkimRequired, setDkimRequired]   = useState(false);
    const [tlsRequired, setTlsRequired]     = useState(false);

    // UX
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk]   = useState<string | null>(null);

    const backHref = `/dashboard/company/${hash}/inbound/routes`;
    const routeUrl = useMemo(() => joinUrl(backend, `/companies/${hash}/inbound-routes/${id}`), [backend, hash, id]);

    useEffect(() => {
        if (!backend || !hash || !id) return;
        let abort = false;

        (async () => {
            setLoading(true);
            setLoadErr(null);
            try {
                // company
                const cRes = await fetch(joinUrl(backend, `/companies/${hash}`), { headers: authHeaders() });
                if (!cRes.ok) throw new Error(`Failed to load company (${cRes.status})`);
                const c: Company = await cRes.json();
                if (!abort) setCompany(c);

                // domains
                try {
                    const dRes = await fetch(joinUrl(backend, `/companies/${hash}/domains`), { headers: authHeaders() });
                    if (dRes.ok) {
                        const list = (await dRes.json()) as DomainBrief[];
                        if (!abort) setDomains(list);
                    } else if (!abort) setDomains([]);
                } catch {
                    if (!abort) setDomains([]);
                }

                // route
                const rRes = await fetch(routeUrl, { headers: authHeaders() });
                if (!rRes.ok) throw new Error(`Failed to load route (${rRes.status})`);
                const r = (await rRes.json()) as InboundRoute;

                if (abort) return;

                // Fill form from route
                const parsed = parsePattern(r.pattern);
                setExprType(parsed.type);
                setHeaderName(parsed.headerName);
                setHeaderValue(parsed.headerValue);
                setRecipient(parsed.recipient);
                setSender(parsed.sender);

                setDomainId(r.domain?.id ?? '');

                // action/destination mapping
                setForwardOn(false);
                setStoreOn(false);
                setStopOn(false);
                setForwardDestinations('');
                setStoreNotifyUrls('');
                setPriority('0');
                setDescription('');

                if (r.action === 'forward') setForwardOn(true);
                if (r.action === 'store')   setStoreOn(true);
                if (r.action === 'stop')    setStopOn(true);

                if (r.destination?.type === 'forward') {
                    setForwardDestinations(toCSV(r.destination.to));
                    if (r.destination.meta?.priority !== undefined) setPriority(String(r.destination.meta.priority));
                    if (r.destination.meta?.description) setDescription(r.destination.meta.description);
                } else if (r.destination?.type === 'store') {
                    setStoreNotifyUrls(toCSV(r.destination.notify));
                    if (r.destination.meta?.priority !== undefined) setPriority(String(r.destination.meta.priority));
                    if (r.destination.meta?.description) setDescription(r.destination.meta.description);
                }

                setSpamThreshold(r.spam_threshold !== null ? String(r.spam_threshold) : '');
                setDkimRequired(r.dkim_required === 1);
                setTlsRequired(r.tls_required === 1);
            } catch (e) {
                if (!abort) setLoadErr(e instanceof Error ? e.message : 'Failed to load');
            } finally {
                if (!abort) setLoading(false);
            }
        })();

        return () => { abort = true; };
    }, [backend, hash, id, routeUrl]);

    /* ----------------------------- validate ----------------------------- */

    function validate(): string | null {
        if (exprType === 'match_header') {
            if (!headerName.trim()) return 'Header name is required.';
            if (!headerValue.trim()) return 'Header value is required.';
        }
        if (exprType === 'match_recipient' && !recipient.trim()) {
            return 'Recipient pattern is required.';
        }
        if (exprType === 'match_sender' && !sender.trim()) {
            return 'Sender pattern is required.';
        }
        if (!forwardOn && !storeOn && !stopOn) {
            return 'Select at least one action (Forward, Store & notify, or Stop).';
        }
        if (forwardOn && !forwardDestinations.trim()) {
            return 'Forward destinations are required when Forward is enabled.';
        }
        if (spamThreshold.trim() !== '' && !isNumber(spamThreshold)) {
            return 'Spam threshold must be a number.';
        }
        if (priority.trim() !== '' && !isNumber(priority)) {
            return 'Priority must be a number.';
        }
        return null;
    }

    /* ------------------------------ submit ----------------------------- */

    async function onSubmit() {
        setErr(null);
        setOk(null);

        const v = validate();
        if (v) { setErr(v); return; }

        // Build pattern from expression UI
        const pattern = buildPattern(exprType, { headerName, headerValue, recipient, sender });

        // Primary action (we follow same rule as create)
        const selected: Array<'forward' | 'store' | 'stop'> = [];
        if (forwardOn) selected.push('forward');
        if (storeOn)   selected.push('store');
        if (stopOn)    selected.push('stop');
        const primary = selected[0];

        let destination: Destination | undefined;
        if (primary === 'forward') {
            destination = {
                type: 'forward',
                to: splitCSV(forwardDestinations),
                meta: {
                    priority: priority.trim() === '' ? undefined : Number(priority),
                    description: description.trim() || undefined,
                },
            };
        } else if (primary === 'store') {
            destination = {
                type: 'store',
                notify: splitCSV(storeNotifyUrls),
                meta: {
                    priority: priority.trim() === '' ? undefined : Number(priority),
                    description: description.trim() || undefined,
                },
            };
        } else {
            // stop: no intrinsic destination, store meta information in a neutral object
            destination = {
                type: 'store',
                notify: [],
                meta: {
                    priority: priority.trim() === '' ? undefined : Number(priority),
                    description: (description ? `(stop) ${description}` : '(stop)'),
                },
            };
        }

        // If user toggled multiple actions, append note in meta
        if (destination && selected.length > 1) {
            const also = selected.slice(1).join(', ');
            const prev = destination.meta?.description || '';
            destination.meta = {
                ...destination.meta,
                description: [prev, `(also selected: ${also})`].filter(Boolean).join(' ').trim(),
            };
        }

        const payload = {
            pattern,
            action: primary,
            domainId: domainId === '' ? null : Number(domainId),
            dkim_required: dkimRequired ? 1 : 0,
            tls_required: tlsRequired ? 1 : 0,
            destination,
            ...(spamThreshold.trim() !== '' ? { spam_threshold: Number(spamThreshold) } : {}),
        };

        setSubmitting(true);
        try {
            const res = await fetch(routeUrl, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                let msg = `Save failed (${res.status})`;
                try { const js = await res.json(); msg = (js as { error?: string; message?: string })?.error || js?.message || msg; } catch {}
                throw new Error(msg);
            }
            setOk('Route updated successfully.');
            // slight pause then back to list
            setTimeout(() => router.push(backHref), 450);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSubmitting(false);
        }
    }

    /* ------------------------------ render ----------------------------- */

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading…</p>
            </div>
        );
    }
    if (loadErr) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="max-w-md text-center space-y-4">
                    <p className="text-red-600">{loadErr}</p>
                    <button
                        onClick={() => router.push(`/dashboard/company/${hash}`)}
                        className="inline-flex items-center space-x-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                        <ArrowLeftIcon className="h-4 w-4"/><span>Back</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={() => router.push(backHref)}
                    className="inline-flex items-center text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">
                    Edit Route {company?.name ? <span className="text-gray-500">· {company.name}</span> : null}
                </h1>
            </div>

            {ok && (
                <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-green-800">
                    <InformationCircleIcon className="h-5 w-5 mt-0.5" />
                    <div className="flex-1">{ok}</div>
                </div>
            )}
            {err && (
                <div className="rounded bg-red-50 text-red-700 px-3 py-2 text-sm">
                    {err}
                </div>
            )}

            <div className="bg-white border rounded-lg p-4 space-y-6">
                {/* Expression section */}
                <div>
                    <p className="text-sm font-medium mb-1">Expression</p>
                    <p className="text-sm text-gray-600">
                        Route filters are expressions that determine when an action is triggered.
                        If a route expression evaluates to true, the corresponding action(s) execute.
                    </p>

                    <div className="mt-4">
                        <label className="block text-sm font-medium mb-1">Expression type</label>
                        <select
                            value={exprType}
                            onChange={(e) => setExprType(e.target.value as ExpressionType)}
                            className="w-full rounded border px-3 py-2"
                        >
                            <option value="match_header">Match Header</option>
                            <option value="match_recipient">Match Recipient</option>
                            <option value="match_sender">Match Sender</option>
                            <option value="catch_all">Catch all</option>
                        </select>
                    </div>

                    {exprType === 'match_header' && (
                        <div className="mt-4 grid md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="route-header-name" className="block text-sm font-medium mb-1">
                                    Header name <span className="text-red-600">*</span>
                                </label>
                                <input
                                    id="route-header-name"
                                    placeholder="X-Header-Name"
                                    value={headerName}
                                    onChange={(e) => setHeaderName(e.target.value)}
                                    className="w-full rounded border px-3 py-2"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Uses the specified header name to match against
                                </p>
                            </div>
                            <div>
                                <label htmlFor="route-header-value" className="block text-sm font-medium mb-1">
                                    Header value <span className="text-red-600">*</span>
                                </label>
                                <input
                                    id="route-header-value"
                                    placeholder="Header value"
                                    value={headerValue}
                                    onChange={(e) => setHeaderValue(e.target.value)}
                                    className="w-full rounded border px-3 py-2"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Matches if the specified value equals the header value
                                </p>
                            </div>
                        </div>
                    )}

                    {exprType === 'match_recipient' && (
                        <div className="mt-4">
                            <label className="block text-sm font-medium mb-1">Recipient pattern <span className="text-red-600">*</span></label>
                            <input
                                placeholder="help@*, *@inbound.example.com"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                className="w-full rounded border px-3 py-2"
                            />
                        </div>
                    )}

                    {exprType === 'match_sender' && (
                        <div className="mt-4">
                            <label className="block text-sm font-medium mb-1">Sender pattern <span className="text-red-600">*</span></label>
                            <input
                                placeholder="sales@*, *@partner.com"
                                value={sender}
                                onChange={(e) => setSender(e.target.value)}
                                className="w-full rounded border px-3 py-2"
                            />
                        </div>
                    )}

                    {/* Domain scope (optional) */}
                    <div className="mt-4">
                        <label className="block text-sm font-medium mb-1">Domain (optional)</label>
                        <select
                            value={domainId}
                            onChange={(e) => setDomainId(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full rounded border px-3 py-2"
                        >
                            <option value="">(All domains)</option>
                            {domains.map(d => <option key={d.id} value={d.id}>{d.domain ?? `#${d.id}`}</option>)}
                        </select>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-6">
                    {/* Forward */}
                    <div>
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={forwardOn}
                                onChange={(e) => setForwardOn(e.target.checked)}
                                id="act-forward"
                            />
                            <label htmlFor="act-forward" className="text-sm font-medium">Forward</label>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                            Forwards the message to a specified destination, which can be another email address or a URL.
                            You can combine multiple destinations by separating them with commas.
                        </p>
                        {forwardOn && (
                            <div className="mt-2">
                <textarea
                    rows={2}
                    placeholder="address@example.com, https://myapp.com/messages"
                    value={forwardDestinations}
                    onChange={(e) => setForwardDestinations(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                />
                            </div>
                        )}
                    </div>

                    {/* Store & notify */}
                    <div>
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={storeOn}
                                onChange={(e) => setStoreOn(e.target.checked)}
                                id="act-store"
                            />
                            <label htmlFor="act-store" className="text-sm font-medium">Store and notify</label>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                            Stores the message temporarily so you can retrieve it later. You can combine multiple
                            retrieval callback URLs separated by commas. If you don’t specify a URL, you can fetch
                            the message later via API.
                        </p>
                        {storeOn && (
                            <div className="mt-2">
                <textarea
                    rows={2}
                    placeholder="https://myapp.com/callback"
                    value={storeNotifyUrls}
                    onChange={(e) => setStoreNotifyUrls(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                />
                            </div>
                        )}
                    </div>

                    {/* Stop */}
                    <div>
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={stopOn}
                                onChange={(e) => setStopOn(e.target.checked)}
                                id="act-stop"
                            />
                            <label htmlFor="act-stop" className="text-sm font-medium">Stop</label>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                            Sets the priority waterfall so the subsequent routes will not be evaluated.
                        </p>
                    </div>
                </div>

                {/* Priority & Description */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Priority</label>
                        <input
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            className="w-full rounded border px-3 py-2"
                            placeholder="0"
                            inputMode="numeric"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Routes are evaluated from lowest to highest priority. Same priority → newer routes first.
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full rounded border px-3 py-2"
                            placeholder="Optional note for this route"
                        />
                    </div>
                </div>

                {/* Constraints */}
                <div className="grid md:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Spam threshold</label>
                        <input
                            value={spamThreshold}
                            onChange={(e) => setSpamThreshold(e.target.value)}
                            className="w-full rounded border px-3 py-2"
                            placeholder="e.g. 5.0"
                            inputMode="decimal"
                        />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                        <input
                            type="checkbox"
                            checked={dkimRequired}
                            onChange={(e) => setDkimRequired(e.target.checked)}
                            id="dkim_req"
                        />
                        <label htmlFor="dkim_req" className="text-sm font-medium">DKIM required</label>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                        <input
                            type="checkbox"
                            checked={tlsRequired}
                            onChange={(e) => setTlsRequired(e.target.checked)}
                            id="tls_req"
                        />
                        <label htmlFor="tls_req" className="text-sm font-medium">TLS required</label>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                    <Link href={backHref} className="px-4 py-2 rounded border hover:bg-gray-50">
                        Cancel
                    </Link>
                    <button
                        onClick={onSubmit}
                        disabled={submitting}
                        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {submitting ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
