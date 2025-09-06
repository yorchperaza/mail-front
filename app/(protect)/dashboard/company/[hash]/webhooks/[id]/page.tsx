'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

type WebhookRow = {
    id: number;
    url: string | null;
    events: string[] | null;
    status: 'active' | 'disabled' | (string & {}) | null;
    batch_size?: number | null;
    max_retries?: number | null;
    retry_backoff?: string | null;
};

type EventKey =
    | 'message.delivered'
    | 'message.bounced'
    | 'message.opened'
    | 'message.clicked'
    | 'tlsrpt.received'
    | 'dmarc.processed'
    | 'reputation.sampled';

const EVENT_OPTIONS: Array<{ key: EventKey; label: string; group: 'Messaging' | 'Compliance' }> = [
    { key: 'message.delivered', label: 'Message delivered', group: 'Messaging' },
    { key: 'message.bounced',   label: 'Message bounced',   group: 'Messaging' },
    { key: 'message.opened',    label: 'Message opened',    group: 'Messaging' },
    { key: 'message.clicked',   label: 'Message clicked',   group: 'Messaging' },
    { key: 'tlsrpt.received',   label: 'TLS-RPT received',  group: 'Compliance' },
    { key: 'dmarc.processed',   label: 'DMARC processed',   group: 'Compliance' },
    { key: 'reputation.sampled',label: 'Reputation sampled',group: 'Compliance' },
];

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || '';

function authHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ----------------------- Backoff helpers ----------------------- */
type BackoffMode = 'exponential' | 'fixed' | 'linear' | 'custom';

function parseBackoffString(raw: string): {
    mode: BackoffMode;
    factor?: number; minSec?: number; maxSec?: number;
    fixedSec?: number;
    linearBase?: number; linearStep?: number; linearMax?: number;
    custom?: string;
} {
    const s = (raw || '').trim();
    if (s.startsWith('exponential:')) {
        const parts = s.replace('exponential:', '').split(',').map(x => parseInt(x, 10));
        const [factor = 2, minSec = 60, maxSec = 3600] = parts;
        return { mode: 'exponential', factor, minSec, maxSec };
    }
    if (s.startsWith('fixed:')) {
        const v = parseInt(s.replace('fixed:', ''), 10);
        return { mode: 'fixed', fixedSec: Number.isFinite(v) ? v : 60 };
    }
    if (s.startsWith('linear:')) {
        const parts = s.replace('linear:', '').split(',').map(x => parseInt(x, 10));
        const [base = 60, step = 60, max = 3600] = parts;
        return { mode: 'linear', linearBase: base, linearStep: step, linearMax: max };
    }
    // anything else → custom
    return { mode: 'custom', custom: s || 'exponential:2,60,3600' };
}

function buildBackoffString(cfg: {
    mode: BackoffMode;
    factor?: number; minSec?: number; maxSec?: number;
    fixedSec?: number;
    linearBase?: number; linearStep?: number; linearMax?: number;
    custom?: string;
}): string {
    switch (cfg.mode) {
        case 'exponential':
            return `exponential:${Math.max(1, cfg.factor ?? 2)},${Math.max(0, cfg.minSec ?? 60)},${Math.max(0, cfg.maxSec ?? 3600)}`;
        case 'fixed':
            return `fixed:${Math.max(0, cfg.fixedSec ?? 60)}`;
        case 'linear':
            return `linear:${Math.max(0, cfg.linearBase ?? 60)},${Math.max(0, cfg.linearStep ?? 60)},${Math.max(0, cfg.linearMax ?? 3600)}`;
        case 'custom':
        default:
            return (cfg.custom || '').trim() || 'exponential:2,60,3600';
    }
}

