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
    ClockIcon,
    PaperClipIcon,
    DocumentTextIcon,
    DocumentIcon,
    ExclamationTriangleIcon,
    CodeBracketIcon,
    ArrowDownTrayIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { EnvelopeIcon as EnvelopeSolid } from '@heroicons/react/24/solid';

/* ========================= Types ========================= */
type InboundAttachment = {
    filename: string | null;
    content_type?: string | null;
    contentType?: string | null; // tolerate either casing
    length?: number | null;
    size?: number | null;
    inline?: boolean | null;
    content_id?: string | null;
    contentId?: string | null;
};

type InboundDetail = {
    id: number;
    from_email: string | null;
    subject: string | null;
    raw_mime_ref: string | null;
    spam_score: number | null;
    dkim_result: string | null;
    dmarc_result: string | null;
    arc_result: string | null;
    received_at: string | null;
    domain: { id: number | null; domain?: string | null; name?: string | null } | null;

    // detail additions from /show:
    headers?: Record<string, string> | null;
    body?: { text?: string | null; html?: string | null } | null;
    attachments?: InboundAttachment[] | null;
};

/* ========================= Helpers ========================= */
function toLocale(s?: string | null) {
    if (!s) return '—';
    try {
        const d = new Date(s);
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return s!;
    }
}

