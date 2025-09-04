'use client';

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    forwardRef,
    useImperativeHandle,
    Fragment,
    FormEvent,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Transition } from '@headlessui/react';
import { ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

/* ------------------------------- Types -------------------------------- */

type ApiError = { message?: string } & Record<string, unknown>;

type PlanBrief = { id: number; name: string };

/** Strongly-typed optional sections we expect inside features objects. */
type FeatureCapabilities = {
    analytics?: string;
    api?: boolean;
    smtp?: boolean;
    webhooks?: boolean;
    templateBuilder?: boolean;
    sendTimeOptimization?: boolean;
    dedicatedIpPools?: boolean;
};

type FeatureQuotas = {
    emailsPerMonth?: number;
    emailsPerDay?: number;
    apiKeys?: number;
    inboundRoutes?: number;
    logRetentionDays?: number;
    emailValidationsIncluded?: number;
    sendingDomains?: { included?: number; max?: number } | null;
};

type FeaturePricing = { overagePer1K?: number };
type FeatureSupport = { tier?: string };

/** A generic record to allow unknown extra primitives without using any. */
type Primitive = string | number | boolean | null | undefined;

/** Object form of features. */
type FeatureObject = {
    capabilities?: FeatureCapabilities;
    quotas?: FeatureQuotas;
    pricing?: FeaturePricing;
    support?: FeatureSupport;
} & Record<string, Primitive>;

/** Features can be: object, list of strings (bullets), or null. */
type PlanFeatures = FeatureObject | string[] | null;

type PlanDetail = {
    id: number;
    name: string;
    monthlyPrice: number | null;
    includedMessages: number | null;
    averagePricePer1K: number | null;
    features: PlanFeatures;
};

type CompanyTiny = {
    name: string | null;
    subscriptionStatus?: string | null;
};

type CurrentPlan = {
    id: number | null;
    name: string | null;
    monthlyPrice?: number | null;
    includedMessages?: number | null;
    averagePricePer1K?: number | null;
    features?: PlanFeatures;
};

/** Shape for 402 “payment required” responses we handle. */
type PaymentRequiredPayload = {
    message?: string;
    stripe?: { clientSecret?: string };
};

/* ------------------------------ Helpers ------------------------------- */

function formatMoney(n: number | null): string {
    if (n === null) return '—';
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(n);
}
function formatMessages(n: number | null): string {
    if (n === null) return '—';
    if (n >= 1000) {
        const k = n / 1000;
        return `${(n % 1000 === 0 ? k.toFixed(0) : k.toFixed(1))}k`;
    }
    return new Intl.NumberFormat().format(n);
}
function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
}
function title(s: string): string {
    return s.replace(/(^|\s|-|_)\S/g, (m) => m.toUpperCase()).replace(/[_-]/g, ' ');
}

/** Type guard for the 402 error payload. */
function isPaymentRequiredPayload(v: unknown): v is PaymentRequiredPayload {
    if (typeof v !== 'object' || v === null) return false;
    const obj = v as Record<string, unknown>;
    const stripe = obj.stripe as Record<string, unknown> | undefined;
    const clientSecretOk =
        !stripe || typeof stripe.clientSecret === 'string' || typeof stripe.clientSecret === 'undefined';
    return clientSecretOk;
}

/** Detects backend error messages that indicate no PM/source is on file. */
function isPmRequiredMessage(msg?: string): boolean {
    if (!msg) return false;
    return /no attached payment source|default payment method|payment method required/i.test(msg);
}

