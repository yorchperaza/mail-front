'use client';

import React, {
    useMemo, useState, useEffect, useRef, forwardRef, useImperativeHandle, FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Combobox } from '@headlessui/react';
import { ArrowLeftIcon, ChevronUpDownIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import countryList from 'react-select-country-list';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

/* -------------------------------- Types -------------------------------- */

type Country = { label: string; value: string };
type Address = { street?: string; city?: string; zip?: string; country?: string };
type CompanyPayload = {
    name: string;
    phone_number?: string;
    address?: Address;
    plan_id?: number | null;
    stripe_payment_method?: string | null;
};

type ApiError = { message?: string; error?: true; fields?: Record<string, string> };
type PlanBrief = { id: number; name: string };

type PlanFeatures =
    | {
    capabilities?: {
        analytics?: string;
        api?: boolean;
        dedicatedIpPools?: boolean;
        sendTimeOptimization?: boolean;
        smtp?: boolean;
        templateBuilder?: boolean;
        webhooks?: boolean;
        [k: string]: unknown;
    };
    pricing?: { overagePer1K?: number | null; [k: string]: unknown };
    quotas?: {
        apiKeys?: number | null;
        emailValidationsIncluded?: number | null;
        emailsPerDay?: number | null;
        emailsPerMonth?: number | null;
        inboundRoutes?: number | null;
        logRetentionDays?: number | null;
        sendingDomains?: { max?: number | null; included?: number | null } | null;
        [k: string]: unknown;
    };
    support?: { tier?: string | null; [k: string]: unknown };
    [k: string]: unknown;
}
    | string[]
    | null;

type PlanDetail = {
    id: number;
    name: string;
    monthlyPrice: number | null;
    includedMessages: number | null;
    averagePricePer1K: number | null;
    features: PlanFeatures;
};

/* ------------------------------- Helpers ------------------------------- */

function formatMoney(n: number | null): string {
    if (n === null) return '—';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
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
function toFeatureBullets(features: PlanFeatures): string[] {
    if (!features) return [];
    if (isStringArray(features)) return features;

    const f = features as Exclude<PlanFeatures, string[] | null>;
    const bullets: string[] = [];

    if (f.capabilities) {
        const cap = f.capabilities;
        if (typeof cap.analytics === 'string') bullets.push(`Analytics: ${title(cap.analytics)}`);
        if (cap.api) bullets.push('API access');
        if (cap.smtp) bullets.push('SMTP relay');
        if (cap.webhooks) bullets.push('Webhooks');
        if (cap.templateBuilder) bullets.push('Template builder');
        if (cap.sendTimeOptimization) bullets.push('Send-time optimization');
        if (cap.dedicatedIpPools) bullets.push('Dedicated IP pools');
    }

    if (f.quotas) {
        const q = f.quotas;
        if (q.emailsPerMonth != null) bullets.push(`Emails per month: ${new Intl.NumberFormat().format(q.emailsPerMonth)}`);
        if (q.emailsPerDay != null) bullets.push(`Emails per day: ${new Intl.NumberFormat().format(q.emailsPerDay)}`);
        if (q.apiKeys != null) bullets.push(`API keys: ${q.apiKeys}`);
        if (q.inboundRoutes != null) bullets.push(`Inbound routes: ${q.inboundRoutes}`);
        if (q.logRetentionDays != null) bullets.push(`Log retention: ${q.logRetentionDays} ${q.logRetentionDays === 1 ? 'day' : 'days'}`);
        if (q.emailValidationsIncluded != null) bullets.push(`Email validations included: ${q.emailValidationsIncluded}`);
        if (q.sendingDomains) {
            const inc = q.sendingDomains.included ?? null;
            const mx = q.sendingDomains.max ?? null;
            const parts: string[] = [];
            if (inc != null) parts.push(`${inc} included`);
            if (mx != null) parts.push(`max ${mx}`);
            if (parts.length) bullets.push(`Sending domains: ${parts.join(' • ')}`);
        }
    }

    if (f.pricing) {
        const p = f.pricing;
        if (p.overagePer1K != null) bullets.push(p.overagePer1K > 0 ? `Overage: $${p.overagePer1K}/1k` : 'No overage charges');
    }

    if (f.support?.tier) bullets.push(`Support: ${title(String(f.support.tier))}`);

    const known = new Set(['capabilities', 'quotas', 'pricing', 'support']);
    Object.entries(f)
        .filter(([k, v]) => !known.has(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'))
        .forEach(([k, v]) => bullets.push(`${title(k)}: ${String(v)}`));

    return bullets;
}

/* ---------------------------- Stripe piece ----------------------------- */

type StripePaymentHandle = () => Promise<string>;

const StripePayment = forwardRef<StripePaymentHandle, { note?: string }>(function StripePayment({ note }, ref) {
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

/* ------------------------------- Page ---------------------------------- */

export default function CreateCompanyPage() {
    const router = useRouter();

    // Company form
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [zip, setZip] = useState('');

    // Countries
    const countries = useMemo(() => countryList().getData() as Country[], []);
    const [country, setCountry] = useState<Country | null>(null);
    const [filtered, setFiltered] = useState<Country[]>(countries);

    // Plans
    const [brief, setBrief] = useState<PlanBrief[]>([]);
    const [details, setDetails] = useState<Record<number, PlanDetail>>({});
    const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
    const [plansLoading, setPlansLoading] = useState(false);
    const [plansError, setPlansError] = useState<string | null>(null);

    // Stripe state
    const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
    const [stripeLoading, setStripeLoading] = useState(false);
    const [stripeSetupError, setStripeSetupError] = useState<string | null>(null);
    const stripePromise = useMemo(() => {
        const pk = process.env.NEXT_PUBLIC_STRIPE_PK;
        return pk ? loadStripe(pk) : null;
    }, []);

    // UX
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState<ApiError | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const selected = selectedPlanId != null ? details[selectedPlanId] : undefined;
    const requireCard = (selected?.monthlyPrice ?? 0) > 0;
    const selectedBullets = useMemo(() => toFeatureBullets(selected?.features ?? null), [selected]);

    /* ----------------------- Load plans (for selection) ----------------------- */

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setPlansLoading(true);
                setPlansError(null);

                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/plans-brief`, { headers: { 'Content-Type': 'application/json' } });
                if (!res.ok) throw new Error(`Failed to load plans (${res.status})`);
                const items = (await res.json()) as PlanBrief[];
                if (cancelled) return;
                setBrief(items);
                if (items.length > 0) setSelectedPlanId(items[0].id);

                const pairs = await Promise.all(
                    items.map(async (p) => {
                        const r = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/plans-id/${p.id}`, { headers: { 'Content-Type': 'application/json' } });
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
        return () => { cancelled = true; };
    }, []);

    /* --------- Create SetupIntent whenever a paid plan is selected --------- */

    useEffect(() => {
        let cancel = false;
        (async () => {
            setStripeSetupError(null);
            if (!requireCard) {
                setStripeClientSecret(null);
                return;
            }
            if (!process.env.NEXT_PUBLIC_STRIPE_PK) {
                setStripeSetupError('Payments unavailable (missing Stripe publishable key).');
                return;
            }
            if (!selectedPlanId) return;

            try {
                setStripeLoading(true);
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/billing/create-setup-intent?plan_id=${selectedPlanId}`,
                    { method: 'POST', headers: { 'Content-Type': 'application/json' } }
                );
                if (!res.ok) throw new Error(`Cannot initialize payment (${res.status})`);
                const { clientSecret } = (await res.json()) as { clientSecret: string };
                if (!cancel) setStripeClientSecret(clientSecret);
            } catch (e) {
                if (!cancel) setStripeSetupError(e instanceof Error ? e.message : 'Failed to set up payment.');
            } finally {
                if (!cancel) setStripeLoading(false);
            }
        })();
        return () => { cancel = true; };
    }, [requireCard, selectedPlanId]);

    /* ------------------------------ UI helpers ------------------------------ */

    function filterCountries(q: string) {
        const query = q.toLowerCase();
        setFiltered(countries.filter((c) => c.label.toLowerCase().includes(query)));
    }

    function validate(): boolean {
        const errs: Record<string, string> = {};
        if (!name.trim()) errs['name'] = 'Company name is required.';
        const anyAddr = [street, city, zip, country?.value ?? ''].some((v) => v?.trim());
        if (anyAddr) {
            if (!street.trim()) errs['street'] = 'Street is required.';
            if (!city.trim()) errs['city'] = 'City is required.';
            if (!zip.trim()) errs['zip'] = 'ZIP / Postal is required.';
            if (!country?.value) errs['country'] = 'Country is required.';
        }
        if (selectedPlanId == null) errs['plan'] = 'Please choose a plan.';
        if (requireCard) {
            if (!stripePromise) errs['payment'] = 'Payments unavailable.';
            if (!stripeClientSecret) errs['payment'] = 'Initializing payment…';
            if (stripeSetupError) errs['payment'] = stripeSetupError;
        }
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    }

    const stripeConfirmRef = useRef<StripePaymentHandle | null>(null);

    /* -------------------------------- Submit -------------------------------- */

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setApiError(null);
        if (!validate()) return;

        setSaving(true);

        try {
            let paymentMethodId: string | null = null;

            if (requireCard) {
                if (!stripeConfirmRef.current) throw new Error('Payment form not ready. Please try again.');
                paymentMethodId = await stripeConfirmRef.current();
            }

            const fullAddr = [street, city, zip, country?.value ?? ''].every((v) => !!v?.trim());

            const payload: CompanyPayload = {
                name: name.trim(),
                plan_id: selectedPlanId ?? undefined,
                ...(phone.trim() ? { phone_number: phone.trim() } : {}),
                ...(fullAddr ? { address: { street: street.trim(), city: city.trim(), zip: zip.trim(), country: country!.value } } : {}),
                ...(paymentMethodId ? { stripe_payment_method: paymentMethodId } : {}),
            };

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                let err: ApiError | undefined;
                try { err = await res.json(); } catch {}
                setApiError(err ?? { message: `Failed to create company: ${res.status}` });
                if (err?.fields) setFieldErrors(err.fields);
                setSaving(false);
                return;
            }

            const json = await res.json();
            if (json?.hash) router.push(`/dashboard/company/${json.hash}`);
            else router.push('/dashboard');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setApiError({ message });
        } finally {
            setSaving(false);
        }
    }

    /* -------------------------------- Render -------------------------------- */

    return (
        <div className="p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
                    aria-label="Back"
                >
                    <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
                </button>
                <h1 className="text-3xl font-semibold">Create Company</h1>
                <div className="ml-auto text-sm">
                    <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
                        All companies →
                    </Link>
                </div>
            </div>

            {/* Two-column grid: LEFT (price + features), RIGHT (form + payment) */}
            <div
                className="
          grid gap-6
          lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]
        "
            >
                {/* LEFT: Plans & Features */}
                <aside className="space-y-4 lg:sticky lg:top-6 self-start">
                    <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Plan</h2>
                            {plansError && <span className="text-sm text-red-600">{plansError}</span>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                <div aria-hidden className={`mt-1 size-5 rounded-full border ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-neutral-300'}`} />
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>

                        {fieldErrors['plan'] && <p className="text-xs text-red-600">{fieldErrors['plan']}</p>}
                    </section>

                    {/* Selected plan feature bullets */}
                    {selected && (
                        <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
                            <div className="flex items-center justify-between gap-4">
                                <div className="text-sm font-semibold text-neutral-800">Selected: {selected.name}</div>
                                <div className="text-sm text-neutral-700">
                                    {formatMoney(selected.monthlyPrice)} /mo • {formatMessages(selected.includedMessages)} messages
                                </div>
                            </div>

                            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-neutral-700">
                                {selectedBullets.length > 0 ? (
                                    selectedBullets.map((f, i) => (
                                        <li key={i} className="flex gap-2">
                                            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500/70" />
                                            <span>{f}</span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-neutral-500">No feature details.</li>
                                )}
                            </ul>
                        </section>
                    )}
                </aside>

                {/* RIGHT: One-column Form + Payment + Actions */}
                <main className="space-y-4">
                    {/* Company Info */}
                    <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Company Info</h2>

                        {apiError?.message && (
                            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                                {apiError.message}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                    Company Name <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => { setName(e.target.value); setFieldErrors((f) => ({ ...f, name: '' })); }}
                                    placeholder="My Awesome Co."
                                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-200 ${fieldErrors['name'] ? 'border-red-400' : 'border-gray-300'}`}
                                />
                                {fieldErrors['name'] && <p className="mt-1 text-xs text-red-600">{fieldErrors['name']}</p>}
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+1 (555) 123-4567"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Address (single column) */}
                    <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Address (optional)</h2>
                            <span className="text-xs text-gray-500">If you fill any field, all four are required.</span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Street</label>
                                <input
                                    type="text"
                                    value={street}
                                    onChange={(e) => { setStreet(e.target.value); setFieldErrors((f) => ({ ...f, street: '' })); }}
                                    placeholder="123 Main St"
                                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-200 ${fieldErrors['street'] ? 'border-red-400' : 'border-gray-300'}`}
                                />
                                {fieldErrors['street'] && <p className="mt-1 text-xs text-red-600">{fieldErrors['street']}</p>}
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 mb-1">City</label>
                                <input
                                    type="text"
                                    value={city}
                                    onChange={(e) => { setCity(e.target.value); setFieldErrors((f) => ({ ...f, city: '' })); }}
                                    placeholder="San Francisco"
                                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-200 ${fieldErrors['city'] ? 'border-red-400' : 'border-gray-300'}`}
                                />
                                {fieldErrors['city'] && <p className="mt-1 text-xs text-red-600">{fieldErrors['city']}</p>}
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 mb-1">ZIP / Postal</label>
                                <input
                                    type="text"
                                    value={zip}
                                    onChange={(e) => { setZip(e.target.value); setFieldErrors((f) => ({ ...f, zip: '' })); }}
                                    placeholder="94105"
                                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-200 ${fieldErrors['zip'] ? 'border-red-400' : 'border-gray-300'}`}
                                />
                                {fieldErrors['zip'] && <p className="mt-1 text-xs text-red-600">{fieldErrors['zip']}</p>}
                            </div>

                            <div>
                                <Combobox value={country} onChange={(val) => { setCountry(val); setFieldErrors((f) => ({ ...f, country: '' })); }}>
                                    <Combobox.Label className="block text-sm text-gray-600 mb-1">Country</Combobox.Label>
                                    <div className="relative">
                                        <Combobox.Input
                                            className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-200 ${fieldErrors['country'] ? 'border-red-400' : 'border-gray-300'}`}
                                            displayValue={(c: Country) => c?.label || ''}
                                            placeholder="Select country"
                                            onChange={(e) => filterCountries(e.target.value)}
                                        />
                                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                                        </Combobox.Button>

                                        <Combobox.Options className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 overflow-auto rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 focus:outline-none">
                                            {filtered.map((c) => (
                                                <Combobox.Option
                                                    key={c.value}
                                                    value={c}
                                                    className={({ active }) =>
                                                        `cursor-pointer select-none relative py-2 pl-4 pr-4 ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-700'}`
                                                    }
                                                >
                                                    {({ selected }) => (
                                                        <span className={`block truncate ${selected ? 'font-semibold' : ''}`}>{c.label}</span>
                                                    )}
                                                </Combobox.Option>
                                            ))}
                                        </Combobox.Options>
                                    </div>
                                </Combobox>
                                {fieldErrors['country'] && <p className="mt-1 text-xs text-red-600">{fieldErrors['country']}</p>}
                            </div>
                        </div>
                    </section>

                    {/* Stripe Payment (only for paid plans) */}
                    {requireCard && (
                        <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 space-y-3">
                            <h2 className="text-lg font-semibold">Payment method</h2>
                            {fieldErrors['payment'] && <p className="text-xs text-red-600">{fieldErrors['payment']}</p>}
                            {stripeSetupError && <p className="text-xs text-red-600">{stripeSetupError}</p>}
                            {stripeLoading && (
                                <div className="mt-1 rounded-xl border border-neutral-200 p-4 animate-pulse">
                                    <div className="h-4 w-40 bg-neutral-200 rounded" />
                                    <div className="mt-3 h-9 w-full bg-neutral-200 rounded" />
                                </div>
                            )}
                            {!stripeLoading && stripePromise && stripeClientSecret && (
                                <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret, appearance: { theme: 'stripe' } }}>
                                    <StripePayment
                                        ref={stripeConfirmRef}
                                        note="Your card will be saved now and automatically charged after your 30-day trial unless you cancel."
                                    />
                                </Elements>
                            )}
                        </section>
                    )}

                    {/* Actions */}
                    <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
                        <form onSubmit={onSubmit} className="flex justify-end gap-3">
                            <Link href="/dashboard" className="inline-flex items-center px-4 py-2 rounded-lg border hover:bg-gray-50">
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={saving || !name.trim() || (requireCard && (!stripeClientSecret || !!stripeSetupError))}
                                className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? 'Creating…' : 'Create Company'}
                            </button>
                        </form>
                    </section>
                </main>
            </div>
        </div>
    );
}
