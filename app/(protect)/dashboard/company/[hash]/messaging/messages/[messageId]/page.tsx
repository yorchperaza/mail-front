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
    CodeBracketIcon,
    DocumentTextIcon,
    DocumentIcon,
    CheckIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    EyeIcon,
    CursorArrowRaysIcon,
    CalendarIcon,
    InboxArrowDownIcon,
    RocketLaunchIcon,
} from '@heroicons/react/24/outline';
import { EnvelopeIcon as EnvelopeSolid } from '@heroicons/react/24/solid';

import { TabDef } from '@/components/ui/Tabs';

/* ========================= Types ========================= */
type Detail = {
    id: number;
    company_id: number | null;
    domain: { id: number | null; name: string | null };
    envelope: {
        from: { email: string; name: string | null };
        replyTo: string | null;
        to?: string[];
        cc?: string[];
        bcc?: string[];
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
const STATE_CONFIG = {
    sent: {
        label: 'Sent',
        icon: CheckIcon,
        bgClass: 'bg-emerald-500',
        lightBgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
        description: 'Message delivered successfully'
    },
    queued: {
        label: 'Queued',
        icon: ClockIcon,
        bgClass: 'bg-amber-500',
        lightBgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
        description: 'Message waiting to be sent'
    },
    preview: {
        label: 'Preview',
        icon: EyeIcon,
        bgClass: 'bg-blue-500',
        lightBgClass: 'bg-blue-50',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-200',
        description: 'Test message preview'
    },
    failed: {
        label: 'Failed',
        icon: XMarkIcon,
        bgClass: 'bg-red-500',
        lightBgClass: 'bg-red-50',
        textClass: 'text-red-700',
        borderClass: 'border-red-200',
        description: 'Message delivery failed'
    },
    queue_failed: {
        label: 'Queue Failed',
        icon: ExclamationTriangleIcon,
        bgClass: 'bg-red-500',
        lightBgClass: 'bg-red-50',
        textClass: 'text-red-700',
        borderClass: 'border-red-200',
        description: 'Failed to queue message'
    },
};

function getStateConfig(state?: string | null) {
    return STATE_CONFIG[(state || '').toLowerCase() as keyof typeof STATE_CONFIG] || {
        label: state || 'Unknown',
        icon: ArrowPathIcon,
        bgClass: 'bg-gray-500',
        lightBgClass: 'bg-gray-50',
        textClass: 'text-gray-700',
        borderClass: 'border-gray-200',
        description: 'Status unknown'
    };
}

function toLocale(s?: string | null, showTime = true) {
    if (!s) return '—';
    try {
        const date = new Date(s);
        if (showTime) {
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch {
        return s;
    }
}

function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function EmailRecipients({ label, list, icon }: { label: string; list?: string[]; icon: React.ReactNode }) {
    if (!list || list.length === 0) return null;

    return (
        <div className="group relative">
            <div className="flex items-center gap-2 py-2">
                <div className="flex items-center gap-1.5 text-gray-500">
                    {icon}
                    <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {list.slice(0, 2).map((email) => (
                        <span key={email} className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200/50">
                            {email}
                        </span>
                    ))}
                    {list.length > 2 && (
                        <button className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200/50 hover:bg-blue-100 transition-colors">
                            +{list.length - 2} more
                        </button>
                    )}
                </div>
            </div>

            {/* Tooltip for full list */}
            {list.length > 2 && (
                <div className="absolute left-0 top-full z-10 mt-1 hidden min-w-[200px] max-w-md rounded-lg bg-gray-900 p-3 text-xs text-white shadow-lg group-hover:block">
                    <div className="space-y-1">
                        {list.map((email) => (
                            <div key={email} className="font-mono">{email}</div>
                        ))}
                    </div>
                    <div className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-gray-900"></div>
                </div>
            )}
        </div>
    );
}

function shortId(id?: string | null, left = 8, right = 6) {
    if (!id) return '—';
    const s = String(id);
    if (s.length <= left + right + 1) return s;
    return `${s.slice(0, left)}…${s.slice(-right)}`;
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

    if (err) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Message</h2>
                    </div>
                    <p className="text-gray-600">{err}</p>
                    <button
                        onClick={() => router.push(`/dashboard/company/${hash}/messaging/messages`)}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Messages
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const stateConfig = getStateConfig(data.state);
    const StateIcon = stateConfig.icon;

    const hasHtml = !!data.html?.trim();
    const hasText = !!data.text?.trim();
    const hasHeaders = !!data.headers && Object.keys(data.headers).length > 0;
    const hasAtt = !!data.attachments && data.attachments.length > 0;

    const hasRecipients = (data.envelope?.to?.length || 0) +
        (data.envelope?.cc?.length || 0) +
        (data.envelope?.bcc?.length || 0) > 0;

    // Build the tab list from available content
    const availableTabs = [
        hasHtml && {
            id: 'html',
            label: 'HTML Preview',
            icon: <CodeBracketIcon className="h-4 w-4" />
        },
        hasText && {
            id: 'text',
            label: 'Plain Text',
            icon: <DocumentTextIcon className="h-4 w-4" />
        },
        hasHeaders && {
            id: 'headers',
            label: 'Headers',
            icon: <DocumentIcon className="h-4 w-4" />
        },
        hasAtt && {
            id: 'attachments',
            label: `Attachments (${data.attachments!.length})`,
            icon: <PaperClipIcon className="h-4 w-4" />
        },
    ].filter(Boolean) as (TabDef & { icon: React.ReactNode })[];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="mx-auto max-w-7xl p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}/messaging/messages`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Messages
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <h1 className="text-2xl font-bold text-gray-900">Message Details</h1>
                    </div>

                    {data.domain?.id && (
                        <Link
                            href={`/dashboard/company/${hash}/domain/${data.domain.id}`}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 transition-colors"
                        >
                            <GlobeAltIcon className="h-4 w-4" />
                            {data.domain.name || 'View Domain'}
                        </Link>
                    )}
                </div>

                {/* Status Card */}
                <div className={`relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ${stateConfig.borderClass}`}>
                    <div className={`absolute inset-x-0 top-0 h-1 ${stateConfig.bgClass}`} />
                    <div className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`rounded-lg ${stateConfig.lightBgClass} p-3`}>
                                    <StateIcon className={`h-6 w-6 ${stateConfig.textClass}`} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-lg font-semibold text-gray-900">
                                            {data.subject || <span className="italic text-gray-400">No Subject</span>}
                                        </h2>
                                        <span className={`inline-flex items-center rounded-full ${stateConfig.lightBgClass} px-3 py-1 text-xs font-semibold ${stateConfig.textClass}`}>
                                            {stateConfig.label}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-500">{stateConfig.description}</p>

                                    {/* Message ID */}
                                    <div className="mt-4 flex items-center gap-2">
                                        <span className="text-xs font-medium text-gray-500">MESSAGE ID</span>
                                        <code
                                            className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 whitespace-nowrap"
                                            title={data.messageId || undefined}
                                        >
                                            {shortId(data.messageId)}
                                        </code>
                                        <CopyButton text={data.messageId || ''} size="sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Tracking Status */}
                            <div className="flex gap-2">
                                <TrackingBadge
                                    active={!!data.tracking?.opens}
                                    label="Opens Tracked"
                                    icon={<EyeIcon className="h-4 w-4" />}
                                />
                                <TrackingBadge
                                    active={!!data.tracking?.clicks}
                                    label="Clicks Tracked"
                                    icon={<CursorArrowRaysIcon className="h-4 w-4" />}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sender Info */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                                <EnvelopeSolid className="h-4 w-4" />
                                SENDER INFORMATION
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <div className="text-xs font-medium text-gray-500 mb-1">FROM</div>
                                <div className="space-y-1">
                                    {data.envelope?.from?.name && (
                                        <div className="font-semibold text-gray-900">{data.envelope.from.name}</div>
                                    )}
                                    <div className="font-mono text-sm text-gray-700 break-all">
                                        {data.envelope?.from?.email || '—'}
                                    </div>
                                </div>
                            </div>

                            {data.envelope?.replyTo && (
                                <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">REPLY TO</div>
                                    <div className="font-mono text-sm text-gray-700 break-all">
                                        {data.envelope.replyTo}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recipients */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                                <InboxArrowDownIcon className="h-4 w-4" />
                                RECIPIENTS
                            </h3>
                        </div>
                        <div className="p-4">
                            {hasRecipients ? (
                                <div className="space-y-1">
                                    <EmailRecipients
                                        label="TO"
                                        list={data.envelope?.to}
                                        icon={<div className="h-2 w-2 rounded-full bg-green-500" />}
                                    />
                                    <EmailRecipients
                                        label="CC"
                                        list={data.envelope?.cc}
                                        icon={<div className="h-2 w-2 rounded-full bg-blue-500" />}
                                    />
                                    <EmailRecipients
                                        label="BCC"
                                        list={data.envelope?.bcc}
                                        icon={<div className="h-2 w-2 rounded-full bg-purple-500" />}
                                    />
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 italic">No recipients specified</div>
                            )}
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                                <ClockIcon className="h-4 w-4" />
                                TIMELINE
                            </h3>
                        </div>
                        <div className="p-4">
                            <div className="space-y-3">
                                <TimelineItem
                                    icon={<CalendarIcon className="h-4 w-4" />}
                                    label="Created"
                                    time={data.timestamps?.createdAt}
                                    color="gray"
                                />
                                <TimelineItem
                                    icon={<ClockIcon className="h-4 w-4" />}
                                    label="Queued"
                                    time={data.timestamps?.queuedAt}
                                    color="amber"
                                />
                                <TimelineItem
                                    icon={<RocketLaunchIcon className="h-4 w-4" />}
                                    label="Sent"
                                    time={data.timestamps?.sentAt}
                                    color="emerald"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Tabs */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="border-b border-gray-200 bg-gray-50/50">
                        <div className="flex gap-1 p-1">
                            {availableTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                    className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                    }`}
                                >
                                    {tab.icon}
                                    {tab.label}
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
                                        <CopyButton text={data.html || ''} label="Copy HTML" />
                                    </div>
                                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                                        <iframe
                                            title="HTML preview"
                                            className="h-[600px] w-full bg-white"
                                            sandbox="allow-same-origin"
                                            srcDoc={data.html || '<p class="p-4 text-sm text-gray-500">No HTML content available</p>'}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <EmptyState message="No HTML content available" />
                            )
                        )}

                        {activeTab === 'text' && (
                            hasText ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-semibold text-gray-700">Plain Text Content</h4>
                                        <CopyButton text={data.text || ''} label="Copy Text" />
                                    </div>
                                    <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 border border-gray-200 p-4 font-mono text-sm text-gray-700 max-h-[600px] overflow-auto">
                                        {data.text}
                                    </pre>
                                </div>
                            ) : (
                                <EmptyState message="No plain text content available" />
                            )
                        )}

                        {activeTab === 'headers' && (
                            hasHeaders ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-semibold text-gray-700">Email Headers</h4>
                                        <CopyButton
                                            text={Object.entries(data.headers!).map(([k, v]) => `${k}: ${String(v)}`).join('\n')}
                                            label="Copy Headers"
                                        />
                                    </div>
                                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                                        <div className="max-h-[600px] overflow-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <tbody className="divide-y divide-gray-100">
                                                {Object.entries(data.headers!).map(([key, value], index) => (
                                                    <tr key={key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
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
                            ) : (
                                <EmptyState message="No headers available" />
                            )
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
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                            {data.attachments!.map((att, index) => (
                                                <tr key={index} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <PaperClipIcon className="h-4 w-4 text-gray-400" />
                                                            <span className="font-medium text-gray-900">
                                                                    {att.filename || 'Unnamed file'}
                                                                </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-700">
                                                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-mono">
                                                                {att.contentType}
                                                            </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-700">
                                                        {att.length ? formatBytes(att.length) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <EmptyState message="No attachments" />
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ========================= Components ========================= */
function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-gray-100 p-3 mb-3">
                <DocumentIcon className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">{message}</p>
        </div>
    );
}

function TrackingBadge({ active, label, icon }: { active: boolean; label: string; icon: React.ReactNode }) {
    return (
        <div className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-all ${
            active
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-gray-50 text-gray-500 ring-gray-200'
        }`}>
            {icon}
            {label}
        </div>
    );
}

function TimelineItem({
                          icon,
                          label,
                          time,
                          color
                      }: {
    icon: React.ReactNode;
    label: string;
    time: string | null;
    color: 'gray' | 'amber' | 'emerald'
}) {
    const colorClasses = {
        gray: 'bg-gray-100 text-gray-600',
        amber: 'bg-amber-100 text-amber-600',
        emerald: 'bg-emerald-100 text-emerald-600',
    };

    return (
        <div className="flex items-start gap-3">
            <div className={`rounded-lg p-1.5 ${colorClasses[color]}`}>
                {icon}
            </div>
            <div className="flex-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</div>
                <div className="text-sm text-gray-900 font-medium">
                    {time ? toLocale(time) : 'Not yet'}
                </div>
            </div>
        </div>
    );
}

function CopyButton({
                        text,
                        label = "Copy",
                        size = "md"
                    }: {
    text: string;
    label?: string;
    size?: 'sm' | 'md'
}) {
    const [copied, setCopied] = useState(false);

    const sizeClasses = {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm px-3 py-1.5'
    };

    return (
        <button
            type="button"
            onClick={() => {
                if (!text) return;
                const ok = copy(text);
                if (ok) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg bg-gray-100 font-medium text-gray-700 hover:bg-gray-200 transition-all ${sizeClasses[size]}`}
            title={label}
        >
            {copied ? (
                <>
                    <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                    Copied!
                </>
            ) : (
                <>
                    <ClipboardIcon className="h-4 w-4" />
                    {label}
                </>
            )}
        </button>
    );
}