export default function EditWebhookPage() {
    const { hash, id } = useParams<{ hash: string; id: string }>();
    const router = useRouter();

    const [loading, setLoading]   = useState(true);
    const [err, setErr]           = useState<string | null>(null);

    const [url, setUrl]           = useState('');
    const [selected, setSelected] = useState<Set<EventKey>>(new Set());
    const [status, setStatus]     = useState<'active' | 'disabled'>('active');
    const [batch, setBatch]       = useState(1);
    const [retries, setRetries]   = useState(5);

    // backoff string (authoritative source we send to API)
    const [backoffRaw, setBackoffRaw] = useState('exponential:2,60,3600');

    // pretty UI state for backoff
    const [backoffMode, setBackoffMode] = useState<BackoffMode>('exponential');
    const [factor, setFactor]           = useState(2);
    const [minSec, setMinSec]           = useState(60);
    const [maxSec, setMaxSec]           = useState(3600);
    const [fixedSec, setFixedSec]       = useState(60);
    const [linearBase, setLinearBase]   = useState(60);
    const [linearStep, setLinearStep]   = useState(60);
    const [linearMax, setLinearMax]     = useState(3600);
    const [customText, setCustomText]   = useState('exponential:2,60,3600');

    const [busy, setBusy]         = useState(false);

    const messagingEvents = useMemo(
        () => EVENT_OPTIONS.filter(e => e.group === 'Messaging'),
        []
    );
    const complianceEvents = useMemo(
        () => EVENT_OPTIONS.filter(e => e.group === 'Compliance'),
        []
    );

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${backend}/companies/${hash}/webhooks`, { headers: authHeaders() });
            if (!res.ok) throw new Error(`Load failed (${res.status})`);
            const list: WebhookRow[] = await res.json();
            const found = list.find(w => w.id === Number(id));
            if (!found) throw new Error('Webhook not found');

            setUrl(found.url ?? '');
            setStatus((found.status as 'active' | 'disabled') ?? 'disabled');
            setBatch(found.batch_size ?? 1);
            setRetries(found.max_retries ?? 5);

            const initial = found.retry_backoff ?? 'exponential:2,60,3600';
            setBackoffRaw(initial);
            const parsed = parseBackoffString(initial);
            setBackoffMode(parsed.mode);
            setFactor(parsed.factor ?? 2);
            setMinSec(parsed.minSec ?? 60);
            setMaxSec(parsed.maxSec ?? 3600);
            setFixedSec(parsed.fixedSec ?? 60);
            setLinearBase(parsed.linearBase ?? 60);
            setLinearStep(parsed.linearStep ?? 60);
            setLinearMax(parsed.linearMax ?? 3600);
            setCustomText(parsed.custom ?? 'exponential:2,60,3600');

            const ev = (found.events ?? []) as string[];
            const valid = new Set<EventKey>();
            ev.forEach(e => { if (EVENT_OPTIONS.some(opt => opt.key === e)) valid.add(e as EventKey); });
            setSelected(valid);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [hash, id]);  // deps for load


    function toggleEvent(key: EventKey) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next as Set<EventKey>;
        });
    }

    function applyPreset(preset: 'all' | 'messaging' | 'compliance' | 'none') {
        const next = new Set<EventKey>();
        if (preset === 'all') {
            EVENT_OPTIONS.forEach(e => next.add(e.key));
        } else if (preset === 'messaging') {
            messagingEvents.forEach(e => next.add(e.key));
        } else if (preset === 'compliance') {
            complianceEvents.forEach(e => next.add(e.key));
        }
        setSelected(next);
    }

    const selectedArray = useMemo(() => Array.from(selected), [selected]);

    // keep backoffRaw in sync whenever UI pieces change
    useEffect(() => {
        const built = buildBackoffString({
            mode: backoffMode,
            factor, minSec, maxSec,
            fixedSec,
            linearBase, linearStep, linearMax,
            custom: customText,
        });
        setBackoffRaw(built);
    }, [backoffMode, factor, minSec, maxSec, fixedSec, linearBase, linearStep, linearMax, customText]);

    useEffect(() => {
        void load();
    }, [load]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
            try { new URL(url); } catch { throw new Error('Please provide a valid destination URL (https://…)'); }
            if (selectedArray.length === 0) throw new Error('Select at least one event.');

            const payload = {
                url,
                events: selectedArray,
                status,
                batch_size: batch,
                max_retries: retries,
                retry_backoff: backoffRaw, // built from the advanced UI
            };

            const res = await fetch(`${backend}/companies/${hash}/webhooks/${id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                let msg = `Update failed (${res.status})`;
                try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
                throw new Error(msg);
            }
            router.push(`/dashboard/company/${hash}/webhooks`);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <p className="text-gray-500">Loading webhook…</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800">← Back</button>
                <h1 className="text-xl sm:text-2xl font-semibold">Edit Webhook</h1>
                <div />
            </div>

            {/* Alerts */}
            {err && <div className="rounded border border-red-200 bg-red-50 text-red-700 p-3 text-sm">{err}</div>}

            {/* Form */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column */}
                <section className="lg:col-span-2 space-y-6">
                    {/* URL */}
                    <div className="bg-white border rounded-xl p-4">
                        <label className="block text-sm font-medium mb-1">Destination URL</label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full border rounded px-2 py-2"
                            placeholder="https://example.com/webhooks/inbound"
                            required
                        />
                        <p className="mt-2 text-xs text-gray-500">Must be reachable over HTTPS.</p>
                    </div>

                    {/* Events */}
                    <div className="bg-white border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">Events</div>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => applyPreset('all')} className="text-xs px-2 py-1 rounded border hover:bg-gray-50">All</button>
                                <button type="button" onClick={() => applyPreset('messaging')} className="text-xs px-2 py-1 rounded border hover:bg-gray-50">Messaging</button>
                                <button type="button" onClick={() => applyPreset('compliance')} className="text-xs px-2 py-1 rounded border hover:bg-gray-50">Compliance</button>
                                <button type="button" onClick={() => applyPreset('none')} className="text-xs px-2 py-1 rounded border hover:bg-gray-50">None</button>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs font-medium text-gray-500 mb-1">Messaging</div>
                                <div className="flex flex-wrap gap-2">
                                    {messagingEvents.map(e => {
                                        const on = selected.has(e.key);
                                        return (
                                            <button
                                                key={e.key}
                                                type="button"
                                                onClick={() => toggleEvent(e.key)}
                                                className={[
                                                    'text-xs px-2 py-1 rounded-full border',
                                                    on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
                                                ].join(' ')}
                                                aria-pressed={on}
                                            >
                                                {e.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-medium text-gray-500 mb-1">Compliance</div>
                                <div className="flex flex-wrap gap-2">
                                    {complianceEvents.map(e => {
                                        const on = selected.has(e.key);
                                        return (
                                            <button
                                                key={e.key}
                                                type="button"
                                                onClick={() => toggleEvent(e.key)}
                                                className={[
                                                    'text-xs px-2 py-1 rounded-full border',
                                                    on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
                                                ].join(' ')}
                                                aria-pressed={on}
                                            >
                                                {e.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <p className="mt-3 text-xs text-gray-500">We’ll only send deliveries for the events you select.</p>
                    </div>
                </section>

                {/* Right column */}
                <aside className="space-y-6">
                    <div className="bg-white border rounded-xl p-4">
                        <div className="text-sm font-medium mb-2">Delivery Options</div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="block text-sm mb-1">Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as 'active' | 'disabled')}
                                    className="w-full border rounded px-2 py-2"
                                >
                                    <option value="active">active</option>
                                    <option value="disabled">disabled</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm mb-1">Batch size</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={batch}
                                    onChange={(e) => setBatch(Number.isNaN(Number(e.target.value)) ? 1 : parseInt(e.target.value, 10))}
                                    className="w-full border rounded px-2 py-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-1">Max retries</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={retries}
                                    onChange={(e) => setRetries(Number.isNaN(Number(e.target.value)) ? 0 : parseInt(e.target.value, 10))}
                                    className="w-full border rounded px-2 py-2"
                                />
                            </div>

                            {/* Retry backoff — improved UI */}
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-2">Retry backoff</label>

                                {/* Mode pills */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {[
                                        { id: 'exponential', label: 'Exponential' },
                                        { id: 'fixed',       label: 'Fixed' },
                                        { id: 'linear',      label: 'Linear' },
                                        { id: 'custom',      label: 'Custom' },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setBackoffMode(opt.id as BackoffMode)}
                                            className={[
                                                'text-xs px-3 py-1.5 rounded-full border',
                                                backoffMode === opt.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
                                            ].join(' ')}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Config panels */}
                                {backoffMode === 'exponential' && (
                                    <div className="grid grid-cols-3 gap-3 bg-gray-50 border rounded-lg p-3">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Factor</label>
                                            <input type="number" min={1} value={factor}
                                                   onChange={e => setFactor(parseInt(e.target.value || '2', 10))}
                                                   className="w-full border rounded px-2 py-1.5" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Min (sec)</label>
                                            <input type="number" min={0} value={minSec}
                                                   onChange={e => setMinSec(parseInt(e.target.value || '0', 10))}
                                                   className="w-full border rounded px-2 py-1.5" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Max (sec)</label>
                                            <input type="number" min={0} value={maxSec}
                                                   onChange={e => setMaxSec(parseInt(e.target.value || '0', 10))}
                                                   className="w-full border rounded px-2 py-1.5" />
                                        </div>
                                        <p className="col-span-3 text-[11px] text-gray-500">
                                            Retries grow by <span className="font-mono">factor</span> each time, clamped between <span className="font-mono">min</span> and <span className="font-mono">max</span>.
                                            Example: <span className="font-mono">{`exponential:${factor},${minSec},${maxSec}`}</span>
                                        </p>
                                    </div>
                                )}

                                {backoffMode === 'fixed' && (
                                    <div className="grid grid-cols-3 gap-3 bg-gray-50 border rounded-lg p-3">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Interval (sec)</label>
                                            <input type="number" min={0} value={fixedSec}
                                                   onChange={e => setFixedSec(parseInt(e.target.value || '0', 10))}
                                                   className="w-full border rounded px-2 py-1.5" />
                                        </div>
                                        <p className="col-span-3 text-[11px] text-gray-500">
                                            Constant delay between retries. Example: <span className="font-mono">{`fixed:${fixedSec}`}</span>
                                        </p>
                                    </div>
                                )}

                                {backoffMode === 'linear' && (
                                    <div className="grid grid-cols-3 gap-3 bg-gray-50 border rounded-lg p-3">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Base (sec)</label>
                                            <input type="number" min={0} value={linearBase}
                                                   onChange={e => setLinearBase(parseInt(e.target.value || '0', 10))}
                                                   className="w-full border rounded px-2 py-1.5" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Step (sec)</label>
                                            <input type="number" min={0} value={linearStep}
                                                   onChange={e => setLinearStep(parseInt(e.target.value || '0', 10))}
                                                   className="w-full border rounded px-2 py-1.5" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Max (sec)</label>
                                            <input type="number" min={0} value={linearMax}
                                                   onChange={e => setLinearMax(parseInt(e.target.value || '0', 10))}
                                                   className="w-full border rounded px-2 py-1.5" />
                                        </div>
                                        <p className="col-span-3 text-[11px] text-gray-500">
                                            Delay grows by <span className="font-mono">step</span> each time, starting from <span className="font-mono">base</span>, capped at <span className="font-mono">max</span>.
                                            Example: <span className="font-mono">{`linear:${linearBase},${linearStep},${linearMax}`}</span>
                                        </p>
                                    </div>
                                )}

                                {backoffMode === 'custom' && (
                                    <div className="bg-gray-50 border rounded-lg p-3">
                                        <label className="block text-xs text-gray-600 mb-1">Custom string</label>
                                        <input
                                            type="text"
                                            value={customText}
                                            onChange={(e) => setCustomText(e.target.value)}
                                            className="w-full border rounded px-2 py-1.5 font-mono text-xs"
                                            placeholder="exponential:2,60,3600"
                                        />
                                        <p className="mt-2 text-[11px] text-gray-500">
                                            Accepts <span className="font-mono">exponential:&lt;factor&gt;,&lt;min&gt;,&lt;max&gt;</span>,
                                            <span className="font-mono"> fixed:&lt;sec&gt;</span> or
                                            <span className="font-mono"> linear:&lt;base&gt;,&lt;step&gt;,&lt;max&gt;</span>.
                                        </p>
                                    </div>
                                )}

                                {/* Live preview of what will be sent */}
                                <div className="mt-3">
                                    <label className="block text-xs text-gray-500 mb-1">Preview (sent to API)</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={backoffRaw}
                                        className="w-full border rounded px-2 py-1.5 font-mono text-xs bg-gray-50"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border rounded-xl p-4">
                        <div className="text-sm font-medium mb-2">Security</div>
                        <p className="text-xs text-gray-600">
                            Deliveries include <span className="font-mono">X-Webhook-Signature</span> (HMAC-SHA256 of the raw body using your secret).
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => router.push(`/dashboard/company/${hash}/webhooks`)}
                            className="px-3 py-2 rounded border text-sm hover:bg-gray-50 w-full"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 w-full"
                        >
                            {busy ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </aside>
            </form>
        </div>
    );
}