function toFeatureBullets(features: PlanFeatures): string[] {
    if (!features) return [];
    if (isStringArray(features)) return features;

    const f = features as FeatureObject;
    const bullets: string[] = [];

    const cap = f.capabilities;
    if (cap) {
        if (typeof cap.analytics === 'string') bullets.push(`Analytics: ${title(cap.analytics)}`);
        if (cap.api) bullets.push('API access');
        if (cap.smtp) bullets.push('SMTP relay');
        if (cap.webhooks) bullets.push('Webhooks');
        if (cap.templateBuilder) bullets.push('Template builder');
        if (cap.sendTimeOptimization) bullets.push('Send-time optimization');
        if (cap.dedicatedIpPools) bullets.push('Dedicated IP pools');
    }

    const q = f.quotas;
    if (q) {
        if (q.emailsPerMonth != null) bullets.push(`Emails per month: ${new Intl.NumberFormat().format(q.emailsPerMonth)}`);
        if (q.emailsPerDay != null) bullets.push(`Emails per day: ${new Intl.NumberFormat().format(q.emailsPerDay)}`);
        if (q.apiKeys != null) bullets.push(`API keys: ${q.apiKeys}`);
        if (q.inboundRoutes != null) bullets.push(`Inbound routes: ${q.inboundRoutes}`);
        if (q.logRetentionDays != null)
            bullets.push(`Log retention: ${q.logRetentionDays} ${q.logRetentionDays === 1 ? 'day' : 'days'}`);
        if (q.emailValidationsIncluded != null)
            bullets.push(`Email validations included: ${q.emailValidationsIncluded}`);
        if (q.sendingDomains) {
            const inc = q.sendingDomains.included ?? null;
            const mx = q.sendingDomains.max ?? null;
            const parts: string[] = [];
            if (inc != null) parts.push(`${inc} included`);
            if (mx != null) parts.push(`max ${mx}`);
            if (parts.length) bullets.push(`Sending domains: ${parts.join(' • ')}`);
        }
    }

    const p = f.pricing;
    if (p && p.overagePer1K != null) {
        bullets.push(p.overagePer1K > 0 ? `Overage: $${p.overagePer1K}/1k` : 'No overage charges');
    }

    const s = f.support;
    if (s?.tier) bullets.push(`Support: ${title(String(s.tier))}`);

    // Add unknown primitive keys as "Key: value" (skip known ones)
    const known = new Set(['capabilities', 'quotas', 'pricing', 'support']);
    Object.entries(f)
        .filter(
            ([k, v]) =>
                !known.has(k) &&
                (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
        )
        .forEach(([k, v]) => bullets.push(`${title(k)}: ${String(v)}`));

    return bullets;
}

/* -------------------------- Stripe child piece ------------------------- */

type StripePaymentHandle = () => Promise<string>; // returns PM id

const StripePayment = forwardRef<StripePaymentHandle, { note?: string }>(function StripePayment(
    { note },
    ref
) {
    const stripe = useStripe();
    const elements = useElements();
    const [localError, setLocalError] = useState<string | null>(null);

    useImperativeHandle(ref, () => async () => {
        setLocalError(null);
        if (!stripe || !elements) throw new Error('Payment form not ready');
        const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
        if (error) {
            const msg = error.message || 'Payment confirmation failed';
            setLocalError(msg);
            throw new Error(msg);
        }
        const pm = setupIntent?.payment_method;
        if (!pm) {
            const msg = 'No payment method returned';
            setLocalError(msg);
            throw new Error(msg);
        }
        return String(pm);
    });

    return (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <PaymentElement options={{ layout: 'accordion' }} />
            {note && <p className="mt-2 text-xs text-neutral-600">{note}</p>}
            {localError && <p className="mt-2 text-xs text-red-600">{localError}</p>}
        </div>
    );
});

/* -------------------------------- Page -------------------------------- */

export default function CompanyBillingPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();

    // company & plan
    const [company, setCompany] = useState<CompanyTiny | null>(null);
    const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);

    // plans
    const [brief, setBrief] = useState<PlanBrief[]>([]);
    const [details, setDetails] = useState<Record<number, PlanDetail>>({});
    const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
    const [plansLoading, setPlansLoading] = useState(false);
    const [plansError, setPlansError] = useState<string | null>(null);

    // ui & errors
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Stripe (for right-side card form only)
    const stripePromise = useMemo(() => {
        const pk = process.env.NEXT_PUBLIC_STRIPE_PK;
        return pk ? loadStripe(pk) : null;
    }, []);
    const [cardClientSecret, setCardClientSecret] = useState<string | null>(null);
    const [cardLoading, setCardLoading] = useState(false);
    const [cardError, setCardError] = useState<string | null>(null);
    const stripeConfirmRef = useRef<StripePaymentHandle | null>(null);

    // Remember the plan we tried to switch to when we discovered a missing PM
    const [pendingPlanId, setPendingPlanId] = useState<number | null>(null);

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const selected = selectedPlanId != null ? details[selectedPlanId] : undefined;

    // Show payment panel only if current or selected plan is paid (non-free)
    const needsPaymentUI =
        ((selected?.monthlyPrice ?? null) ?? (currentPlan?.monthlyPrice ?? null) ?? 0) > 0;

    /* ------------------------ Load company tiny (status) ------------------------ */
    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}`, {
                    headers: authHeaders(),
                });
                if (!res.ok) throw new Error(`Failed to load company (${res.status})`);
                const data = (await res.json()) as Record<string, unknown>;
                if (!cancel) {
                    setCompany({
                        name: (data?.name as string | null) ?? null,
                        subscriptionStatus: (data?.subscriptionStatus as string | null) ?? null,
                    });
                }
            } catch (e) {
                if (!cancel) setError(e instanceof Error ? e.message : 'Failed to load company.');
            }
        })();
        return () => {
            cancel = true;
        };
    }, [hash]);

    /* -------------------------- Load current plan only ------------------------- */
    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies-plan/${hash}`, {
                    headers: authHeaders(),
                });
                if (!res.ok && res.status !== 200) throw new Error(`Failed to load current plan (${res.status})`);
                const data = (await res.json().catch(() => null)) as CurrentPlan | null;
                if (!cancel) setCurrentPlan(data ?? null);
            } catch {
                if (!cancel) setCurrentPlan(null);
            }
        })();
        return () => {
            cancel = true;
        };
    }, [hash]);

    /* -------------------------------- Load plans ------------------------------- */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setPlansLoading(true);
                setPlansError(null);

                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/plans-brief`, {
                    headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) throw new Error(`Failed to load plans (${res.status})`);
                const items = (await res.json()) as PlanBrief[];
                if (cancelled) return;
                setBrief(items);

                // default select current plan if exists, else first
                const currentId = currentPlan?.id ?? null;
                if (items.length > 0) setSelectedPlanId(currentId ?? items[0].id);

                const pairs = await Promise.all(
                    items.map(async (p) => {
                        const r = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/plans-id/${p.id}`, {
                            headers: { 'Content-Type': 'application/json' },
                        });
                        if (!r.ok) throw new Error(`Failed to load plan ${p.id} (${r.status})`);
                        const d = (await r.json()) as PlanDetail;
                        return [p.id, d] as const;
                    })
                );
                if (cancelled) return;
                setDetails(Object.fromEntries(pairs));
            } catch (e) {
                if (!cancelled) setPlansError(e instanceof Error ? e.message : 'Failed to load plans.');
            } finally {
                if (!cancelled) setPlansLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [currentPlan?.id]);

    /* ----------------- SetupIntent for adding / updating card ------------------ */
    async function initCompanySetupIntent() {
        setCardError(null);
        try {
            setCardLoading(true);
            if (!stripePromise) throw new Error('Payments unavailable (missing Stripe publishable key).');

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/billing/setup-intent`,
                { method: 'POST', headers: authHeaders() }
            );
            if (!res.ok) throw new Error(`Cannot initialize payment (${res.status})`);
            const { clientSecret } = (await res.json()) as { clientSecret: string };
            setCardClientSecret(clientSecret);
        } catch (e) {
            setCardError(e instanceof Error ? e.message : 'Failed to initialize payment.');
        } finally {
            setCardLoading(false);
        }
    }

    /* ---------------------------- Update card only ---------------------------- */
    async function handleSaveNewCard() {
        setError(null);
        setSuccess(null);
        try {
            if (!stripeConfirmRef.current) throw new Error('Payment form not ready.');
            const pmId = await stripeConfirmRef.current();

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/billing/update-payment-method`,
                {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ payment_method: pmId }),
                }
            );
            if (!res.ok) throw new Error(`Failed to set default payment method (${res.status})`);

            // collapse the form after success
            setCardClientSecret(null);
            setSuccess('Payment method updated.');

            // If we were in the middle of a plan change, retry it now
            if (pendingPlanId != null) {
                const retry = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/billing/change-plan`,
                    {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify({ plan_id: pendingPlanId }),
                    }
                );
                const data = (await retry.json().catch(() => ({}))) as unknown;

                if (retry.status === 402 && isPaymentRequiredPayload(data)) {
                    const secretFromServer = data.stripe?.clientSecret;
                    if (secretFromServer) {
                        setCardClientSecret(secretFromServer);
                    } else {
                        await initCompanySetupIntent();
                    }
                    setError(
                        data.message ||
                        'A payment method is still required. Please add a payment method to continue.'
                    );
                    return;
                }

                if (!retry.ok) {
                    const msg =
                        (typeof data === 'object' && data && 'message' in data && typeof (data as { message: string }).message === 'string'
                            ? (data as { message: string }).message
                            : undefined) || `Failed to change plan (${retry.status})`;
                    throw new Error(msg);
                }

                setPendingPlanId(null);
                setSuccess(`Plan updated to ${details[pendingPlanId]?.name ?? 'selected plan'}.`);

                // refresh current plan
                try {
                    const p = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies-plan/${hash}`, {
                        headers: authHeaders(),
                    }).then((r) => r.json());
                    setCurrentPlan((p as CurrentPlan | null) ?? null);
                } catch {
                    /* ignore */
                }
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update payment method.');
        }
    }

    /* --------------------------- Change plan/package -------------------------- */
    async function handleChangePlan(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        if (selectedPlanId == null) {
            setError('Please select a plan.');
            return;
        }

        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/billing/change-plan`,
                {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ plan_id: selectedPlanId }),
                }
            );

            // Handle "payment method required" path:
            if (res.status === 402) {
                const data = (await res.json().catch(() => ({}))) as unknown;
                setPendingPlanId(selectedPlanId);

                if (isPaymentRequiredPayload(data)) {
                    const secretFromServer = data.stripe?.clientSecret;
                    if (secretFromServer) {
                        setCardClientSecret(secretFromServer);
                    } else {
                        await initCompanySetupIntent();
                    }
                    setError(
                        data.message ||
                        'This customer has no attached payment source or default payment method. Please add a payment method to continue.'
                    );
                } else {
                    await initCompanySetupIntent();
                    setError(
                        'This customer has no attached payment source or default payment method. Please add a payment method to continue.'
                    );
                }
                return;
            }

            const data = (await res.json().catch(() => ({}))) as unknown;

            if (!res.ok) {
                const msg =
                    (typeof data === 'object' && data && 'message' in data && typeof (data as { message: string }).message === 'string'
                        ? (data as { message: string }).message
                        : undefined) || '';
                if (isPmRequiredMessage(msg)) {
                    setPendingPlanId(selectedPlanId);
                    await initCompanySetupIntent();
                    setError(
                        msg ||
                        'This customer has no attached payment source or default payment method. Please add a payment method to continue.'
                    );
                    return;
                }
                throw new Error(msg || `Failed to change plan (${res.status})`);
            }

            setSuccess(`Plan updated to ${details[selectedPlanId]?.name ?? 'selected plan'}.`);

            // Refresh current plan
            try {
                const p = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies-plan/${hash}`, {
                    headers: authHeaders(),
                }).then((r) => r.json());
                setCurrentPlan((p as CurrentPlan | null) ?? null);
            } catch {
                /* ignore */
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Could not change plan.';
            if (isPmRequiredMessage(msg)) {
                setPendingPlanId(selectedPlanId);
                await initCompanySetupIntent();
                setError(
                    'This customer has no attached payment source or default payment method. Please add a payment method to continue.'
                );
                return;
            }
            setError(msg);
        }
    }

    /* ---------------------------- Cancel at period end ------------------------ */
    async function handleCancelAtPeriodEnd() {
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/billing/cancel-subscription`,
                {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ cancel_now: false }),
                }
            );
            const data = (await res.json().catch(() => ({}))) as unknown;
            if (!res.ok) {
                const msg =
                    (typeof data === 'object' && data && 'message' in data && typeof (data as { message: string }).message === 'string'
                        ? (data as { message: string }).message
                        : undefined) || `Failed to cancel (${res.status})`;
                throw new Error(msg);
            }
            setSuccess('Subscription will cancel at period end.');
            // Optionally refresh status
            try {
                const c = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}`, {
                    headers: authHeaders(),
                }).then((r) => r.json());
                const name = (c?.name as string | null) ?? (company?.name ?? null);
                const status = (c?.subscriptionStatus as string | null) ?? 'canceled';
                setCompany({ name, subscriptionStatus: status });
            } catch {
                /* ignore */
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not cancel subscription.');
        }
    }

    /* ---------------------------- Billing Portal ----------------------------- */
    async function openBillingPortal() {
        setError(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies-billing-portal/${hash}`, {
                method: 'POST',
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error(`Failed to open billing portal (${res.status})`);
            const { url } = (await res.json()) as { url: string };
            window.location.href = url;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not open billing portal.');
        }
    }

    /* -------------------------------- UI ---------------------------------- */

    return (
        <div className="p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
                >
                    <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
                    <span className="sr-only">Back</span>
                </button>
                <h1 className="text-3xl font-semibold">Billing</h1>
                <div className="ml-auto text-sm text-gray-500">
                    <Link href={`/dashboard/company/${hash}`} className="text-blue-600 hover:text-blue-700">
                        Company overview →
                    </Link>
                </div>
            </div>

            {/* Alerts */}
            <Transition
                as={Fragment}
                show={!!error || !!success}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 -translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 -translate-y-1"
            >
                <div className="space-y-2">
                    {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</div>}
                    {success && (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">{success}</div>
                    )}
                </div>
            </Transition>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: Plan picker + features + cancel */}
                <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Plan</h2>
                        <span className="text-sm text-neutral-600">
              Current: <span className="font-medium">{currentPlan?.name ?? '—'}</span>
            </span>
                    </div>

                    {/* Plan cards */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {plansLoading &&
                            Array.from({ length: 2 }).map((_, i) => (
                                <div key={i} className="rounded-2xl border border-neutral-200 p-4 animate-pulse">
                                    <div className="h-5 w-24 bg-neutral-200 rounded mb-3" />
                                    <div className="h-8 w-32 bg-neutral-200 rounded mb-2" />
                                    <div className="h-3 w-2/3 bg-neutral-200 rounded" />
                                </div>
                            ))}

                        {!plansLoading &&
                            brief.map((p) => {
                                const d = details[p.id];
                                const isSelected = selectedPlanId === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setSelectedPlanId(p.id)}
                                        className={`relative text-left rounded-2xl border p-4 transition focus:outline-none focus:ring-2 ${
                                            isSelected
                                                ? 'border-blue-600 ring-blue-200 bg-gradient-to-br from-blue-50/70 to-white'
                                                : 'border-neutral-200 hover:border-neutral-300'
                                        }`}
                                    >
                                        {isSelected && (
                                            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        <CheckCircleIcon className="h-3.5 w-3.5" /> Selected
                      </span>
                                        )}
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-neutral-800">{p.name}</div>
                                                <div className="mt-1 text-2xl font-extrabold">
                                                    {d ? formatMoney(d.monthlyPrice) : '—'}
                                                    <span className="text-sm font-semibold text-neutral-500"> /mo</span>
                                                </div>
                                                <div className="mt-1 text-xs text-neutral-600">
                                                    Includes {d ? formatMessages(d.includedMessages) : '—'} messages • Avg ${d?.averagePricePer1K ?? '—'}/1k
                                                </div>
                                            </div>
                                            <div
                                                aria-hidden
                                                className={`mt-1 size-5 rounded-full border ${
                                                    isSelected ? 'border-blue-600 bg-blue-600' : 'border-neutral-300'
                                                }`}
                                            />
                                        </div>
                                    </button>
                                );
                            })}
                    </div>

                    {/* Selected plan details */}
                    {selected && (
                        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="text-sm font-semibold text-neutral-800">Selected: {selected.name}</div>
                                <div className="text-sm text-neutral-700">
                                    {formatMoney(selected.monthlyPrice)} /mo • {formatMessages(selected.includedMessages)} messages
                                </div>
                            </div>
                            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-neutral-700">
                                {toFeatureBullets(selected.features).length > 0 ? (
                                    toFeatureBullets(selected.features).map((f, i) => (
                                        <li key={i} className="flex gap-2">
                                            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500/70" />
                                            <span>{f}</span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-neutral-500">No feature details.</li>
                                )}
                            </ul>
                        </div>
                    )}

                    {/* Plan change form */}
                    <form onSubmit={handleChangePlan} className="mt-6">
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                disabled={plansLoading}
                            >
                                Update Plan
                            </button>
                        </div>
                    </form>

                    {/* Cancel subscription — period end only (shown for paid plans) */}
                    {needsPaymentUI && (
                        <div className="mt-8 border-t pt-6">
                            <h3 className="text-sm font-semibold text-neutral-800 mb-2">Cancel subscription</h3>
                            <p className="text-sm text-neutral-600 mb-3">Cancel at the end of the current billing period.</p>
                            <button
                                onClick={handleCancelAtPeriodEnd}
                                className="inline-flex items-center px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50"
                            >
                                Cancel at period end
                            </button>
                        </div>
                    )}
                </section>

                {/* RIGHT: Payment method management (only for paid plans) */}
                {needsPaymentUI && (
                    <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Payment method</h2>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={openBillingPortal}
                                    className="text-sm text-neutral-700 hover:text-neutral-900 underline underline-offset-2"
                                >
                                    Manage cards (Stripe Portal)
                                </button>
                                <button
                                    type="button"
                                    onClick={initCompanySetupIntent}
                                    className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                    {cardClientSecret ? 'Reset form' : 'Add / change card'}
                                </button>
                            </div>
                        </div>

                        <p className="mt-1 text-sm text-neutral-600">Update the default card used for invoices.</p>

                        <div className="mt-4">
                            {cardError && <p className="text-sm text-red-600">{cardError}</p>}
                            {cardLoading && (
                                <div className="rounded-xl border border-neutral-200 p-4 animate-pulse">
                                    <div className="h-4 w-40 bg-neutral-200 rounded" />
                                    <div className="mt-3 h-9 w-full bg-neutral-200 rounded" />
                                </div>
                            )}

                            {!cardLoading && stripePromise && cardClientSecret && (
                                <Elements
                                    stripe={stripePromise}
                                    options={{ clientSecret: cardClientSecret, appearance: { theme: 'stripe' } }}
                                >
                                    <div className="space-y-4">
                                        <StripePayment
                                            ref={stripeConfirmRef}
                                            note="Your card will be saved for future automatic charges."
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                onClick={handleSaveNewCard}
                                                className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                Save new payment method
                                            </button>
                                        </div>
                                    </div>
                                </Elements>
                            )}

                            {!cardLoading && !cardClientSecret && (
                                <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
                                    Click <span className="font-medium text-neutral-700">Add / change card</span> to open the secure card
                                    form.
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
