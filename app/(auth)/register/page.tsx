"use client";

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
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    CreditCardIcon,
    ArrowPathIcon,
    SparklesIcon,
    ShieldCheckIcon,
    BoltIcon,
    RocketLaunchIcon,
} from "@heroicons/react/24/outline";

/* ------------------------------- Types ---------------------------------- */

type ApiError = { message?: string } & Record<string, unknown>;
type CountryOption = { code: string; name: string };
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
    if (n === null) return "Custom";
    if (n === 0) return "Free";
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(n);
}

/** 4500 -> 4.5k, 10000 -> 10k, <1000 stays number */
function formatMessages(n: number | null): string {
    if (n === null) return "Unlimited";
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
        if (q.emailsPerMonth != null) bullets.push(`${new Intl.NumberFormat().format(q.emailsPerMonth)} emails/month`);
        if (q.emailsPerDay != null) bullets.push(`${new Intl.NumberFormat().format(q.emailsPerDay)} emails/day`);
        if (q.apiKeys != null) bullets.push(`${q.apiKeys} API keys`);
        if (q.inboundRoutes != null) bullets.push(`${q.inboundRoutes} inbound routes`);
        if (q.logRetentionDays != null) bullets.push(`${q.logRetentionDays} days log retention`);
        if (q.emailValidationsIncluded != null) bullets.push(`${q.emailValidationsIncluded} validations included`);
        if (q.sendingDomains) {
            const inc = q.sendingDomains.included ?? null;
            if (inc != null) bullets.push(`${inc} sending domains included`);
        }
    }

    if (f.pricing?.overagePer1K != null) {
        bullets.push(f.pricing.overagePer1K > 0 ? `$${f.pricing.overagePer1K}/1k overage` : "No overage charges");
    }

    if (f.support?.tier) bullets.push(`${title(String(f.support.tier))} support`);

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
        <div className="rounded-2xl bg-white/50 backdrop-blur-sm ring-1 ring-blue-200/50 p-4">
            <PaymentElement options={{ layout: "accordion" }} />
            {note && <p className="mt-2 text-xs text-blue-600">{note}</p>}
            {localError && <p className="mt-2 text-xs text-red-600">{localError}</p>}
        </div>
    );
});

/* ------------------------------ Component ------------------------------- */

