"use client";

import type { CSSProperties } from "react";
import React, {
    Fragment,
    useEffect,
    useMemo,
    useState,
    useRef,
    forwardRef,
    useImperativeHandle,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Combobox, Transition } from "@headlessui/react";
import countriesData from "world-countries";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

/* ------------------------------- Types ---------------------------------- */

type ApiError = { message?: string } & Record<string, unknown>;
type CountryOption = { code: string; name: string };
type BrandStyle = CSSProperties & { ["--ml-primary"]?: string };
type WCountry = { cca2: string; name: { common: string } };

/** Matches backend shape (supports nested features) */
type PlanBrief = { id: number; name: string };

type PlanFeatures = {
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
    pricing?: {
        overagePer1K?: number | null;
        [k: string]: unknown;
    };
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
    support?: {
        tier?: string | null;
        [k: string]: unknown;
    };
    [k: string]: unknown;
};

type PlanDetail = {
    id: number;
    name: string;
    monthlyPrice: number | null;
    includedMessages: number | null;
    averagePricePer1K: number | null;
    features: PlanFeatures | string[] | null;
};

/* ------------------------------ Data ------------------------------------ */

const COUNTRIES: CountryOption[] = (countriesData as WCountry[])
    .map((c) => ({ code: c.cca2, name: c.name.common }))
    .filter((c) => Boolean(c.code && c.name))
    .sort((a, b) => a.name.localeCompare(b.name));

/* ------------------------------ Helpers --------------------------------- */

function formatMoney(n: number | null): string {
    if (n === null) return "—";
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(n);
}

