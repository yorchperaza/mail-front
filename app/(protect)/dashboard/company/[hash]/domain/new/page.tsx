'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    GlobeAltIcon,
    ShieldCheckIcon,
    InformationCircleIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    PlusIcon,
    XMarkIcon,
    DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

/* ----------------------------- Types ----------------------------- */

type TxtLike = string | { name?: string; value: string };

type DnsTxt = TxtLike;

type DnsMx = string | { host: string; priority?: number };

type DnsDkim = Record<string, string | { selector?: string; value: string }> | null;

type DnsRecords = {
    spf_expected?: TxtLike | TxtLike[] | null;   // simplified to avoid array inside the item
    dmarc_expected?: TxtLike | null;             // simplified to a single TXT-like
    mx_expected?: DnsMx[] | null;
    dkim?: DnsDkim;
};

type CreatedDomain = {
    id: number;
    domain: string;
    status: 'pending' | 'verified' | string | null;
    created_at: string | null;
    txt?: DnsTxt[] | null;
    records: DnsRecords;
    smtp: {
        host: string;
        ip: string;
        ports: number[];
        tls: { starttls: boolean; implicit: boolean };
        username: string;
        password: string;
        ip_pool?: string | null;
    };
};

type ApiError = {
    error: true;
    message: string;
    fields?: Record<string, string>;
};

/* --------------------------- UI Helpers -------------------------- */

