'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, CheckIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type PlanFeatures = {
    quotas: {
        emailsPerDay?: number | null;
        emailsPerMonth?: number | null;
        logRetentionDays?: number;
        apiKeys?: number;
        inboundRoutes?: number;
        sendingDomains: { included?: number | null; max?: number | null };
        emailValidationsIncluded?: number;
    };
    pricing: { overagePer1K?: number | null };
    capabilities: {
        api: boolean;
        smtp: boolean;
        analytics: 'basic' | 'standard' | 'advanced';
        webhooks: boolean;
        templateBuilder: boolean;
        dedicatedIpPools: boolean;
        sendTimeOptimization: boolean;
    };
    support: { tier: 'ticket' | 'email' | 'chat_phone' | 'sla'; notes?: string };
};

type Plan = {
    id: number;
    name: string | null;
    monthlyPrice: number | null;
    includedMessages: number | null;
    averagePricePer1K: number | null;
    features: PlanFeatures | null;
    /** From backend shape() */
    stripePriceId?: string | null;
};

type PatchBody = Partial<{
    name: string;
    monthlyPrice: number | null;
    includedMessages: number | null;
    averagePricePer1K: number | null;
    features: PlanFeatures | null;
}>;

/* ----------------------------- Helpers ---------------------------- */

function intOrNull(s: string): number | null {
    const t = s.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}
function decOrNull(s: string): number | null {
    const t = s.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
}
function str(v: number | null | undefined) {
    return v === null || v === undefined ? '' : String(v);
}
// remove null/undefined/'' recursively; keep 0/false
function compactDeep<T>(obj: T): T {
    if (Array.isArray(obj)) {
        return obj
            .map((v) => compactDeep(v))
            .filter((v): v is NonNullable<typeof v> => v !== null && v !== undefined) as unknown as T;
    }
    if (obj && typeof obj === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            const cleaned = compactDeep(v);
            if (cleaned !== null && cleaned !== undefined && cleaned !== '') {
                out[k] = cleaned;
            }
        }
        return out as T;
    }
    return obj;
}

/* ------------------------------ Page ------------------------------ */

