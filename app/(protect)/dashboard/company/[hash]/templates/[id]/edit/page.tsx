'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    CheckIcon,
    CodeBracketIcon,
    DocumentTextIcon,
    EyeIcon,
    ExclamationTriangleIcon,
    TrashIcon,
    SparklesIcon,
    TagIcon,
    Cog6ToothIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    DocumentDuplicateIcon,
    BeakerIcon,
    BookOpenIcon,
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
type ViewMode = 'split' | 'editor' | 'preview';

type InlineResponse = { html?: string; error?: string };
type TextifyResponse = { text?: string; error?: string };

/* ----------------------------- Template Library ------------------------------ */

const STARTER_TEMPLATES = [
    {
        id: 'newsletter',
        name: 'Newsletter',
        icon: BookOpenIcon,
        description: 'Modern newsletter with header, content sections, and footer',
        html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{company.name}} Newsletter</title>
    <style>
        body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
        .content { padding: 40px 20px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #1f2937; font-size: 20px; margin-bottom: 10px; }
        .section p { color: #4b5563; line-height: 1.6; }
        .button { display: inline-block; padding: 12px 24px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; }
        .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; font-size: 14px; color: #6b7280; }
        .footer a { color: #6366f1; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{company.name}}</h1>
        </div>
        <div class="content">
            <div class="section">
                <p>Hi {{contact.name}},</p>
                <h2>Welcome to our newsletter!</h2>
                <p>We're excited to share our latest updates with you.</p>
            </div>
            <div class="section">
                <h2>What's New</h2>
                <p>Add your main content here...</p>
                <p><a href="#" class="button">Learn More</a></p>
            </div>
        </div>
        <div class="footer">
            <p>© {{company.name}} · {{today}}</p>
            <p>
                <a href="{{unsubscribe_url}}">Unsubscribe</a> · 
                <a href="{{view_in_browser_url}}">View in browser</a>
            </p>
        </div>
    </div>
</body>
</html>`,
        text: `{{company.name}} Newsletter

Hi {{contact.name}},

Welcome to our newsletter!
We're excited to share our latest updates with you.

What's New
Add your main content here...

Learn More: [link]

---
© {{company.name}} · {{today}}
Unsubscribe: {{unsubscribe_url}}
View in browser: {{view_in_browser_url}}`,
    },
];

/* ----------------------------- Merge tags ------------------------------ */

const MERGE_TAGS = [
    { category: 'Contact', tags: [
            { key: '{{contact.name}}', label: 'Name', icon: '👤' },
            { key: '{{contact.email}}', label: 'Email', icon: '✉️' },
            { key: '{{contact.first_name}}', label: 'First Name', icon: '👤' },
            { key: '{{contact.last_name}}', label: 'Last Name', icon: '👤' },
        ]},
    { category: 'Company', tags: [
            { key: '{{company.name}}', label: 'Company Name', icon: '🏢' },
            { key: '{{company.website}}', label: 'Website', icon: '🌐' },
        ]},
    { category: 'System', tags: [
            { key: '{{today}}', label: 'Today\'s Date', icon: '📅' },
            { key: '{{unsubscribe_url}}', label: 'Unsubscribe Link', icon: '🔗' },
            { key: '{{view_in_browser_url}}', label: 'Browser View Link', icon: '🔗' },
        ]},
];

const CONTENT_BLOCKS = [
    {
        label: 'Header Section',
        icon: '🎯',
        html: `<div style="padding: 30px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center;">
    <h1 style="color: #ffffff; margin: 0;">{{company.name}}</h1>
</div>`,
        text: `=== {{company.name}} ===\n`,
    },
    {
        label: 'Call-to-Action Button',
        icon: '🔘',
        html: `<div style="text-align: center; margin: 30px 0;">
    <a href="#" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">Click Here</a>
</div>`,
        text: `\n[Click Here] → [link]\n`,
    },
    {
        label: 'Image Placeholder',
        icon: '🖼️',
        html: `<div style="text-align: center; margin: 20px 0;">
    <img src="https://via.placeholder.com/600x300" alt="Image" style="max-width: 100%; height: auto; border-radius: 8px;">
</div>`,
        text: `\n[Image]\n`,
    },
    {
        label: 'Footer with Unsubscribe',
        icon: '📝',
        html: `<div style="margin-top: 40px; padding: 20px; background-color: #f9fafb; text-align: center; font-size: 12px; color: #6b7280;">
    <p>© {{company.name}} · {{today}}</p>
    <p>
        <a href="{{unsubscribe_url}}" style="color: #6366f1;">Unsubscribe</a> · 
        <a href="{{view_in_browser_url}}" style="color: #6366f1;">View in browser</a>
    </p>
</div>`,
        text: `\n---\n© {{company.name}} · {{today}}\nUnsubscribe: {{unsubscribe_url}}\nView in browser: {{view_in_browser_url}}\n`,
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

/* ------------------------------ Page --------------------------------- */

export default function TemplateEditPage() {
    const router = useRouter();
    const { hash, id } = useParams<{ hash: string; id: string }>();

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const backHref = `/dashboard/company/${hash}/templates/${id}`;

    // Loading & error
    const [loading, setLoading] = useState<boolean>(true);
    const [loadErr, setLoadErr] = useState<string | null>(null);

    // Basics
    const [name, setName] = useState<string>('');
    const [engine, setEngine] = useState<string>('raw');
    const [version, setVersion] = useState<string>('');

    // Content
    const [mode, setMode] = useState<ContentMode>('html');
    const [html, setHtml] = useState<string>('');
    const [text, setText] = useState<string>('');

    // View
    const [viewMode, setViewMode] = useState<ViewMode>('split');
    const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
    const [showMergeTags, setShowMergeTags] = useState(false);
    const [showBlocks, setShowBlocks] = useState(false);

    // Meta (read-only)
    const [createdAt, setCreatedAt] = useState<string | null>(null);

    // Preview data (JSON)
    const [dataJSON, setDataJSON] = useState<string>(JSON.stringify(defaultPreviewData(), null, 2));
    const [dataObj, setDataObj] = useState<Record<string, unknown>>(defaultPreviewData());
    const [dataErr, setDataErr] = useState<string | null>(null);
    const [showPreviewData, setShowPreviewData] = useState(false);

    // Inline CSS & textify helpers
    const [inlineCss, setInlineCss] = useState<boolean>(true);
    const [inlining, setInlining] = useState<boolean>(false);
    const [inlineErr, setInlineErr] = useState<string | null>(null);
    const [inlinedHtml, setInlinedHtml] = useState<string>('');

    const [textifying, setTextifying] = useState<boolean>(false);
    const [textifyErr, setTextifyErr] = useState<string | null>(null);

    // UI
    const [saving, setSaving] = useState<boolean>(false);
    const [err, setErr] = useState<string | null>(null);

    // Fetch existing template
    useEffect(() => {
        let abort = false;
        (async () => {
            if (!backend) return setLoadErr('Missing backend URL');
            setLoading(true);
            setLoadErr(null);
            try {
                const res = await fetch(`${backend}/companies/${hash}/templates/${id}`);
                if (!res.ok) throw new Error(`Failed to load template (${res.status})`);
                const tpl = (await res.json()) as Template;
                if (abort) return;
                setName(tpl.name ?? '');
                setEngine(tpl.engine ?? 'raw');
                setVersion(tpl.version != null ? String(tpl.version) : '');
                setHtml(tpl.html ?? '');
                setText(tpl.text ?? '');
                setCreatedAt(tpl.created_at ?? null);
                // auto choose mode
                setMode(tpl.html ? 'html' : 'text');
            } catch (e) {
                if (!abort) setLoadErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => {
            abort = true;
        };
    }, [backend, hash, id]);

    /* ---------- validate preview JSON ---------- */
    useEffect(() => {
        try {
            const parsed = JSON.parse(dataJSON || '{}') as Record<string, unknown>;
            setDataObj(parsed);
            setDataErr(null);
        } catch {
            setDataErr('Invalid JSON format');
        }
    }, [dataJSON]);

    /* ---------- inline CSS on server (optional) ---------- */
    useEffect(() => {
        if (!inlineCss || mode !== 'html' || !html.trim()) {
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
                    payload = (await res.json()) as InlineResponse;
                } else {
                    const txt = await res.text();
                    throw new Error(`Unexpected response: ${txt.slice(0, 120)}…`);
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
                return `<pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:14px;line-height:1.4;margin:16px;color:#111827">${escapeHtml(t)}</pre>`;
            }

            const input = html || '';
            let compiled = substitute(input, dataObj);

            if (engine === 'handlebars' && Handlebars) {
                const tpl = Handlebars.compile(input);
                compiled = tpl(dataObj);
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
    }, [mode, html, text, engine, dataObj, inlineCss, inlining, inlineErr, inlinedHtml]);

    /* ---------- warnings ---------- */
    const hasUnsubscribe = useMemo(() => {
        const content = mode === 'html' ? html : text;
        return content?.includes('{{unsubscribe_url}}');
    }, [mode, html, text]);

    const canSubmit = name.trim().length > 0;

    /* ---------- actions ---------- */

    function loadTemplate(template: typeof STARTER_TEMPLATES[0]) {
        setHtml(template.html);
        setText(template.text);
        setName(template.name);
        setShowTemplateLibrary(false);
    }

    function insertTag(tag: string) {
        if (mode === 'html') {
            setHtml(prev => prev + tag);
        } else {
            setText(prev => prev + tag);
        }
    }

    function insertBlock(block: typeof CONTENT_BLOCKS[0]) {
        if (mode === 'html') {
            setHtml(prev => prev + '\n' + block.html);
        } else {
            setText(prev => prev + '\n' + block.text);
        }
    }

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
            const json = (await res.json()) as TextifyResponse;
            if (!res.ok || json.error) throw new Error(json.error || `Convert failed`);
            setMode('text');
            setText(json.text || '');
        } catch (e) {
            setTextifyErr((e as Error).message);
        } finally {
            setTextifying(false);
        }
    }

    async function saveTemplate(redirect: 'back' | 'stay' | 'duplicate') {
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

            if (redirect === 'duplicate') {
                // Create new template as copy
                const res = await fetch(`${backend}/companies/${hash}/templates`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({
                        ...payload,
                        name: `${name.trim()} (Copy)`,
                    }),
                });
                const json = (await res.json()) as Template | { error?: string };
                if (!res.ok) throw new Error('error' in json && json.error ? json.error : `Duplicate failed`);
                const created = json as Template;
                router.push(`/dashboard/company/${hash}/templates/${created.id}/edit`);
            } else {
                // Update existing template
                const res = await fetch(`${backend}/companies/${hash}/templates/${id}`, {
                    method: 'PATCH',
                    headers: authHeaders(),
                    body: JSON.stringify(payload),
                });
                const json = (await res.json()) as Template | { error?: string };
                if (!res.ok) throw new Error('error' in json && json.error ? json.error : `Save failed`);

                if (redirect === 'back') router.push(backHref);
            }
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    async function onDelete() {
        if (!backend) return setErr('Missing backend URL');
        if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) return;
        try {
            const res = await fetch(`${backend}/companies/${hash}/templates/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            router.push(`/dashboard/company/${hash}/templates`);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    /* ------------------------------- Render -------------------------------- */

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading template...</p>
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
                        <h2 className="text-lg font-semibold">Error Loading Template</h2>
                    </div>
                    <p className="text-gray-600">{loadErr}</p>
                    <button
                        onClick={() => router.push(`/dashboard/company/${hash}/templates`)}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Templates
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(backHref)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Template
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Edit Template</h1>
                            <p className="text-sm text-gray-500">
                                ID: {id} · Created {toLocale(createdAt, 'date')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => saveTemplate('duplicate')}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                        >
                            <DocumentDuplicateIcon className="h-4 w-4" />
                            Duplicate
                        </button>
                        <button
                            onClick={onDelete}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 transition-all"
                        >
                            <TrashIcon className="h-4 w-4" />
                            Delete
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <button
                            onClick={() => saveTemplate('stay')}
                            disabled={!canSubmit || saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <CheckIcon className="h-4 w-4" />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={() => saveTemplate('back')}
                            disabled={!canSubmit || saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <CheckIcon className="h-4 w-4" />
                            {saving ? 'Saving...' : 'Save & Back'}
                        </button>
                    </div>
                </div>

                {/* Quick Actions Bar */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowTemplateLibrary(!showTemplateLibrary)}
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:from-purple-600 hover:to-purple-700 transition-all"
                            >
                                <BookOpenIcon className="h-4 w-4" />
                                Template Library
                            </button>
                            <button
                                onClick={() => setShowMergeTags(!showMergeTags)}
                                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                            >
                                <TagIcon className="h-4 w-4" />
                                Merge Tags
                            </button>
                            <button
                                onClick={() => setShowBlocks(!showBlocks)}
                                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Content Blocks
                            </button>
                            {mode === 'html' && (
                                <button
                                    onClick={onGeneratePlainText}
                                    disabled={textifying || !html.trim()}
                                    className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-all"
                                >
                                    <SparklesIcon className="h-4 w-4" />
                                    {textifying ? 'Generating...' : 'Generate Plain Text'}
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                                <button
                                    onClick={() => setViewMode('split')}
                                    className={cx(
                                        'rounded px-2 py-1 text-xs font-medium transition-all',
                                        viewMode === 'split' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                                    )}
                                >
                                    Split View
                                </button>
                                <button
                                    onClick={() => setViewMode('editor')}
                                    className={cx(
                                        'rounded px-2 py-1 text-xs font-medium transition-all',
                                        viewMode === 'editor' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                                    )}
                                >
                                    Editor Only
                                </button>
                                <button
                                    onClick={() => setViewMode('preview')}
                                    className={cx(
                                        'rounded px-2 py-1 text-xs font-medium transition-all',
                                        viewMode === 'preview' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                                    )}
                                >
                                    Preview Only
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Template Library Modal */}
                {showTemplateLibrary && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">Replace with Template</h2>
                                    <button
                                        onClick={() => setShowTemplateLibrary(false)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                {STARTER_TEMPLATES.map((template) => {
                                    const Icon = template.icon;
                                    return (
                                        <div
                                            key={template.id}
                                            onClick={() => {
                                                if (confirm('This will replace your current content. Continue?')) {
                                                    loadTemplate(template);
                                                }
                                            }}
                                            className="rounded-lg border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-lg transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <h3 className="font-medium text-gray-900 group-hover:text-indigo-600">{template.name}</h3>
                                            </div>
                                            <p className="text-sm text-gray-600">{template.description}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Merge Tags Dropdown */}
                {showMergeTags && (
                    <div className="absolute z-40 mt-2 bg-white rounded-lg shadow-lg ring-1 ring-gray-200 p-4 max-w-md">
                        {MERGE_TAGS.map((category) => (
                            <div key={category.category} className="mb-4 last:mb-0">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                    {category.category}
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {category.tags.map((tag) => (
                                        <button
                                            key={tag.key}
                                            onClick={() => {
                                                insertTag(tag.key);
                                                setShowMergeTags(false);
                                            }}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                        >
                                            <span>{tag.icon}</span>
                                            <div>
                                                <div className="font-medium text-gray-900">{tag.label}</div>
                                                <div className="text-xs text-gray-500 font-mono">{tag.key}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Content Blocks Dropdown */}
                {showBlocks && (
                    <div className="absolute z-40 mt-2 bg-white rounded-lg shadow-lg ring-1 ring-gray-200 p-4 max-w-sm">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Content Blocks
                        </h3>
                        <div className="space-y-2">
                            {CONTENT_BLOCKS.map((block) => (
                                <button
                                    key={block.label}
                                    onClick={() => {
                                        insertBlock(block);
                                        setShowBlocks(false);
                                    }}
                                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                >
                                    <span className="text-lg">{block.icon}</span>
                                    <span className="font-medium text-gray-900">{block.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Template Settings */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-3">
                        <div className="flex items-center gap-2 text-white">
                            <Cog6ToothIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Template Settings</h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Template Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Monthly Newsletter"
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Template Engine
                                </label>
                                <select
                                    value={engine}
                                    onChange={(e) => setEngine(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="handlebars">Handlebars ({'{{tags}}'})</option>
                                    <option value="raw">Raw HTML</option>
                                    <option value="">(none)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Version
                                </label>
                                <input
                                    type="number"
                                    value={version}
                                    onChange={(e) => setVersion(e.target.value)}
                                    placeholder="1"
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setMode('html')}
                                        className={cx(
                                            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                                            mode === 'html'
                                                ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'
                                                : 'text-gray-600 hover:text-gray-900'
                                        )}
                                    >
                                        <CodeBracketIcon className="h-4 w-4" />
                                        HTML
                                    </button>
                                    <button
                                        onClick={() => setMode('text')}
                                        className={cx(
                                            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                                            mode === 'text'
                                                ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'
                                                : 'text-gray-600 hover:text-gray-900'
                                        )}
                                    >
                                        <DocumentTextIcon className="h-4 w-4" />
                                        Plain Text
                                    </button>
                                </div>

                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={inlineCss}
                                        onChange={(e) => setInlineCss(e.target.checked)}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-gray-700">Inline CSS for preview</span>
                                </label>

                                <button
                                    onClick={() => setShowPreviewData(!showPreviewData)}
                                    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                                >
                                    <BeakerIcon className="h-4 w-4" />
                                    Test Data
                                </button>
                            </div>

                            {!hasUnsubscribe && (
                                <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
                                    <ExclamationTriangleIcon className="h-4 w-4" />
                                    <span>Consider adding {'{{unsubscribe_url}}'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Preview Data Panel */}
                {showPreviewData && (
                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden mb-6">
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
                                rows={8}
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

                {/* Main Content Area */}
                <div className={cx(
                    'grid gap-6',
                    viewMode === 'split' && 'grid-cols-1 lg:grid-cols-2',
                    viewMode === 'editor' && 'grid-cols-1',
                    viewMode === 'preview' && 'grid-cols-1'
                )}>
                    {/* Editor */}
                    {viewMode !== 'preview' && (
                        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-gray-700 to-gray-800 px-6 py-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-white">
                                        <CodeBracketIcon className="h-5 w-5" />
                                        <h3 className="text-sm font-semibold uppercase tracking-wider">
                                            {mode === 'html' ? 'HTML Editor' : 'Plain Text Editor'}
                                        </h3>
                                    </div>
                                    {viewMode === 'split' && (
                                        <button
                                            onClick={() => setViewMode('editor')}
                                            className="text-white/60 hover:text-white"
                                        >
                                            <ArrowsPointingOutIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                    {viewMode === 'editor' && (
                                        <button
                                            onClick={() => setViewMode('split')}
                                            className="text-white/60 hover:text-white"
                                        >
                                            <ArrowsPointingInIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="h-[600px] overflow-auto">
                                {mode === 'html' ? (
                                    CodeMirror ? (
                                        <CodeMirror
                                            value={html}
                                            height="600px"
                                            onChange={(v: string) => setHtml(v)}
                                        />
                                    ) : (
                                        <textarea
                                            value={html}
                                            onChange={(e) => setHtml(e.target.value)}
                                            className="w-full h-full px-4 py-3 font-mono text-sm border-0 outline-none resize-none"
                                            placeholder="Start typing your HTML template..."
                                        />
                                    )
                                ) : (
                                    <textarea
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        className="w-full h-full px-4 py-3 font-mono text-sm border-0 outline-none resize-none"
                                        placeholder="Start typing your plain text template..."
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    {viewMode !== 'editor' && (
                        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-white">
                                        <EyeIcon className="h-5 w-5" />
                                        <h3 className="text-sm font-semibold uppercase tracking-wider">Live Preview</h3>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-indigo-100">
                                            {engine} · {mode}
                                        </span>
                                        {viewMode === 'split' && (
                                            <button
                                                onClick={() => setViewMode('preview')}
                                                className="text-white/60 hover:text-white"
                                            >
                                                <ArrowsPointingOutIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                        {viewMode === 'preview' && (
                                            <button
                                                onClick={() => setViewMode('split')}
                                                className="text-white/60 hover:text-white"
                                            >
                                                <ArrowsPointingInIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <iframe
                                title="preview"
                                className="w-full h-[600px] bg-white"
                                sandbox="allow-same-origin"
                                srcDoc={`<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0">${previewHtml}</body></html>`}
                            />
                        </div>
                    )}
                </div>

                {/* Error Messages */}
                {err && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                        <div className="flex items-center gap-3">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                            <p className="text-sm text-red-700">{err}</p>
                        </div>
                    </div>
                )}

                {textifyErr && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                        <div className="flex items-center gap-3">
                            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                            <p className="text-sm text-amber-700">Text generation error: {textifyErr}</p>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <Link href={`/dashboard/company/${hash}/templates/${id}`} className="hover:text-gray-800">
                        View template details →
                    </Link>
                </div>
            </div>
        </div>
    );
}

/* ------------------------- Utilities ------------------------- */

function substitute<T extends Record<string, unknown>>(input: string, data: T): string {
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