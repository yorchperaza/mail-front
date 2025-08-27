'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    PencilSquareIcon,
    TrashIcon,
    EyeIcon,
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

/* -------------- Optional client-only Handlebars -------------- */
let Handlebars: typeof HandlebarsNS | null = null;
if (typeof window !== 'undefined') {
    // lazy so SSR doesn't try to bundle it
    import('handlebars').then((m) => {
        Handlebars = m;
    });
}

/* ---------------- Utils ---------------- */

function cx(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(' ');
}

function toLocale(s?: string | null) {
    if (!s) return '—';
    try {
        return new Date(s).toLocaleString();
    } catch {
        return s;
    }
}

/** Tiny {{a.b.c}} replacer for preview data (no helpers/logic) */
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
        contact: { name: 'Jane Example', email: 'jane@example.com' },
        company: { name: 'Acme Inc.' },
        today: `${yyyy}-${mm}-${dd}`,
        unsubscribe_url: 'https://example.com/unsubscribe?c=123',
        view_in_browser_url: 'https://example.com/campaigns/preview/abc',
    };
}

function EngineBadge({ engine }: { engine: string | null }) {
    if (!engine) return <span className="text-gray-400">—</span>;
    const tone =
        engine === 'raw'
            ? 'bg-gray-100 text-gray-800 border-gray-200'
            : engine === 'handlebars'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-gray-50 text-gray-700 border-gray-200';
    return (
        <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs', tone)}>
      {engine}
    </span>
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
            setDataErr('Preview data is not valid JSON.');
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
                    setInlinedHtml(''); // nothing to inline
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
                    throw new Error(`Unexpected response (${res.status}): ${text.slice(0, 120)}…`);
                }
                if (!res.ok || payload.error) throw new Error(payload.error || `Inline failed (${res.status})`);
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
                return `<pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:14px;line-height:1.4;margin:0">${escapeHtml(
                    t
                )}</pre>`;
            }

            // HTML path
            const input = tpl.html || '';
            let compiled = substitute(input, dataObj);

            if (tpl.engine === 'handlebars' && Handlebars) {
                const tplFn = Handlebars.compile(input);
                compiled = tplFn(dataObj as object);
            }

            if (inlineCss) {
                if (inlineErr) return `<p style="color:#b91c1c">Inline CSS error: ${escapeHtml(inlineErr)}</p>`;
                if (inlining) return `<p style="color:#6b7280">Inlining CSS…</p>`;
                return inlinedHtml || compiled;
            }
            return compiled;
        } catch (e) {
            return `<p style="color:#b91c1c">Preview error: ${(e as Error).message}</p>`;
        }
    }, [tpl, dataObj, inlineCss, inlining, inlineErr, inlinedHtml]);

    async function onDelete() {
        if (!tpl) return;
        if (!confirm('Delete this template?')) return;
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

    const backHref = `/dashboard/company/${hash}/templates`;

    if (loading && !tpl) return <p className="p-6 text-center text-gray-600">Loading template…</p>;
    if (err)
        return (
            <div className="p-6 text-center">
                <p className="text-red-600">{err}</p>
                <button onClick={() => router.push(backHref)} className="mt-3 inline-flex items-center px-3 py-2 rounded border">
                    <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back
                </button>
            </div>
        );
    if (!tpl) return null;

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={() => router.push(backHref)} className="inline-flex items-center text-gray-600 hover:text-gray-800">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold flex items-center gap-3">
                    <EyeIcon className="h-6 w-6 text-gray-500" />
                    {tpl.name || <span className="text-gray-400">(untitled)</span>}
                </h1>
                <div className="flex items-center gap-2">
                    <Link
                        href={`/dashboard/company/${hash}/templates/${tpl.id}/edit`}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded border hover:bg-gray-50"
                    >
                        <PencilSquareIcon className="h-5 w-5" /> Edit
                    </Link>
                    <button onClick={onDelete} className="inline-flex items-center gap-1 px-3 py-2 rounded border text-red-600 hover:bg-red-50">
                        <TrashIcon className="h-5 w-5" /> Delete
                    </button>
                </div>
            </div>

            {/* Meta */}
            <div className="bg-white border rounded-lg p-4">
                <div className="grid md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <div className="text-gray-600">Engine</div>
                        <div className="mt-1">
                            <EngineBadge engine={tpl.engine} />
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-600">Version</div>
                        <div className="mt-1">{tpl.version ?? '—'}</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Created</div>
                        <div className="mt-1">{toLocale(tpl.created_at)}</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Used in</div>
                        <div className="mt-1">
                            {typeof tpl.usage?.campaigns === 'number'
                                ? `${tpl.usage.campaigns} campaign${tpl.usage.campaigns === 1 ? '' : 's'}`
                                : '—'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Source (read-only) */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <h2 className="text-lg font-semibold">Source</h2>
                {tpl.html ? (
                    <div>
                        <div className="text-xs text-gray-500 mb-1">HTML</div>
                        <pre className="overflow-auto rounded border bg-gray-50 p-3 text-xs text-gray-800">
              <code>{tpl.html}</code>
            </pre>
                    </div>
                ) : null}
                {tpl.text ? (
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Plain text</div>
                        <pre className="overflow-auto rounded border bg-gray-50 p-3 text-xs text-gray-800">
              <code>{tpl.text}</code>
            </pre>
                    </div>
                ) : null}
                {!tpl.html && !tpl.text && <p className="text-gray-500 text-sm">No source stored for this template.</p>}
            </div>

            {/* Preview controls + data */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={inlineCss} onChange={(e) => setInlineCss(e.target.checked)} disabled={!tpl.html} />
                        Inline CSS for preview
                    </label>
                    {inlineErr && <span className="text-sm text-red-600">Inline CSS error: {inlineErr}</span>}
                    {inlining && <span className="text-sm text-gray-600">Inlining…</span>}
                </div>

                <div>
                    <div className="text-xs text-gray-500 mb-1">Preview data (JSON)</div>
                    <textarea
                        value={dataJSON}
                        onChange={(e) => setDataJSON(e.target.value)}
                        rows={8}
                        className={cx('w-full px-3 py-2 font-mono text-xs outline-none rounded border', dataErr ? 'bg-rose-50 border-rose-200' : 'border-gray-300')}
                    />
                    {dataErr && <div className="mt-1 text-sm text-red-600">{dataErr}</div>}
                </div>

                {/* Preview */}
                <div className="border rounded overflow-hidden">
                    <div className="px-3 py-2 border-b bg-gray-50 text-sm text-gray-700 flex items-center justify-between">
            <span className="inline-flex items-center">
              <EyeIcon className="h-4 w-4 mr-1" />
              Preview
            </span>
                        <span className="text-xs text-gray-500">
              Engine: <span className="font-medium">{tpl.engine || 'none'}</span>
            </span>
                    </div>
                    <iframe
                        title="preview"
                        className="w-full h-[640px] bg-white"
                        sandbox="allow-same-origin"
                        srcDoc={`<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji;margin:16px;color:#111827;}</style>
</head><body>${previewHtml}</body></html>`}
                    />
                </div>
            </div>
        </div>
    );
}
