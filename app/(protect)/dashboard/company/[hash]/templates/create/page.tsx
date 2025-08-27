'use client';

import React, {JSX, useEffect, useMemo, useState} from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    CheckIcon,
    CodeBracketIcon,
    DocumentTextIcon,
    EyeIcon,
    ExclamationTriangleIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror';

// Lazy import editor so Next doesn't SSR it
let CodeMirror: React.ComponentType<ReactCodeMirrorProps> | null = null;

if (typeof window !== 'undefined') {
    import('@uiw/react-codemirror').then((m) => {
        CodeMirror = m.default as React.ComponentType<ReactCodeMirrorProps>;
    });
}

// Optional client-side Handlebars for quick templating
let Handlebars: typeof import('handlebars') | null = null;
if (typeof window !== 'undefined') {
    import('handlebars').then((m) => (Handlebars = m.default));
}

/* -------------------------------- Types -------------------------------- */

type Template = {
    id: number;
    name: string | null;
    engine: string | null; // 'raw' | 'handlebars' | null
    version: number | null;
    html: string | null;
    text: string | null;
    created_at: string | null;
};

type ContentMode = 'html' | 'text';

type InlineResponse = { html?: string; error?: string };
type TextifyResponse = { text?: string; error?: string };

/* ----------------------------- Merge tags ------------------------------ */

const TAGS = [
    { key: '{{contact.name}}', label: 'Contact Name' },
    { key: '{{contact.email}}', label: 'Contact Email' },
    { key: '{{company.name}}', label: 'Company Name' },
    { key: '{{today}}', label: 'Today (YYYY-MM-DD)' },
    { key: '{{unsubscribe_url}}', label: 'Unsubscribe URL' },
    { key: '{{view_in_browser_url}}', label: 'View in browser URL' },
];

const SNIPPETS = [
    {
        label: 'Greeting block',
        html: `<p>Hi {{contact.name}},</p>\n<p>We thought you might like this update from {{company.name}}.</p>\n`,
        text: `Hi {{contact.name}},\n\nWe thought you might like this update from {{company.name}}.\n\n`,
    },
    {
        label: 'Footer (legal + unsubscribe)',
        html: `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />\n<p style="font-size:12px;color:#6b7280">You are receiving this email because you opted in at our website. <a href="{{unsubscribe_url}}">Unsubscribe</a> · <a href="{{view_in_browser_url}}">View in browser</a></p>\n`,
        text: `----\nYou are receiving this email because you opted in at our website.\nUnsubscribe: {{unsubscribe_url}}\nView in browser: {{view_in_browser_url}}\n`,
    },
    {
        label: 'One-column section (responsive)',
        html: `<table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:0 12px;">
      <table role="presentation" width="600" style="max-width:600px;border-collapse:collapse;">
        <tr>
          <td style="padding:16px 20px;">
            <h2 style="margin:0 0 8px;font-size:20px;line-height:1.2;">Section title</h2>
            <p style="margin:0;color:#4b5563;">Your content here…</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>\n`,
        text: `Section title\n\nYour content here…\n`,
    },
];

/* ----------------------------- Utilities ------------------------------ */