function Toast({
                   kind = 'info',
                   text,
                   onClose,
               }: {
    kind?: 'info' | 'success' | 'error';
    text: string;
    onClose: () => void;
}) {
    const styles = {
        success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        error: 'bg-rose-50 border-rose-200 text-rose-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
    } as const;

    return (
        <div
            className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border px-4 py-3 shadow-lg ${styles[kind]}`}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{text}</span>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1 hover:bg-white/40 transition-colors"
                    aria-label="Close"
                    title="Close"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function GradientSection({
                             icon,
                             title,
                             from,
                             to,
                             children,
                         }: {
    icon: React.ReactNode;
    title: string;
    from: string;
    to: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className={`bg-gradient-to-r ${from} ${to} px-6 py-4`}>
                <div className="flex items-center gap-2 text-white">
                    {icon}
                    <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
                </div>
            </div>
            <div className="p-6 space-y-4">{children}</div>
        </div>
    );
}

/* ---------------------------- Utilities -------------------------- */

const DOMAIN_RE =
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

const copy = async (
    text: string,
    toast: (k: 'info' | 'success' | 'error', t: string) => void
) => {
    try {
        await navigator.clipboard.writeText(text);
        toast('success', 'Copied to clipboard');
    } catch {
        toast('error', 'Copy failed');
    }
};

function txtToRow(t: DnsTxt): { name: string; value: string } {
    return typeof t === 'string' ? { name: '@', value: t } : { name: t.name ?? '@', value: t.value };
}

function spfToRows(v: DnsRecords['spf_expected']): Array<{ name: string; value: string }> {
    if (!v) return [];
    const toRow = (x: TxtLike): { name: string; value: string } =>
        typeof x === 'string' ? { name: '@', value: x } : { name: x.name ?? '@', value: x.value };
    return Array.isArray(v) ? v.map(toRow) : [toRow(v)];
}

function dmarcToRow(v: DnsRecords['dmarc_expected']): { name: string; value: string } | null {
    if (!v) return null;
    return typeof v === 'string' ? { name: '_dmarc', value: v } : { name: v.name ?? '_dmarc', value: v.value };
}

function mxToRows(v: DnsRecords['mx_expected']): Array<{ name: string; value: string }> {
    if (!v) return [];
    return v.map((mx) => {
        if (typeof mx === 'string') return { name: '@', value: mx };
        const pr = typeof mx.priority === 'number' ? ` (prio ${mx.priority})` : '';
        return { name: '@', value: `${mx.host}${pr}` };
    });
}

function dkimToRows(d: DnsDkim): Array<{ name: string; value: string }> {
    if (!d) return [];
    const out: Array<{ name: string; value: string }> = [];
    for (const key of Object.keys(d)) {
        const v = d[key];
        if (typeof v === 'string') out.push({ name: `${key}._domainkey`, value: v });
        else out.push({ name: `${(v.selector ?? key)}._domainkey`, value: v.value });
    }
    return out;
}

/* ---------------------------- Page ------------------------------- */

export default function CreateDomainPage() {
    const router = useRouter();
    const params = useParams<{ hash: string }>();
    const hash = params.hash;

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const backHref = `/dashboard/company/${hash}/domain`;

    // Form state
    const [domain, setDomain] = useState('');
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState<ApiError | null>(null);
    const [created, setCreated] = useState<CreatedDomain | null>(null);
    const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);

    const showToast = (kind: 'info' | 'success' | 'error', text: string) => {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 3000);
    };

    const domainErr = useMemo(() => {
        const v = domain.trim();
        if (!v) return 'Domain is required';
        if (!DOMAIN_RE.test(v)) return 'Enter a valid domain (e.g. example.com)';
        return null;
    }, [domain]);

    const canSubmit = useMemo(() => !saving && !domainErr && !!domain.trim(), [saving, domainErr, domain]);

    async function onCreate() {
        if (!backend) return setApiError({ error: true, message: 'Missing backend URL' });
        if (domainErr) return;

        setSaving(true);
        setApiError(null);

        try {
            const res = await fetch(`${backend}/companies/${hash}/domains`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ domain: domain.trim().toLowerCase() }),
            });

            if (!res.ok) {
                const errJson: ApiError = await res
                    .json()
                    .catch(() => ({ error: true, message: `Create failed (${res.status})` } as ApiError));
                setApiError(errJson);
                showToast('error', errJson.message || 'Create failed');
                return;
            }

            const payload = (await res.json()) as CreatedDomain;
            // defensive defaults for optional fields
            payload.records = payload.records || {};
            payload.txt = payload.txt ?? null;
            setCreated(payload);
            showToast('success', `Domain "${payload.domain}" created`);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setApiError({ error: true, message });
            showToast('error', message);
        } finally {
            setSaving(false);
        }
    }

    // Derived DNS rows
    const spfRows = useMemo(() => spfToRows(created?.records?.spf_expected ?? null), [created]);
    const dmarcRow = useMemo(() => dmarcToRow(created?.records?.dmarc_expected ?? null), [created]);
    const mxRows = useMemo(() => mxToRows(created?.records?.mx_expected ?? null), [created]);
    const dkimRows = useMemo(() => dkimToRows(created?.records?.dkim ?? null), [created]);
    const extraTxt = useMemo(() => (created?.txt ?? []).map(txtToRow), [created]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-3xl mx-auto p-6 space-y-6">
                {toast && <Toast kind={toast.kind} text={toast.text} onClose={() => setToast(null)} />}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(backHref)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Domains
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Add New Domain</h1>
                            <p className="text-sm text-gray-500">Connect a sending domain and verify DNS</p>
                        </div>
                    </div>
                </div>

                {/* Create Domain */}
                <GradientSection
                    icon={<GlobeAltIcon className="h-5 w-5" />}
                    title="Domain Details"
                    from="from-blue-500"
                    to="to-blue-600"
                >
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <GlobeAltIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                            Domain *
                        </label>
                        <input
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            placeholder="example.com"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            disabled={!!created}
                            inputMode="url"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                        {domainErr && !created && (
                            <p className="mt-2 text-sm text-rose-700 flex items-start gap-2">
                                <ExclamationTriangleIcon className="h-4 w-4 mt-0.5" /> {domainErr}
                            </p>
                        )}
                    </div>

                    {apiError && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 flex items-start gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4 text-rose-600 mt-0.5" />
                            <div className="text-sm text-rose-800">{apiError.message}</div>
                        </div>
                    )}

                    {created ? (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                            <div className="flex items-start gap-3">
                                <CheckCircleSolid className="h-5 w-5 text-emerald-600 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-emerald-900">Domain created!</p>
                                    <p className="text-xs text-emerald-700 mt-1">
                                        <span className="font-semibold">{created.domain}</span>
                                        {created.status ? (
                                            <>
                                                {' '}• Status: <span className="uppercase">{String(created.status)}</span>
                                            </>
                                        ) : null}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={onCreate}
                            disabled={!canSubmit}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                        >
                            <PlusIcon className="h-5 w-5" />
                            {saving ? 'Adding…' : 'Add Domain'}
                        </button>
                    )}
                </GradientSection>

                {/* DNS Instructions (only after create) */}
                <div className={`${created ? 'opacity-100' : 'opacity-50 pointer-events-none'} transition-opacity`}>
                    <GradientSection
                        icon={<ShieldCheckIcon className="h-5 w-5" />}
                        title="Verify DNS"
                        from="from-indigo-500"
                        to="to-indigo-600"
                    >
                        <p className="text-sm text-gray-600 -mt-1">
                            Add the DNS records below at your DNS provider for <span className="font-semibold">{created?.domain || 'your domain'}</span>.
                            After adding, return to the Domains list to verify.
                        </p>

                        {/* Records Table */}
                        <div className="rounded-lg border border-gray-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name / Host</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Value</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">TTL</th>
                                    <th className="px-4 py-3" />
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                {/* SPF */}
                                {spfRows.map((r, i) => (
                                    <tr key={`spf-${i}`} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono">TXT</td>
                                        <td className="px-4 py-3 font-mono">{r.name}</td>
                                        <td className="px-4 py-3 font-mono break-all">{r.value}</td>
                                        <td className="px-4 py-3">3600</td>
                                        <td className="px-2 py-3 text-right">
                                            <button
                                                onClick={() => copy(r.value, showToast)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                                            >
                                                <DocumentDuplicateIcon className="h-4 w-4" /> Copy
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* DMARC */}
                                {dmarcRow && (
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono">TXT</td>
                                        <td className="px-4 py-3 font-mono">{dmarcRow.name}</td>
                                        <td className="px-4 py-3 font-mono break-all">{dmarcRow.value}</td>
                                        <td className="px-4 py-3">3600</td>
                                        <td className="px-2 py-3 text-right">
                                            <button
                                                onClick={() => copy(dmarcRow.value, showToast)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                                            >
                                                <DocumentDuplicateIcon className="h-4 w-4" /> Copy
                                            </button>
                                        </td>
                                    </tr>
                                )}

                                {/* MX */}
                                {mxRows.map((r, i) => (
                                    <tr key={`mx-${i}`} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono">MX</td>
                                        <td className="px-4 py-3 font-mono">{r.name}</td>
                                        <td className="px-4 py-3 font-mono break-all">{r.value}</td>
                                        <td className="px-4 py-3">3600</td>
                                        <td className="px-2 py-3 text-right">
                                            <button
                                                onClick={() => copy(r.value, showToast)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                                            >
                                                <DocumentDuplicateIcon className="h-4 w-4" /> Copy
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* DKIM */}
                                {dkimRows.map((r, i) => (
                                    <tr key={`dkim-${i}`} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono">TXT</td>
                                        <td className="px-4 py-3 font-mono">{r.name}</td>
                                        <td className="px-4 py-3 font-mono break-all">{r.value}</td>
                                        <td className="px-4 py-3">3600</td>
                                        <td className="px-2 py-3 text-right">
                                            <button
                                                onClick={() => copy(r.value, showToast)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                                            >
                                                <DocumentDuplicateIcon className="h-4 w-4" /> Copy
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Extra TXT records (if any) */}
                        {extraTxt.length > 0 && (
                            <div className="rounded-lg border border-gray-200 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200 mt-4">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                                        <th />
                                    </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                    {extraTxt.map((r, i) => (
                                        <tr key={`txt-${i}`} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-mono">TXT</td>
                                            <td className="px-4 py-3 font-mono">{r.name}</td>
                                            <td className="px-4 py-3 font-mono break-all">{r.value}</td>
                                            <td className="px-2 py-3 text-right">
                                                <button
                                                    onClick={() => copy(r.value, showToast)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                                                >
                                                    <DocumentDuplicateIcon className="h-4 w-4" /> Copy
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 flex items-start gap-2 mt-4">
                            <InformationCircleIcon className="h-5 w-5 mt-0.5" />
                            <div className="text-sm">
                                If you already have an SPF record, merge our include into your existing one instead of adding a second SPF record.
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 justify-between">
                            <Link href={backHref} className="text-sm text-gray-600 hover:text-gray-800 transition-colors">
                                ← Back to all domains
                            </Link>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => router.push(backHref)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all"
                                >
                                    <CheckCircleIcon className="h-5 w-5" /> I&#39;ve added the records
                                </button>
                            </div>
                        </div>
                    </GradientSection>
                </div>

                {/* SMTP Credentials */}
                {created && created.smtp && (
                    <>
                        <GradientSection
                            icon={<InformationCircleIcon className="h-5 w-5" />}
                            title="SMTP Credentials"
                            from="from-emerald-500"
                            to="to-emerald-600"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-lg border border-gray-200 p-4">
                                    <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Server</div>
                                    <div className="space-y-1 text-sm">
                                        <div><span className="text-gray-500">Host:</span> <span className="font-mono">{created.smtp.host}</span></div>
                                        <div><span className="text-gray-500">IP:</span> <span className="font-mono">{created.smtp.ip}</span></div>
                                        <div><span className="text-gray-500">Ports:</span> <span className="font-mono">{created.smtp.ports.join(', ')}</span></div>
                                        <div>
                                            <span className="text-gray-500">TLS:</span>{' '}
                                            <span className="font-mono">STARTTLS={String(created.smtp.tls.starttls)} • ImplicitTLS={String(created.smtp.tls.implicit)}</span>
                                        </div>
                                        {created.smtp.ip_pool && (
                                            <div><span className="text-gray-500">IP Pool:</span> <span className="font-mono">{created.smtp.ip_pool}</span></div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-gray-200 p-4">
                                    <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Credentials</div>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <div className="text-gray-500">Username</div>
                                                <div className="font-mono break-all">{created.smtp.username}</div>
                                            </div>
                                            <button
                                                onClick={() => copy(created.smtp.username, showToast)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                                            >
                                                <DocumentDuplicateIcon className="h-4 w-4" /> Copy
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <div className="text-gray-500">Password</div>
                                                <div className="font-mono break-all">••••••••••••</div>
                                            </div>
                                            <button
                                                onClick={() => copy(created.smtp.password, showToast)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                                            >
                                                <DocumentDuplicateIcon className="h-4 w-4" /> Copy
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900 text-sm flex items-start gap-2">
                                <InformationCircleIcon className="h-5 w-5 mt-0.5" />
                                Use port <span className="mx-1 font-semibold">587</span> with STARTTLS in most cases. Port <span className="mx-1 font-semibold">465</span> is for implicit TLS.
                            </div>
                        </GradientSection>
                    </>
                )}

                {/* Help */}
                <GradientSection
                    icon={<InformationCircleIcon className="h-5 w-5" />}
                    title="Troubleshooting"
                    from="from-slate-500"
                    to="to-slate-700"
                >
                    <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                        <li>Use the exact <span className="font-mono">Host</span>/<span className="font-mono">Name</span> shown. Many DNS providers append the domain automatically.</li>
                        <li>Set TTL to 3600 or provider default.</li>
                        <li>After propagation, open the Domains page and click <em>Verify</em> for your domain.</li>
                    </ul>
                </GradientSection>
            </div>
        </div>
    );
}