export default function PlanEditPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const backHref = '/admin/plans';

    /* -------------------------- Load plan -------------------------- */

    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState<string | null>(null);

    // Basics
    const [name, setName] = useState('');
    const [monthlyPrice, setMonthlyPrice] = useState('');
    const [includedMessages, setIncludedMessages] = useState('');
    const [averagePricePer1K, setAveragePricePer1K] = useState('');

    // Track originals to describe Stripe action
    const [initialMonthlyPrice, setInitialMonthlyPrice] = useState<number | null>(null);
    const [stripePriceId, setStripePriceId] = useState<string | null | undefined>(null);

    // Features – Quotas
    const [emailsPerDay, setEmailsPerDay] = useState('');
    const [emailsPerMonth, setEmailsPerMonth] = useState('');
    const [logRetentionDays, setLogRetentionDays] = useState('1');
    const [apiKeys, setApiKeys] = useState('2');
    const [inboundRoutes, setInboundRoutes] = useState('1');
    const [sendingIncluded, setSendingIncluded] = useState('1');
    const [sendingMax, setSendingMax] = useState('');
    const [emailValidations, setEmailValidations] = useState('0');

    // Features – Pricing
    const [overagePer1K, setOveragePer1K] = useState('');

    // Features – Capabilities
    const [capAPI, setCapAPI] = useState(true);
    const [capSMTP, setCapSMTP] = useState(true);
    const [analytics, setAnalytics] = useState<'basic' | 'standard' | 'advanced'>('basic');
    const [webhooks, setWebhooks] = useState(false);
    const [templates, setTemplates] = useState(false);
    const [dedicatedIp, setDedicatedIp] = useState(false);
    const [sto, setSto] = useState(false); // send-time optimization

    // Features – Support
    const [supportTier, setSupportTier] = useState<'ticket' | 'email' | 'chat_phone' | 'sla'>('ticket');
    const [supportNotes, setSupportNotes] = useState('');

    // UI
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!backend || !id) return;
        (async () => {
            setLoading(true);
            setLoadErr(null);
            try {
                // GET matches your controller's GET route
                const res = await fetch(`${backend}/plans-id/${id}`, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load plan (${res.status})`);
                const p: Plan = await res.json();

                // Basics
                setName(p.name ?? '');
                setMonthlyPrice(str(p.monthlyPrice));
                setIncludedMessages(str(p.includedMessages));
                setAveragePricePer1K(str(p.averagePricePer1K));

                setInitialMonthlyPrice(p.monthlyPrice ?? null);
                setStripePriceId(p.stripePriceId ?? null);

                // Features with safe fallbacks
                const f = p.features ?? {
                    quotas: { sendingDomains: {} },
                    pricing: {},
                    capabilities: {
                        api: true, smtp: true, analytics: 'basic', webhooks: false,
                        templateBuilder: false, dedicatedIpPools: false, sendTimeOptimization: false,
                    },
                    support: { tier: 'ticket' },
                };

                setEmailsPerDay(str(f.quotas?.emailsPerDay));
                setEmailsPerMonth(str(f.quotas?.emailsPerMonth));
                setLogRetentionDays(str(f.quotas?.logRetentionDays));
                setApiKeys(str(f.quotas?.apiKeys));
                setInboundRoutes(str(f.quotas?.inboundRoutes));
                setSendingIncluded(str(f.quotas?.sendingDomains?.included));
                setSendingMax(str(f.quotas?.sendingDomains?.max));
                setEmailValidations(str(f.quotas?.emailValidationsIncluded));
                setOveragePer1K(str(f.pricing?.overagePer1K));

                setCapAPI(!!f.capabilities?.api);
                setCapSMTP(!!f.capabilities?.smtp);
                setAnalytics(
                    ['basic', 'standard', 'advanced'].includes(f.capabilities?.analytics as string)
                        ? (f.capabilities?.analytics as 'basic' | 'standard' | 'advanced')
                        : 'basic'
                );
                setWebhooks(!!f.capabilities?.webhooks);
                setTemplates(!!f.capabilities?.templateBuilder);
                setDedicatedIp(!!f.capabilities?.dedicatedIpPools);
                setSto(!!f.capabilities?.sendTimeOptimization);

                setSupportTier(
                    ['ticket', 'email', 'chat_phone', 'sla'].includes(f.support?.tier as string)
                        ? (f.support?.tier as 'ticket' | 'email' | 'chat_phone' | 'sla')
                        : 'ticket'
                );
                setSupportNotes(f.support?.notes ?? '');
            } catch (e) {
                setLoadErr(e instanceof Error ? e.message : 'Load failed');
            } finally {
                setLoading(false);
            }
        })();
    }, [backend, id]);

    // Build features for PATCH from controlled inputs
    const features: PlanFeatures = useMemo(
        () => ({
            quotas: {
                emailsPerDay: intOrNull(emailsPerDay),
                emailsPerMonth: intOrNull(emailsPerMonth),
                logRetentionDays: intOrNull(logRetentionDays) ?? 0,
                apiKeys: intOrNull(apiKeys) ?? 0,
                inboundRoutes: intOrNull(inboundRoutes) ?? 0,
                sendingDomains: {
                    included: intOrNull(sendingIncluded),
                    max: intOrNull(sendingMax),
                },
                emailValidationsIncluded: intOrNull(emailValidations) ?? 0,
            },
            pricing: { overagePer1K: decOrNull(overagePer1K) },
            capabilities: {
                api: capAPI,
                smtp: capSMTP,
                analytics,
                webhooks,
                templateBuilder: templates,
                dedicatedIpPools: dedicatedIp,
                sendTimeOptimization: sto,
            },
            support: {
                tier: supportTier,
                notes: supportNotes.trim() || undefined,
            },
        }),
        [
            emailsPerDay, emailsPerMonth, logRetentionDays, apiKeys, inboundRoutes,
            sendingIncluded, sendingMax, emailValidations, overagePer1K,
            capAPI, capSMTP, analytics, webhooks, templates, dedicatedIp, sto,
            supportTier, supportNotes
        ]
    );

    const parsedMonthly = useMemo(() => decOrNull(monthlyPrice), [monthlyPrice]);
    const invalidMonthly = useMemo(() => {
        if (monthlyPrice.trim() === '') return false; // allow blank (custom/free)
        const n = decOrNull(monthlyPrice);
        return n === null || n < 0; // negative or NaN is invalid
    }, [monthlyPrice]);

    // Describe how Stripe will react on save (backend handles it)
    const stripeAction: 'none' | 'create' | 'rotate' | 'detach' = useMemo(() => {
        if (invalidMonthly) return 'none';
        const before = (initialMonthlyPrice ?? 0) > 0 ? initialMonthlyPrice! : 0;
        const after = (parsedMonthly ?? 0) > 0 ? parsedMonthly! : 0;

        if (before === 0 && after === 0) return 'none';
        if (before === 0 && after > 0) return 'create';
        if (before > 0 && after === 0) return 'detach';
        if (before > 0 && after > 0 && before !== after) return 'rotate';
        return 'none';
    }, [invalidMonthly, initialMonthlyPrice, parsedMonthly]);

    const canSubmit = name.trim().length > 0 && !invalidMonthly;

    async function onSave() {
        if (!backend || !id) return setErr('Missing backend URL or id');
        if (!canSubmit) return setErr('Please fix the highlighted fields.');

        setSaving(true);
        setErr(null);
        setSaveMsg(null);

        try {
            const raw: PatchBody = {
                name: name.trim(),
                monthlyPrice: parsedMonthly ?? null, // <= 0 or blank -> free/custom
                includedMessages: intOrNull(includedMessages),
                averagePricePer1K: decOrNull(averagePricePer1K),
                features,
            };
            const payload = compactDeep(raw);

            // PATCH matches your controller
            const res = await fetch(`${backend}/plans/${id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) {
                const msg = (json && (json.error || json.message)) || `Save failed (${res.status})`;
                throw new Error(msg);
            }

            const updated = json as Plan;
            setStripePriceId(updated.stripePriceId ?? null);

            const suffix =
                stripeAction === 'create'
                    ? updated.stripePriceId ? ` Stripe Price: ${updated.stripePriceId}` : ''
                    : stripeAction === 'rotate'
                        ? updated.stripePriceId ? ` New Stripe Price: ${updated.stripePriceId}` : ' (rotated Stripe price)'
                        : stripeAction === 'detach'
                            ? ' (plan is now free/custom; Stripe product/price detached or archived)'
                            : '';

            setSaveMsg(`Saved.${suffix}`);
            // refresh baseline for further edits
            setInitialMonthlyPrice(updated.monthlyPrice ?? null);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="p-6 text-center text-gray-600">Loading plan…</div>;
    }
    if (loadErr) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-600">{loadErr}</p>
                <button onClick={() => router.push(backHref)} className="mt-3 inline-flex items-center px-3 py-2 rounded border">
                    <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={() => router.push(backHref)} className="inline-flex items-center text-gray-600 hover:text-gray-800">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">Edit Plan</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onSave}
                        disabled={!canSubmit || saving}
                        className="inline-flex items-center px-4 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-60"
                    >
                        <CheckIcon className="h-5 w-5 mr-1" />
                        {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </div>

            {/* Basics */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Name <span className="text-red-600">*</span>
                        </label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Scale"
                            className="w-full rounded border px-3 py-2"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium mb-1">Monthly price (USD)</label>
                            {/* Stripe action badge */}
                            <span
                                className={
                                    'text-xs px-2 py-1 rounded border ' +
                                    (invalidMonthly
                                        ? 'border-red-300 text-red-700 bg-red-50'
                                        : stripeAction === 'create'
                                            ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                                            : stripeAction === 'rotate'
                                                ? 'border-blue-300 text-blue-700 bg-blue-50'
                                                : stripeAction === 'detach'
                                                    ? 'border-amber-300 text-amber-700 bg-amber-50'
                                                    : 'border-gray-300 text-gray-600 bg-gray-50')
                                }
                                title={
                                    invalidMonthly
                                        ? 'Enter a non-negative number, or leave blank for custom/free'
                                        : stripeAction === 'create'
                                            ? 'Will create a Stripe Product + monthly Price'
                                            : stripeAction === 'rotate'
                                                ? 'Will create a new Stripe Price and leave the old one inactive'
                                                : stripeAction === 'detach'
                                                    ? 'Will make this plan free/custom; backend will detach/archive Stripe objects'
                                                    : 'No Stripe changes'
                                }
                            >
                {invalidMonthly
                    ? 'Invalid price'
                    : stripeAction === 'create'
                        ? 'Stripe: will create Product + Price'
                        : stripeAction === 'rotate'
                            ? 'Stripe: will rotate Price'
                            : stripeAction === 'detach'
                                ? 'Stripe: will detach (free/custom)'
                                : 'Stripe: no change'}
              </span>
                        </div>
                        <input
                            inputMode="decimal"
                            value={monthlyPrice}
                            onChange={(e) => setMonthlyPrice(e.target.value)}
                            placeholder="e.g. 50"
                            className={
                                'w-full rounded border px-3 py-2 ' +
                                (invalidMonthly ? 'border-red-400 focus:outline-red-500' : '')
                            }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Leave blank or set to 0 for custom/free. Any value &gt; 0 will create or rotate a Stripe monthly Price.
                        </p>

                        {/* Show current Stripe Price ID if present */}
                        {stripePriceId ? (
                            <p className="mt-2 text-xs text-gray-600">Current Stripe Price: <span className="font-mono">{stripePriceId}</span></p>
                        ) : (
                            <p className="mt-2 text-xs text-gray-400">No Stripe Price attached.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Included messages (per month)</label>
                        <input
                            inputMode="numeric"
                            value={includedMessages}
                            onChange={(e) => setIncludedMessages(e.target.value)}
                            placeholder="e.g. 100000"
                            className="w-full rounded border px-3 py-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Avg. price per 1K</label>
                        <input
                            inputMode="decimal"
                            value={averagePricePer1K}
                            onChange={(e) => setAveragePricePer1K(e.target.value)}
                            placeholder="e.g. 0.50"
                            className="w-full rounded border px-3 py-2"
                        />
                    </div>
                </div>
            </div>

            {/* Features */}
            <div className="bg-white border rounded-lg p-4 space-y-6">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                    <InformationCircleIcon className="h-4 w-4" />
                    <span>Update the plan features below. These fields assemble the JSON sent to the API.</span>
                </div>

                {/* Quotas */}
                <section>
                    <h2 className="text-lg font-semibold mb-3">Quotas</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Emails / day</label>
                            <input
                                inputMode="numeric"
                                value={emailsPerDay}
                                onChange={(e) => setEmailsPerDay(e.target.value)}
                                placeholder="e.g. 100"
                                className="w-full rounded border px-3 py-2"
                            />
                            <p className="text-xs text-gray-500 mt-1">Leave blank for no daily cap.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Emails / month</label>
                            <input
                                inputMode="numeric"
                                value={emailsPerMonth}
                                onChange={(e) => setEmailsPerMonth(e.target.value)}
                                placeholder="e.g. 50000"
                                className="w-full rounded border px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Log retention (days)</label>
                            <input
                                inputMode="numeric"
                                value={logRetentionDays}
                                onChange={(e) => setLogRetentionDays(e.target.value)}
                                placeholder="e.g. 30"
                                className="w-full rounded border px-3 py-2"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">API keys</label>
                            <input
                                inputMode="numeric"
                                value={apiKeys}
                                onChange={(e) => setApiKeys(e.target.value)}
                                placeholder="e.g. 2"
                                className="w-full rounded border px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Inbound routes</label>
                            <input
                                inputMode="numeric"
                                value={inboundRoutes}
                                onChange={(e) => setInboundRoutes(e.target.value)}
                                placeholder="e.g. 5"
                                className="w-full rounded border px-3 py-2"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Sending domains (included)</label>
                                <input
                                    inputMode="numeric"
                                    value={sendingIncluded}
                                    onChange={(e) => setSendingIncluded(e.target.value)}
                                    placeholder="e.g. 1"
                                    className="w-full rounded border px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Sending domains (max)</label>
                                <input
                                    inputMode="numeric"
                                    value={sendingMax}
                                    onChange={(e) => setSendingMax(e.target.value)}
                                    placeholder="e.g. 1000"
                                    className="w-full rounded border px-3 py-2"
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave blank for unlimited.</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Email validations included</label>
                            <input
                                inputMode="numeric"
                                value={emailValidations}
                                onChange={(e) => setEmailValidations(e.target.value)}
                                placeholder="e.g. 5000"
                                className="w-full rounded border px-3 py-2"
                            />
                        </div>
                    </div>
                </section>

                {/* Pricing */}
                <section>
                    <h2 className="text-lg font-semibold mb-3">Pricing</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Overage per 1K (USD)</label>
                            <input
                                inputMode="decimal"
                                value={overagePer1K}
                                onChange={(e) => setOveragePer1K(e.target.value)}
                                placeholder="e.g. 1.10"
                                className="w-full rounded border px-3 py-2"
                            />
                        </div>
                    </div>
                </section>

                {/* Capabilities */}
                <section>
                    <h2 className="text-lg font-semibold mb-3">Capabilities</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={capAPI} onChange={(e) => setCapAPI(e.target.checked)} />
                            <span>REST API</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={capSMTP} onChange={(e) => setCapSMTP(e.target.checked)} />
                            <span>SMTP relay</span>
                        </label>
                        <div>
                            <label className="block text-sm font-medium mb-1">Analytics</label>
                            <select
                                value={analytics}
                                onChange={(e) => setAnalytics(e.target.value as 'basic' | 'standard' | 'advanced')}
                                className="w-full rounded border px-3 py-2"
                            >
                                <option value="basic">basic</option>
                                <option value="standard">standard</option>
                                <option value="advanced">advanced</option>
                            </select>
                        </div>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={webhooks} onChange={(e) => setWebhooks(e.target.checked)} />
                            <span>Webhooks</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={templates} onChange={(e) => setTemplates(e.target.checked)} />
                            <span>Template builder</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={dedicatedIp} onChange={(e) => setDedicatedIp(e.target.checked)} />
                            <span>Dedicated IP pools</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={sto} onChange={(e) => setSto(e.target.checked)} />
                            <span>Send-time optimization</span>
                        </label>
                    </div>
                </section>

                {/* Support */}
                <section>
                    <h2 className="text-lg font-semibold mb-3">Support</h2>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Tier</label>
                            <select
                                value={supportTier}
                                onChange={(e) => setSupportTier(e.target.value as 'ticket' | 'email' | 'chat_phone' | 'sla')}
                                className="w-full rounded border px-3 py-2"
                            >
                                <option value="ticket">ticket</option>
                                <option value="email">email</option>
                                <option value="chat_phone">chat & phone</option>
                                <option value="sla">SLA</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                            <input
                                value={supportNotes}
                                onChange={(e) => setSupportNotes(e.target.value)}
                                placeholder="e.g. Priority onboarding, deliverability reviews"
                                className="w-full rounded border px-3 py-2"
                            />
                        </div>
                    </div>
                </section>
            </div>

            {/* Messages */}
            {(err || saveMsg) && (
                <div className="text-sm">
                    {err && <div className="text-red-600">{err}</div>}
                    {saveMsg && <div className="text-green-700">{saveMsg}</div>}
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-sm text-gray-500">
                <div>
                    <span>Fields with </span>
                    <span className="text-red-600">*</span>
                    <span> are required.</span>
                </div>
                <Link href={backHref} className="hover:text-gray-800">
                    ← Back to plans
                </Link>
            </div>
        </div>
    );
}
