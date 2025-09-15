'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    InformationCircleIcon,
    FunnelIcon,
    // PaperAirplaneIcon, // [forward removed]
    ArchiveBoxIcon,
    StopIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    SparklesIcon,
    GlobeAltIcon,
    HashtagIcon,
    UserIcon,
    AtSymbolIcon,
    DocumentTextIcon,
    AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
} from '@heroicons/react/24/solid';

/* ----------------------------- Types ----------------------------- */

type Company = { id: number; name: string | null };
type DomainBrief = { id: number; domain: string | null };

type ExpressionType = 'match_header' | 'match_recipient' | 'match_sender' | 'catch_all';

// Forward option removed. Keeping a commented stub for a future re‑enable.
// type Destination =
//     | { type: 'forward'; to: string[]; meta?: { priority?: number; description?: string } }
//     | { type: 'store';   notify: string[]; meta?: { priority?: number; description?: string } };

// Only "store" destination remains
type Destination = { type: 'store'; notify: string[]; meta?: { priority?: number; description?: string } };

// Forward action removed from allowed actions
// type RouteAction = 'forward' | 'store' | 'stop';
type RouteAction = 'store' | 'stop';

type CreateRoutePayload = {
    pattern: string;
    action: RouteAction;
    domainId: number | null;
    dkim_required: 0 | 1;
    tls_required: 0 | 1;
    spam_threshold?: number;
    destination?: Destination;
};

/* ----------------------------- Helpers ----------------------------- */

