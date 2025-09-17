'use client';

import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import {
    ChartBarIcon,
    CodeBracketIcon,
    EyeIcon,
    EyeSlashIcon,
    InboxArrowDownIcon,
    CheckCircleIcon,
    PaperAirplaneIcon,
    BeakerIcon,
    ServerStackIcon,
    ArrowPathIcon,
    SparklesIcon,
    RocketLaunchIcon, BoltIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';

/* ========================= Types (match backend) ========================= */

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

type PlanBrief = {
    id: number;
    name: string;
};

type PlanDetail = {
    id: number;
    name: string;
    monthlyPrice: number | null;
    includedMessages: number | null;
    averagePricePer1K: number | null;
    features: PlanFeatures | string[] | null;
};

type ApiError = { message?: string } & Record<string, unknown>;

/* =============================== Helpers ================================ */

function formatMoney(n: number | null): string {
    if (n === null) return 'Custom';
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(n);
}

function formatMessages(n: number | null): string {
    if (n === null) return 'Unlimited';
    if (n >= 1000) {
        const thousands = n / 1000;
        const isWhole = n % 1000 === 0;
        return `${isWhole ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
    }
    return new Intl.NumberFormat().format(n);
}

/* ====================== Stripe child & integration ====================== */

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
        <div className="rounded-2xl bg-white/50 backdrop-blur-sm ring-1 ring-blue-200/50 p-4">
            <PaymentElement options={{ layout: 'accordion' }} />
            {note && <p className="mt-2 text-xs text-blue-600">{note}</p>}
            {localError && <p className="mt-2 text-xs text-red-600">{localError}</p>}
        </div>
    );
});

/* =============================== Component ============================== */

export default function MonkeysMailLanding() {
    const router = useRouter();

    // Plans state (dynamic)
    const [brief, setBrief] = useState<PlanBrief[]>([]);
    const [details, setDetails] = useState<Record<number, PlanDetail>>({});
    const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
    const [plansLoading, setPlansLoading] = useState(false);
    const [plansError, setPlansError] = useState<string | null>(null);

    // Registration form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [company, setCompany] = useState('');
    const [fullName, setFullName] = useState('');
    const [agree, setAgree] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [marketingOptIn, setMarketingOptIn] = useState(true);

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

    // Stripe state
    const stripePromise = useMemo(() => {
        const pk = process.env.NEXT_PUBLIC_STRIPE_PK;
        return pk ? loadStripe(pk) : null;
    }, []);
    const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
    const [stripeLoading, setStripeLoading] = useState(false);
    const [stripeSetupError, setStripeSetupError] = useState<string | null>(null);
    const stripeConfirmRef = useRef<StripePaymentHandle | null>(null);

    const selected = selectedPlanId != null ? details[selectedPlanId] : undefined;
    const requireCard = (selected?.monthlyPrice ?? 0) > 0;

    /* -------------------------- Load plans (dynamic) -------------------------- */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setPlansLoading(true);
            setPlansError(null);
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/plans-brief`, {
                    headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) throw new Error(`Failed to load plans (${res.status})`);
                const items = (await res.json()) as PlanBrief[];
                if (cancelled) return;
                setBrief(items);
                if (items.length > 1) setSelectedPlanId(items[2].id); else if (items.length > 0) setSelectedPlanId(items[0].id);

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
    }, []);

    /* -------- Create SetupIntent when a paid plan is chosen (Stripe) -------- */
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
        return () => {
            cancel = true;
        };
    }, [requireCard, selectedPlanId]);

    /* ----------------------------- Registration ----------------------------- */
    async function handleRegistration() {
        setError(null);

        if (!fullName || !company || !email || !password) {
            setError('Please fill in all required fields.');
            return;
        }
        if (!agree) {
            setError('Please agree to our terms and privacy policy to continue.');
            return;
        }
        if (passScore < 3) {
            setError('Password must be at least 10 characters with upper, lower, number, and symbol.');
            return;
        }
        if (selectedPlanId == null) {
            setError('Please choose a plan.');
            return;
        }

        setLoading(true);
        try {
            let paymentMethodId: string | null = null;

            if (requireCard) {
                if (!stripeConfirmRef.current) throw new Error('Payment form not ready.');
                paymentMethodId = await stripeConfirmRef.current();
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: fullName,
                    company,
                    email,
                    password,
                    plan_id: selectedPlanId,
                    stripe_payment_method: paymentMethodId,
                    marketing_opt_in: marketingOptIn,
                }),
            });

            const data = (await res.json().catch(() => ({}))) as ApiError;
            if (res.status === 201) {
                router.push('/login?registered=1');
                return;
            }
            throw new Error((typeof data.message === 'string' && data.message) || 'Registration failed. Please try again.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }

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

            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-purple-200/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Image src="/logo.svg" alt="MonkeysLegion" width={160} height={38} className="rounded-xl" />
                            </div>
                            <div className="hidden md:block h-6 w-px bg-blue-300" />
                            <span className="hidden md:inline-block text-sm text-blue-700">
                               The Email API for Developers
                            </span>
                        </div>
                        <nav className="hidden md:flex items-center gap-2">
                            <a href="#features" className="px-4 py-2 text-sm font-medium text-blue-700 hover:text-blue-900 rounded-lg hover:bg-blue-100/50 transition-all">
                                Features
                            </a>
                            <a href="#pricing" className="px-4 py-2 text-sm font-medium text-blue-700 hover:text-blue-900 rounded-lg hover:bg-blue-100/50 transition-all">
                                Pricing
                            </a>
                            <a href="/login" className="px-4 py-2 text-sm font-medium text-blue-700 hover:text-blue-900 rounded-lg hover:bg-blue-100/50 transition-all">
                                Sign In
                            </a>
                            <a href="#signup" className="ml-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-600 rounded-lg hover:from-blue-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105">
                                Get Started ✨
                            </a>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section id="hero" className="relative overflow-hidden pt-12 pb-20">
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-12">
                        {/* Left Content */}
                        <div className="relative z-10">
                            {/* Animated badge */}
                            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 px-4 py-2 shadow-sm mb-8">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                </span>
                                <span className="text-sm font-medium text-blue-900">Trusted by 10,000+ developers</span>
                            </div>

                            <h1 className="relative">
                                <span className="block text-5xl lg:text-7xl font-black leading-tight text-blue-500">
                                    Email Infrastructure
                                </span>
                                <span className="block bg-gradient-to-br from-blue-900 via-blue-600 to-blue-600 bg-clip-text text-5xl lg:text-7xl font-black leading-tight text-transparent">
                                    That Scales With You
                                </span>
                                {/* Decorative underline */}
                                <svg className="absolute -bottom-2 left-0 w-48" height="8" viewBox="0 0 200 8">
                                    <path
                                        d="M0 4 Q50 0 100 4 T200 4"
                                        stroke="url(#blueGradient)"
                                        strokeWidth="3"
                                        fill="none"
                                        strokeLinecap="round"
                                        className="animate-draw"
                                    />
                                    <defs>
                                        <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#60a5fa" /> {/* blue-400 */}
                                            <stop offset="100%" stopColor="#2563eb" /> {/* blue-600 */}
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </h1>

                            <p className="mt-6 text-xl text-slate-700 leading-relaxed">
                                Send transactional and marketing emails at scale. Built for developers, trusted by enterprises. Start with 4,500 free emails per month.
                            </p>

                            {/* Feature pills */}
                            <div className="mt-8 flex flex-wrap gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-sm backdrop-blur-sm">
                                    <span className="text-blue-600">✓</span>
                                    <span>Developer-First Email API</span>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm backdrop-blur-sm">
                                    <span className="text-sky-600">✓</span>
                                    <span>99.99% Uptime SLA</span>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-4 py-2 text-sm backdrop-blur-sm">
                                    <span className="text-cyan-600">✓</span>
                                    <span>Webhooks & Real-Time Analytics</span>
                                </div>
                            </div>

                            {/* Trust indicators */}
                            <div className="mt-10 flex items-center gap-6 text-sm text-slate-600">
                                <div className="flex items-center gap-2">
                                    <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
                                    <span>DKIM, SPF & DMARC ready</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ServerStackIcon className="h-4 w-4 text-blue-600" />
                                    <span>SMTP & REST API</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <BoltIcon className="h-4 w-4 text-sky-600" />
                                    <span>Sub-100ms API latency</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Signup Form with floating effect */}
                        <div
                            id="signup"
                            className="relative lg:ml-auto w-full max-w-md"
                        >
                            {/* Floating badges */}
                            <div className="absolute -right-4 -top-4 animate-float rounded-2xl bg-gradient-to-r from-green-400 to-green-600 px-4 py-2 text-sm font-bold text-white shadow-xl z-10">
                                ✨ 30 Days Free
                            </div>

                            <div className="rounded-3xl bg-white/90 backdrop-blur-xl shadow-2xl ring-1 ring-blue-200/50 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-600 to-sky-600 px-6 py-4">
                                    <h2 className="text-xl font-semibold text-white">Start Your Free Trial</h2>
                                    <p className="text-blue-100 text-sm mt-1">No credit card required for free plan</p>
                                </div>

                                <div className="p-6 space-y-4">
                                    {error && (
                                        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-shrink-0">
                                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <p className="text-sm text-red-800">{error}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Plan Selection */}
                                    <div>
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
                                                    const mostPopularId = brief[2]?.id ?? brief[1]?.id ?? brief[0]?.id ?? -1;
                                                    const isPopular = plan.id === mostPopularId;
                                                    const disabled = d?.monthlyPrice === null;

                                                    return (
                                                        <button
                                                            key={plan.id}
                                                            type="button"
                                                            onClick={() => !disabled && setSelectedPlanId(plan.id)}
                                                            disabled={disabled}
                                                            className={`relative w-full text-left rounded-xl border-2 p-4 transition-all transform hover:scale-105 ${
                                                                isSelected
                                                                    ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-sky-50 ring-2 ring-blue-500'
                                                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                                            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
                                                                    {d?.monthlyPrice !== null && (
                                                                        <div className="text-xs text-gray-500">per month</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Form Fields */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Full Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                className="w-full rounded-lg border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                placeholder="John Doe"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Company *
                                            </label>
                                            <input
                                                type="text"
                                                value={company}
                                                onChange={(e) => setCompany(e.target.value)}
                                                className="w-full rounded-lg border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                placeholder="Acme Inc."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Work Email *
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full rounded-lg border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            placeholder="john@company.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Password *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full rounded-lg border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
                                                placeholder="Min. 10 characters"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700"
                                            >
                                                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
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

                                    {/* Stripe Payment */}
                                    {requireCard && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                                                        note="Card saved now, charged after 30-day trial"
                                                    />
                                                </Elements>
                                            )}
                                        </div>
                                    )}

                                    {/* Agreements */}
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
                                                <a href="/terms" className="text-blue-600 hover:underline">
                                                    Terms of Service
                                                </a>{' '}
                                                and{' '}
                                                <a href="/privacy" className="text-blue-600 hover:underline">
                                                    Privacy Policy
                                                </a>
                                            </span>
                                        </label>
                                        <label className="flex items-start gap-2">
                                            <input
                                                type="checkbox"
                                                checked={marketingOptIn}
                                                onChange={(e) => setMarketingOptIn(e.target.checked)}
                                                className="mt-0.5 rounded border-blue-300 text-blue-500 focus:ring-blue-500"
                                            />
                                            <span className="text-xs text-gray-600">
                                                Send me product updates and tips
                                            </span>
                                        </label>
                                    </div>

                                    <button
                                        onClick={handleRegistration}
                                        disabled={loading || (requireCard && (!stripeClientSecret || !!stripeSetupError))}
                                        className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:from-blue-700 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                                    >
                                        {loading ? (
                                            <>
                                                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                                Creating Account...
                                            </>
                                        ) : (
                                            <>
                                                Start Free Trial
                                                <span className="transition-transform group-hover:translate-x-1">🚀</span>
                                            </>
                                        )}
                                    </button>

                                    <p className="text-center text-sm text-gray-600">
                                        Already have an account?{' '}
                                        <a href="/login" className="font-medium text-blue-600 hover:text-blue-700">
                                            Sign in
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Animated Stats Section */}
            <section className="py-16 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { value: '1B+', label: 'Emails/month', color: 'from-emerald-400 to-emerald-600', icon: '📧' },
                            { value: '10K+', label: 'Developers', color: 'from-blue-400 to-blue-600', icon: '👨‍💻' },
                            { value: '99.99%', label: 'Uptime SLA', color: 'from-purple-400 to-purple-600', icon: '⚡' },
                            { value: '150+', label: 'Countries', color: 'from-amber-400 to-amber-600', icon: '🌍' },
                        ].map((stat, idx) => (
                            <div
                                key={idx}
                                className="group relative rounded-2xl bg-white/80 backdrop-blur-sm p-6 text-center ring-1 ring-blue-200/50 hover:ring-blue-300 transition-all hover:scale-105 hover:shadow-xl"
                            >
                                <div className="text-3xl mb-2">{stat.icon}</div>
                                <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                                    {stat.value}
                                </div>
                                <div className="mt-1 text-sm text-gray-600">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section with floating cards */}
            <section id="features" className="py-20 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-100 to-sky-100 px-4 py-2 text-sm font-medium text-blue-900 mb-4">
                            <SparklesIcon className="h-4 w-4" />
                            Features
                        </span>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-900 to-sky-900 bg-clip-text text-transparent">
                            Everything You Need to Scale
                        </h2>
                        <p className="mt-4 text-lg text-gray-600">
                            Powerful features that grow with your business
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: PaperAirplaneIcon,
                                title: 'Powerful API',
                                description: 'RESTful API with SDKs for all major languages',
                                gradient: 'from-blue-500 to-blue-600',
                                delay: '0'
                            },
                            {
                                icon: InboxArrowDownIcon,
                                title: 'Inbound Processing',
                                description: 'Parse incoming emails and route to webhooks',
                                gradient: 'from-purple-500 to-purple-600',
                                delay: '100'
                            },
                            {
                                icon: CheckCircleIcon,
                                title: 'Email Validation',
                                description: 'Verify addresses before sending',
                                gradient: 'from-emerald-500 to-emerald-600',
                                delay: '200'
                            },
                            {
                                icon: ChartBarIcon,
                                title: 'Real-time Analytics',
                                description: 'Track opens, clicks, bounces instantly',
                                gradient: 'from-indigo-500 to-indigo-600',
                                delay: '300'
                            },
                            {
                                icon: BeakerIcon,
                                title: 'A/B Testing',
                                description: 'Test and optimize your campaigns',
                                gradient: 'from-pink-500 to-pink-600',
                                delay: '400'
                            },
                            {
                                icon: ServerStackIcon,
                                title: 'Dedicated IPs',
                                description: 'Improve deliverability with your own IPs',
                                gradient: 'from-amber-500 to-amber-600',
                                delay: '500'
                            },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="group relative rounded-2xl bg-white/90 backdrop-blur-sm p-6 shadow-lg ring-1 ring-blue-200/50 hover:ring-blue-300 transition-all hover:scale-105 hover:shadow-xl hover:-translate-y-2"
                                style={{
                                    animationDelay: `${feature.delay}ms`
                                }}
                            >
                                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} mb-4 group-hover:scale-110 transition-transform`}>
                                    <feature.icon className="h-6 w-6 text-white" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                                <p className="text-sm text-gray-600">{feature.description}</p>
                            </div>
                        ))}
                    </div>

                    {/* Code Example with glassmorphism */}
                    <div className="mt-20">
                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-900 to-sky-900 bg-clip-text text-transparent">
                                Simple Integration
                            </h3>
                            <p className="mt-2 text-gray-600">Get started in minutes with our intuitive API</p>
                        </div>

                        <div className="max-w-3xl mx-auto">
                            <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-sky-900 p-1 shadow-2xl">
                                <div className="rounded-3xl bg-gray-900/95 backdrop-blur-xl overflow-hidden">
                                    <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-3 border-b border-gray-700">
                                        <div className="flex gap-1.5">
                                            <div className="h-3 w-3 rounded-full bg-red-500" />
                                            <div className="h-3 w-3 rounded-full bg-yellow-500" />
                                            <div className="h-3 w-3 rounded-full bg-green-500" />
                                        </div>
                                        <span className="ml-2 text-xs text-gray-400">example.js</span>
                                    </div>
                                    <pre className="p-6 text-sm text-gray-300 overflow-x-auto">
                                        <code>{`// Send an email with MonkeysMail 🐵
const sendEmail = async () => {
  const response = await fetch('https://smtp.monkeysmail.com/messages/send', {
    method: 'POST',
    headers: {
      'X-API-Key': 'mm_live.abc123.your-secret-key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: ['customer@example.com'],
      subject: 'Welcome to our platform!',
      html: '<h1>Welcome!</h1><p>Thanks for signing up.</p>',
      text: 'Welcome! Thanks for signing up.',
      from: 'noreply@yourdomain.com'
    })
  });
  
  const data = await response.json();
  console.log('Email sent:', data);
};`}</code>
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section with animated gradient */}
            <section className="py-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-sky-600 to-blue-600 animate-gradient-x" />
                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white mb-6">
                        <RocketLaunchIcon className="h-4 w-4" />
                        Ready to launch?
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Transform Your Email Infrastructure Today
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Join 10,000+ developers sending billions of emails every month
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a
                            href="#signup"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-medium text-blue-600 shadow-lg hover:bg-gray-50 transition-all transform hover:scale-105"
                        >
                            Start Free Trial
                            <span>🐵</span>
                        </a>
                        <a
                            href="/docs"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700/50 backdrop-blur-sm px-6 py-3 text-sm font-medium text-white shadow-lg hover:bg-blue-700/70 transition-all transform hover:scale-105"
                        >
                            View Documentation
                            <CodeBracketIcon className="h-4 w-4" />
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-50 text-gray-600 py-12 border-t border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <Image src="/logo.svg" alt="MonkeysMail" width={160} height={38} className="rounded-xl" />
                            </div>
                            <p className="text-sm">
                                Email infrastructure that scales with your business.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-900 mb-3">Product</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#features" className="hover:text-blue-600 transition-colors">Features</a></li>
                                <li><a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a></li>
                                <li><a href="/docs" className="hover:text-blue-600 transition-colors">Documentation</a></li>
                                <li><a href="/api" className="hover:text-blue-600 transition-colors">API Reference</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-900 mb-3">Company</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="/about" className="hover:text-blue-600 transition-colors">About</a></li>
                                <li><a href="/blog" className="hover:text-blue-600 transition-colors">Blog</a></li>
                                <li><a href="/careers" className="hover:text-blue-600 transition-colors">Careers</a></li>
                                <li><a href="/contact" className="hover:text-blue-600 transition-colors">Contact</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-900 mb-3">Legal</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="/terms" className="hover:text-blue-600 transition-colors">Terms</a></li>
                                <li><a href="/privacy" className="hover:text-blue-600 transition-colors">Privacy</a></li>
                                <li><a href="/security" className="hover:text-blue-600 transition-colors">Security</a></li>
                                <li><a href="/gdpr" className="hover:text-blue-600 transition-colors">GDPR</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-200 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm">
                        <p>© {new Date().getFullYear()} MonkeysMail. All rights reserved. Made with 💙 and 🐵</p>

                        <a
                            href="https://monkeyslegion.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 hover:text-gray-900"
                        >
                            <span>Powered by</span>
                            <Image src="/MonkeysLegion.svg" alt="MonkeysLegion" width={140} height={28} />
                        </a>
                    </div>
                </div>
            </footer>


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

                @keyframes float {
                    0%, 100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-10px);
                    }
                }

                @keyframes draw {
                    to {
                        stroke-dashoffset: 0;
                    }
                }

                @keyframes gradient-x {
                    0%, 100% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                }

                .animate-blob {
                    animation: blob 7s infinite;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }

                .animate-draw {
                    stroke-dasharray: 200;
                    stroke-dashoffset: 200;
                    animation: draw 2s ease-out forwards;
                }

                .animate-gradient-x {
                    background-size: 200% 200%;
                    animation: gradient-x 3s ease infinite;
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