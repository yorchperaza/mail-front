'use client';

import React from 'react';
import copy from 'copy-to-clipboard';
import {
    CheckIcon,
    ClipboardIcon,
    ArrowPathIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { DomainDetail, MxRecord } from '@/types/domain';

/* ---------- Narrow helper types to avoid `any` ---------- */
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
};

type VerificationReport = {
    checked_at?: string;
    records?: VerificationRecords;
};

/* ---------- Tiny building blocks ---------- */
function CodeChip({ children }: { children: React.ReactNode }) {
    return (
        <code className="font-mono text-[11px] md:text-xs bg-gray-100 rounded px-2 py-1 break-all">
            {children}
        </code>
    );
}

function CopyBtn({ value }: { value?: string | null }) {
    const [copied, setCopied] = React.useState(false);
    if (!value) return null;
    return (
        <button
            type="button"
            onClick={() => {
                copy(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 900);
            }}
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-gray-200"
            title={copied ? 'Copied' : 'Copy'}
        >
            {copied ? (
                <CheckIcon className="h-4 w-4 text-green-600" />
            ) : (
                <ClipboardIcon className="h-4 w-4 text-gray-600" />
            )}
        </button>
    );
}

function Row({
                 type,
                 name,
                 value,
                 ttl = '1 hour',
                 priority,
             }: {
    type: string;
    name: string | null | undefined;
    value: string | null | undefined;
    ttl?: string;
    priority?: number | null | undefined;
}) {
    return (
        <tr className="border-b last:border-0">
            <td className="py-2 pr-4 text-sm">
                <span className="rounded bg-gray-100 px-2 py-0.5">{type}</span>
            </td>
            <td className="py-2 pr-4">
                <CodeChip>{name || '—'}</CodeChip>
            </td>
            <td className="py-2 pr-2 max-w-[36rem]">
                <div className="flex items-center gap-2">
                    <CodeChip>{value || '—'}</CodeChip>
                    <CopyBtn value={value ?? undefined} />
                </div>
            </td>
            <td className="py-2 pr-4">{ttl}</td>
            <td className="py-2 pr-4">{typeof priority === 'number' ? priority : '—'}</td>
        </tr>
    );
}

function Note({ children }: { children: React.ReactNode }) {
    return (
        <div className="mt-3 text-sm text-gray-700 flex items-start gap-2">
            <InformationCircleIcon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>{children}</div>
        </div>
    );
}