function cx(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(' ');
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

function requiresUnsubscribe(htmlOrText: string) {
    const needle = '{{unsubscribe_url}}';
    return !htmlOrText?.includes(needle);
}

/* ------------------------------ Page --------------------------------- */

export default function TemplateCreatePage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const backHref = `/dashboard/company/${hash}/templates`;

    // Basics
    const [name, setName] = useState('');
    const [engine, setEngine] = useState<string>('raw'); // 'raw' | 'handlebars'
    const [version, setVersion] = useState<string>('');

    // Content
    const [mode, setMode] = useState<ContentMode>('html');
    const [html, setHtml] = useState<string>('');
    const [text, setText] = useState<string>('');

    // Preview data (JSON)
    const [dataJSON, setDataJSON] = useState(JSON.stringify(defaultPreviewData(), null, 2));
    const [dataObj, setDataObj] = useState<Record<string, unknown>>(defaultPreviewData());
    const [dataErr, setDataErr] = useState<string | null>(null);

    // Inline CSS & textify helpers
    const [inlineCss, setInlineCss] = useState(true);
    const [inlining, setInlining] = useState(false);
    const [inlineErr, setInlineErr] = useState<string | null>(null);
    const [inlinedHtml, setInlinedHtml] = useState<string>('');

    const [textifying, setTextifying] = useState(false);
    const [textifyErr, setTextifyErr] = useState<string | null>(null);

    // UI
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    /* ---------- validate preview JSON ---------- */
    useEffect(() => {
        try {
            const parsed = JSON.parse(dataJSON || '{}');
            setDataObj(parsed);
            setDataErr(null);
        } catch {
            setDataErr('Preview data is not valid JSON.');
        }
    }, [dataJSON]);

    /* ---------- inline CSS on server (optional) ---------- */
    useEffect(() => {
        if (!inlineCss || mode !== 'html' || !html.trim()) {
            // reset state when there is no content
            setInlineErr(null);
            setInlinedHtml('');
            return;
        }

        const controller = new AbortController();
        const t = setTimeout(async () => {
            try {
                setInlining(true);
                setInlineErr(null);
                const source = substitute(html, dataObj);

                const res = await fetch('/api/email/inline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ html: source }),
                    signal: controller.signal,
                });

                const contentType = res.headers.get('content-type') || '';
                let payload: InlineResponse = {};

                if (contentType.includes('application/json')) {
                    payload = await res.json();
                } else {
                    const txt = await res.text();
                    throw new Error(`Unexpected response (${res.status}): ${txt.slice(0, 120)}…`);
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
        }, 250);

        return () => {
            controller.abort();
            clearTimeout(t);
        };
    }, [inlineCss, mode, html, dataObj]);

    /* ---------- preview renderer ---------- */
    const previewHtml = useMemo(() => {
        try {
            if (mode === 'text') {
                const t = substitute(text || '', dataObj);
                return `<pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:14px;line-height:1.4;margin:0">${escapeHtml(
                    t,
                )}</pre>`;
            }

            const input = html || '';
            let compiled = substitute(input, dataObj);

            if (engine === 'handlebars' && Handlebars) {
                const tpl = Handlebars.compile(input);
                compiled = tpl(dataObj);
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
    }, [mode, html, text, engine, dataObj, inlineCss, inlining, inlineErr, inlinedHtml]);

    /* ---------- warnings ---------- */
    const warnUnsub = useMemo(() => {
        const content = mode === 'html' ? html : text;
        return requiresUnsubscribe(content);
    }, [mode, html, text]);

    const canSubmit = name.trim().length > 0;

    /* ---------- actions ---------- */

    async function onGeneratePlainText() {
        setTextifyErr(null);
        setTextifying(true);
        try {
            const source = substitute(html || '', dataObj);
            const res = await fetch('/api/email/textify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html: source }),
            });
            const json: TextifyResponse = await res.json();
            if (!res.ok || json.error) throw new Error(json.error || `Convert failed (${res.status})`);
            setMode('text');
            setText(json.text || '');
        } catch (e) {
            setTextifyErr((e as Error).message);
        } finally {
            setTextifying(false);
        }
    }

    async function createTemplate(redirectToDetail: boolean) {
        if (!backend) return setErr('Missing backend URL');
        if (!canSubmit) return setErr('Please enter a name.');

        setSaving(true);
        setErr(null);

        try {
            const payload: Record<string, unknown> = {
                name: name.trim(),
                engine: engine.trim() || null,
                version: version.trim() === '' ? null : Number(version),
                html: mode === 'html' ? (html.trim() === '' ? null : html) : null,
                text: mode === 'text' ? (text.trim() === '' ? null : text) : null,
            };

            const res = await fetch(`${backend}/companies/${hash}/templates`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });
            const json = (await res.json()) as Template | { error?: string };
            if (!res.ok) throw new Error('error' in json && json.error ? json.error : `Create failed (${res.status})`);

            const created = json as Template;
            if (redirectToDetail) {
                router.push(`/dashboard/company/${hash}/templates/${created.id}`);
            } else {
                router.push(backHref);
            }
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    /* ------------------------------- Render (STACKED) -------------------------------- */

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={() => router.push(backHref)} className="inline-flex items-center text-gray-600 hover:text-gray-800">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">Create Template</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => createTemplate(false)}
                        disabled={!canSubmit || saving}
                        className="inline-flex items-center px-4 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-60"
                    >
                        <CheckIcon className="h-5 w-5 mr-1" />
                        {saving ? 'Creating…' : 'Create & return'}
                    </button>
                    <button
                        onClick={() => createTemplate(true)}
                        disabled={!canSubmit || saving}
                        className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    >
                        {saving ? 'Working…' : 'Create & open'}
                    </button>
                </div>
            </div>

            {/* Basics */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <div className="grid md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1">
                            Name <span className="text-red-600">*</span>
                        </label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Newsletter v2"
                            className="w-full rounded border px-3 py-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Engine</label>
                        <select value={engine} onChange={(e) => setEngine(e.target.value)} className="w-full rounded border px-3 py-2">
                            <option value="raw">raw (HTML as-is)</option>
                            <option value="handlebars">handlebars ({'{{tags}}'})</option>
                            <option value="">(none)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Version</label>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={version}
                            onChange={(e) => setVersion(e.target.value)}
                            placeholder="optional"
                            className="w-full rounded border px-3 py-2"
                        />
                    </div>
                </div>

                {/* Mode switch + warnings */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setMode('html')}
                        className={cx(
                            'inline-flex items-center px-3 py-1.5 rounded border text-sm',
                            mode === 'html' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'hover:bg-gray-50',
                        )}
                    >
                        <CodeBracketIcon className="h-4 w-4 mr-1" /> HTML
                    </button>
                    <button
                        onClick={() => setMode('text')}
                        className={cx(
                            'inline-flex items-center px-3 py-1.5 rounded border text-sm',
                            mode === 'text' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'hover:bg-gray-50',
                        )}
                    >
                        <DocumentTextIcon className="h-4 w-4 mr-1" /> Plain text
                    </button>

                    <label className="ml-4 inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={inlineCss} onChange={(e) => setInlineCss(e.target.checked)} />
                        Inline CSS for preview
                    </label>

                    <div className="ml-auto flex items-center gap-3 text-sm">
                        {warnUnsub && (
                            <span className="inline-flex items-center text-amber-700">
                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                <span>Consider adding {'{{unsubscribe_url}}'} to reduce spam complaints.</span>
              </span>
                        )}
                        {inlineErr && <span className="text-sm text-red-600">Inline CSS error: {inlineErr}</span>}
                        {inlining && <span className="text-sm text-gray-600">Inlining…</span>}
                    </div>
                </div>
            </div>

            {/* EDITOR + TOOLS + PREVIEW DATA (TOP) */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                {/* Insert tools */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Tag picker */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Insert tag:</span>
                        <div className="flex flex-wrap gap-2">
                            {TAGS.map((t) => (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => insertToken(mode, t.key, setHtml, setText)}
                                    className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
                                    title={t.label}
                                >
                                    {t.key}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Snippets */}
                    <div className="ml-auto">
                        <div className="relative inline-block">
                            <details>
                                <summary className="list-none">
                  <span className="inline-flex items-center px-2 py-1 rounded border text-xs hover:bg-gray-50 cursor-pointer">
                    <PlusIcon className="h-4 w-4 mr-1" /> Insert snippet
                  </span>
                                </summary>
                                <div className="absolute right-0 z-10 mt-1 w-72 bg-white border rounded shadow">
                                    {SNIPPETS.map((s) => (
                                        <button
                                            key={s.label}
                                            type="button"
                                            onClick={() => insertSnippet(mode, s, setHtml, setText)}
                                            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                            title={s.label}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </details>
                        </div>
                    </div>
                </div>

                {/* Editor */}
                {mode === 'html' ? (
                    <div className="border rounded overflow-hidden">
                        <div className="px-3 py-2 border-b bg-gray-50 text-sm text-gray-700">HTML editor</div>
                        <div className="p-0">
                            {CodeMirror ? (
                                <CodeMirror value={html} height="420px" onChange={(v: string) => setHtml(v)} />
                            ) : (
                                <textarea
                                    value={html}
                                    onChange={(e) => setHtml(e.target.value)}
                                    rows={20}
                                    className="w-full px-3 py-2 font-mono text-sm outline-none"
                                    placeholder="Write HTML (with optional <style>...</style>)…"
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="border rounded overflow-hidden">
                        <div className="px-3 py-2 border-b bg-gray-50 text-sm text-gray-700">Plain text editor</div>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={22}
                            className="w-full px-3 py-2 font-mono text-sm outline-none"
                            placeholder="Write the plain-text content…"
                        />
                    </div>
                )}

                {/* Tools */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onGeneratePlainText}
                        disabled={textifying || mode !== 'html' || !html.trim()}
                        className="inline-flex items-center px-3 py-1.5 rounded border hover:bg-gray-50 disabled:opacity-60 text-sm"
                        title="Generate plain text from current HTML"
                    >
                        {textifying ? 'Generating…' : 'Generate plain text from HTML'}
                    </button>
                    {textifyErr && <span className="text-sm text-red-600">{textifyErr}</span>}
                </div>

                {/* Preview data (JSON) */}
                <div className="border rounded overflow-hidden">
                    <div className="px-3 py-2 border-b bg-gray-50 text-sm text-gray-700">Preview data (JSON)</div>
                    <textarea
                        value={dataJSON}
                        onChange={(e) => setDataJSON(e.target.value)}
                        rows={10}
                        className={cx('w-full px-3 py-2 font-mono text-xs outline-none', dataErr ? 'bg-rose-50' : undefined)}
                    />
                    {dataErr && <div className="px-3 py-2 text-sm text-red-600 border-t">{dataErr}</div>}
                </div>
            </div>

            {/* PREVIEW (BOTTOM) */}
            <div className="border rounded overflow-hidden bg-white">
                <div className="px-3 py-2 border-b bg-gray-50 text-sm text-gray-700 flex items-center justify-between">
          <span className="inline-flex items-center">
            <EyeIcon className="h-4 w-4 mr-1" />
            Preview
          </span>
                    <span className="text-xs text-gray-500">
            Engine: <span className="font-medium">{engine || 'none'}</span> · Mode: <span className="font-medium">{mode}</span>
          </span>
                </div>
                <iframe
                    title="preview"
                    className="w-full h-[720px] bg-white" /* taller since it's the only item on bottom */
                    sandbox="allow-same-origin"
                    srcDoc={`<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji;margin:16px;color:#111827;}</style>
</head><body>${previewHtml}</body></html>`}
                />
            </div>

            {/* Errors */}
            {err && <div className="text-sm text-red-600">{err}</div>}

            {/* Footer */}
            <div className="flex items-center justify-between text-sm text-gray-500">
                <div>
                    <span>Fields with </span>
                    <span className="text-red-600">*</span>
                    <span> are required.</span>
                </div>
                <Link href={backHref} className="hover:text-gray-800">
                    ← Back to templates
                </Link>
            </div>
        </div>
    );
}

/* ------------------------- Insert helpers ------------------------- */
function insertToken(
    mode: ContentMode,
    token: string,
    setHtml: React.Dispatch<React.SetStateAction<string>>,
    setText: React.Dispatch<React.SetStateAction<string>>,
) {
    if (mode === 'html') setHtml((prev) => `${prev}${token}`);
    else setText((prev) => `${prev}${token}`);
}

function insertSnippet(
    mode: ContentMode,
    snippet: { html: string; text: string },
    setHtml: React.Dispatch<React.SetStateAction<string>>,
    setText: React.Dispatch<React.SetStateAction<string>>,
) {
    if (mode === 'html') setHtml((prev) => `${prev}${snippet.html}`);
    else setText((prev) => `${prev}${snippet.text}`);
}

/* ------------------------- Simple templating ------------------------- */

function substitute<T extends Record<string, unknown>>(input: string, data: T): string {
    // Handles {{a.b.c}} safely for raw/handlebars preview data
    return input.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_m, path: string) => {
        const val = path.split('.').reduce<unknown>((acc, key) => {
            if (acc !== null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
                return (acc as Record<string, unknown>)[key];
            }
            return undefined;
        }, data as Record<string, unknown>);
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
