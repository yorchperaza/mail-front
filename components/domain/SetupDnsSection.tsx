// File: RecordsTab.tsx
'use client';

import React from 'react';
import copy from 'copy-to-clipboard';
import {
    ClipboardIcon,
    ArrowPathIcon,
    InformationCircleIcon,
    ServerIcon,
    ShieldCheckIcon,
    KeyIcon,
    DocumentTextIcon,
    EnvelopeIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
    XCircleIcon as XCircleSolid,
    ClockIcon as ClockSolid,
    ExclamationTriangleIcon as ExclamationTriangleSolid,
} from '@heroicons/react/24/solid';
import type { DomainDetail, MxRecord } from '@/types/domain';

/* ---------- Types ---------- */
type DkimExpected = { name?: string; value?: string };

type VerificationRecord = {
    status?: string;
    host?: string;
    expected?: unknown;
    found?: unknown;
    errors?: unknown;
};

type VerificationRecords = {
    verification_txt?: VerificationRecord;
    spf?: VerificationRecord;
    dmarc?: VerificationRecord;
    mx?: VerificationRecord;
    dkim?: VerificationRecord;

    // NEW (verification outputs if your verifier returns them)
    tlsrpt?: VerificationRecord;
    mta_sts?: VerificationRecord;
};

type VerificationReport = {
    checked_at?: string;
    records?: VerificationRecords;
};

/* ---------- Helpers ---------- */
function getObj<T extends object = Record<string, unknown>>(v: unknown): T | null {
    return v && typeof v === 'object' ? (v as T) : null;
}

/* ---------- Components ---------- */
function CodeChip({ children }: { children: React.ReactNode }) {
    return (
        <code className="inline-flex items-center rounded-md bg-gradient-to-r from-gray-100 to-gray-50 px-2 py-1 text-xs font-mono text-gray-700 border border-gray-200">
            {children}
        </code>
    );
}

