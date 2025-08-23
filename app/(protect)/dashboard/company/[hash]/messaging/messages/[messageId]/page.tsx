'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import copy from 'copy-to-clipboard';
import {
    ArrowLeftIcon,
    ClipboardIcon,
    CheckCircleIcon,
    GlobeAltIcon,
    EnvelopeOpenIcon,
} from '@heroicons/react/24/outline';

// ⬇️ adjust this import path to your project structure
import Tabs, { TabDef } from '@/components/ui/Tabs';

/* ========================= Types ========================= */
type Detail = {
    id: number;
    company_id: number | null;
    domain: { id: number | null; name: string | null };
    envelope: {
        from: { email: string; name: string | null };
        replyTo: string | null;
    };
    subject: string | null;
    text: string | null;
    html: string | null;
    headers: Record<string, string> | null;
    attachments: { filename: string; contentType: string; length: number | null }[] | null;
    tracking: { opens: boolean | null; clicks: boolean | null } | null;
    state: 'queued' | 'sent' | 'failed' | 'preview' | 'queue_failed' | string | null;
    messageId: string | null;
    timestamps: { createdAt: string | null; queuedAt: string | null; sentAt: string | null };
};

/* ========================= Helpers ========================= */
const STATE_LABEL: Record<string, string> = {
    queued: 'Queued',
    sent: 'Sent',
    failed: 'Failed',
    preview: 'Preview',
    queue_failed: 'Queue Failed',
};

function badgeClass(state?: string | null) {
    const s = (state || '').toLowerCase();
    if (s === 'sent') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (s === 'queued' || s === 'preview') return 'bg-amber-50 text-amber-700 ring-amber-200';
    if (s === 'failed' || s === 'queue_failed') return 'bg-red-50 text-red-700 ring-red-200';
    return 'bg-gray-50 text-gray-600 ring-gray-200';
}
function toLocale(s?: string | null) {
    if (!s) return '—';
    try { return new Date(s).toLocaleString(); } catch { return s; }
}