function formatBytes(bytes?: number | null) {
    if (!bytes || bytes <= 0) return '—';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function badge(color: 'gray' | 'green' | 'red' | 'amber', text: string) {
    const map = {
        gray: 'bg-gray-100 text-gray-700 ring-gray-200',
        green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        red: 'bg-red-50 text-red-700 ring-red-200',
        amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    } as const;
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${map[color]}`}>
      {text}
    </span>
    );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
    const [ok, setOk] = useState(false);
    return (
        <button
            onClick={() => {
                if (!text) return;
                copy(text);
                setOk(true);
                setTimeout(() => setOk(false), 1500);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition"
        >
            {ok ? <CheckCircleIcon className="h-4 w-4 text-emerald-600" /> : <ClipboardIcon className="h-4 w-4" />}
            {ok ? 'Copied!' : label}
        </button>
    );
}

/* ========================= Page ========================= */
export default function InboundDetailPage() {
    const { hash, id } = useParams<{ hash: string; id: string }>();
    const router = useRouter();

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL!;
    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;

    const url = useMemo(
        () => `${backend}/companies/${hash}/inbound-messages/${encodeURIComponent(id)}`,
        [backend, hash, id]
    );
    const rawUrl = useMemo(
        () => `${backend}/companies/${hash}/inbound-messages/${encodeURIComponent(id)}/raw`,
        [backend, hash, id]
    );

    const [data, setData] = useState<InboundDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'html' | 'text' | 'headers' | 'attachments'>('html');

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
                if (!res.ok) throw new Error(`Failed to load inbound (${res.status})`);
                const json = await res.json();
                // Accept both {item:{...}} and flat { ... }
                const item: InboundDetail = json?.item ?? json;
                if (!abort) setData(item);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [url, token]);

    const html = data?.body?.html ?? null;
    const text = data?.body?.text ?? null;
    const headers = data?.headers ?? null;
    const attachments = data?.attachments ?? [];

    const hasHtml = !!html?.trim();
    const hasText = !!text?.trim();
    const hasHeaders = !!headers && Object.keys(headers).length > 0;
    const hasAtt = !!attachments && attachments.length > 0;

    const tabs = [
        hasHtml && { id: 'html', label: 'HTML Preview', icon: <CodeBracketIcon className="h-4 w-4" /> },
        hasText && { id: 'text', label: 'Plain Text', icon: <DocumentTextIcon className="h-4 w-4" /> },
        hasHeaders && { id: 'headers', label: 'Headers', icon: <DocumentIcon className="h-4 w-4" /> },
        hasAtt && { id: 'attachments', label: `Attachments (${attachments.length})`, icon: <PaperClipIcon className="h-4 w-4" /> },
    ].filter(Boolean) as { id: typeof activeTab; label: string; icon: React.ReactNode }[];

    /* ===== UI states ===== */
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="mx-auto max-w-7xl p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="rounded-xl bg-white p-6 shadow-sm">
                            <div className="h-32 rounded bg-gray-200" />
                        </div>
                        <div className="rounded-xl bg-white p-6 shadow-sm">
                            <div className="h-96 rounded bg-gray-200" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (err || !data) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Inbound</h2>
                    </div>
                    <p className="text-gray-600">{err ?? 'Unknown error'}</p>
                    <button
                        onClick={() => router.push(`/dashboard/company/${hash}/messaging/inbound`)}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Inbound
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="mx-auto max-w-7xl p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}/messaging/inbound`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Inbound
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <h1 className="text-2xl font-bold text-gray-900">Inbound Message</h1>
                    </div>

                    {data.domain?.id && (
                        <Link
                            href={`/dashboard/company/${hash}/domain/${data.domain.id}`}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 transition-colors"
                        >
                            <GlobeAltIcon className="h-4 w-4" />
                            {data.domain?.name || data.domain?.domain || 'View Domain'}
                        </Link>
                    )}
                </div>

                {/* Summary Card */}
                <div className="relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gray-800" />
                    <div className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                <div className="rounded-lg bg-gray-50 p-3">
                                    <EnvelopeSolid className="h-6 w-6 text-gray-700" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-lg font-semibold text-gray-900">
                                            {data.subject || <span className="italic text-gray-400">No Subject</span>}
                                        </h2>
                                        {badge('gray', 'Inbound')}
                                    </div>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Received {toLocale(data.received_at)}
                                    </p>

                                    {/* From */}
                                    <div className="mt-4">
                                        <div className="text-xs font-medium text-gray-500">FROM</div>
                                        <div className="font-mono text-sm text-gray-800 break-words">
                                            {data.from_email || headers?.from || '—'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <CopyButton text={data.subject || ''} label="Copy Subject" />
                                <a
                                    href={rawUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black transition"
                                    title="Download raw .eml"
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                    .eml
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recipients (from headers) */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                                Recipients
                            </h3>
                        </div>
                        <div className="p-4 space-y-3 text-sm">
                            <div>
                                <div className="text-xs font-medium text-gray-500 mb-1">TO</div>
                                <div className="font-mono text-gray-800 break-words">
                                    {headers?.to || '—'}
                                </div>
                            </div>
                            {headers?.cc && (
                                <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">CC</div>
                                    <div className="font-mono text-gray-800 break-words">
                                        {headers.cc}
                                    </div>
                                </div>
                            )}
                            {headers?.['bcc'] && (
                                <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">BCC</div>
                                    <div className="font-mono text-gray-800 break-words">
                                        {headers['bcc']}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Authentication */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                                <ShieldCheckIcon className="h-4 w-4" />
                                Authentication
                            </h3>
                        </div>
                        <div className="p-4 space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">DKIM</span>
                                {badge(
                                    !data.dkim_result ? 'gray' :
                                        data.dkim_result === 'pass' ? 'green' :
                                            data.dkim_result === 'fail' ? 'red' : 'amber',
                                    data.dkim_result ?? 'n/a'
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">DMARC</span>
                                {badge(
                                    !data.dmarc_result ? 'gray' :
                                        data.dmarc_result === 'pass' ? 'green' :
                                            data.dmarc_result === 'fail' ? 'red' : 'amber',
                                    data.dmarc_result ?? 'n/a'
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">ARC</span>
                                {badge(
                                    !data.arc_result ? 'gray' :
                                        data.arc_result === 'pass' ? 'green' :
                                            data.arc_result === 'fail' ? 'red' : 'amber',
                                    data.arc_result ?? 'n/a'
                                )}
                            </div>
                            <div className="pt-2 text-xs text-gray-500">
                                {headers?.['authentication-results'] && (
                                    <div className="break-words">
                                        <span className="font-semibold">Auth-Results: </span>
                                        <span className="font-mono">{headers['authentication-results']}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                                <ClockIcon className="h-4 w-4" />
                                Meta
                            </h3>
                        </div>
                        <div className="p-4 text-sm space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Received</span>
                                <span className="font-medium text-gray-900">{toLocale(data.received_at)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Spam score</span>
                                <span className="font-medium text-gray-900">{data.spam_score ?? '—'}</span>
                            </div>
                            <div className="pt-2">
                                <div className="text-xs font-medium text-gray-500 mb-1">Raw Path</div>
                                <code className="block rounded bg-gray-50 px-2 py-1 text-[11px] text-gray-700 ring-1 ring-gray-200 break-all">
                                    {data.raw_mime_ref || '—'}
                                </code>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Tabs */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="border-b border-gray-200 bg-gray-50/50">
                        <div className="flex gap-1 p-1">
                            {tabs.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id)}
                                    className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                                        activeTab === t.id
                                            ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                    }`}
                                >
                                    {t.icon}
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="min-h-[400px] p-6">
                        {activeTab === 'html' && (
                            hasHtml ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-semibold text-gray-700">HTML Preview</h4>
                                        <CopyButton text={html || ''} label="Copy HTML" />
                                    </div>
                                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                                        <iframe
                                            title="HTML preview"
                                            className="h-[600px] w-full bg-white"
                                            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                                            referrerPolicy="no-referrer"
                                            srcDoc={html || '<p class="p-4 text-sm text-gray-500">No HTML content available</p>'}
                                        />
                                    </div>
                                </div>
                            ) : <Empty message="No HTML content available" />
                        )}

                        {activeTab === 'text' && (
                            hasText ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-semibold text-gray-700">Plain Text Content</h4>
                                        <CopyButton text={text || ''} label="Copy Text" />
                                    </div>
                                    <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 border border-gray-200 p-4 font-mono text-sm text-gray-700 max-h-[600px] overflow-auto">
                    {text}
                  </pre>
                                </div>
                            ) : <Empty message="No plain text content available" />
                        )}

                        {activeTab === 'headers' && (
                            hasHeaders ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-semibold text-gray-700">Email Headers</h4>
                                        <CopyButton
                                            text={Object.entries(headers!).map(([k, v]) => `${k}: ${String(v)}`).join('\n')}
                                            label="Copy Headers"
                                        />
                                    </div>
                                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                                        <div className="max-h-[600px] overflow-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <tbody className="divide-y divide-gray-100">
                                                {Object.entries(headers!).map(([key, value], idx) => (
                                                    <tr key={key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                                            {key}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-700 font-mono break-all">
                                                            {String(value)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : <Empty message="No headers available" />
                        )}

                        {activeTab === 'attachments' && (
                            hasAtt ? (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold text-gray-700">File Attachments</h4>
                                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                    Filename
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                    Content Type
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                    Size
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                    Inline / CID
                                                </th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                            {attachments!.map((att, i) => {
                                                const ct = att.contentType ?? att.content_type ?? 'application/octet-stream';
                                                const sz = (att.length ?? att.size) ?? null;
                                                const cid = att.contentId ?? att.content_id ?? null;
                                                return (
                                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <PaperClipIcon className="h-4 w-4 text-gray-400" />
                                                                <span className="font-medium text-gray-900">
                                    {att.filename || 'Unnamed file'}
                                  </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-700">
                                                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-mono">{ct}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-700">
                                                            {formatBytes(sz ?? undefined)}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-700">
                                                            {att.inline ? badge('green', 'inline') : badge('gray', 'attachment')}
                                                            {cid && (
                                                                <span className="ml-2 font-mono text-xs text-gray-600">cid:{cid}</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : <Empty message="No attachments" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ========================= Tiny components ========================= */
function Empty({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-gray-100 p-3 mb-3">
                <DocumentIcon className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">{message}</p>
        </div>
    );
}
