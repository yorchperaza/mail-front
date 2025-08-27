'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    CheckIcon,
    CodeBracketIcon,
    EyeIcon,
    ExclamationTriangleIcon,
    PlayIcon,
    TrashIcon,
    PauseIcon,
    PowerIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror';

/* -------------------- Lazy CodeMirror (no SSR) -------------------- */
let CodeMirror: React.ComponentType<ReactCodeMirrorProps> | null = null;
if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    import('@uiw/react-codemirror').then((m) => {
        CodeMirror = m.default as React.ComponentType<ReactCodeMirrorProps>;
    });
}

/* ----------------------------- Types ------------------------------ */

type Automation = {
    id: number;
    name: string | null;
    trigger: string | null;   // 'time' | 'webhook' | 'event' | null
    flow: Record<string, unknown> | null;
    status: 'draft' | 'active' | 'paused' | 'disabled' | null;
    last_run_at: string | null;
    created_at: string | null;
};

type TriggerKind = 'time' | 'webhook' | 'event';
type PostBody = {
    name?: string | null;
    trigger?: string | null;
    flow?: Record<string, unknown> | null;
    status?: string | null;
};

/* --------------------------- Utilities ---------------------------- */

function cx(...xs: Array<string | false | null | undefined>): string {
    return xs.filter(Boolean).join(' ');
}

function defaultFlow(trigger: TriggerKind): Record<string, unknown> {
    switch (trigger) {
        case 'time':
            return {
                trigger: { type: 'time', cron: '0 9 * * *' }, // every day 09:00
                steps: [{ type: 'action', name: 'send_email', template_id: 123 }],
            };
        case 'webhook':
            return {
                trigger: { type: 'webhook', secret: 'replace-me' },
                steps: [{ type: 'filter', if: 'payload.event == "signup"' }],
            };
        case 'event':
            return {
                trigger: { type: 'event', name: 'contact.created' },
                steps: [{ type: 'action', name: 'add_to_list', list_id: 1 }],
            };
        default:
            return { trigger: { type: 'time', cron: '0 9 * * *' }, steps: [] };
    }
}