/* ========================= Page ========================= */
export default function MessageByMessageIdPage() {
    const { hash, messageId } = useParams<{ hash: string; messageId: string }>();
    const router = useRouter();

    const [data, setData] = useState<Detail | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'html' | 'text' | 'headers' | 'attachments'>('html');

    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const url = useMemo(
        () => `${backend}/companies/${hash}/messages/message-id/${encodeURIComponent(messageId)}`,
        [backend, hash, messageId]
    );

    // Fetch
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(url, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
                if (!res.ok) throw new Error(`Failed to load message (${res.status})`);
                const json: Detail = await res.json();
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [url, token]);

    /* ===== Loading / Error ===== */
    if (loading) {
        return (
            <div className="mx-auto max-w-7xl p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-56 rounded bg-gray-200" />
                    <div className="h-28 rounded bg-gray-200" />
                    <div className="h-[70vh] rounded bg-gray-200" />
                </div>
            </div>
        );
    }
    if (err) return <p className="p-6 text-center text-red-600">{err}</p>;
    if (!data) return null;

    const hasHtml = !!data.html?.trim();
    const hasText = !!data.text?.trim();
    const hasHeaders = !!data.headers && Object.keys(data.headers).length > 0;
    const hasAtt = !!data.attachments && data.attachments.length > 0;

    // Build the tab list from available content
    const availableTabs = [
        hasHtml && { id: 'html', label: 'HTML' },
        hasText && { id: 'text', label: 'Text' },
        hasHeaders && { id: 'headers', label: 'Headers' },
        hasAtt && { id: 'attachments', label: `Attachments${hasAtt ? ` (${data.attachments!.length})` : ''}` },
    ].filter(Boolean) as TabDef[];


    return (
        <div className="mx-auto max-w-7xl p-6 space-y-6">
            {/* Top bar */}
            <div className="rounded-2xl border bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}/messaging/messages`)}
                            className="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-gray-700 hover:bg-gray-50"
                        >
                            <ArrowLeftIcon className="mr-1 h-5 w-5" /> Back
                        </button>
                        <h1 className="text-2xl font-semibold tracking-tight">Message</h1>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${badgeClass(data.state)}`}>
              {STATE_LABEL[data.state ?? ''] || (data.state || '—')}
            </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                        {data.domain?.id ? (
                            <Link
                                href={`/dashboard/company/${hash}/domain/${data.domain.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-blue-700 hover:bg-blue-50"
                            >
                                <GlobeAltIcon className="h-4 w-4" />
                                {data.domain.name || 'Domain'}
                            </Link>
                        ) : (
                            <span className="text-gray-500">No domain</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Meta */}
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Subject</div>
                        <div className="break-words text-lg font-medium">
                            {data.subject || <span className="text-gray-500">—</span>}
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-gray-500">Message-ID</span>
                        <code className="max-w-[56ch] overflow-hidden text-ellipsis whitespace-nowrap rounded-md border bg-gray-50 px-2 py-1 font-mono text-xs">
                            {data.messageId || '—'}
                        </code>
                        <CopyButton ariaLabel="Copy Message-ID" text={data.messageId || ''} />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <InfoCard
                        title="From"
                        body={
                            <div className="space-y-1">
                                <div className="text-sm">
                                    {data.envelope?.from?.name && <span className="font-medium">{data.envelope.from.name} </span>}
                                    <span className="rounded border bg-gray-50 px-1.5 py-0.5 font-mono">
                    &lt;{data.envelope?.from?.email ?? '—'}&gt;
                  </span>
                                </div>
                                <div className="text-xs text-gray-600">
                                    Reply-To:{' '}
                                    {data.envelope?.replyTo ? <span className="font-mono">{data.envelope.replyTo}</span> : '—'}
                                </div>
                            </div>
                        }
                        icon={<EnvelopeOpenIcon className="h-4 w-4" />}
                    />

                    <InfoCard
                        title="Tracking"
                        body={
                            <div className="flex flex-wrap gap-2">
                                <Badge on={!!data.tracking?.opens} label="Opens" />
                                <Badge on={!!data.tracking?.clicks} label="Clicks" />
                            </div>
                        }
                    />

                    <InfoCard
                        title="Timestamps (UTC)"
                        body={
                            <div className="space-y-1 text-xs text-gray-700">
                                <div>Created: {toLocale(data.timestamps?.createdAt)}</div>
                                <div>Queued: {toLocale(data.timestamps?.queuedAt)}</div>
                                <div>Sent: {toLocale(data.timestamps?.sentAt)}</div>
                            </div>
                        }
                    />
                </div>
            </div>

            {/* Tabs + Panels */}
            <div className="overflow-hidden rounded-2xl border shadow-sm">
                <div className="sticky top-0 z-[1] border-b bg-white/80 px-2 pt-2 backdrop-blur">
                    <Tabs
                        tabs={availableTabs}
                        activeId={activeTab}
                        onChange={(id) => setActiveTab(id as typeof activeTab)}
                        className="px-1"
                    />
                </div>

                <div className="bg-white p-4">
                    {activeTab === 'html' &&
                        (hasHtml ? <HTMLPreview html={data.html!} /> : <Empty>HTML body not available.</Empty>)}

                    {activeTab === 'text' &&
                        (hasText ? (
                            <div className="space-y-3">
                                <div className="flex justify-end">
                                    <CopyButton ariaLabel="Copy text body" text={data.text || ''} />
                                </div>
                                <pre className="whitespace-pre-wrap rounded-xl border bg-gray-50 p-4 text-sm">
                  {data.text}
                </pre>
                            </div>
                        ) : (
                            <Empty>Plain text body not available.</Empty>
                        ))}

                    {activeTab === 'headers' &&
                        (hasHeaders ? (
                            <div className="space-y-3">
                                <div className="flex justify-end">
                                    <CopyButton
                                        ariaLabel="Copy all headers"
                                        text={Object.entries(data.headers!).map(([k, v]) => `${k}: ${String(v)}`).join('\n')}
                                    />
                                </div>
                                <div className="overflow-auto rounded-xl border">
                                    <table className="min-w-full text-sm">
                                        <tbody>
                                        {Object.entries(data.headers!).map(([k, v]) => (
                                            <tr key={k} className="border-t last:border-b-0">
                                                <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-700">{k}</td>
                                                <td className="break-all px-3 py-2 text-gray-800">{String(v)}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <Empty>No headers.</Empty>
                        ))}

                    {activeTab === 'attachments' &&
                        (hasAtt ? (
                            <div className="overflow-auto rounded-xl border">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                    <tr className="text-left">
                                        <th className="px-3 py-2 font-semibold">Filename</th>
                                        <th className="px-3 py-2 font-semibold">Content-Type</th>
                                        <th className="px-3 py-2 font-semibold">Size (B64 length)</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {data.attachments!.map((a, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="break-all px-3 py-2">{a.filename || '—'}</td>
                                            <td className="px-3 py-2">{a.contentType}</td>
                                            <td className="px-3 py-2">{a.length ?? '—'}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <Empty>No attachments.</Empty>
                        ))}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
                <Link href={`/dashboard/company/${hash}/messages`} className="text-blue-700 hover:underline">
                    ← Back to messages
                </Link>
            </div>
        </div>
    );
}

/* ========================= UI Bits ========================= */
function Empty({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
            {children}
        </div>
    );
}

function Badge({ on, label }: { on: boolean; label: string }) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ${
                on ? 'ring-emerald-200 bg-emerald-50 text-emerald-700' : 'ring-gray-200 bg-gray-50 text-gray-600'
            }`}
        >
      <span className={`block h-2 w-2 rounded-full ${on ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {label}
    </span>
    );
}

function InfoCard({
                      title,
                      body,
                      icon,
                  }: {
    title: string;
    body: React.ReactNode;
    icon?: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                {icon ?? null}
                {title}
            </div>
            {body}
        </div>
    );
}

/** Copy-to-clipboard (copy-to-clipboard lib) */
function CopyButton({ text, ariaLabel }: { text: string; ariaLabel?: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            type="button"
            aria-label={ariaLabel || 'Copy to clipboard'}
            onClick={() => {
                if (!text) return;
                const ok = copy(text);
                if (ok) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                }
            }}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
            title={ariaLabel || 'Copy to clipboard'}
        >
            {copied ? <CheckCircleIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}

/** Sandboxed HTML preview */
function HTMLPreview({ html }: { html: string }) {
    return (
        <div className="overflow-hidden rounded-xl border">
            <div className="border-b bg-gray-50 px-3 py-1.5 text-xs text-gray-500">HTML Preview</div>
            <iframe title="HTML preview" className="h-[70vh] w-full bg-white" sandbox="allow-same-origin" srcDoc={html} />
        </div>
    );
}
