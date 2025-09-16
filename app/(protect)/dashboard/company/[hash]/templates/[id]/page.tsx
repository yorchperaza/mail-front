'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    PencilSquareIcon,
    TrashIcon,
    EyeIcon,
    DocumentTextIcon,
    CodeBracketIcon,
    ClockIcon,
    SparklesIcon,
    DocumentDuplicateIcon,
    BeakerIcon,
    ChartBarIcon,
    Cog6ToothIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import type * as HandlebarsNS from 'handlebars';

/* ---------------- Types ---------------- */

type TemplateItem = {
    id: number;
    name: string | null;
    engine: string | null;     // 'raw' | 'handlebars' | null
    version: number | null;
    html: string | null;
    text: string | null;
    created_at: string | null; // ISO
    usage?: {
        campaigns?: number | null;
    };
};

type InlineResponse = { html?: string; error?: string };

/* -------------- Engine Configuration -------------- */
const ENGINE_CONFIG = {
    raw: {
        label: 'Raw HTML',
        icon: DocumentTextIcon,
        bgClass: 'bg-gray-50',
        textClass: 'text-gray-700',
        borderClass: 'border-gray-200',
        dotClass: 'bg-gray-500',
    },
    handlebars: {
        label: 'Handlebars',
        icon: CodeBracketIcon,
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
        dotClass: 'bg-amber-500',
    },
};

function getEngineConfig(engine?: string | null) {
    return ENGINE_CONFIG[(engine || '').toLowerCase() as keyof typeof ENGINE_CONFIG] || {
        label: engine || 'Unknown',
        icon: DocumentTextIcon,
        bgClass: 'bg-gray-50',
        textClass: 'text-gray-700',
        borderClass: 'border-gray-200',
        dotClass: 'bg-gray-500',
    };
}

/* -------------- Optional client-only Handlebars -------------- */
let Handlebars: typeof HandlebarsNS | null = null;
if (typeof window !== 'undefined') {
    import('handlebars').then((m) => {
        Handlebars = m;
    });
}

/* ---------------- Utils ---------------- */

function cx(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(' ');
}

function toLocale(s?: string | null, format: 'full' | 'short' | 'date' = 'short') {
    if (!s) return '—';
    try {
        const date = new Date(s);
        if (format === 'full') {
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else if (format === 'date') {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }
        return date.toLocaleDateString();
    } catch {
        return s;
    }
}

function substitute(input: string, data: Record<string, unknown>) {
    return (input || '').replace(/{{\s*([a-zA-Z0-9_\.]+)\s*}}/g, (_: string, path: string) => {
        const val = path.split('.').reduce<unknown>((acc, k) => {
            if (acc && typeof acc === 'object' && k in acc) {
                return (acc as Record<string, unknown>)[k];
            }
            return undefined;
        }, data);
        return String(val ?? '');
    });
}

function escapeHtml(s: string) {
    return s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function defaultPreviewData() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return {
        contact: {
            name: 'Jane Example',
            email: 'jane@example.com',
            first_name: 'Jane',
            last_name: 'Example'
        },
        company: {
            name: 'Acme Inc.',
            website: 'https://acme.example.com'
        },
        today: `${yyyy}-${mm}-${dd}`,
        unsubscribe_url: 'https://example.com/unsubscribe?c=123',
        view_in_browser_url: 'https://example.com/campaigns/preview/abc',
    };
}

function StatCard({ label, value, icon, color, subtitle }: {
    label: string;
    value: string | number | React.ReactNode;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'amber' | 'red';
    subtitle?: string;
}) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        red: 'from-red-500 to-red-600',
    };

    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className={`bg-gradient-to-r ${colors[color]} p-3`}>
                <div className="flex items-center justify-between text-white">
                    {icon}
                    <span className="text-xs font-medium uppercase tracking-wider opacity-90">{label}</span>
                </div>
            </div>
            <div className="p-4">
                <div className="text-2xl font-bold text-gray-900">
                    {value}
                </div>
                {subtitle && (
                    <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
                )}
            </div>
        </div>
    );
}