/* ---------- Status pill (per card) ---------- */
function StatusPill({ status }: { status?: string }) {
    const s = (status || '').toLowerCase();
    const map: Record<string, string> = {
        pass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        fail: 'bg-red-50 text-red-700 ring-red-200',
        skipped: 'bg-gray-50 text-gray-600 ring-gray-200',
        pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    };
    const cls = map[s] || map.pending;
    const label = s ? s[0].toUpperCase() + s.slice(1) : 'Pending';
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${cls}`}>
      {label}
    </span>
    );
}

/* ---------- Expected/Found/Errors block ---------- */
function DetailsBlock({
                          record,
                      }: {
    record?: { host?: string; expected?: unknown; found?: unknown; errors?: unknown };
}) {
    if (!record) return null;

    const Pretty = ({ value }: { value: unknown }) => (
        <pre className="whitespace-pre-wrap break-all text-xs bg-gray-50 rounded-md p-2 ring-1 ring-gray-200">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
    );

    return (
        <div className="mt-4 grid sm:grid-cols-3 gap-3">
            <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Host / Name</div>
                <div className="text-sm">
                    {record.host ? <CodeChip>{record.host}</CodeChip> : <span className="text-gray-500">—</span>}
                </div>
            </div>
            <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Expected</div>
                <Pretty value={record.expected ?? '—'} />
            </div>
            <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Found</div>
                <Pretty value={record.found ?? '—'} />
                {record.errors ? (
                    <div className="mt-2 text-xs text-red-700">
                        <div className="font-medium">Errors</div>
                        <Pretty value={record.errors} />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

/* ---------- Step wrapper with *inline* status ---------- */
function StepCard({
                      step,
                      title,
                      status,
                      subtitle,
                      children,
                      accent = 'border-blue-200',
                  }: {
    step: number;
    title: string;
    status?: string;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    accent?: string;
}) {
    return (
        <section className={`rounded-xl border ${accent} bg-white shadow-sm overflow-hidden`}>
            <header className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b bg-gradient-to-br from-gray-50 to-white">
                <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">
                        {step}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
                        {subtitle ? <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p> : null}
                    </div>
                </div>
                <div className="pt-1">
                    <StatusPill status={status} />
                </div>
            </header>
            <div className="p-4 sm:p-5">{children}</div>
        </section>
    );
}

/* ---------- Main section ---------- */
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

    // DKIM expected (optional, not declared on DomainDetail)
    const dkim =
        ((detail.records as (DomainDetail['records'] & { dkim_expected?: DkimExpected }) | undefined)
            ?.dkim_expected) ?? undefined;

    // Verification report & timestamps (optional, not declared on DomainDetail)
    const report =
        ((detail as unknown as { verification_report?: VerificationReport }).verification_report) ?? null;

    const lastChecked =
        report?.checked_at ??
        ((detail as unknown as { last_checked_at?: string }).last_checked_at ?? null);

    const recs: VerificationRecords = report?.records ?? {};

    const prettyTime = (iso?: string | null) => {
        if (!iso) return 'Not checked yet';
        try {
            const d = new Date(iso);
            return d.toLocaleString();
        } catch {
            return String(iso);
        }
    };

    return (
        <section className="space-y-6">
            {/* Intro + refresh + last checked (no group list here) */}
            <div className="bg-white rounded-xl shadow p-5 border">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Set up DNS for <span className="text-blue-700">{domain}</span>
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Complete each step below in your DNS provider (Cloudflare, Route53, GoDaddy, etc).
                            When done, click <span className="font-medium">Refresh</span> to re-check.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
                        disabled={loadingRefresh}
                        title="Refresh verification"
                    >
                        <ArrowPathIcon className={`h-4 w-4 ${loadingRefresh ? 'animate-spin' : ''}`} />
                        {loadingRefresh ? 'Refreshing…' : 'Refresh'}
                    </button>
                </div>

                <div className="mt-3 text-sm text-gray-700">
                    <span className="font-medium">Last checked:</span> <span>{prettyTime(lastChecked)}</span>
                </div>
            </div>

            {/* Step 1: Verification */}
            <StepCard
                step={1}
                title="Domain verification (TXT)"
                status={recs?.verification_txt?.status}
                subtitle={
                    <>
                        Create a TXT record exactly as shown. This confirms you control{' '}
                        <span className="font-medium">{domain}</span>.
                    </>
                }
            >
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                        <tr className="text-left text-gray-500">
                            <th className="py-2 pr-4">Type</th>
                            <th className="py-2 pr-4">Name / Host</th>
                            <th className="py-2 pr-4">Value</th>
                            <th className="py-2 pr-4">TTL</th>
                            <th className="py-2 pr-4">Priority</th>
                        </tr>
                        </thead>
                        <tbody>
                        <Row type="TXT" name={txtName} value={txtValue} />
                        </tbody>
                    </table>
                </div>

                <DetailsBlock record={recs?.verification_txt} />

                <Note>
                    Providers label “Name/Host” differently (Host / Record name). For the root, use{' '}
                    <strong>@</strong>. Keep TTL at <strong>1 hour</strong> (or “Auto”).
                </Note>
            </StepCard>

            {/* Step 2: SPF */}
            <StepCard
                step={2}
                title="SPF (TXT) — authorize Monkey’s Mail to send"
                status={recs?.spf?.status}
                subtitle={
                    <>
                        You should have <strong>one</strong> SPF TXT on the root. If you already have SPF, merge our
                        mechanisms into it.
                    </>
                }
                accent="border-emerald-200"
            >
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                        <tr className="text-left text-gray-500">
                            <th className="py-2 pr-4">Type</th>
                            <th className="py-2 pr-4">Name / Host</th>
                            <th className="py-2 pr-4">Value</th>
                            <th className="py-2 pr-4">TTL</th>
                            <th className="py-2 pr-4">Priority</th>
                        </tr>
                        </thead>
                        <tbody>
                        <Row type="TXT" name="@" value={spf} />
                        </tbody>
                    </table>
                </div>

                <DetailsBlock record={recs?.spf} />

                <Note>
                    Keep only one SPF TXT. Example combined value:{' '}
                    <CodeChip>v=spf1 ip4:34.30.122.164 include:monkeysmail.com ~all</CodeChip>. If you use other
                    senders (e.g. Google, Microsoft), keep their mechanisms in the same single record.
                </Note>
            </StepCard>

            {/* Step 3: DMARC */}
            <StepCard
                step={3}
                title="DMARC (TXT) — alignment & reporting"
                status={recs?.dmarc?.status}
                subtitle={
                    <>
                        Start with <strong>p=none</strong> to monitor. After a few weeks, consider{' '}
                        <strong>quarantine</strong> or <strong>reject</strong>.
                    </>
                }
                accent="border-amber-200"
            >
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                        <tr className="text-left text-gray-500">
                            <th className="py-2 pr-4">Type</th>
                            <th className="py-2 pr-4">Name / Host</th>
                            <th className="py-2 pr-4">Value</th>
                            <th className="py-2 pr-4">TTL</th>
                            <th className="py-2 pr-4">Priority</th>
                        </tr>
                        </thead>
                        <tbody>
                        <Row type="TXT" name={dmarcName} value={dmarcVal} />
                        </tbody>
                    </table>
                </div>

                <DetailsBlock record={recs?.dmarc} />

                <Note>
                    The DMARC record lives at <CodeChip>_dmarc.{domain}</CodeChip>. Reports go to the addresses in{' '}
                    <CodeChip>rua</CodeChip> (aggregate) and <CodeChip>ruf</CodeChip> (forensic) if present.
                </Note>
            </StepCard>

            {/* Step 4: MX (optional) */}
            <StepCard
                step={4}
                title="MX (optional) — only if you receive mail here"
                status={recs?.mx?.status}
                subtitle={
                    <>
                        Set MX to receive mail at <span className="font-medium">{domain}</span> via Monkey’s Mail. If
                        you only <em>send</em> emails, you can skip this step.
                    </>
                }
                accent="border-purple-200"
            >
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                        <tr className="text-left text-gray-500">
                            <th className="py-2 pr-4">Type</th>
                            <th className="py-2 pr-4">Name / Host</th>
                            <th className="py-2 pr-4">Value / Target</th>
                            <th className="py-2 pr-4">TTL</th>
                            <th className="py-2 pr-4">Priority</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(mx ?? []).map((r, i) => (
                            <Row
                                key={`mx-${i}`}
                                type="MX"
                                name={r.host ?? '@'}
                                value={r.value ?? 'smtp.monkeysmail.com.'}
                                ttl="1 hour"
                                priority={typeof r.priority === 'number' ? r.priority : 10}
                            />
                        ))}
                        {(!mx || mx.length === 0) && (
                            <Row type="MX" name="@" value="smtp.monkeysmail.com." ttl="1 hour" priority={10} />
                        )}
                        </tbody>
                    </table>
                </div>

                <DetailsBlock record={recs?.mx} />

                <Note>
                    Some DNS UIs require the target <em>without</em> a trailing dot. If{' '}
                    <CodeChip>smtp.monkeysmail.com.</CodeChip> is rejected, use{' '}
                    <CodeChip>smtp.monkeysmail.com</CodeChip>. Priority should be <strong>10</strong>.
                </Note>
            </StepCard>

            {/* Step 5: DKIM */}
            <StepCard
                step={5}
                title="DKIM (TXT) — signing key"
                status={recs?.dkim?.status}
                subtitle="Publish the DKIM public key to let mailbox providers verify your message signature."
                accent="border-indigo-200"
            >
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                        <tr className="text-left text-gray-500">
                            <th className="py-2 pr-4">Type</th>
                            <th className="py-2 pr-4">Name / Host</th>
                            <th className="py-2 pr-4">Value</th>
                            <th className="py-2 pr-4">TTL</th>
                            <th className="py-2 pr-4">Priority</th>
                        </tr>
                        </thead>
                        <tbody>
                        <Row type="TXT" name={dkim?.name ?? ''} value={dkim?.value ?? ''} />
                        </tbody>
                    </table>
                </div>

                <DetailsBlock record={recs?.dkim} />

                <Note>
                    Use the exact value including the <code>v=DKIM1; k=rsa; p=...</code> part.
                    The selector is the part before <code>._domainkey</code> in the name.
                </Note>
            </StepCard>

            <div className="text-xs text-gray-500">
                DNS changes can take from a few minutes up to 24h to propagate. If your provider offers “Auto”
                TTL, you can use it.
            </div>
        </section>
    );
}
