'use client';

import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import {
    ArrowRightIcon,
    ShieldCheckIcon,
    ChartBarIcon,
    BoltIcon,
    EnvelopeIcon,
    CodeBracketIcon,
    EyeIcon,
    EyeSlashIcon,
    InboxArrowDownIcon,
    CheckCircleIcon,
    PaperAirplaneIcon,
    BeakerIcon,
    ServerStackIcon,
    ArrowPathIcon,
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
        <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-4">
            <PaymentElement options={{ layout: 'accordion' }} />
            {note && <p className="mt-2 text-xs text-gray-600">{note}</p>}
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
    const requireCard = (selected?.monthlyPrice ?? 0) > 0; // paid plans need card

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
                if (items.length > 1) setSelectedPlanId(items[1].id); else if (items.length > 0) setSelectedPlanId(items[0].id);

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
                    marketing_opt_in: !!marketingOptIn,
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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <Image src="/logo.svg" alt="MonkeysMail" width={140} height={28} priority />
                            <div className="hidden md:block h-6 w-px bg-gray-300" />
                            <span className="hidden md:inline-block text-sm text-gray-600">
                                Email Infrastructure for Modern Teams
                            </span>
                        </div>
                        <nav className="hidden md:flex items-center gap-2">
                            <a href="#features" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-all">
                                Features
                            </a>
                            <a href="#pricing" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-all">
                                Pricing
                            </a>
                            <a href="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-all">
                                Sign In
                            </a>
                            <a href="#signup" className="ml-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-sm">
                                Get Started
                            </a>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section id="hero" className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-50/30 via-transparent to-amber-50/30" />
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
                    <div className="grid lg:grid-cols-2 gap-12">
                        {/* Left Content */}
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2 text-sm font-medium text-orange-700 ring-1 ring-orange-200 mb-8">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                </span>
                                Trusted by 50,000+ developers worldwide
                            </div>

                            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                                Email Infrastructure
                                <span className="block bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                                    That Scales With You
                                </span>
                            </h1>

                            <p className="text-xl text-gray-600 mb-8">
                                Send transactional and marketing emails at scale. Built for developers, trusted by enterprises. Start with 5,000 free emails per month.
                            </p>

                            {/* Feature Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                                        <BoltIcon className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">Lightning Fast</div>
                                        <div className="text-sm text-gray-600">Sub-100ms API</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                        <ShieldCheckIcon className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">99.99% Uptime</div>
                                        <div className="text-sm text-gray-600">Enterprise SLA</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                                        <ChartBarIcon className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">Real-time Analytics</div>
                                        <div className="text-sm text-gray-600">Track everything</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                                        <CodeBracketIcon className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">Developer First</div>
                                        <div className="text-sm text-gray-600">RESTful API & SDKs</div>
                                    </div>
                                </div>
                            </div>

                            {/* Trust Indicators */}
                            <div className="flex items-center gap-8">
                                <div>
                                    <div className="text-3xl font-bold text-orange-600">10B+</div>
                                    <div className="text-sm text-gray-600">Emails sent monthly</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-orange-600">50K+</div>
                                    <div className="text-sm text-gray-600">Active developers</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-orange-600">150+</div>
                                    <div className="text-sm text-gray-600">Countries served</div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Signup Form */}
                        <div id="signup" className="lg:ml-auto w-full max-w-md">
                            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
                                    <h2 className="text-xl font-semibold text-white">Start Your Free Trial</h2>
                                    <p className="text-orange-100 text-sm mt-1">30 days free</p>
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
                                                        <div key={i} className="h-16 bg-gray-200 rounded-lg" />
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
                                                    const isPopular = plan.id === (brief[1]?.id ?? -1);
                                                    const disabled = d?.monthlyPrice === null;

                                                    return (
                                                        <button
                                                            key={plan.id}
                                                            type="button"
                                                            onClick={() => !disabled && setSelectedPlanId(plan.id)}
                                                            disabled={disabled}
                                                            className={`relative w-full text-left rounded-lg border-2 p-4 transition-all ${
                                                                isSelected
                                                                    ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        >
                                                            {isPopular && !disabled && (
                                                                <span className="absolute -top-3 right-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                                                    MOST POPULAR
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
                                                                    <div className="text-2xl font-bold text-gray-900">
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
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
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
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
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
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
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
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 pr-10"
                                                placeholder="Min. 10 characters"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
                                                                ? 'bg-gradient-to-r from-orange-400 to-orange-500'
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
                                                    <div className="h-20 bg-gray-200 rounded-lg" />
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
                                                className="mt-0.5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                            />
                                            <span className="text-xs text-gray-600">
                                                I agree to the{' '}
                                                <a href="/terms" className="text-orange-600 hover:underline">
                                                    Terms of Service
                                                </a>{' '}
                                                and{' '}
                                                <a href="/privacy" className="text-orange-600 hover:underline">
                                                    Privacy Policy
                                                </a>
                                            </span>
                                        </label>
                                        <label className="flex items-start gap-2">
                                            <input
                                                type="checkbox"
                                                checked={marketingOptIn}
                                                onChange={(e) => setMarketingOptIn(e.target.checked)}
                                                className="mt-0.5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                            />
                                            <span className="text-xs text-gray-600">
                                                Send me product updates and tips
                                            </span>
                                        </label>
                                    </div>

                                    <button
                                        onClick={handleRegistration}
                                        disabled={loading || (requireCard && (!stripeClientSecret || !!stripeSetupError))}
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {loading ? (
                                            <>
                                                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                                Creating Account...
                                            </>
                                        ) : (
                                            <>
                                                Start Free Trial
                                                <ArrowRightIcon className="h-4 w-4" />
                                            </>
                                        )}
                                    </button>

                                    <p className="text-center text-sm text-gray-600">
                                        Already have an account?{' '}
                                        <a href="/login" className="font-medium text-orange-600 hover:text-orange-700">
                                            Sign in
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 bg-white border-y border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 text-center ring-1 ring-emerald-200">
                            <div className="text-3xl font-bold text-emerald-700">99.99%</div>
                            <div className="mt-1 text-sm text-emerald-600">Uptime SLA</div>
                        </div>
                        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-6 text-center ring-1 ring-blue-200">
                            <div className="text-3xl font-bold text-blue-700">100ms</div>
                            <div className="mt-1 text-sm text-blue-600">API Response</div>
                        </div>
                        <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-6 text-center ring-1 ring-purple-200">
                            <div className="text-3xl font-bold text-purple-700">GDPR</div>
                            <div className="mt-1 text-sm text-purple-600">Compliant</div>
                        </div>
                        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-6 text-center ring-1 ring-amber-200">
                            <div className="text-3xl font-bold text-amber-700">24/7</div>
                            <div className="mt-1 text-sm text-amber-600">Support</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900">Everything You Need to Scale</h2>
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
                            },
                            {
                                icon: InboxArrowDownIcon,
                                title: 'Inbound Processing',
                                description: 'Parse incoming emails and route to webhooks',
                                gradient: 'from-purple-500 to-purple-600',
                            },
                            {
                                icon: CheckCircleIcon,
                                title: 'Email Validation',
                                description: 'Verify addresses before sending',
                                gradient: 'from-emerald-500 to-emerald-600',
                            },
                            {
                                icon: ChartBarIcon,
                                title: 'Real-time Analytics',
                                description: 'Track opens, clicks, bounces instantly',
                                gradient: 'from-indigo-500 to-indigo-600',
                            },
                            {
                                icon: BeakerIcon,
                                title: 'A/B Testing',
                                description: 'Test and optimize your campaigns',
                                gradient: 'from-pink-500 to-pink-600',
                            },
                            {
                                icon: ServerStackIcon,
                                title: 'Dedicated IPs',
                                description: 'Improve deliverability with your own IPs',
                                gradient: 'from-amber-500 to-amber-600',
                            },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="group rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 hover:shadow-lg hover:ring-gray-300 transition-all"
                            >
                                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${feature.gradient} mb-4`}>
                                    <feature.icon className="h-6 w-6 text-white" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                                <p className="text-sm text-gray-600">{feature.description}</p>
                            </div>
                        ))}
                    </div>

                    {/* Code Example */}
                    <div className="mt-20">
                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-bold text-gray-900">Simple Integration</h3>
                            <p className="mt-2 text-gray-600">Get started in minutes with our intuitive API</p>
                        </div>

                        <div className="max-w-3xl mx-auto">
                            <div className="rounded-xl bg-gray-900 p-1 shadow-2xl">
                                <div className="flex items-center gap-2 rounded-t-lg bg-gray-800 px-4 py-3">
                                    <div className="flex gap-1.5">
                                        <div className="h-3 w-3 rounded-full bg-red-500" />
                                        <div className="h-3 w-3 rounded-full bg-yellow-500" />
                                        <div className="h-3 w-3 rounded-full bg-green-500" />
                                    </div>
                                    <span className="ml-2 text-xs text-gray-400">example.js</span>
                                </div>
                                <pre className="p-6 text-sm text-gray-300 overflow-x-auto">
                                    <code>{`// Send an email with MonkeysMail
const MonkeysMail = require('monkeysmail');
const client = new MonkeysMail('YOUR_API_KEY');

await client.messages.send({
  from: 'hello@yourdomain.com',
  to: 'customer@example.com',
  subject: 'Welcome to MonkeysMail! 🐵',
  html: '<h1>Start sending emails in minutes!</h1>',
  tracking: true
});`}</code>
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-r from-orange-500 to-amber-500">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to Transform Your Email Infrastructure?
                    </h2>
                    <p className="text-xl text-orange-100 mb-8">
                        Join 50,000+ developers sending billions of emails every month
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a
                            href="#signup"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium text-orange-600 shadow-lg hover:bg-gray-50 transition-all"
                        >
                            Start Free Trial
                            <ArrowRightIcon className="h-4 w-4" />
                        </a>
                        <a
                            href="/docs"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-3 text-sm font-medium text-white shadow-lg hover:bg-orange-700 transition-all"
                        >
                            View Documentation
                            <CodeBracketIcon className="h-4 w-4" />
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <EnvelopeIcon className="h-6 w-6 text-orange-500" />
                                <span className="font-bold text-white">MonkeysMail</span>
                            </div>
                            <p className="text-sm">
                                Email infrastructure that scales with your business.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-3">Product</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#features" className="hover:text-white">Features</a></li>
                                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                                <li><a href="/docs" className="hover:text-white">Documentation</a></li>
                                <li><a href="/api" className="hover:text-white">API Reference</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-3">Company</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="/about" className="hover:text-white">About</a></li>
                                <li><a href="/blog" className="hover:text-white">Blog</a></li>
                                <li><a href="/careers" className="hover:text-white">Careers</a></li>
                                <li><a href="/contact" className="hover:text-white">Contact</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-3">Legal</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="/terms" className="hover:text-white">Terms</a></li>
                                <li><a href="/privacy" className="hover:text-white">Privacy</a></li>
                                <li><a href="/security" className="hover:text-white">Security</a></li>
                                <li><a href="/gdpr" className="hover:text-white">GDPR</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
                        <p>© {new Date().getFullYear()} MonkeysMail. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}