export default function RegisterPage() {
    const router = useRouter();

    // 2-Step form state
    const [currentStep, setCurrentStep] = useState<'info' | 'payment'>('info');
    const [formData, setFormData] = useState<{
        fullName: string;
        company: string;
        country: CountryOption | null;
        email: string;
        password: string;
        planId: number;
        agree: boolean;
        newsOptIn: boolean;
    } | null>(null);

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
    const defaultPickDone = useRef(false);

    // errors & ui
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Stripe state
    const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
    const [stripeLoading, setStripeLoading] = useState(false);
    const [stripeSetupError, setStripeSetupError] = useState<string | null>(null);
    const stripeConfirmRef = useRef<StripePaymentHandle | null>(null);

    const stripePromise = useMemo(() => {
        const pk = process.env.NEXT_PUBLIC_STRIPE_PK;
        return pk ? loadStripe(pk) : null;
    }, []);

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

                // Default to most popular plan (3rd, then 2nd, then 1st)
                if (!defaultPickDone.current) {
                    const preferredId = items[2]?.id ?? items[1]?.id ?? items[0]?.id ?? null;
                    if (preferredId != null) setSelectedPlanId(preferredId);
                    defaultPickDone.current = true;
                }

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

    // Create SetupIntent only when moving to payment step
    useEffect(() => {
        let cancel = false;
        (async () => {
            setStripeSetupError(null);

            // Only create setup intent if we're on payment step and need a card
            if (currentStep !== 'payment' || !requireCard) {
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
    }, [currentStep, requireCard, selectedPlanId]);

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

    /* ----------------------------- Step 1: Initial form ----------------------------- */
    async function handleStep1Submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        // Validation
        if (!fullName.trim()) {
            setError("Please enter your full name.");
            return;
        }
        if (!company.trim()) {
            setError("Please enter your company.");
            return;
        }
        if (!country) {
            setError("Please select your country.");
            return;
        }
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            setError("Please enter a valid email address.");
            return;
        }
        if (!password || passScore < 3) {
            setError("Password must be at least 10 characters with upper, lower, number, and symbol.");
            return;
        }
        if (!agree) {
            setError("Please agree to our terms and privacy policy to continue.");
            return;
        }
        if (selectedPlanId == null) {
            setError("Please choose a plan.");
            return;
        }

        // Save form data
        setFormData({
            fullName,
            company,
            country,
            email,
            password,
            planId: selectedPlanId,
            agree,
            newsOptIn,
        });

        // If it's a free plan, register immediately
        if (!requireCard) {
            await handleRegistration(null);
        } else {
            // Move to payment step
            setCurrentStep('payment');
        }
    }

    /* ----------------------------- Step 2: Payment ----------------------------- */
    async function handleStep2Submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (!stripeConfirmRef.current) throw new Error("Payment form not ready.");
            const paymentMethodId = await stripeConfirmRef.current();
            await handleRegistration(paymentMethodId);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Payment confirmation failed.");
            setLoading(false);
        }
    }

    /* ----------------------------- Final Registration ----------------------------- */
    async function handleRegistration(paymentMethodId: string | null) {
        const data = formData || {
            fullName,
            company,
            country,
            email,
            password,
            planId: selectedPlanId!,
            agree,
            newsOptIn,
        };

        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.fullName,
                    company: data.company,
                    country: data.country?.name,
                    country_code: data.country?.code,
                    email: data.email,
                    password: data.password,
                    plan_id: data.planId,
                    stripe_payment_method: paymentMethodId,
                    marketing_opt_in: data.newsOptIn,
                }),
            });

            const responseData = (await res.json().catch(() => ({}))) as ApiError;
            if (res.status === 201) {
                router.push("/login?registered=1");
                return;
            }
            throw new Error((typeof responseData.message === "string" && responseData.message) || "Registration failed. Please try again.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    // Find most popular plan
    const mostPopularId = brief[2]?.id ?? brief[1]?.id ?? brief[0]?.id ?? -1;

    /* ------------------------------ UI ---------------------------------- */
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50">
            {/* Animated gradient mesh background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -left-40 -top-40 h-96 w-96 animate-blob rounded-full bg-blue-300/30 mix-blend-multiply blur-3xl" />
                <div className="animation-delay-2000 absolute -right-40 top-20 h-96 w-96 animate-blob rounded-full bg-cyan-300/30 mix-blend-multiply blur-3xl" />
                <div className="animation-delay-4000 absolute -bottom-40 left-40 h-96 w-96 animate-blob rounded-full bg-sky-300/30 mix-blend-multiply blur-3xl" />
                <div className="absolute right-40 bottom-20 h-96 w-96 animate-blob rounded-full bg-indigo-300/30 mix-blend-multiply blur-3xl" />
            </div>

            {/* Grid pattern overlay */}
            <div
                className="fixed inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(90deg, #000 1px, transparent 1px), linear-gradient(#000 1px, transparent 1px)`,
                    backgroundSize: '50px 50px'
                }}
            />

            {/* Constrained, asymmetric grid: right column fixed, left grows */}
            <div className="mx-auto min-h-screen grid lg:max-w-[1400px] lg:grid-cols-[minmax(0,1fr)_minmax(480px,560px)] lg:gap-x-12 xl:max-w-[1600px] xl:grid-cols-[minmax(0,1.1fr)_minmax(520px,620px)] xl:gap-x-16 2xl:max-w-[1760px] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(560px,660px)] 2xl:gap-x-20">

                {/* Left column (desktop only): brand + plan cards */}
                <aside className="hidden lg:flex flex-col justify-between lg:p-12 xl:p-16 relative overflow-hidden">
                    <header className="flex items-center gap-3">
                        <Image src="/logo.svg" alt="MonkeysLegion" width={160} height={38} className="rounded-xl" />
                    </header>

                    <div className="max-w-xl">
                        <div className="mb-8">
                            <h1 className="text-5xl font-black leading-tight">
                                <span className="text-blue-500">Deploy faster.</span>
                                <span className="block bg-gradient-to-br from-blue-900 via-blue-600 to-blue-600 bg-clip-text text-transparent">
                                    Pay less. Scale safely.
                                </span>
                            </h1>

                            {/* Feature pills */}
                            <div className="mt-8 flex flex-wrap gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 backdrop-blur-sm px-4 py-2 text-sm">
                                    <ShieldCheckIcon className="h-4 w-4 text-blue-600" />
                                    <span>Enterprise-ready Auth & RBAC</span>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 backdrop-blur-sm px-4 py-2 text-sm">
                                    <BoltIcon className="h-4 w-4 text-sky-600" />
                                    <span>Zero-downtime deploys</span>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 backdrop-blur-sm px-4 py-2 text-sm">
                                    <RocketLaunchIcon className="h-4 w-4 text-cyan-600" />
                                    <span>Git-native workflow</span>
                                </div>
                            </div>
                        </div>

                        <section>
                            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-100 to-sky-100 px-4 py-2 text-sm font-medium text-blue-900 mb-4">
                                <SparklesIcon className="h-4 w-4" />
                                Choose Your Plan
                            </div>

                            {plansError && (
                                <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{plansError}</div>
                            )}

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {plansLoading && [1, 2].map((i) => (
                                    <div key={i} className="animate-pulse">
                                        <div className="h-32 bg-blue-100 rounded-xl" />
                                    </div>
                                ))}

                                {!plansLoading && brief.map((plan) => {
                                    const d = details[plan.id];
                                    const isSelected = selectedPlanId === plan.id;
                                    const isPopular = plan.id === mostPopularId;
                                    const disabled = !d || d.monthlyPrice === null;

                                    return (
                                        <button
                                            key={plan.id}
                                            type="button"
                                            onClick={() => {
                                                if (!disabled) setSelectedPlanId(plan.id);
                                            }}
                                            disabled={disabled}
                                            className={`relative text-left rounded-xl border-2 p-4 transition-all transform hover:scale-105 ${
                                                isSelected
                                                    ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-sky-50 ring-2 ring-blue-500 shadow-lg'
                                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 bg-white/80 backdrop-blur-sm'
                                            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            {isPopular && !disabled && (
                                                <span className="absolute -top-3 right-4 bg-gradient-to-r from-blue-600 to-sky-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                                    MOST POPULAR 🌟
                                                </span>
                                            )}

                                            <div className="font-semibold text-gray-900">{plan.name}</div>
                                            <div className="mt-2 text-2xl font-bold bg-gradient-to-r from-blue-600 to-sky-600 bg-clip-text text-transparent">
                                                {formatMoney(d?.monthlyPrice ?? null)}
                                                {d?.monthlyPrice !== null && d?.monthlyPrice !== 0 && (
                                                    <span className="text-xs text-gray-500"> /month</span>
                                                )}
                                            </div>
                                            <div className="mt-1 text-sm text-gray-600">
                                                {d?.includedMessages != null && (
                                                    <span>{formatMessages(d.includedMessages)} emails/mo</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {selected && selectedBullets.length > 0 && (
                                <div className="mt-6 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg ring-1 ring-blue-200/50 p-6">
                                    <h3 className="font-semibold text-gray-900 mb-4">{selected.name} Features</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {selectedBullets.slice(0, 5).map((f, i) => (
                                            <div key={i} className="flex gap-3">
                                                <CheckCircleIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                                <span className="text-sm text-gray-700">{f}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    <footer className="text-xs text-gray-500">
                        © {new Date().getFullYear()} MonkeysLegion. All rights reserved.
                    </footer>
                </aside>

                {/* Right column - Form */}
                <main className="flex items-center justify-center md:justify-start p-6 sm:p-10">
                    <div className="w-full">
                        <div className="rounded-3xl bg-white/90 backdrop-blur-xl shadow-2xl ring-1 ring-blue-200/50 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-sky-600 px-6 py-4">
                                <div className="flex items-center gap-3 lg:hidden mb-2">
                                    <Image src="/logo.svg" alt="MonkeysLegion" width={140} height={32} className="rounded-lg" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">
                                    {currentStep === 'info' ? 'Start Your Free Trial' : 'Complete Your Registration'}
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {currentStep === 'info'
                                        ? '30-day trial • Cancel anytime • GDPR compliant'
                                        : 'Secure payment • Cancel anytime'}
                                </p>
                            </div>

                            {/* Step indicators */}
                            {requireCard && currentStep === 'payment' && (
                                <div className="px-6 pt-4">
                                    <div className="flex items-center justify-center">
                                        <div className="flex items-center">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white text-sm font-medium">
                                                ✓
                                            </div>
                                            <span className="ml-2 text-sm font-medium text-gray-900">Account Info</span>
                                        </div>
                                        <div className="mx-4 h-px w-12 bg-gray-300" />
                                        <div className="flex items-center">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-medium">
                                                2
                                            </div>
                                            <span className="ml-2 text-sm font-medium text-gray-900">Payment</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="p-6">
                                {/* MOBILE-ONLY plan selection */}
                                <section className="lg:hidden mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Choose Your Plan
                                    </label>

                                    <div className="space-y-2">
                                        {plansLoading ? (
                                            <div className="animate-pulse space-y-2">
                                                {[1, 2, 3].map((i) => (
                                                    <div key={i} className="h-16 bg-blue-100 rounded-xl" />
                                                ))}
                                            </div>
                                        ) : plansError ? (
                                            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                                                {plansError}
                                            </div>
                                        ) : (
                                            brief.map((plan) => {
                                                const d = details[plan.id];
                                                const isSelected = selectedPlanId === plan.id;
                                                const isPopular = plan.id === mostPopularId;
                                                const disabled = !d || d.monthlyPrice === null;

                                                return (
                                                    <button
                                                        key={plan.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (!disabled) setSelectedPlanId(plan.id);
                                                        }}
                                                        disabled={disabled}
                                                        className={`relative w-full text-left rounded-xl border-2 p-4 transition-all ${
                                                            isSelected
                                                                ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-sky-50 ring-2 ring-blue-500'
                                                                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                                        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer transform hover:scale-105'}`}
                                                    >
                                                        {isPopular && !disabled && (
                                                            <span className="absolute -top-3 right-4 bg-gradient-to-r from-blue-600 to-sky-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                                                MOST POPULAR 🌟
                                                            </span>
                                                        )}

                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <div className="font-semibold text-gray-900">{plan.name}</div>
                                                                <div className="text-sm text-gray-600">
                                                                    {d?.includedMessages != null && (
                                                                        <span>{formatMessages(d.includedMessages)} emails/mo</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-sky-600 bg-clip-text text-transparent">
                                                                    {formatMoney(d?.monthlyPrice ?? null)}
                                                                </div>
                                                                {d?.monthlyPrice !== null && d?.monthlyPrice !== 0 && (
                                                                    <div className="text-xs text-gray-500">per month</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </section>

                                {error && (
                                    <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                                        <p className="text-sm text-red-800">{error}</p>
                                    </div>
                                )}

                                {currentStep === 'info' ? (
                                    <form onSubmit={handleStep1Submit} className="space-y-4">
                                        {/* Step 1: Account Information */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                                                    Full Name *
                                                </label>
                                                <input
                                                    id="fullName"
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    className="w-full rounded-lg border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                    placeholder="John Doe"
                                                    autoComplete="name"
                                                />
                                            </div>

                                            <div>
                                                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                                                    Company *
                                                </label>
                                                <input
                                                    id="company"
                                                    value={company}
                                                    onChange={(e) => setCompany(e.target.value)}
                                                    className="w-full rounded-lg border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                    placeholder="Acme Inc."
                                                    autoComplete="organization"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                                                Country *
                                            </label>
                                            <Combobox value={country} onChange={setCountry} nullable>
                                                <div className="relative">
                                                    <Combobox.Input
                                                        id="country"
                                                        displayValue={(c: CountryOption | null) => c?.name ?? ""}
                                                        onChange={(e) => setQuery(e.target.value)}
                                                        placeholder="Select country..."
                                                        className="w-full rounded-lg border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
                                                    />
                                                    <Combobox.Button className="absolute inset-y-0 right-3 text-gray-400">
                                                        ▼
                                                    </Combobox.Button>
                                                    <Transition
                                                        as={Fragment}
                                                        leave="transition ease-in duration-100"
                                                        leaveFrom="opacity-100"
                                                        leaveTo="opacity-0"
                                                        afterLeave={() => setQuery("")}
                                                    >
                                                        <Combobox.Options className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-xl bg-white p-1 shadow-xl ring-1 ring-black/5">
                                                            {filteredCountries.length === 0 ? (
                                                                <div className="px-3 py-2 text-sm text-gray-600">No results</div>
                                                            ) : (
                                                                filteredCountries.map((c) => (
                                                                    <Combobox.Option
                                                                        key={c.code}
                                                                        value={c}
                                                                        className={({ active }) =>
                                                                            `cursor-pointer select-none rounded-lg px-3 py-2 text-sm ${
                                                                                active ? "bg-blue-50 text-gray-900" : "text-gray-800"
                                                                            }`
                                                                        }
                                                                    >
                                                                        {c.name}
                                                                    </Combobox.Option>
                                                                ))
                                                            )}
                                                        </Combobox.Options>
                                                    </Transition>
                                                </div>
                                            </Combobox>
                                        </div>

                                        <div>
                                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                                Work Email *
                                            </label>
                                            <input
                                                id="email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full rounded-lg border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                placeholder="john@company.com"
                                                autoComplete="email"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                                Password *
                                            </label>
                                            <div className="relative">
                                                <input
                                                    id="password"
                                                    type={showPass ? "text" : "password"}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="w-full rounded-lg border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-12"
                                                    placeholder="Min. 10 characters"
                                                    autoComplete="new-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPass(!showPass)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:text-blue-700"
                                                >
                                                    {showPass ? "Hide" : "Show"}
                                                </button>
                                            </div>
                                            <div className="mt-2">
                                                <div className="flex gap-1">
                                                    {[0, 1, 2, 3].map((i) => (
                                                        <div
                                                            key={i}
                                                            className={`h-1 flex-1 rounded-full transition-all ${
                                                                passScore > i
                                                                    ? 'bg-gradient-to-r from-blue-400 to-sky-400'
                                                                    : 'bg-gray-200'
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={agree}
                                                    onChange={(e) => setAgree(e.target.checked)}
                                                    className="mt-0.5 rounded border-blue-300 text-blue-500 focus:ring-blue-500"
                                                />
                                                <span className="text-xs text-gray-600">
                                                    I agree to the{' '}
                                                    <a href="https://monkeysmail.com/terms" target="_blank" className="text-blue-600 hover:underline">
                                                            Terms of Service
                                                        </a>{' '}
                                                    and{' '}
                                                    <a href="https://monkeysmail.com/privacy" target="_blank" className="text-blue-600 hover:underline">
                                                            Privacy Policy
                                                        </a>
                                                </span>
                                            </label>
                                            <label className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={newsOptIn}
                                                    onChange={(e) => setNewsOptIn(e.target.checked)}
                                                    className="mt-0.5 rounded border-blue-300 text-blue-500 focus:ring-blue-500"
                                                />
                                                <span className="text-xs text-gray-600">
                                                    Send me product updates and tips
                                                </span>
                                            </label>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:from-blue-700 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                                        >
                                            {loading ? (
                                                <>
                                                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    {requireCard ? 'Start Free Trial' : 'Start Free Trial'}
                                                    <span className="transition-transform group-hover:translate-x-1">
                                                            🚀
                                                        </span>
                                                </>
                                            )}
                                        </button>
                                    </form>
                                ) : (
                                    <form onSubmit={handleStep2Submit} className="space-y-4">
                                        {/* Step 2: Payment Information */}

                                        {/* Show selected plan summary */}
                                        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium text-gray-900">
                                                        {selected?.name} Plan
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        {formatMessages(selected?.includedMessages ?? null)} emails/month
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xl font-bold text-blue-600">
                                                        {formatMoney(selected?.monthlyPrice ?? null)}/mo
                                                    </div>
                                                    <div className="text-xs text-gray-500">after 30-day trial</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Account summary */}
                                        <div className="rounded-lg bg-gray-50 p-4 space-y-2">
                                            <h3 className="font-medium text-gray-900 mb-2">Account Information</h3>
                                            <div className="text-sm text-gray-600 space-y-1">
                                                <div><span className="font-medium">Name:</span> {formData?.fullName}</div>
                                                <div><span className="font-medium">Company:</span> {formData?.company}</div>
                                                <div><span className="font-medium">Country:</span> {formData?.country?.name}</div>
                                                <div><span className="font-medium">Email:</span> {formData?.email}</div>
                                            </div>
                                        </div>

                                        {/* Stripe Payment */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                <CreditCardIcon className="inline h-4 w-4 mr-1" />
                                                Payment Method
                                            </label>
                                            {stripeSetupError && (
                                                <div className="mb-2 text-sm text-red-600">{stripeSetupError}</div>
                                            )}
                                            {stripeLoading && (
                                                <div className="animate-pulse">
                                                    <div className="h-20 bg-blue-100 rounded-xl" />
                                                </div>
                                            )}
                                            {!stripeLoading && stripePromise && stripeClientSecret && (
                                                <Elements
                                                    stripe={stripePromise}
                                                    options={{ clientSecret: stripeClientSecret, appearance: { theme: 'stripe' } }}
                                                >
                                                    <StripePayment
                                                        ref={stripeConfirmRef}
                                                        note="Your card will be saved securely and charged after your 30-day free trial"
                                                    />
                                                </Elements>
                                            )}
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCurrentStep('info');
                                                    setError(null);
                                                }}
                                                disabled={loading}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                <ArrowLeftIcon className="h-4 w-4" />
                                                Back
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={loading || !stripeClientSecret || !!stripeSetupError}
                                                className="group flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:from-blue-700 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                                            >
                                                {loading ? (
                                                    <>
                                                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                                        Creating Account...
                                                    </>
                                                ) : (
                                                    <>
                                                        Complete Registration
                                                        <CheckCircleIcon className="h-5 w-5 transition-transform group-hover:scale-110" />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                <p className="mt-4 text-center text-sm text-gray-600">
                                    Already have an account?{' '}
                                    <a href="/login" className="font-medium text-blue-600 hover:text-blue-700">
                                        Sign in
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Custom CSS for animations */}
            <style jsx>{`
                @keyframes blob {
                    0%, 100% {
                        transform: translate(0, 0) scale(1);
                    }
                    33% {
                        transform: translate(30px, -50px) scale(1.1);
                    }
                    66% {
                        transform: translate(-20px, 20px) scale(0.9);
                    }
                }

                .animate-blob {
                    animation: blob 7s infinite;
                }

                .animation-delay-2000 {
                    animation-delay: 2s;
                }

                .animation-delay-4000 {
                    animation-delay: 4s;
                }
            `}</style>
        </div>
    );
}