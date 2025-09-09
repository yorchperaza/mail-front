'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import copy from 'copy-to-clipboard';
import {
    ArrowLeftIcon,
    GlobeAltIcon,
    BoltIcon,
    Cog6ToothIcon,
    ClipboardDocumentIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
    ClipboardDocumentIcon as ClipboardSolid,
    BoltIcon as BoltSolid,
    ShieldCheckIcon as ShieldCheckSolid,
} from '@heroicons/react/24/solid';

const backend = process.env.NEXT_PUBLIC_BACKEND_URL || '';

function authHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ===== Events ===== */

type EventKey =
    | 'message.delivered'
    | 'message.bounced'
    | 'message.opened'
    | 'message.clicked'
    | 'tlsrpt.received'
    | 'dmarc.processed'
    | 'reputation.sampled';

const EVENT_OPTIONS: Array<{ key: EventKey; label: string; group: 'Messaging' | 'Compliance'; description: string }> = [
    { key: 'message.delivered', label: 'Message delivered', group: 'Messaging', description: 'When a message is successfully delivered' },
    { key: 'message.bounced',   label: 'Message bounced',   group: 'Messaging', description: 'When a message bounces back' },
    { key: 'message.opened',    label: 'Message opened',    group: 'Messaging', description: 'When a recipient opens a message' },
    { key: 'message.clicked',   label: 'Message clicked',   group: 'Messaging', description: 'When a recipient clicks a link' },
    { key: 'tlsrpt.received',   label: 'TLS-RPT received',  group: 'Compliance', description: 'TLS reporting data received' },
    { key: 'dmarc.processed',   label: 'DMARC processed',   group: 'Compliance', description: 'DMARC authentication results' },
    { key: 'reputation.sampled',label: 'Reputation sampled',group: 'Compliance', description: 'Domain reputation monitoring' },
];

/* ===== Backoff helpers ===== */

type BackoffMode = 'exponential' | 'fixed' | 'linear' | 'custom';

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