function CopyBtn({ value, label = 'Copy' }: { value?: string | null; label?: string }) {
    const [copied, setCopied] = React.useState(false);
    if (!value) return null;

    return (
        <button
            type="button"
            onClick={() => {
                copy(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200 transition-colors"
            title={copied ? 'Copied!' : label}
        >
            {copied ? (
                <>
                    <CheckCircleSolid className="h-3.5 w-3.5" />
                    Copied
                </>
            ) : (
                <>
                    <ClipboardIcon className="h-3.5 w-3.5" />
                    {label}
                </>
            )}
        </button>
    );
}

function RecordRow({
                       type,
                       name,
                       value,
                       ttl = '3600',
                       priority,
                   }: {
    type: string;
    name: string | null | undefined;
    value: string | null | undefined;
    ttl?: string;
    priority?: number | null | undefined;
}) {
    const typeColors: Record<string, string> = {
        TXT: 'bg-blue-100 text-blue-700 border-blue-200',
        MX: 'bg-purple-100 text-purple-700 border-purple-200',
        CNAME: 'bg-amber-100 text-amber-700 border-amber-200',
        A: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };

    const typeClass = typeColors[type] || 'bg-gray-100 text-gray-700 border-gray-200';

    return (
        <tr className="hover:bg-gray-50 transition-colors">
            <td className="px-4 py-3 text-sm">
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold border ${typeClass}`}>
                    {type}
                </span>
            </td>
            <td className="px-4 py-3">
                <CodeChip>{name || '—'}</CodeChip>
            </td>
            <td className="px-4 py-3 max-w-[36rem]">
                <div className="flex items-center gap-2">
                    <CodeChip>{value || '—'}</CodeChip>
                    <CopyBtn value={value ?? undefined} />
                </div>
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">{ttl}s</td>
            <td className="px-4 py-3 text-sm text-gray-900">
                {typeof priority === 'number' ? (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        {priority}
                    </span>
                ) : (
                    '—'
                )}
            </td>
        </tr>
    );
}

function InfoNote({ children }: { children: React.ReactNode }) {
    return (
        <div className="mt-4 flex items-start gap-3 rounded-lg bg-blue-50 p-4 border border-blue-200">
            <InformationCircleIcon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">{children}</div>
        </div>
    );
}

function StatusBadge({ status }: { status?: string }) {
    const statusConfig = {
        pass: {
            icon: CheckCircleSolid,
            bgClass: 'bg-emerald-50',
            textClass: 'text-emerald-700',
            borderClass: 'border-emerald-200',
            label: 'Verified',
        },
        fail: {
            icon: XCircleSolid,
            bgClass: 'bg-red-50',
            textClass: 'text-red-700',
            borderClass: 'border-red-200',
            label: 'Failed',
        },
        skipped: {
            icon: ClockSolid,
            bgClass: 'bg-gray-50',
            textClass: 'text-gray-600',
            borderClass: 'border-gray-200',
            label: 'Skipped',
        },
        pending: {
            icon: ClockSolid,
            bgClass: 'bg-amber-50',
            textClass: 'text-amber-700',
            borderClass: 'border-amber-200',
            label: 'Pending',
        },
    };

    const config =
        statusConfig[(status || '').toLowerCase() as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${config.bgClass} ${config.textClass} border ${config.borderClass}`}
        >
            <Icon className="h-3.5 w-3.5" />
            {config.label}
        </span>
    );
}

function VerificationDetails({ record }: { record?: { host?: string; expected?: unknown; found?: unknown; errors?: unknown } }) {
    if (!record) return null;

    const PrettyValue = ({ value, type }: { value: unknown; type: 'expected' | 'found' | 'error' }) => {
        const colorClasses = {
            expected: 'bg-blue-50 border-blue-200',
            found: 'bg-emerald-50 border-emerald-200',
            error: 'bg-red-50 border-red-200',
        };

        const text =
            typeof value === 'string'
                ? value
                : (() => {
                    try {
                        return JSON.stringify(value, null, 2);
                    } catch {
                        return String(value);
                    }
                })();

        return (
            <pre className={`whitespace-pre-wrap break-all text-xs rounded-lg p-3 border font-mono ${colorClasses[type]}`}>
                {text}
            </pre>
        );
    };

    return (
        <div className="mt-4 grid sm:grid-cols-3 gap-4">
            <div>
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Host / Name</div>
                {record.host ? <CodeChip>{record.host}</CodeChip> : <span className="text-sm text-gray-500">Not specified</span>}
            </div>

            <div>
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Expected Value</div>
                <PrettyValue value={record.expected ?? '—'} type="expected" />
            </div>

            <div>
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Found Value</div>
                <PrettyValue value={record.found ?? '—'} type="found" />
                {record.errors !== undefined && record.errors !== null && (
                    <div className="mt-3">
                        <div className="text-xs font-medium text-red-700 uppercase tracking-wider mb-2">Errors</div>
                        <PrettyValue value={record.errors} type="error" />
                    </div>
                )}
            </div>
        </div>
    );
}

function DnsStepCard({
                         step,
                         title,
                         status,
                         subtitle,
                         icon,
                         children,
                         color = 'indigo',
                     }: {
    step: number;
    title: string;
    status?: string;
    subtitle?: React.ReactNode;
    icon: React.ReactNode;
    children: React.ReactNode;
    color?: 'indigo' | 'emerald' | 'amber' | 'purple' | 'blue';
}) {
    const colors = {
        indigo: 'from-indigo-500 to-indigo-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        purple: 'from-purple-500 to-purple-600',
        blue: 'from-blue-500 to-blue-600',
    };

    return (
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <header className={`bg-gradient-to-r ${colors[color]} px-6 py-4`}>
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur text-white text-sm font-bold">
                            {step}
                        </div>
                        <div className="flex items-center gap-2 text-white">
                            {icon}
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
                                {subtitle && <p className="text-xs text-white/80 mt-0.5">{subtitle}</p>}
                            </div>
                        </div>
                    </div>
                    <StatusBadge status={status} />
                </div>
            </header>
            <div className="p-6">{children}</div>
        </section>
    );
}

/* ---------- Main Component ---------- */
export default function SetupDnsSection({
                                            detail,
                                            onRefresh,
                                            loadingRefresh = false,
                                        }: {
    detail: DomainDetail;
    onRefresh: () => void;
    loadingRefresh?: boolean;
}) {
    const domain = detail.domain ?? '';
    const txtName = detail.txt?.name ?? '';
    const txtValue = detail.txt?.value ?? '';
    const spf = detail.records?.spf_expected ?? '';
    const dmarcVal = detail.records?.dmarc_expected ?? '';
    const mx = (detail.records?.mx_expected ?? []) as MxRecord[];
    const dmarcName = `_dmarc.${domain}`;

    // DKIM expected (optional) — no any
    const recObj = getObj(detail.records);
    const dkim = (recObj?.dkim_expected ?? null) as DkimExpected | null;

    // NEW: TLS-RPT & MTA-STS expected (from controller)
    const tlsrpt = getObj(recObj?.tlsrpt) as
        | { name?: string; type?: string; value?: string; ttl?: number | string; rua?: string }
        | null;

    const mtaSts = getObj(recObj?.mta_sts) as
        | {
        policy_txt?: { name?: string; type?: string; value?: string; ttl?: number | string };
        host?: { name?: string; type?: string; value?: string; ttl?: number | string };
        acme_delegate?: { name?: string; type?: string; value?: string; ttl?: number | string };
    }
        | null;

    const mtaStsPolicyUrl = (recObj?.mta_sts_policy_url as string | undefined) ?? undefined;

    // Verification report — no any
    const detailObj = getObj(detail) as Record<string, unknown> | null;
    const report = (detailObj?.verification_report ?? null) as VerificationReport | null;
    const lastChecked = report?.checked_at ?? ((detailObj?.last_checked_at as string | undefined) ?? null);
    const recs: VerificationRecords = report?.records ?? {};

    const formatTime = (iso?: string | null) => {
        if (!iso) return 'Never';
        try {
            const d = new Date(iso);
            return d.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return String(iso);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                            <ServerIcon className="h-5 w-5" />
                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wider">DNS Configuration for {domain}</h2>
                                <p className="text-xs text-indigo-100 mt-0.5">Complete all steps in your DNS provider</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={loadingRefresh}
                            className="inline-flex items-center gap-2 rounded-lg bg-white/20 backdrop-blur px-4 py-2 text-sm font-medium text-white hover:bg-white/30 disabled:opacity-50 transition-all"
                        >
                            <ArrowPathIcon className={`h-4 w-4 ${loadingRefresh ? 'animate-spin' : ''}`} />
                            {loadingRefresh ? 'Verifying…' : 'Verify DNS'}
                        </button>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-3 border-t border-indigo-400/20">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Last verification check:</span>
                        <span className="font-medium text-gray-900">{formatTime(lastChecked)}</span>
                    </div>
                </div>
            </div>

            {/* Step 1: Domain Verification */}
            <DnsStepCard
                step={1}
                title="Domain Verification"
                status={recs?.verification_txt?.status}
                subtitle="Confirm domain ownership with TXT record"
                icon={<ShieldCheckIcon className="h-5 w-5" />}
                color="blue"
            >
                <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Name / Host
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Value</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">TTL</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Priority
                            </th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                        <RecordRow type="TXT" name={txtName} value={txtValue} ttl="3600" />
                        </tbody>
                    </table>
                </div>

                <VerificationDetails record={recs?.verification_txt} />

                <InfoNote>
                    <strong>Note:</strong> Use <code className="font-mono">@</code> for the root domain. TTL can be set to 3600 seconds
                    (1 hour) or &quot;Auto&quot; if available.
                </InfoNote>
            </DnsStepCard>

            {/* Step 2: SPF Configuration */}
            <DnsStepCard
                step={2}
                title="SPF Authentication"
                status={recs?.spf?.status}
                subtitle="Authorize email sending servers"
                icon={<EnvelopeIcon className="h-5 w-5" />}
                color="emerald"
            >
                <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Name / Host
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Value</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">TTL</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Priority
                            </th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                        <RecordRow type="TXT" name="@" value={spf} ttl="3600" />
                        </tbody>
                    </table>
                </div>

                <VerificationDetails record={recs?.spf} />

                <InfoNote>
                    <strong>Important:</strong> Only one SPF record is allowed per domain. If you have existing SPF records, merge them
                    into a single record. Example:{' '}
                    <code className="font-mono text-xs">v=spf1 include:monkeysmail.com include:google.com ~all</code>
                </InfoNote>
            </DnsStepCard>

            {/* Step 3: DMARC Policy */}
            <DnsStepCard
                step={3}
                title="DMARC Policy"
                status={recs?.dmarc?.status}
                subtitle="Email authentication and reporting"
                icon={<DocumentTextIcon className="h-5 w-5" />}
                color="amber"
            >
                <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Name / Host
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Value</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">TTL</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Priority
                            </th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                        <RecordRow type="TXT" name={dmarcName} value={dmarcVal} ttl="3600" />
                        </tbody>
                    </table>
                </div>

                <VerificationDetails record={recs?.dmarc} />

                <InfoNote>
                    <strong>Recommendation:</strong> Start with <code className="font-mono">p=none</code> for monitoring. After
                    analyzing reports, gradually move to <code className="font-mono">p=quarantine</code> or{' '}
                    <code className="font-mono">p=reject</code> for full protection.
                </InfoNote>
            </DnsStepCard>

            {/* Step 4: MX Records */}
            <DnsStepCard
                step={4}
                title="MX Records"
                status={recs?.mx?.status}
                subtitle="Mail server configuration (optional for receiving email)"
                icon={<EnvelopeIcon className="h-5 w-5" />}
                color="purple"
            >
                <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Name / Host
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Value / Target
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">TTL</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Priority
                            </th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                        {mx.length > 0 ? (
                            mx.map((r, i) => (
                                <RecordRow
                                    key={`mx-${i}`}
                                    type="MX"
                                    name={r.host ?? '@'}
                                    value={r.value ?? 'smtp.monkeysmail.com'}
                                    ttl="3600"
                                    priority={typeof r.priority === 'number' ? r.priority : 10}
                                />
                            ))
                        ) : (
                            <RecordRow type="MX" name="@" value="smtp.monkeysmail.com" ttl="3600" priority={10} />
                        )}
                        </tbody>
                    </table>
                </div>

                <VerificationDetails record={recs?.mx} />

                <InfoNote>
                    <strong>Note:</strong> MX records are only needed if you want to receive emails at this domain. Some providers
                    require the trailing dot (e.g., <code className="font-mono">smtp.monkeysmail.com.</code>), while others don&apos;t.
                </InfoNote>
            </DnsStepCard>

            {/* Step 5: DKIM Signature */}
            <DnsStepCard
                step={5}
                title="DKIM Signature"
                status={recs?.dkim?.status}
                subtitle="Email signature verification"
                icon={<KeyIcon className="h-5 w-5" />}
                color="indigo"
            >
                <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Name / Host
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Value</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">TTL</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Priority
                            </th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                        <RecordRow type="TXT" name={dkim?.name ?? ''} value={dkim?.value ?? ''} ttl="3600" />
                        </tbody>
                    </table>
                </div>

                <VerificationDetails record={recs?.dkim} />

                <InfoNote>
                    <strong>Important:</strong> Include the complete DKIM value starting with
                    <code className="font-mono"> v=DKIM1; k=rsa; p=…</code>. The selector is the subdomain before{' '}
                    <code className="font-mono">._domainkey</code>.
                </InfoNote>
            </DnsStepCard>

            {/* NEW Step 6: TLS-RPT Reporting */}
            <DnsStepCard
                step={6}
                title="TLS-RPT Reporting"
                status={recs?.tlsrpt?.status}
                subtitle="Enable SMTP TLS failure reports"
                icon={<ShieldCheckIcon className="h-5 w-5" />}
                color="blue"
            >
                <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Name / Host
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Value</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">TTL</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Priority
                            </th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                        <RecordRow
                            type={tlsrpt?.type ?? 'TXT'}
                            name={tlsrpt?.name ?? `_smtp._tls.${domain}`}
                            value={tlsrpt?.value ?? 'v=TLSRPTv1; rua=mailto:tlsrpt@monkeyslegion.com'}
                            ttl={`${tlsrpt?.ttl ?? '3600'}`}
                        />
                        </tbody>
                    </table>
                </div>

                <VerificationDetails record={recs?.tlsrpt} />

                <InfoNote>
                    <strong>Tip:</strong> The report address can be your mailbox (e.g.{' '}
                    <code className="font-mono">mailto:tlsrpt@{domain}</code>) or our managed inbox{' '}
                    <code className="font-mono">mailto:tlsrpt@monkeyslegion.com</code>.
                </InfoNote>
            </DnsStepCard>

            {/* NEW Step 7: MTA-STS */}
            <DnsStepCard
                step={7}
                title="MTA-STS Policy"
                status={recs?.mta_sts?.status}
                subtitle="Enforce TLS for inbound mail delivery"
                icon={<InformationCircleIcon className="h-5 w-5" />}
                color="emerald"
            >
                <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Name / Host
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Value</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">TTL</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Priority
                            </th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                        {/* TXT id */}
                        <RecordRow
                            type={mtaSts?.policy_txt?.type ?? 'TXT'}
                            name={mtaSts?.policy_txt?.name ?? `_mta-sts.${domain}`}
                            value={mtaSts?.policy_txt?.value ?? 'v=STSv1; id=sts-YYYYMMDD'}
                            ttl={`${mtaSts?.policy_txt?.ttl ?? '3600'}`}
                        />
                        {/* mta-sts host (CNAME to managed edge) */}
                        <RecordRow
                            type={mtaSts?.host?.type ?? 'CNAME'}
                            name={mtaSts?.host?.name ?? `mta-sts.${domain}`}
                            value={mtaSts?.host?.value ?? 'mta-sts.monkeysmail.com.'}
                            ttl={`${mtaSts?.host?.ttl ?? '3600'}`}
                        />
                        {/* Optional ACME delegation for certs */}
                        <RecordRow
                            type={mtaSts?.acme_delegate?.type ?? 'CNAME'}
                            name={mtaSts?.acme_delegate?.name ?? `_acme-challenge.mta-sts.${domain}`}
                            value={mtaSts?.acme_delegate?.value ?? `_acme-challenge.${domain}.auth.monkeysmail.com.`}
                            ttl={`${mtaSts?.acme_delegate?.ttl ?? '3600'}`}
                        />
                        </tbody>
                    </table>
                </div>

                <VerificationDetails record={recs?.mta_sts} />

                <InfoNote>
                    <div className="space-y-1">
                        <div>
                            <strong>Policy URL:</strong>{' '}
                            <a
                                href={mtaStsPolicyUrl || 'https://mta-sts.monkeysmail.com/.well-known/mta-sts.txt'}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                            >
                                {mtaStsPolicyUrl || 'https://mta-sts.monkeysmail.com/.well-known/mta-sts.txt'}
                            </a>
                        </div>
                        <div>
                            After publishing the DNS records, set your policy file at the URL above. We host a managed policy if you
                            use our CNAME.
                        </div>
                    </div>
                </InfoNote>
            </DnsStepCard>

            {/* Propagation Notice */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-start gap-3">
                    <ExclamationTriangleSolid className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-900">
                        <strong>DNS Propagation:</strong> Changes can take anywhere from a few minutes to 48 hours to propagate
                        globally. Most changes are visible within 1–4 hours. Click &quot;Verify DNS&quot; to check the current status of your
                        records.
                    </div>
                </div>
            </div>
        </div>
    );
}