/* ---------------- Page ---------------- */

export default function TemplateShowPage() {
    const router = useRouter();
    const { hash, id } = useParams<{ hash: string; id: string }>();

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const [tpl, setTpl] = useState<TemplateItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // preview state
    const [inlineCss, setInlineCss] = useState(true);
    const [inlining, setInlining] = useState(false);
    const [inlineErr, setInlineErr] = useState<string | null>(null);
    const [inlinedHtml, setInlinedHtml] = useState<string>('');

    const [dataJSON, setDataJSON] = useState(JSON.stringify(defaultPreviewData(), null, 2));
    const [dataObj, setDataObj] = useState<Record<string, unknown>>(defaultPreviewData());
    const [dataErr, setDataErr] = useState<string | null>(null);
    const [showPreviewData, setShowPreviewData] = useState(false);
    const [showSource, setShowSource] = useState(false);

    // fetch template
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(`${backend}/companies/${hash}/templates/${id}`, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load template (${res.status})`);
                const json: TemplateItem = await res.json();
                if (!abort) setTpl(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => {
            abort = true;
        };
    }, [backend, hash, id]);

    // validate preview JSON
    useEffect(() => {
        try {
            const parsed = JSON.parse(dataJSON || '{}');
            setDataObj(parsed as Record<string, unknown>);
            setDataErr(null);
        } catch {
            setDataErr('Invalid JSON format');
        }
    }, [dataJSON]);

    // server-side inline CSS (only when HTML exists)
    useEffect(() => {
        if (!inlineCss || !tpl?.html) {
            setInlineErr(null);
            setInlinedHtml('');
            return;
        }
        const controller = new AbortController();
        const t = setTimeout(async () => {
            try {
                setInlining(true);
                setInlineErr(null);
                const source = substitute(tpl.html || '', dataObj);
                if (!source.trim()) {
                    setInlinedHtml('');
                    return;
                }
                const res = await fetch('/api/email/inline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ html: source }),
                    signal: controller.signal,
                });

                const contentType = res.headers.get('content-type') || '';
                let payload: InlineResponse = {};
                if (contentType.includes('application/json')) {
                    payload = (await res.json()) as InlineResponse;
                } else {
                    const text = await res.text();
                    throw new Error(`Unexpected response: ${text.slice(0, 120)}…`);
                }
                if (!res.ok || payload.error) throw new Error(payload.error || `Inline failed`);
                setInlinedHtml(payload.html || '');
            } catch (e) {
                if (!(e instanceof DOMException && e.name === 'AbortError')) {
                    setInlineErr((e as Error).message);
                    setInlinedHtml('');
                }
            } finally {
                setInlining(false);
            }
        }, 200);

        return () => {
            controller.abort();
            clearTimeout(t);
        };
    }, [inlineCss, tpl?.html, dataObj]);

    // preview
    const previewHtml = useMemo(() => {
        try {
            if (!tpl) return '';
            // If text only
            if (!tpl.html && tpl.text) {
                const t = substitute(tpl.text, dataObj);
                return `<pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:14px;line-height:1.4;margin:16px;color:#111827">${escapeHtml(t)}</pre>`;
            }

            // HTML path
            const input = tpl.html || '';
            let compiled = substitute(input, dataObj);

            if (tpl.engine === 'handlebars' && Handlebars) {
                const tplFn = Handlebars.compile(input);
                compiled = tplFn(dataObj as object);
            }

            if (inlineCss) {
                if (inlineErr) return `<p style="color:#ef4444;padding:20px">⚠️ CSS inline error: ${escapeHtml(inlineErr)}</p>`;
                if (inlining) return `<div style="padding:20px;text-align:center"><p style="color:#6b7280">Processing CSS...</p></div>`;
                return inlinedHtml || compiled;
            }
            return compiled;
        } catch (e) {
            return `<p style="color:#ef4444;padding:20px">⚠️ Preview error: ${(e as Error).message}</p>`;
        }
    }, [tpl, dataObj, inlineCss, inlining, inlineErr, inlinedHtml]);

    async function onDelete() {
        if (!tpl) return;
        if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) return;
        try {
            const res = await fetch(`${backend}/companies/${hash}/templates/${tpl.id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            router.push(`/dashboard/company/${hash}/templates`);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        }
    }

    async function onDuplicate() {
        if (!tpl) return;
        try {
            const res = await fetch(`${backend}/companies/${hash}/templates`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    name: `${tpl.name} (Copy)`,
                    engine: tpl.engine,
                    version: tpl.version,
                    html: tpl.html,
                    text: tpl.text,
                }),
            });
            if (!res.ok) throw new Error(`Duplicate failed (${res.status})`);
            const newTpl: TemplateItem = await res.json();
            router.push(`/dashboard/company/${hash}/templates/${newTpl.id}/edit`);
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        }
    }

    const backHref = `/dashboard/company/${hash}/templates`;

    if (loading && !tpl) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading template...</p>
                </div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Template</h2>
                    </div>
                    <p className="text-gray-600">{err}</p>
                    <button
                        onClick={() => router.push(backHref)}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Templates
                    </button>
                </div>
            </div>
        );
    }

    if (!tpl) return null;

    const engineConfig = getEngineConfig(tpl.engine);
    const EngineIcon = engineConfig.icon;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(backHref)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Templates
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {tpl.name || <span className="text-gray-400 italic">Untitled Template</span>}
                            </h1>
                            <p className="text-sm text-gray-500">
                                Template ID: {tpl.id}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onDuplicate}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                        >
                            <DocumentDuplicateIcon className="h-4 w-4" />
                            Duplicate
                        </button>
                        <Link
                            href={`/dashboard/company/${hash}/templates/${tpl.id}/edit`}
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                        >
                            <PencilSquareIcon className="h-4 w-4" />
                            Edit Template
                        </Link>
                        <button
                            onClick={onDelete}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 transition-all"
                        >
                            <TrashIcon className="h-4 w-4" />
                            Delete
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Template Engine"
                        value={
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${engineConfig.bgClass} ${engineConfig.textClass} border ${engineConfig.borderClass}`}>
                                <EngineIcon className="h-3 w-3" />
                                {engineConfig.label}
                            </span>
                        }
                        icon={<CodeBracketIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="Version"
                        value={`v${tpl.version || '1'}`}
                        icon={<SparklesIcon className="h-5 w-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="Created"
                        value={toLocale(tpl.created_at, 'date')}
                        icon={<ClockIcon className="h-5 w-5" />}
                        color="amber"
                        subtitle={toLocale(tpl.created_at, 'full')}
                    />
                    <StatCard
                        label="Usage"
                        value={tpl.usage?.campaigns || 0}
                        icon={<ChartBarIcon className="h-5 w-5" />}
                        color="red"
                        subtitle={`campaign${(tpl.usage?.campaigns || 0) === 1 ? '' : 's'}`}
                    />
                </div>

                {/* Quick Actions Bar */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowSource(!showSource)}
                                className={cx(
                                    "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                                    showSource
                                        ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                                        : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                                )}
                            >
                                <CodeBracketIcon className="h-4 w-4" />
                                {showSource ? 'Hide Source' : 'View Source'}
                            </button>
                            <button
                                onClick={() => setShowPreviewData(!showPreviewData)}
                                className={cx(
                                    "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                                    showPreviewData
                                        ? "bg-purple-100 text-purple-700 ring-1 ring-purple-200"
                                        : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                                )}
                            >
                                <BeakerIcon className="h-4 w-4" />
                                Test Data
                            </button>
                            <label className="inline-flex items-center gap-2 text-sm ml-4">
                                <input
                                    type="checkbox"
                                    checked={inlineCss}
                                    onChange={(e) => setInlineCss(e.target.checked)}
                                    disabled={!tpl.html}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-gray-700">Inline CSS for preview</span>
                            </label>
                        </div>

                        {(inlineErr || inlining) && (
                            <div className="flex items-center gap-2">
                                {inlining && (
                                    <span className="text-sm text-gray-600">Processing CSS...</span>
                                )}
                                {inlineErr && (
                                    <span className="text-sm text-red-600">CSS error: {inlineErr}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Source Code Panel */}
                {showSource && (
                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-6 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <CodeBracketIcon className="h-5 w-5" />
                                    <h3 className="text-sm font-semibold uppercase tracking-wider">Template Source Code</h3>
                                </div>
                                <button
                                    onClick={() => setShowSource(false)}
                                    className="text-white/60 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {tpl.html && (
                                <div className="p-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <CodeBracketIcon className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm font-medium text-gray-700">HTML Content</span>
                                        <span className="text-xs text-gray-500">({tpl.html.length} characters)</span>
                                    </div>
                                    <pre className="overflow-auto rounded-lg bg-gray-50 border border-gray-200 p-4 text-xs text-gray-800 font-mono max-h-96">
                                        <code>{tpl.html}</code>
                                    </pre>
                                </div>
                            )}
                            {tpl.text && (
                                <div className="p-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <DocumentTextIcon className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm font-medium text-gray-700">Plain Text Content</span>
                                        <span className="text-xs text-gray-500">({tpl.text.length} characters)</span>
                                    </div>
                                    <pre className="overflow-auto rounded-lg bg-gray-50 border border-gray-200 p-4 text-xs text-gray-800 font-mono max-h-96">
                                        <code>{tpl.text}</code>
                                    </pre>
                                </div>
                            )}
                            {!tpl.html && !tpl.text && (
                                <div className="p-12 text-center">
                                    <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                                    <p className="mt-2 text-sm text-gray-500">No source code stored for this template</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Preview Data Panel */}
                {showPreviewData && (
                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <BeakerIcon className="h-5 w-5" />
                                    <h3 className="text-sm font-semibold uppercase tracking-wider">Test Data (JSON)</h3>
                                </div>
                                <button
                                    onClick={() => setShowPreviewData(false)}
                                    className="text-white/80 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="p-0">
                            <textarea
                                value={dataJSON}
                                onChange={(e) => setDataJSON(e.target.value)}
                                rows={10}
                                className={cx(
                                    'w-full px-4 py-3 font-mono text-sm',
                                    dataErr ? 'bg-red-50 text-red-900' : 'bg-gray-50'
                                )}
                                style={{ resize: 'vertical' }}
                            />
                            {dataErr && (
                                <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-sm text-red-600">
                                    {dataErr}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Live Preview */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <EyeIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Live Preview</h3>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-indigo-100">
                                <span>Engine: {tpl.engine || 'none'}</span>
                                <span>•</span>
                                <span>Type: {tpl.html ? 'HTML' : 'Plain Text'}</span>
                                {tpl.html && (
                                    <>
                                        <span>•</span>
                                        <span>CSS: {inlineCss ? 'Inlined' : 'Raw'}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <iframe
                        title="preview"
                        className="w-full h-[640px] bg-white"
                        sandbox="allow-same-origin"
                        srcDoc={`<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0">${previewHtml}</body></html>`}
                    />
                </div>

                {/* Template Info */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-3">
                        <div className="flex items-center gap-2 text-white">
                            <Cog6ToothIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Template Information</h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Template Name</dt>
                                <dd className="mt-1 text-sm text-gray-900">{tpl.name || 'Untitled'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Template ID</dt>
                                <dd className="mt-1 text-sm text-gray-900 font-mono">#{tpl.id}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Content Types</dt>
                                <dd className="mt-1 flex items-center gap-2">
                                    {tpl.html && (
                                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                            HTML
                                        </span>
                                    )}
                                    {tpl.text && (
                                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                            Plain Text
                                        </span>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Last Modified</dt>
                                <dd className="mt-1 text-sm text-gray-900">{toLocale(tpl.created_at, 'full')}</dd>
                            </div>
                        </dl>
                        {(tpl.usage?.campaigns || 0) > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                                    <CheckCircleIcon className="h-4 w-4" />
                                    This template is actively used in {tpl.usage?.campaigns} campaign{(tpl.usage?.campaigns || 0) === 1 ? '' : 's'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}