export default function NewWebhookPage() {
    const { hash } = useParams<{ hash: string }>();
    const router = useRouter();

    // Basics
    const [url, setUrl] = useState('');
    const [selected, setSelected] = useState<Set<EventKey>>(
        () => new Set<EventKey>([
            'message.delivered',
            'message.bounced',
            'tlsrpt.received',
            'dmarc.processed',
            'reputation.sampled',
        ])
    );
    const [status, setStatus]   = useState<'active' | 'disabled'>('active');
    const [batch, setBatch]     = useState(1);
    const [retries, setRetries] = useState(5);

    // Backoff UI
    const [backoffMode, setBackoffMode] = useState<BackoffMode>('exponential');
    const [factor, setFactor]       = useState(2);
    const [minSec, setMinSec]       = useState(60);
    const [maxSec, setMaxSec]       = useState(3600);
    const [fixedSec, setFixedSec]   = useState(60);
    const [linearBase, setLinearBase] = useState(60);
    const [linearStep, setLinearStep] = useState(60);
    const [linearMax, setLinearMax]   = useState(3600);
    const [customText, setCustomText] = useState('exponential:2,60,3600');

    const [backoffRaw, setBackoffRaw] = useState('exponential:2,60,3600');

    useEffect(() => {
        setBackoffRaw(buildBackoffString({
            mode: backoffMode,
            factor, minSec, maxSec,
            fixedSec,
            linearBase, linearStep, linearMax,
            custom: customText,
        }));
    }, [backoffMode, factor, minSec, maxSec, fixedSec, linearBase, linearStep, linearMax, customText]);

    // UX
    const [busy, setBusy]   = useState(false);
    const [err, setErr]     = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);

    // copy feedback
    const [copiedSecret, setCopiedSecret] = useState(false);
    const [copiedBackoff, setCopiedBackoff] = useState(false);

    const messagingEvents = useMemo(
        () => EVENT_OPTIONS.filter(e => e.group === 'Messaging'),
        []
    );
    const complianceEvents = useMemo(
        () => EVENT_OPTIONS.filter(e => e.group === 'Compliance'),
        []
    );

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

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        setSecret(null);

        try {
            try { new URL(url); } catch { throw new Error('Please provide a valid destination URL (https://…)'); }
            if (selectedArray.length === 0) throw new Error('Select at least one event.');

            const payload = {
                url,
                events: selectedArray,
                status,
                batch_size: batch,
                max_retries: retries,
                retry_backoff: backoffRaw,
            };

            const res = await fetch(`${backend}/companies/${hash}/webhooks`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                let msg = `Create failed (${res.status})`;
                try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
                throw new Error(msg);
            }

            const j: { id?: number; secret?: string | null } = await res.json();
            setSecret(j?.secret ?? null);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    function onCopySecret() {
        if (!secret) return;
        copy(secret);
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 1600);
    }

    function onCopyBackoff() {
        copy(backoffRaw);
        setCopiedBackoff(true);
        setTimeout(() => setCopiedBackoff(false), 1200);
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-6xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Create New Webhook</h1>
                            <p className="text-sm text-gray-500">
                                Configure real-time event notifications
                            </p>
                        </div>
                    </div>
                </div>

                {/* Alerts */}
                {err && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                            <p className="text-red-800 font-medium">{err}</p>
                        </div>
                    </div>
                )}

                {secret && (
                    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-white">
                                    <CheckCircleSolid className="h-6 w-6" />
                                    <div>
                                        <h2 className="text-lg font-semibold">Webhook Created Successfully</h2>
                                        <p className="text-sm text-green-100">Your webhook is now configured and ready to receive events</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push(`/dashboard/company/${hash}/webhooks`)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-green-600 font-medium hover:bg-green-50 transition-colors"
                                >
                                    View All Webhooks
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Webhook Secret</label>
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                                    <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                                    Store this secret securely. It won&#39;t be shown again and is needed to verify webhook deliveries.
                                </p>
                                <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200">
                                    <code className="flex-1 font-mono text-sm break-all text-gray-900 bg-white px-3 py-2 rounded-lg border">
                                        {secret}
                                    </code>
                                    <button
                                        onClick={onCopySecret}
                                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                                            copiedSecret
                                                ? 'bg-green-100 text-green-700 border border-green-200'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                                        }`}
                                    >
                                        {copiedSecret ? (
                                            <>
                                                <CheckCircleSolid className="h-4 w-4" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <ClipboardSolid className="h-4 w-4" />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left column */}
                    <section className="lg:col-span-2 space-y-6">
                        {/* Destination URL */}
                        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                                <div className="flex items-center gap-3 text-white">
                                    <GlobeAltIcon className="h-5 w-5" />
                                    <h2 className="text-lg font-semibold">Destination Configuration</h2>
                                </div>
                            </div>
                            <div className="p-6">
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Webhook URL <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    disabled={!!secret}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                    placeholder="https://your-app.com/webhooks/handler"
                                    required
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                    Must be a valid HTTPS URL that can receive POST requests with webhook payloads.
                                </p>
                            </div>
                        </div>

                        {/* Events */}
                        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-white">
                                        <BoltSolid className="h-5 w-5" />
                                        <h2 className="text-lg font-semibold">Event Selection</h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('all')}
                                            disabled={!!secret}
                                            className="px-3 py-1.5 rounded-lg border border-white/20 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            All
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('messaging')}
                                            disabled={!!secret}
                                            className="px-3 py-1.5 rounded-lg border border-white/20 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Messaging
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('compliance')}
                                            disabled={!!secret}
                                            className="px-3 py-1.5 rounded-lg border border-white/20 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Compliance
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('none')}
                                            disabled={!!secret}
                                            className="px-3 py-1.5 rounded-lg border border-white/20 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            None
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Messaging Events */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Messaging Events</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {EVENT_OPTIONS.filter(e => e.group === 'Messaging').map(e => {
                                            const isSelected = selected.has(e.key);
                                            return (
                                                <label
                                                    key={e.key}
                                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'border-indigo-200 bg-indigo-50 ring-1 ring-indigo-200'
                                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                    } ${!!secret ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleEvent(e.key)}
                                                        disabled={!!secret}
                                                        className="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                    />
                                                    <div className="flex-1">
                                                        <span className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                                                            {e.label}
                                                        </span>
                                                        <p className={`text-xs mt-0.5 ${isSelected ? 'text-indigo-700' : 'text-gray-500'}`}>
                                                            {e.description}
                                                        </p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Compliance Events */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Compliance Events</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {EVENT_OPTIONS.filter(e => e.group === 'Compliance').map(e => {
                                            const isSelected = selected.has(e.key);
                                            return (
                                                <label
                                                    key={e.key}
                                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'border-indigo-200 bg-indigo-50 ring-1 ring-indigo-200'
                                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                    } ${!!secret ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleEvent(e.key)}
                                                        disabled={!!secret}
                                                        className="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                    />
                                                    <div className="flex-1">
                                                        <span className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                                                            {e.label}
                                                        </span>
                                                        <p className={`text-xs mt-0.5 ${isSelected ? 'text-indigo-700' : 'text-gray-500'}`}>
                                                            {e.description}
                                                        </p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs text-blue-800">
                                        <BoltIcon className="h-3 w-3 inline mr-1" />
                                        Webhook deliveries will only be sent for the events you select above.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Right column */}
                    <aside className="space-y-6">
                        {/* Delivery Options */}
                        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                                <div className="flex items-center gap-3 text-white">
                                    <Cog6ToothIcon className="h-5 w-5" />
                                    <h2 className="text-lg font-semibold">Delivery Options</h2>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as 'active' | 'disabled')}
                                        disabled={!!secret}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <option value="active">Active</option>
                                        <option value="disabled">Disabled</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Batch size</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={batch}
                                            onChange={(e) => setBatch(Number.isNaN(Number(e.target.value)) ? 1 : parseInt(e.target.value, 10))}
                                            disabled={!!secret}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Max retries</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={retries}
                                            onChange={(e) => setRetries(Number.isNaN(Number(e.target.value)) ? 0 : parseInt(e.target.value, 10))}
                                            disabled={!!secret}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Retry backoff with copy */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Retry backoff strategy</label>

                                    {/* Mode pills */}
                                    <div className="flex flex-wrap gap-2 mb-4">
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
                                                disabled={!!secret}
                                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                                    backoffMode === opt.id
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                } ${!!secret ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Config panels */}
                                    {backoffMode === 'exponential' && (
                                        <div className="grid grid-cols-3 gap-3 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-4 mb-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Factor</label>
                                                <input type="number" min={1} value={factor}
                                                       onChange={e => setFactor(parseInt(e.target.value || '2', 10))}
                                                       disabled={!!secret}
                                                       className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Min (sec)</label>
                                                <input type="number" min={0} value={minSec}
                                                       onChange={e => setMinSec(parseInt(e.target.value || '0', 10))}
                                                       disabled={!!secret}
                                                       className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Max (sec)</label>
                                                <input type="number" min={0} value={maxSec}
                                                       onChange={e => setMaxSec(parseInt(e.target.value || '0', 10))}
                                                       disabled={!!secret}
                                                       className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed" />
                                            </div>
                                            <p className="col-span-3 text-[10px] text-gray-500">
                                                Pattern: <span className="font-mono">{`exponential:${factor},${minSec},${maxSec}`}</span>
                                            </p>
                                        </div>
                                    )}

                                    {backoffMode === 'fixed' && (
                                        <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-4 mb-4">
                                            <div className="mb-3">
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Interval (seconds)</label>
                                                <input type="number" min={0} value={fixedSec}
                                                       onChange={e => setFixedSec(parseInt(e.target.value || '0', 10))}
                                                       disabled={!!secret}
                                                       className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed" />
                                            </div>
                                            <p className="text-[10px] text-gray-500">
                                                Pattern: <span className="font-mono">{`fixed:${fixedSec}`}</span>
                                            </p>
                                        </div>
                                    )}

                                    {backoffMode === 'linear' && (
                                        <div className="grid grid-cols-3 gap-3 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-4 mb-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Base (sec)</label>
                                                <input type="number" min={0} value={linearBase}
                                                       onChange={e => setLinearBase(parseInt(e.target.value || '0', 10))}
                                                       disabled={!!secret}
                                                       className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Step (sec)</label>
                                                <input type="number" min={0} value={linearStep}
                                                       onChange={e => setLinearStep(parseInt(e.target.value || '0', 10))}
                                                       disabled={!!secret}
                                                       className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Max (sec)</label>
                                                <input type="number" min={0} value={linearMax}
                                                       onChange={e => setLinearMax(parseInt(e.target.value || '0', 10))}
                                                       disabled={!!secret}
                                                       className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed" />
                                            </div>
                                            <p className="col-span-3 text-[10px] text-gray-500">
                                                Pattern: <span className="font-mono">{`linear:${linearBase},${linearStep},${linearMax}`}</span>
                                            </p>
                                        </div>
                                    )}

                                    {backoffMode === 'custom' && (
                                        <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-4 mb-4">
                                            <label className="block text-xs font-medium text-gray-600 mb-2">Custom backoff string</label>
                                            <input
                                                type="text"
                                                value={customText}
                                                onChange={(e) => setCustomText(e.target.value)}
                                                disabled={!!secret}
                                                className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-xs disabled:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                                                placeholder="exponential:2,60,3600"
                                            />
                                            <p className="mt-2 text-[10px] text-gray-500">
                                                Supports <span className="font-mono">exponential:&lt;factor&gt;,&lt;min&gt;,&lt;max&gt;</span>,
                                                <span className="font-mono"> fixed:&lt;sec&gt;</span>, or
                                                <span className="font-mono"> linear:&lt;base&gt;,&lt;step&gt;,&lt;max&gt;</span>
                                            </p>
                                        </div>
                                    )}

                                    {/* Live preview with copy */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-2">Generated configuration</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={backoffRaw}
                                                className="flex-1 border border-gray-300 rounded px-3 py-2 font-mono text-xs bg-gray-50"
                                            />
                                            <button
                                                type="button"
                                                onClick={onCopyBackoff}
                                                className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                                    copiedBackoff
                                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                                                }`}
                                            >
                                                {copiedBackoff ? (
                                                    <>
                                                        <CheckCircleIcon className="h-3 w-3" />
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <ClipboardDocumentIcon className="h-3 w-3" />
                                                        Copy
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Security Info */}
                        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
                                <div className="flex items-center gap-3 text-white">
                                    <ShieldCheckSolid className="h-5 w-5" />
                                    <h2 className="text-lg font-semibold">Security</h2>
                                </div>
                            </div>
                            <div className="p-6">
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    We generate a unique secret key for webhook signature verification. Each delivery includes an
                                    <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded mx-1">X-Webhook-Signature</span>
                                    header containing an HMAC-SHA256 hash of the request body using your secret.
                                </p>
                            </div>
                        </div>

                        {/* Action buttons - Hide after creation */}
                        {!secret && (
                            <div className="flex flex-col gap-3">
                                <button
                                    type="submit"
                                    disabled={busy}
                                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
                                >
                                    {busy ? (
                                        <>
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            Creating…
                                        </>
                                    ) : (
                                        <>
                                            <PlusIcon className="h-4 w-4" />
                                            Create Webhook
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.push(`/dashboard/company/${hash}/webhooks`)}
                                    className="w-full px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </aside>
                </form>
            </div>
        </div>
    );
}