/** 4500 -> 4.5k, 10000 -> 10k, <1000 stays number */
function formatMessages(n: number | null): string {
    if (n === null) return "—";
    if (n >= 1000) {
        const thousands = n / 1000;
        const isWhole = n % 1000 === 0;
        return `${isWhole ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
    }
    return new Intl.NumberFormat().format(n);
}

function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.every((x) => typeof x === "string");
}
function title(s: string): string {
    return s.replace(/(^|\s|-|_)\S/g, (m) => m.toUpperCase()).replace(/[_-]/g, " ");
}

function toFeatureBullets(features: PlanDetail["features"]): string[] {
    if (!features) return [];
    if (isStringArray(features)) return features;

    const f = features as PlanFeatures;
    const bullets: string[] = [];

    if (f.capabilities) {
        const cap = f.capabilities;
        if (typeof cap.analytics === "string") bullets.push(`Analytics: ${title(cap.analytics)}`);
        if (cap.api) bullets.push("API access");
        if (cap.smtp) bullets.push("SMTP relay");
        if (cap.webhooks) bullets.push("Webhooks");
        if (cap.templateBuilder) bullets.push("Template builder");
        if (cap.sendTimeOptimization) bullets.push("Send-time optimization");
        if (cap.dedicatedIpPools) bullets.push("Dedicated IP pools");
    }

    if (f.quotas) {
        const q = f.quotas;
        if (q.emailsPerMonth != null) bullets.push(`Emails per month: ${new Intl.NumberFormat().format(q.emailsPerMonth)}`);
        if (q.emailsPerDay != null) bullets.push(`Emails per day: ${new Intl.NumberFormat().format(q.emailsPerDay)}`);
        if (q.apiKeys != null) bullets.push(`API keys: ${q.apiKeys}`);
        if (q.inboundRoutes != null) bullets.push(`Inbound routes: ${q.inboundRoutes}`);
        if (q.logRetentionDays != null) bullets.push(`Log retention: ${q.logRetentionDays} ${q.logRetentionDays === 1 ? "day" : "days"}`);
        if (q.emailValidationsIncluded != null) bullets.push(`Email validations included: ${q.emailValidationsIncluded}`);
        if (q.sendingDomains) {
            const inc = q.sendingDomains.included ?? null;
            const mx = q.sendingDomains.max ?? null;
            const parts: string[] = [];
            if (inc != null) parts.push(`${inc} included`);
            if (mx != null) parts.push(`max ${mx}`);
            if (parts.length) bullets.push(`Sending domains: ${parts.join(" • ")}`);
        }
    }

    if (f.pricing) {
        const p = f.pricing;
        if (p.overagePer1K != null) bullets.push(p.overagePer1K > 0 ? `Overage: $${p.overagePer1K}/1k` : "No overage charges");
    }

    if (f.support?.tier) bullets.push(`Support: ${title(String(f.support.tier))}`);

    // Fallback for simple unknown keys
    const known = new Set(["capabilities", "quotas", "pricing", "support"]);
    Object.entries(f)
        .filter(([k, v]) => !known.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
        .forEach(([k, v]) => bullets.push(`${title(k)}: ${String(v)}`));

    return bullets;
}

/* ------------------------- Stripe child component ------------------------ */

type StripePaymentHandle = () => Promise<string>; // returns paymentMethodId
const StripePayment = forwardRef<StripePaymentHandle, { note?: string }>(function StripePayment(
    { note },
    ref
) {
    const stripe = useStripe();
    const elements = useElements();
    const [localError, setLocalError] = useState<string | null>(null);

    useImperativeHandle(ref, () => async () => {
        setLocalError(null);
        if (!stripe || !elements) throw new Error("Payment form not ready");
        const { error, setupIntent } = await stripe.confirmSetup({
            elements,
            redirect: "if_required",
        });
        if (error) {
            const msg = error.message || "Payment confirmation failed";
            setLocalError(msg);
            throw new Error(msg);
        }
        const pm = setupIntent?.payment_method;
        if (!pm) {
            const msg = "No payment method returned";
            setLocalError(msg);
            throw new Error(msg);
        }
        return String(pm);
    });

    return (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <PaymentElement options={{ layout: "accordion" }} />
            {note && <p className="mt-2 text-xs text-neutral-600">{note}</p>}
            {localError && <p className="mt-2 text-xs text-red-600">{localError}</p>}
        </div>
    );
});

/* ------------------------------ Component ------------------------------- */

export default function RegisterPage() {
    const router = useRouter();

    // profile fields
    const [fullName, setFullName] = useState("");
    const [company, setCompany] = useState("");
    const [country, setCountry] = useState<CountryOption | null>(null);
    const [query, setQuery] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [agree, setAgree] = useState(false);
    const [newsOptIn, setNewsOptIn] = useState(true);

    // plans state
    const [brief, setBrief] = useState<PlanBrief[]>([]);
    const [details, setDetails] = useState<Record<number, PlanDetail>>({});
    const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
    const [plansLoading, setPlansLoading] = useState(false);
    const [plansError, setPlansError] = useState<string | null>(null);

    // errors & ui
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // Stripe state
    const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
    const [stripeLoading, setStripeLoading] = useState(false);
    const [stripeSetupError, setStripeSetupError] = useState<string | null>(null);

    const stripePromise = useMemo(() => {
        const pk = process.env.NEXT_PUBLIC_STRIPE_PK;
        return pk ? loadStripe(pk) : null;
    }, []);

    const brandStyle: BrandStyle = { "--ml-primary": "#ea8a0a" };

    const selected = selectedPlanId != null ? details[selectedPlanId] : undefined;
    const requireCard = (selected?.monthlyPrice ?? 0) > 0;
    const selectedBullets = toFeatureBullets(selected?.features ?? null);

    // Default country
    useEffect(() => {
        const def = COUNTRIES.find((c) => c.name === "United States");
        setCountry(def ?? COUNTRIES[0]);
    }, []);

    // Load plans from backend
    useEffect(() => {
        let cancelled = false;
        async function loadPlans() {
            setPlansLoading(true);
            setPlansError(null);
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/plans-brief`, {
                    headers: { "Content-Type": "application/json" },
                });
                if (!res.ok) throw new Error(`Failed to load plans (${res.status})`);
                const items = (await res.json()) as PlanBrief[];
                if (cancelled) return;
                setBrief(items);
                if (items.length > 0) setSelectedPlanId(items[0].id);

                const pairs = await Promise.all(
                    items.map(async (p) => {
                        const r = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/plans-id/${p.id}`, {
                            headers: { "Content-Type": "application/json" },
                        });
                        if (!r.ok) throw new Error(`Failed to load plan ${p.id} (${r.status})`);
                        const d = (await r.json()) as PlanDetail;
                        return [p.id, d] as const;
                    })
                );
                if (cancelled) return;
                setDetails(Object.fromEntries(pairs));
            } catch (e) {
                if (!cancelled) setPlansError(e instanceof Error ? e.message : "Failed to load plans.");
            } finally {
                if (!cancelled) setPlansLoading(false);
            }
        }
        loadPlans();
        return () => {
            cancelled = true;
        };
    }, []);

    // Fetch/Create SetupIntent when a paid plan is selected
    useEffect(() => {
        let cancel = false;
        (async () => {
            setStripeSetupError(null);
            if (!requireCard) {
                setStripeClientSecret(null);
                return;
            }
            if (!process.env.NEXT_PUBLIC_STRIPE_PK) {
                setStripeSetupError("Payments unavailable (missing Stripe publishable key).");
                return;
            }
            if (!selectedPlanId) return;

            try {
                setStripeLoading(true);
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/billing/create-setup-intent?plan_id=${selectedPlanId}`,
                    { method: "POST", headers: { "Content-Type": "application/json" } }
                );
                if (!res.ok) throw new Error(`Cannot initialize payment (${res.status})`);
                const { clientSecret } = (await res.json()) as { clientSecret: string };
                if (!cancel) setStripeClientSecret(clientSecret);
            } catch (e) {
                if (!cancel) setStripeSetupError(e instanceof Error ? e.message : "Failed to set up payment.");
            } finally {
                if (!cancel) setStripeLoading(false);
            }
        })();
        return () => {
            cancel = true;
        };
    }, [requireCard, selectedPlanId]);

    // Filtered list for country combobox
    const filteredCountries = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return COUNTRIES;
        return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
    }, [query]);

    // Password score
    const passScore = useMemo(() => {
        let s = 0;
        if (password.length >= 10) s++;
        if (/[a-z]/.test(password)) s++;
        if (/[A-Z]/.test(password)) s++;
        if (/\d/.test(password)) s++;
        if (/[^A-Za-z0-9]/.test(password)) s++;
        return Math.min(s, 4);
    }, [password]);

    /* ---------------------------- validation ---------------------------- */
    function validate(): boolean {
        const errs: Record<string, string> = {};
        if (!fullName.trim()) errs.fullName = "Please enter your full name.";
        if (!company.trim()) errs.company = "Please enter your company.";
        if (!country) errs.country = "Please pick your country.";
        if (selectedPlanId == null) errs.plan = "Please choose a plan.";
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = "Enter a valid email address.";
        if (!password || passScore < 3) errs.password = "Use at least 10 chars with upper, lower, number, symbol.";
        if (!agree) errs.agree = "You must agree to the Terms and Privacy Policy.";
        if (requireCard) {
            if (!stripePromise) errs.payment = "Payments unavailable right now.";
            if (!stripeClientSecret) errs.payment = "Initializing payment…";
            if (stripeSetupError) errs.payment = stripeSetupError;
        }
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    }

    /* ------------------------------ submit ------------------------------ */
    const stripeConfirmRef = useRef<StripePaymentHandle | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!validate()) return;

        setLoading(true);
        try {
            let paymentMethodId: string | null = null;

            if (requireCard) {
                if (!stripeConfirmRef.current) {
                    throw new Error("Payment form not ready. Please try again.");
                }
                // Confirm the SetupIntent and get PM id
                paymentMethodId = await stripeConfirmRef.current();
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: fullName,
                    company,
                    country: country?.name,
                    country_code: country?.code,
                    email,
                    password,
                    plan_id: selectedPlanId,
                    // backend will create customer/subscription with 30-day trial & default PM
                    stripe_payment_method: paymentMethodId,
                    marketing_opt_in: !!newsOptIn,
                }),
            });

            const data = (await res.json().catch(() => ({}))) as ApiError;

            if (res.status === 201) {
                router.push("/login?registered=1");
            } else {
                throw new Error((typeof data.message === "string" && data.message) || "Registration failed. Please try again.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unexpected error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    /* ------------------------------ UI ---------------------------------- */
    return (
        <div className="min-h-svh w-full bg-neutral-50" style={brandStyle}>
            {/* Constrained, asymmetric grid: right column fixed, left grows */}
            <div
                className="
          mx-auto min-h-svh grid
          lg:max-w-[1400px] lg:grid-cols-[minmax(0,1fr)_minmax(480px,560px)] lg:gap-x-12
          xl:max-w-[1600px] xl:grid-cols-[minmax(0,1.1fr)_minmax(520px,620px)] xl:gap-x-16
          2xl:max-w-[1760px] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(560px,660px)] 2xl:gap-x-20
        "
            >
                {/* Left column (desktop only): brand + plan cards */}
                <aside className="hidden lg:flex flex-col justify-between lg:p-12 xl:p-16 relative overflow-hidden">
                    <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-orange-200/50 via-amber-100/60 to-white" />
                    <header className="flex items-center gap-3">
                        <Image src="/logo.svg" alt="MonkeysLegion" width={150} height={36} className="rounded-xl" />
                    </header>

                    <div className="max-w-xl">
                        <div className="mb-8">
                            <h1 className="text-4xl font-extrabold leading-tight">
                                Create your account
                                <span className="block text-[var(--ml-primary)]">Deploy faster. Pay less. Scale safely.</span>
                            </h1>
                            <ul className="mt-8 space-y-4 text-neutral-700">
                                <li className="flex gap-3">
                                    <span className="mt-1 inline-block size-2.5 rounded-full bg-[var(--ml-primary)]" />
                                    Git-native workflow with automated previews & zero-downtime deploys.
                                </li>
                                <li className="flex gap-3">
                                    <span className="mt-1 inline-block size-2.5 rounded-full bg-[var(--ml-primary)]" />
                                    Built-in observability, webhooks queue, and idempotency guards.
                                </li>
                                <li className="flex gap-3">
                                    <span className="mt-1 inline-block size-2.5 rounded-full bg-[var(--ml-primary)]" />
                                    Enterprise-ready auth, RBAC, and secrets management.
                                </li>
                            </ul>
                        </div>

                        <section>
                            <h3 className="text-sm font-semibold text-neutral-700">Choose a plan</h3>

                            {plansError && (
                                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{plansError}</div>
                            )}

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {plansLoading &&
                                    Array.from({ length: 2 }).map((_, i) => (
                                        <div key={i} className="rounded-2xl border border-neutral-200 p-4 animate-pulse">
                                            <div className="h-5 w-24 bg-neutral-200 rounded mb-3" />
                                            <div className="h-8 w-32 bg-neutral-200 rounded mb-4" />
                                            <div className="space-y-2">
                                                <div className="h-3 w-5/6 bg-neutral-200 rounded" />
                                                <div className="h-3 w-2/3 bg-neutral-200 rounded" />
                                                <div className="h-3 w-4/5 bg-neutral-200 rounded" />
                                            </div>
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
                                                    isSelected ? "border-[var(--ml-primary)] ring-[var(--ml-primary)]/30 bg-orange-50/40" : "border-neutral-200 hover:border-neutral-300"
                                                }`}
                                            >
                                                {isSelected && (
                                                    <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-[var(--ml-primary)] px-2 py-0.5 text-[10px] font-semibold text-white">
                            Selected
                          </span>
                                                )}
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm font-semibold text-neutral-800">{p.name}</div>
                                                        <div className="mt-1 text-2xl font-extrabold">
                                                            {d ? formatMoney(d.monthlyPrice) : "—"}<span className="text-sm font-semibold text-neutral-500"> /mo</span>
                                                        </div>
                                                        <div className="mt-1 text-xs text-neutral-600">
                                                            Includes {d ? formatMessages(d.includedMessages) : "—"} messages • Avg ${d?.averagePricePer1K ?? "—"}/1k
                                                        </div>
                                                    </div>
                                                    <div aria-hidden className={`mt-1 size-5 rounded-full border ${isSelected ? "border-[var(--ml-primary)] bg-[var(--ml-primary)]" : "border-neutral-300"}`} />
                                                </div>
                                            </button>
                                        );
                                    })}
                            </div>

                            {selected && (
                                <div className="mt-4 rounded-2xl border border-neutral-200 bg-white/70 p-4">
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
                                                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--ml-primary)]/70" />
                                                    <span>{f}</span>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="text-neutral-500">No feature details.</li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            {fieldErrors.plan && <p className="mt-2 text-xs text-red-600">{fieldErrors.plan}</p>}
                        </section>
                    </div>

                    <footer className="text-xs text-neutral-500">© {new Date().getFullYear()} MonkeysLegion. All rights reserved.</footer>
                </aside>

                {/* Right column – includes MOBILE plan cards + form */}
                {/* Center on mobile, left-align on md+ so there's whitespace on tablets; fixed column on lg+ */}
                <main className="flex items-center justify-center md:justify-start p-6 sm:p-10">
                    <div className="w-full">
                        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-neutral-100">
                            {/* Mobile header */}
                            <div className="flex items-center gap-3 mb-4 lg:hidden">
                                <Image src="/logo.svg" alt="MonkeysLegion" width={150} height={28} className="rounded-lg" />
                            </div>

                            {/* MOBILE-ONLY plan cards (brand text hidden on mobile) */}
                            <section className="lg:hidden">
                                <h3 className="text-sm font-semibold text-neutral-700">Choose a plan</h3>

                                {plansError && (
                                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{plansError}</div>
                                )}

                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {plansLoading &&
                                        Array.from({ length: 2 }).map((_, i) => (
                                            <div key={i} className="rounded-2xl border border-neutral-200 p-4 animate-pulse">
                                                <div className="h-5 w-24 bg-neutral-200 rounded mb-3" />
                                                <div className="h-8 w-32 bg-neutral-200 rounded mb-4" />
                                                <div className="space-y-2">
                                                    <div className="h-3 w-5/6 bg-neutral-200 rounded" />
                                                    <div className="h-3 w-2/3 bg-neutral-200 rounded" />
                                                    <div className="h-3 w-4/5 bg-neutral-200 rounded" />
                                                </div>
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
                                                        isSelected ? "border-[var(--ml-primary)] ring-[var(--ml-primary)]/30 bg-orange-50/40" : "border-neutral-200 hover:border-neutral-300"
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-[var(--ml-primary)] px-2 py-0.5 text-[10px] font-semibold text-white">
                              Selected
                            </span>
                                                    )}
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-sm font-semibold text-neutral-800">{p.name}</div>
                                                            <div className="mt-1 text-2xl font-extrabold">
                                                                {d ? formatMoney(d.monthlyPrice) : "—"}<span className="text-sm font-semibold text-neutral-500"> /mo</span>
                                                            </div>
                                                            <div className="mt-1 text-xs text-neutral-600">
                                                                Includes {d ? formatMessages(d.includedMessages) : "—"} messages • Avg ${d?.averagePricePer1K ?? "—"}/1k
                                                            </div>
                                                        </div>
                                                        <div aria-hidden className={`mt-1 size-5 rounded-full border ${isSelected ? "border-[var(--ml-primary)] bg-[var(--ml-primary)]" : "border-neutral-300"}`} />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                </div>

                                {/* Selected plan full features (mobile collapsible) */}
                                {selected && (
                                    <details className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 open:bg-white p-4">
                                        <summary className="cursor-pointer list-none">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="text-sm font-semibold text-neutral-800">Selected: {selected.name}</div>
                                                <div className="text-sm text-neutral-700">
                                                    {formatMoney(selected.monthlyPrice)} /mo • {formatMessages(selected.includedMessages)} messages
                                                </div>
                                            </div>
                                            <div className="mt-1 text-xs text-neutral-500">Tap to view features</div>
                                        </summary>
                                        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-neutral-700">
                                            {selectedBullets.length > 0 ? (
                                                selectedBullets.map((f, i) => (
                                                    <li key={i} className="flex gap-2">
                                                        <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--ml-primary)]/70" />
                                                        <span>{f}</span>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="text-neutral-500">No feature details.</li>
                                            )}
                                        </ul>
                                    </details>
                                )}

                                {fieldErrors.plan && <p className="mt-2 text-xs text-red-600">{fieldErrors.plan}</p>}
                            </section>

                            {/* Form header */}
                            <h2 className="mt-6 text-2xl font-bold tracking-tight">Start free</h2>
                            <p className="mt-1 text-sm text-neutral-600">30-day trial · Cancel anytime · GDPR compliant</p>

                            {error && (
                                <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
                            )}

                            {/* Form (single column) */}
                            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                                {/* Full name */}
                                <div>
                                    <label htmlFor="fullName" className="block text-sm font-medium">Full name</label>
                                    <input
                                        id="fullName"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className={`mt-1 w-full rounded-xl border px-3 py-2 outline-none transition focus:ring-2 ${
                                            fieldErrors.fullName ? "border-red-300 ring-red-200" : "border-neutral-300 focus:ring-[var(--ml-primary)]/30"
                                        }`}
                                        placeholder="Full Name"
                                        autoComplete="name"
                                    />
                                    {fieldErrors.fullName && <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>}
                                </div>

                                {/* Company */}
                                <div>
                                    <label htmlFor="company" className="block text-sm font-medium">Company</label>
                                    <input
                                        id="company"
                                        value={company}
                                        onChange={(e) => setCompany(e.target.value)}
                                        className={`mt-1 w-full rounded-xl border px-3 py-2 outline-none transition focus:ring-2 ${
                                            fieldErrors.company ? "border-red-300 ring-red-200" : "border-neutral-300 focus:ring-[var(--ml-primary)]/30"
                                        }`}
                                        placeholder="Company Name"
                                        autoComplete="organization"
                                    />
                                    {fieldErrors.company && <p className="mt-1 text-xs text-red-600">{fieldErrors.company}</p>}
                                </div>

                                {/* Country */}
                                <div>
                                    <label htmlFor="country" className="block text-sm font-medium">Country</label>
                                    <Combobox value={country} onChange={setCountry} nullable>
                                        <div className="relative mt-1">
                                            <Combobox.Input
                                                id="country"
                                                displayValue={(c: CountryOption | null) => c?.name ?? ""}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder="Search country…"
                                                className={`w-full rounded-xl border px-3 py-2 outline-none transition focus:ring-2 ${
                                                    fieldErrors.country ? "border-red-300 ring-red-200" : "border-neutral-300 focus:ring-[var(--ml-primary)]/30"
                                                }`}
                                            />
                                            <Combobox.Button className="absolute inset-y-0 right-2 my-auto text-neutral-500 text-sm">▼</Combobox.Button>
                                            <Transition
                                                as={Fragment}
                                                leave="transition ease-in duration-100"
                                                leaveFrom="opacity-100"
                                                leaveTo="opacity-0"
                                                afterLeave={() => setQuery("")}
                                            >
                                                <Combobox.Options className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/5">
                                                    {filteredCountries.length === 0 ? (
                                                        <div className="px-3 py-2 text-sm text-neutral-600">No results</div>
                                                    ) : (
                                                        filteredCountries.map((c) => (
                                                            <Combobox.Option
                                                                key={c.code}
                                                                value={c}
                                                                className={({ active }) =>
                                                                    `cursor-pointer select-none rounded-lg px-3 py-2 text-sm ${
                                                                        active ? "bg-orange-50 text-neutral-900" : "text-neutral-800"
                                                                    }`
                                                                }
                                                            >
                                                                {({ selected }) => (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ml-primary)]/70" />
                                                                        <span className={selected ? "font-medium" : ""}>{c.name}</span>
                                                                    </div>
                                                                )}
                                                            </Combobox.Option>
                                                        ))
                                                    )}
                                                </Combobox.Options>
                                            </Transition>
                                        </div>
                                    </Combobox>
                                    {fieldErrors.country && <p className="mt-1 text-xs text-red-600">{fieldErrors.country}</p>}
                                </div>

                                {/* Email */}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium">Work email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={`mt-1 w-full rounded-xl border px-3 py-2 outline-none transition focus:ring-2 ${
                                            fieldErrors.email ? "border-red-300 ring-red-200" : "border-neutral-300 focus:ring-[var(--ml-primary)]/30"
                                        }`}
                                        placeholder="you@company.com"
                                        autoComplete="email"
                                    />
                                    {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
                                </div>

                                {/* Password + strength */}
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium">Password</label>
                                    <div className="relative">
                                        <input
                                            id="password"
                                            type={showPass ? "text" : "password"}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className={`mt-1 w-full rounded-xl border px-3 py-2 pr-12 outline-none transition focus:ring-2 ${
                                                fieldErrors.password ? "border-red-300 ring-red-200" : "border-neutral-300 focus:ring-[var(--ml-primary)]/30"
                                            }`}
                                            placeholder="At least 10 characters"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPass((s) => !s)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                                            aria-label={showPass ? "Hide password" : "Show password"}
                                        >
                                            {showPass ? "Hide" : "Show"}
                                        </button>
                                    </div>

                                    <div className="mt-2">
                                        <div className="flex gap-1">
                                            {[0, 1, 2, 3].map((i) => (
                                                <div key={i} className={`h-1 w-full rounded ${passScore > i ? "bg-[var(--ml-primary)]" : "bg-neutral-200"}`} />
                                            ))}
                                        </div>
                                        <div className="mt-1 text-xs text-neutral-500">Use upper & lower case, number, and a symbol. Minimum 10 characters.</div>
                                    </div>
                                    {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
                                </div>

                                {/* Stripe Payment (only for paid plans) */}
                                {requireCard && (
                                    <div>
                                        <label className="block text-sm font-medium">Payment method</label>
                                        {stripeSetupError && <p className="mt-2 text-xs text-red-600">{stripeSetupError}</p>}
                                        {stripeLoading && (
                                            <div className="mt-2 rounded-xl border border-neutral-200 p-4 animate-pulse">
                                                <div className="h-4 w-40 bg-neutral-200 rounded" />
                                                <div className="mt-3 h-9 w-full bg-neutral-200 rounded" />
                                            </div>
                                        )}
                                        {!stripeLoading && stripePromise && stripeClientSecret && (
                                            <Elements
                                                stripe={stripePromise}
                                                options={{
                                                    clientSecret: stripeClientSecret,
                                                    appearance: { theme: "stripe" },
                                                }}
                                            >
                                                <StripePayment
                                                    ref={stripeConfirmRef}
                                                    note="Your card will be saved now and automatically charged after your 30-day trial unless you cancel."
                                                />
                                            </Elements>
                                        )}
                                        {fieldErrors.payment && <p className="mt-2 text-xs text-red-600">{fieldErrors.payment}</p>}
                                    </div>
                                )}

                                {/* Consent */}
                                <div className="space-y-3">
                                    <label className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={agree}
                                            onChange={(e) => setAgree(e.target.checked)}
                                            className="mt-1 size-4 rounded border-neutral-300 text-[var(--ml-primary)] focus:ring-[var(--ml-primary)]"
                                        />
                                        <span className="text-sm text-neutral-700">
                      I agree to the{" "}
                                            <a href="/legal/terms" className="text-[var(--ml-primary)] hover:underline">Terms of Service</a>{" "}
                                            and{" "}
                                            <a href="/legal/privacy" className="text-[var(--ml-primary)] hover:underline">Privacy Policy</a>.
                    </span>
                                    </label>
                                    <label className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={newsOptIn}
                                            onChange={(e) => setNewsOptIn(e.target.checked)}
                                            className="mt-1 size-4 rounded border-neutral-300 text-[var(--ml-primary)] focus:ring-[var(--ml-primary)]"
                                        />
                                        <span className="text-sm text-neutral-700">Send me product updates and best practices (optional).</span>
                                    </label>
                                    {fieldErrors.agree && <p className="text-xs text-red-600">{fieldErrors.agree}</p>}
                                </div>

                                {/* Submit */}
                                <div>
                                    <button
                                        type="submit"
                                        disabled={loading || (requireCard && (!stripeClientSecret || !!stripeSetupError))}
                                        className="group relative inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ml-primary)] px-4 py-2.5 font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
                                    >
                                        {loading ? "Creating your account…" : "Create account"}
                                        <span aria-hidden className="transition -translate-x-0 group-hover:translate-x-0.5">→</span>
                                    </button>

                                    <p className="mt-3 text-center text-sm text-neutral-600">
                                        Already have an account?{" "}
                                        <a href="/login" className="text-[var(--ml-primary)] hover:underline">Log in</a>
                                    </p>
                                </div>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