const joinUrl = (base: string, path: string) =>
    `${(base || '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

const splitCSV = (s: string): string[] =>
    s
        .split(',')
        .map(x => x.trim())
        .filter(Boolean);

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

function parseDomainBriefs(raw: unknown): DomainBrief[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((v): DomainBrief | null => {
            if (typeof v !== 'object' || v === null) return null;
            const idRaw = (v as { id?: unknown }).id;
            const id =
                typeof idRaw === 'number'
                    ? idRaw
                    : typeof idRaw === 'string' && !Number.isNaN(Number(idRaw))
                        ? Number(idRaw)
                        : null;
            if (id === null) return null;
            const domainRaw = (v as { domain?: unknown }).domain;
            const domain = typeof domainRaw === 'string' ? domainRaw : null;
            return { id, domain };
        })
        .filter((x): x is DomainBrief => x !== null);
}

/* ----------------------------- Page ----------------------------- */

export default function InboundRouteCreateLikeMailgunPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

    const authHeaders = (): HeadersInit => {
        const token =
            typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    /* ----------- load company + domains for scope dropdown ----------- */
    const [company, setCompany] = useState<Company | null>(null);
    const [domains, setDomains] = useState<DomainBrief[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState<string | null>(null);

    useEffect(() => {
        if (!backend || !hash) return;
        let abort = false;

        (async () => {
            setLoading(true);
            setLoadErr(null);
            try {
                const cRes = await fetch(joinUrl(backend, `/companies/${hash}`), { headers: authHeaders() });
                if (!cRes.ok) throw new Error(`Failed to load company (${cRes.status})`);
                const c: Company = await cRes.json();
                if (!abort) setCompany(c);
            } catch (e) {
                if (!abort) setLoadErr(e instanceof Error ? e.message : 'Failed to load company');
            }
            try {
                const dRes = await fetch(joinUrl(backend, `/companies/${hash}/domains`), { headers: authHeaders() });
                if (dRes.ok) {
                    const raw: unknown = await dRes.json();
                    const norm = parseDomainBriefs(raw);
                    if (!abort) setDomains(norm);
                } else {
                    if (!abort) setDomains([]);
                }
            } catch {
                if (!abort) setDomains([]);
            } finally {
                if (!abort) setLoading(false);
            }
        })();

        return () => { abort = true; };
    }, [backend, hash]);

    /* --------------------------- form state --------------------------- */

    // Scope
    const [domainId, setDomainId] = useState<number | ''>('');

    // Expression
    const [exprType, setExprType] = useState<ExpressionType>('match_header');
    const [headerName, setHeaderName] = useState('');
    const [headerValue, setHeaderValue] = useState('');
    const [recipient, setRecipient] = useState('');
    const [sender, setSender] = useState('');

    // Actions (toggles)
    // const [forwardOn, setForwardOn] = useState(false); // [forward removed]
    const [storeOn, setStoreOn] = useState(false);
    const [stopOn, setStopOn] = useState(false);

    // Action payloads
    // const [forwardDestinations, setForwardDestinations] = useState(''); // [forward removed]
    const [storeNotifyUrls, setStoreNotifyUrls] = useState('');

    // Priority / Description
    const [priority, setPriority] = useState<string>('0');
    const [description, setDescription] = useState('');

    // Constraints
    const [spamThreshold, setSpamThreshold] = useState<string>('');
    const [dkimRequired, setDkimRequired] = useState(false);
    const [tlsRequired, setTlsRequired] = useState(false);

    // UX
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    const backHref = `/dashboard/company/${hash}/inbound/routes`;

    /* ----------------------------- validate ----------------------------- */

    function validate(): string | null {
        // Expression checks
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

        // At least one action must be selected (only Store or Stop now)
        if (!storeOn && !stopOn) {
            return 'Select at least one action (Store & notify, or Stop).';
        }

        // Forward validations removed
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
        const pattern = buildPattern(exprType, {
            headerName, headerValue, recipient, sender,
        });

        // Build outbound action + destination (forward removed)
        const selected: Array<'store' | 'stop'> = [];
        if (storeOn) selected.push('store');
        if (stopOn) selected.push('stop');

        const primary = selected[0];

        let destination: Destination | undefined;
        if (primary === 'store') {
            destination = {
                type: 'store',
                notify: splitCSV(storeNotifyUrls),
                meta: {
                    priority: priority.trim() === '' ? undefined : Number(priority),
                    description: description.trim() || undefined,
                },
            };
        } else {
            // For stop, we keep the same backend shape (destination optional / harmless)
            destination = {
                type: 'store',
                notify: [],
                meta: {
                    priority: priority.trim() === '' ? undefined : Number(priority),
                    description: `(stop) ${description.trim()}`.trim(),
                },
            };
        }

        const payload: CreateRoutePayload = {
            pattern,
            action: primary,
            domainId: domainId === '' ? null : Number(domainId),
            dkim_required: dkimRequired ? 1 as const : 0 as const,
            tls_required: tlsRequired ? 1 as const : 0 as const,
            destination,
        };
        if (spamThreshold.trim() !== '') payload.spam_threshold = Number(spamThreshold);

        if (destination && (storeOn || stopOn)) {
            (destination.meta ||= {}).description =
                [
                    (destination.meta?.description || description || '').trim(),
                    selected.slice(1).length ? `(also selected: ${selected.slice(1).join(', ')})` : '',
                ].filter(Boolean).join(' ');
        }

        setSubmitting(true);
        try {
            const res = await fetch(joinUrl(backend, `/companies/${hash}/inbound-routes`), {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                let msg = `Create failed (${res.status})`;
                try { const js = await res.json(); msg = js?.error || js?.message || msg; } catch {}
                throw new Error(msg);
            }
            setOk('Route created successfully.');
            setTimeout(() => router.push(backHref), 450);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Create failed');
        } finally {
            setSubmitting(false);
        }
    }

    /* ------------------------------ render ----------------------------- */

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-4xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="rounded-xl bg-gray-200 h-96" />
                    </div>
                </div>
            </div>
        );
    }

    if (loadErr) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Page</h2>
                    </div>
                    <p className="text-gray-600">{loadErr}</p>
                    <button
                        onClick={() => router.push(`/dashboard/company/${hash}`)}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(backHref)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Routes
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Create Inbound Route</h1>
                            {company?.name && (
                                <p className="text-sm text-gray-500">{company.name}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Alerts */}
                {ok && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                        <div className="flex items-center gap-3">
                            <CheckCircleSolid className="h-5 w-5 text-emerald-600" />
                            <p className="text-sm font-medium text-emerald-800">{ok}</p>
                        </div>
                    </div>
                )}
                {err && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                        <div className="flex items-center gap-3">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                            <p className="text-sm font-medium text-red-800">{err}</p>
                        </div>
                    </div>
                )}

                {/* Expression Section */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <FunnelIcon className="h-5 w-5" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider">
                                Expression & Filters
                            </h2>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <p className="text-sm text-gray-600">
                                Route filters are expressions that determine when an action is triggered.
                                If a route expression evaluates to true, the corresponding action(s) execute.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Expression Type
                                </label>
                                <select
                                    value={exprType}
                                    onChange={(e) => setExprType(e.target.value as ExpressionType)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="match_header">Match Header</option>
                                    <option value="match_recipient">Match Recipient</option>
                                    <option value="match_sender">Match Sender</option>
                                    <option value="catch_all">Catch All</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <GlobeAltIcon className="inline h-4 w-4 mr-1" />
                                    Domain Scope
                                </label>
                                <select
                                    value={domainId}
                                    onChange={(e) => setDomainId(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">All domains</option>
                                    {domains.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.domain ?? `#${d.id}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {exprType === 'match_header' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <DocumentTextIcon className="inline h-4 w-4 mr-1" />
                                        Header Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        placeholder="X-Header-Name"
                                        value={headerName}
                                        onChange={(e) => setHeaderName(e.target.value)}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Uses the specified header name to match against
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Header Value <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        placeholder="Header value"
                                        value={headerValue}
                                        onChange={(e) => setHeaderValue(e.target.value)}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Matches if the specified value equals the header value
                                    </p>
                                </div>
                            </div>
                        )}

                        {exprType === 'match_recipient' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <AtSymbolIcon className="inline h-4 w-4 mr-1" />
                                    Recipient Pattern <span className="text-red-500">*</span>
                                </label>
                                <input
                                    placeholder="help@*, *@inbound.example.com"
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Use wildcards (*) to match patterns
                                </p>
                            </div>
                        )}

                        {exprType === 'match_sender' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <UserIcon className="inline h-4 w-4 mr-1" />
                                    Sender Pattern <span className="text-red-500">*</span>
                                </label>
                                <input
                                    placeholder="sales@*, *@partner.com"
                                    value={sender}
                                    onChange={(e) => setSender(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Use wildcards (*) to match patterns
                                </p>
                            </div>
                        )}

                        {exprType === 'catch_all' && (
                            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                                <div className="flex items-center gap-2">
                                    <InformationCircleIcon className="h-5 w-5 text-blue-600" />
                                    <p className="text-sm text-blue-800">
                                        This route will match all incoming messages not caught by other routes
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Section */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <SparklesIcon className="h-5 w-5" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider">
                                Actions
                            </h2>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Forward Action removed (commented for future implementation) */}
                        {false && (
                            <div className="rounded-lg border border-gray-200 p-4">
                                <div className="flex items-start gap-3">
                                    <input type="checkbox" id="act-forward" className="mt-1 rounded border-gray-300" />
                                    <div className="flex-1">
                                        <label htmlFor="act-forward" className="flex items-center gap-2 text-sm font-medium text-gray-900 cursor-pointer">
                                            {/* <PaperAirplaneIcon className="h-4 w-4 text-blue-600" /> */}
                                            Forward (disabled)
                                        </label>
                                        <p className="mt-1 text-sm text-gray-600">
                                            This option has been temporarily removed and will return in a future version.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Store Action */}
                        <div className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={storeOn}
                                    onChange={(e) => setStoreOn(e.target.checked)}
                                    id="act-store"
                                    className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="flex-1">
                                    <label htmlFor="act-store" className="flex items-center gap-2 text-sm font-medium text-gray-900 cursor-pointer">
                                        <ArchiveBoxIcon className="h-4 w-4 text-emerald-600" />
                                        Store and Notify
                                    </label>
                                    <p className="mt-1 text-sm text-gray-600">
                                        Stores the message temporarily so you can retrieve it later. You can combine multiple
                                        retrieval callback URLs separated by commas. If you don&apos;t specify a URL, you can fetch
                                        the message later via API.
                                    </p>
                                    {storeOn && (
                                        <textarea
                                            rows={2}
                                            placeholder="https://myapp.com/callback"
                                            value={storeNotifyUrls}
                                            onChange={(e) => setStoreNotifyUrls(e.target.value)}
                                            className="mt-3 w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Stop Action */}
                        <div className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={stopOn}
                                    onChange={(e) => setStopOn(e.target.checked)}
                                    id="act-stop"
                                    className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="flex-1">
                                    <label htmlFor="act-stop" className="flex items-center gap-2 text-sm font-medium text-gray-900 cursor-pointer">
                                        <StopIcon className="h-4 w-4 text-red-600" />
                                        Stop
                                    </label>
                                    <p className="mt-1 text-sm text-gray-600">
                                        Sets the priority waterfall so the subsequent routes will not be evaluated.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Settings */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <AdjustmentsHorizontalIcon className="h-5 w-5" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider">
                                Additional Settings
                            </h2>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Priority & Description */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <HashtagIcon className="inline h-4 w-4 mr-1" />
                                    Priority
                                </label>
                                <input
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    placeholder="0"
                                    type="number"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Lower numbers = higher priority
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    placeholder="Optional note for this route"
                                />
                            </div>
                        </div>

                        {/* Constraints */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Security Constraints</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <ExclamationTriangleIcon className="inline h-4 w-4 mr-1" />
                                        Spam Threshold
                                    </label>
                                    <input
                                        value={spamThreshold}
                                        onChange={(e) => setSpamThreshold(e.target.value)}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        placeholder="e.g. 5.0"
                                        type="number"
                                        step={0.1}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={dkimRequired}
                                            onChange={(e) => setDkimRequired(e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">
                                            <ShieldCheckIcon className="inline h-4 w-4 mr-1" />
                                            DKIM Required
                                        </span>
                                    </label>
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={tlsRequired}
                                            onChange={(e) => setTlsRequired(e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">
                                            <ShieldCheckIcon className="inline h-4 w-4 mr-1" />
                                            TLS Required
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                    <Link
                        href={backHref}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                    >
                        Cancel
                    </Link>
                    <button
                        onClick={onSubmit}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {submitting ? (
                            <>
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon className="h-4 w-4" />
                                Create Route
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