function escapeHtml(s: string): string {
    return s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

/* ------------------------------ Page ------------------------------ */

export default function AutomationEditPage() {
    const router = useRouter();
    const { hash, id } = useParams<{ hash: string; id: string }>();

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const backHref = `/dashboard/company/${hash}/automations`;

    // Data/UI state
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [working, setWorking] = useState(false);

    // Basics
    const [name, setName] = useState<string>('');
    const [trigger, setTrigger] = useState<TriggerKind>('time');
    const [status, setStatus] = useState<'draft' | 'active' | 'paused' | 'disabled'>('draft');

    // Flow JSON (editable)
    const [flowJSON, setFlowJSON] = useState<string>(JSON.stringify(defaultFlow('time'), null, 2));
    const [flowObj, setFlowObj] = useState<Record<string, unknown>>(defaultFlow('time'));
    const [flowErr, setFlowErr] = useState<string | null>(null);

    // Meta
    const [createdAt, setCreatedAt] = useState<string | null>(null);
    const [lastRunAt, setLastRunAt] = useState<string | null>(null);

    /* ---------- load automation ---------- */
    useEffect(() => {
        let abort = false;
        (async () => {
            if (!backend) return setErr('Missing backend URL');
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(`${backend}/companies/${hash}/automations/${id}`, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load automation (${res.status})`);
                const a: Automation = await res.json();

                if (abort) return;
                setName(a.name ?? '');
                // prefer explicit trigger, else infer from flow.trigger.type
                const t = (a.trigger as TriggerKind | null) ??
                    (typeof a.flow?.trigger === 'object' && a.flow?.trigger && typeof (a.flow!.trigger as any).type === 'string'
                        ? ((a.flow!.trigger as any).type as TriggerKind)
                        : 'time');
                setTrigger(t);

                const flow = a.flow ?? defaultFlow(t);
                setFlowObj(flow);
                setFlowJSON(JSON.stringify(flow, null, 2));
                setFlowErr(null);

                setStatus((a.status ?? 'draft') as typeof status);
                setCreatedAt(a.created_at);
                setLastRunAt(a.last_run_at);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [backend, hash, id]);

    /* ---------- react to trigger changes: sync JSON's trigger block ---------- */
    useEffect(() => {
        try {
            const parsed = JSON.parse(flowJSON || '{}') as Record<string, unknown>;
            const next = { ...parsed, trigger: defaultFlow(trigger).trigger };
            const nextStr = JSON.stringify(next, null, 2);
            setFlowJSON(nextStr);
            setFlowObj(next);
            setFlowErr(null);
        } catch {
            const def = defaultFlow(trigger);
            setFlowJSON(JSON.stringify(def, null, 2));
            setFlowObj(def);
            setFlowErr(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger]);

    /* ---------- validate as user edits ---------- */
    useEffect(() => {
        try {
            const parsed = JSON.parse(flowJSON || '{}') as Record<string, unknown>;
            setFlowObj(parsed);
            setFlowErr(null);
        } catch {
            setFlowErr('Flow is not valid JSON.');
        }
    }, [flowJSON]);

    const canSubmit = name.trim().length > 0 && !flowErr;

    /* ---------- lint (UX hints) ---------- */
    const lintIssues = useMemo(() => {
        const issues: string[] = [];
        if (!flowObj || typeof flowObj !== 'object') {
            issues.push('Flow must be a JSON object.');
            return issues;
        }
        const trg = (flowObj as Record<string, unknown>)['trigger'];
        if (!trg || typeof trg !== 'object') {
            issues.push('Missing "trigger" object.');
        } else {
            const ttype = (trg as Record<string, unknown>)['type'];
            if (ttype !== trigger) {
                issues.push(`Trigger type in JSON ("${String(ttype)}") differs from selection ("${trigger}").`);
            }
            if (trigger === 'time') {
                const cron = (trg as Record<string, unknown>)['cron'];
                if (!cron || typeof cron !== 'string' || cron.trim() === '') {
                    issues.push('Time trigger requires a non-empty "cron" string.');
                }
            }
            if (trigger === 'webhook') {
                const secret = (trg as Record<string, unknown>)['secret'];
                if (!secret || typeof secret !== 'string' || secret.trim().length < 8) {
                    issues.push('Webhook trigger "secret" should be at least 8 characters.');
                }
            }
            if (trigger === 'event') {
                const name = (trg as Record<string, unknown>)['name'];
                if (!name || typeof name !== 'string' || name.trim() === '') {
                    issues.push('Event trigger requires "name" (e.g., "contact.created").');
                }
            }
        }
        const steps = (flowObj as Record<string, unknown>)['steps'];
        if (!Array.isArray(steps)) {
            issues.push('Flow "steps" should be an array.');
        }
        return issues;
    }, [flowObj, trigger]);

    /* ---------- actions ---------- */

    async function saveAutomation(goBackAfter = false) {
        if (!backend) return setErr('Missing backend URL');
        if (!canSubmit) return setErr('Please fix the form errors.');

        setWorking(true);
        setErr(null);
        try {
            const payload: PostBody = {
                name: name.trim(),
                trigger,
                status,
                flow: flowErr ? null : flowObj,
            };
            const res = await fetch(`${backend}/companies/${hash}/automations/${id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });
            const json = (await res.json()) as Automation | { error?: string };
            if (!res.ok) throw new Error('error' in json && json.error ? json.error : `Update failed (${res.status})`);

            if (goBackAfter) router.push(backHref);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setWorking(false);
        }
    }

    async function lifecycle(action: 'run' | 'enable' | 'pause' | 'disable') {
        if (!backend) return setErr('Missing backend URL');
        setWorking(true);
        setErr(null);
        try {
            const res = await fetch(`${backend}/companies/${hash}/automations/${id}/${action}`, {
                method: 'POST',
                headers: authHeaders(),
            });
            const payload = await res.json();
            if (!res.ok) throw new Error((payload && payload.error) || `${action} failed (${res.status})`);
            // normalize: /run returns { automation, run: {...} }, others return automation directly
            const a: Automation | undefined = payload.automation ?? payload;
            if (a) {
                setStatus((a.status ?? 'draft') as typeof status);
                setLastRunAt(a.last_run_at ?? lastRunAt);
            }
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setWorking(false);
        }
    }

    async function handleDelete() {
        if (!backend) return setErr('Missing backend URL');
        if (!confirm('Delete this automation?')) return;
        setWorking(true);
        setErr(null);
        try {
            const res = await fetch(`${backend}/companies/${hash}/automations/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            router.push(backHref);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setWorking(false);
        }
    }

    /* ------------------------------ Render ------------------------------ */

    if (loading) return <p className="p-6 text-center text-gray-600">Loading automation…</p>;
    if (err && name === '' && flowJSON === '') {
        return (
            <div className="p-6 text-center">
                <p className="text-red-600">{err}</p>
                <button onClick={() => router.push(backHref)} className="mt-3 inline-flex items-center px-3 py-2 rounded border">
                    <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={() => router.push(backHref)} className="inline-flex items-center text-gray-600 hover:text-gray-800">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">Edit Automation</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => saveAutomation(false)}
                        disabled={!canSubmit || working}
                        className="inline-flex items-center px-4 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-60"
                    >
                        <CheckIcon className="h-5 w-5 mr-1" />
                        {working ? 'Saving…' : 'Save'}
                    </button>
                    <button
                        onClick={() => saveAutomation(true)}
                        disabled={!canSubmit || working}
                        className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    >
                        {working ? 'Working…' : 'Save & back'}
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
                            placeholder="e.g. Welcome drip"
                            className="w-full rounded border px-3 py-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Trigger</label>
                        <select
                            value={trigger}
                            onChange={(e) => setTrigger(e.target.value as TriggerKind)}
                            className="w-full rounded border px-3 py-2"
                        >
                            <option value="time">time (CRON)</option>
                            <option value="webhook">webhook</option>
                            <option value="event">event</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as typeof status)}
                            className="w-full rounded border px-3 py-2"
                        >
                            <option value="draft">draft</option>
                            <option value="active">active</option>
                            <option value="paused">paused</option>
                            <option value="disabled">disabled</option>
                        </select>
                    </div>
                </div>

                {/* Meta */}
                <div className="text-xs text-gray-500">
                    Created: <span className="font-medium">{createdAt ? new Date(createdAt).toLocaleString() : '—'}</span> · Last run:{' '}
                    <span className="font-medium">{lastRunAt ? new Date(lastRunAt).toLocaleString() : '—'}</span>
                </div>

                {/* Hints based on trigger */}
                <div className="text-sm text-gray-600 flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    {trigger === 'time' && <span>Use a standard CRON string in <code>flow.trigger.cron</code> (e.g. <code>0 9 * * *</code> for daily 09:00).</span>}
                    {trigger === 'webhook' && <span>Provide a strong <code>flow.trigger.secret</code>; you’ll receive a URL elsewhere after enabling.</span>}
                    {trigger === 'event' && <span>Set <code>flow.trigger.name</code> to an internal event (e.g. <code>"contact.created"</code>).</span>}
                </div>
            </div>

            {/* FLOW EDITOR + LINT + JSON INPUT (TOP) */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 text-sm">
                        <CodeBracketIcon className="h-4 w-4" />
                        <span>Flow (JSON)</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            const def = defaultFlow(trigger);
                            setFlowJSON(JSON.stringify(def, null, 2));
                            setFlowObj(def);
                            setFlowErr(null);
                        }}
                        className="text-sm inline-flex items-center px-2 py-1 rounded border hover:bg-gray-50"
                        title="Reset to default for current trigger"
                    >
                        Reset to default
                    </button>
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                    {/* Left: JSON editor */}
                    <div className="border rounded overflow-hidden">
                        <div className="px-3 py-2 border-b bg-gray-50 text-sm text-gray-700">JSON editor</div>
                        <div>
                            {CodeMirror ? (
                                <CodeMirror value={flowJSON} height="420px" onChange={(v) => setFlowJSON(v)} />
                            ) : (
                                <textarea
                                    value={flowJSON}
                                    onChange={(e) => setFlowJSON(e.target.value)}
                                    rows={20}
                                    className={cx('w-full px-3 py-2 font-mono text-sm outline-none', flowErr ? 'bg-rose-50' : undefined)}
                                    placeholder='{"trigger":{"type":"time","cron":"0 9 * * *"},"steps":[]}'
                                />
                            )}
                        </div>
                    </div>

                    {/* Right: Lint + Quick testers */}
                    <div className="space-y-3">
                        <div className="border rounded p-3">
                            <div className="text-sm font-medium mb-2">Checks</div>
                            {flowErr ? (
                                <div className="text-sm text-red-600">Flow JSON error: {flowErr}</div>
                            ) : lintIssues.length > 0 ? (
                                <ul className="list-disc ml-4 text-sm text-amber-700">
                                    {lintIssues.map((it) => (
                                        <li key={it}>{it}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-sm text-green-700">Looks good!</div>
                            )}
                        </div>

                        {/* Quick actions */}
                        <div className="border rounded p-3">
                            <div className="text-sm font-medium mb-1">Actions</div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={working}
                                    onClick={() => lifecycle('run')}
                                    className="inline-flex items-center px-3 py-1.5 rounded border hover:bg-gray-50 text-sm disabled:opacity-60"
                                    title="Run now"
                                >
                                    <PlayIcon className="h-4 w-4 mr-1" /> Run
                                </button>
                                <button
                                    type="button"
                                    disabled={working || status === 'active'}
                                    onClick={() => lifecycle('enable')}
                                    className="inline-flex items-center px-3 py-1.5 rounded border hover:bg-gray-50 text-sm disabled:opacity-60"
                                    title="Enable"
                                >
                                    <CheckCircleIcon className="h-4 w-4 mr-1" /> Enable
                                </button>
                                <button
                                    type="button"
                                    disabled={working || status === 'paused'}
                                    onClick={() => lifecycle('pause')}
                                    className="inline-flex items-center px-3 py-1.5 rounded border hover:bg-gray-50 text-sm disabled:opacity-60"
                                    title="Pause"
                                >
                                    <PauseIcon className="h-4 w-4 mr-1" /> Pause
                                </button>
                                <button
                                    type="button"
                                    disabled={working || status === 'disabled'}
                                    onClick={() => lifecycle('disable')}
                                    className="inline-flex items-center px-3 py-1.5 rounded border hover:bg-gray-50 text-sm disabled:opacity-60"
                                    title="Disable"
                                >
                                    <PowerIcon className="h-4 w-4 mr-1" /> Disable
                                </button>
                                <button
                                    type="button"
                                    disabled={working}
                                    onClick={handleDelete}
                                    className="inline-flex items-center px-3 py-1.5 rounded border text-red-600 hover:bg-red-50 text-sm disabled:opacity-60"
                                    title="Delete"
                                >
                                    <TrashIcon className="h-4 w-4 mr-1" /> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PREVIEW (BOTTOM) */}
            <div className="border rounded overflow-hidden bg-white">
                <div className="px-3 py-2 border-b bg-gray-50 text-sm text-gray-700 flex items-center justify-between">
          <span className="inline-flex items-center">
            <EyeIcon className="h-4 w-4 mr-1" />
            Flow Preview (read-only)
          </span>
                    <span className="text-xs text-gray-500">
            Trigger: <span className="font-medium">{trigger || '—'}</span> · Status:{' '}
                        <span className="font-medium">{status || '—'}</span>
          </span>
                </div>
                <iframe
                    title="preview"
                    className="w-full h-[560px] bg-white"
                    sandbox="allow-same-origin"
                    srcDoc={`<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji;margin:16px;color:#111827;}</style>
</head><body><pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.5;margin:0">${escapeHtml(
                        JSON.stringify(flowErr ? { error: 'Invalid JSON' } : flowObj, null, 2)
                    )}</pre></body></html>`}
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
                    ← Back to automations
                </Link>
            </div>
        </div>
    );
}
