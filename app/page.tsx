'use client';

import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import {
    FiSend,
    FiShield,
    FiBarChart2,
    FiCheckCircle,
    FiZap,
    FiMail,
    FiGlobe,
    FiCode,
    FiUsers,
    FiClock,
    FiTrendingUp,
    FiArrowRight,
    FiEye,
    FiEyeOff,
    FiInbox,
} from 'react-icons/fi';

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

function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function title(s: string): string {
    return s.replace(/(^|\s|-|_)\S/g, (m) => m.toUpperCase()).replace(/[_-]/g, ' ');
}

function toFeatureBullets(features: PlanDetail['features']): string[] {
    if (!features) return [];
    if (isStringArray(features)) return features;

    const f = features as PlanFeatures;
    const bullets: string[] = [];

    if (f.capabilities) {
        const cap = f.capabilities;
        if (typeof cap.analytics === 'string') bullets.push(`Analytics: ${title(cap.analytics)}`);
        if (cap.api) bullets.push('Full API access');
        if (cap.smtp) bullets.push('SMTP relay');
        if (cap.webhooks) bullets.push('Webhooks & events');
        if (cap.templateBuilder) bullets.push('Template builder');
        if (cap.sendTimeOptimization) bullets.push('Send-time optimization');
        if (cap.dedicatedIpPools) bullets.push('Dedicated IP pools');
    }

    if (f.quotas) {
        const q = f.quotas;
        if (q.emailsPerMonth != null) bullets.push(`${formatMessages(q.emailsPerMonth)} emails/month`);
        if (q.logRetentionDays != null) bullets.push(`${q.logRetentionDays}-day log retention`);
        if (q.emailValidationsIncluded != null)
            bullets.push(`${formatMessages(q.emailValidationsIncluded)} email validations`);
        if (q.inboundRoutes != null) bullets.push(`${q.inboundRoutes} inbound routes`);
    }

    if (f.pricing?.overagePer1K != null) {
        bullets.push(f.pricing.overagePer1K > 0 ? `$${f.pricing.overagePer1K}/1k overage` : 'No overage charges');
    }

    if (f.support?.tier) bullets.push(`${title(String(f.support.tier))} support`);

    return bullets;
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
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <PaymentElement options={{ layout: 'accordion' }} />
            {note && <p className="mt-2 text-xs text-neutral-600">{note}</p>}
            {localError && <p className="mt-2 text-xs text-red-600">{localError}</p>}
        </div>
    );
});

/* =============================== Component ============================== */

export default function MonkeysMailLanding() {
    const router = useRouter();

    // Brand color
    const brandColor = '#ea8a0a';
    type CSSVarPrimary = { ['--ml-primary']: string };

    const brandStyle: React.CSSProperties & CSSVarPrimary = {
        ['--ml-primary']: brandColor,
    };

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
    const selectedBullets = toFeatureBullets(selected?.features ?? null);

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
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50" style={brandStyle}>
            {/* Top bar with logo */}
            <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b border-orange-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Image src="/logo.svg" alt="MonkeysMail" width={140} height={28} priority />
                        <span className="hidden sm:inline-block text-sm text-gray-600">Email Infrastructure for Builders</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-6 text-sm text-gray-700">
                        <a href="#features" className="hover:text-gray-900">Features</a>
                        <a href="#pricing" className="hover:text-gray-900">Pricing</a>
                        <a href="/login" className="hover:text-gray-900">Sign in</a>
                    </nav>
                </div>
            </header>

            {/* Hero Section with Registration */}
            <section className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-100/50 via-transparent to-amber-100/50" />
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
                    <div className="grid lg:grid-cols-2 gap-12 min-h-[86vh]">
                        {/* Left: Branding and Features */}
                        <div className="pt-20">
                            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-100 to-amber-100 px-4 py-2 rounded-full mb-6 border border-orange-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                                <span className="text-sm font-medium text-orange-800">Trusted by 50,000+ developers worldwide</span>
                            </div>

                            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-extrabold text-gray-900 mb-4 leading-tight">
                                Email Infrastructure
                                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[var(--ml-primary)] via-orange-500 to-[var(--ml-primary)]">
                  That Just Works
                </span>
                            </h1>

                            <p className="text-xl lg:text-2xl text-gray-600 mb-8">
                                Send transactional and marketing emails at scale. Built for developers, trusted by enterprises.
                            </p>

                            {/* Key Features */}
                            <div className="space-y-4 mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-[var(--ml-primary)] to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FiZap className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">Lightning Fast Delivery</div>
                                        <div className="text-sm text-gray-600">Sub-100ms API response, 10B+ emails monthly</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-[var(--ml-primary)] to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FiShield className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">99.99% Uptime SLA</div>
                                        <div className="text-sm text-gray-600">Enterprise-grade reliability with global redundancy</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-[var(--ml-primary)] to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FiBarChart2 className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">Real-time Analytics</div>
                                        <div className="text-sm text-gray-600">Track opens, clicks, bounces instantly</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-[var(--ml-primary)] to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FiCode className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">Simple Integration</div>
                                        <div className="text-sm text-gray-600">RESTful API, SMTP relay, SDKs for all languages</div>
                                    </div>
                                </div>
                            </div>

                            {/* Trust badges */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="text-2xl font-bold text-[var(--ml-primary)]">5 min</div>
                                    <div className="text-xs text-gray-600">Setup time</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-[var(--ml-primary)]">Free</div>
                                    <div className="text-xs text-gray-600">5k emails/mo</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-[var(--ml-primary)]">24/7</div>
                                    <div className="text-xs text-gray-600">Support</div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Registration Card (dynamic) */}
                        <div className="lg:ml-auto w-full max-w-md">
                            <div className="bg-white rounded-2xl shadow-2xl p-6 lg:p-8 border border-orange-100">
                                <div className="text-center mb-6">
                                    <div className="mx-auto mb-2 flex items-center justify-center">
                                        <Image src="/logo.svg" alt="MonkeysMail" width={120} height={24} />
                                    </div>
                                    <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Start Your Free Trial</h2>
                                    <p className="text-gray-600 text-sm">30 days free • No credit card on free plan • Cancel anytime</p>
                                </div>

                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
                                )}

                                <div className="space-y-4">
                                    {/* Plan Selection (dynamic) */}
                                    <div id="pricing">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Choose Your Plan</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {plansLoading ? (
                                                Array.from({ length: 4 }).map((_, i) => (
                                                    <div key={i} className="border border-gray-200 rounded-lg p-2 animate-pulse">
                                                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
                                                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                                                    </div>
                                                ))
                                            ) : plansError ? (
                                                <div className="col-span-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">{plansError}</div>
                                            ) : (
                                                brief.map((plan) => {
                                                    const d = details[plan.id];
                                                    const isSelected = selectedPlanId === plan.id;
                                                    const isPopular = plan.id === (brief[1]?.id ?? -1); // second plan popular by default
                                                    const disabled = d?.monthlyPrice === null; // Custom/Enterprise not self-serve
                                                    return (
                                                        <button
                                                            key={plan.id}
                                                            type="button"
                                                            onClick={() => !disabled && setSelectedPlanId(plan.id)}
                                                            disabled={disabled}
                                                            className={`relative text-left border rounded-lg p-2 transition-all ${
                                                                isSelected ? 'border-[var(--ml-primary)] bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                                                            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        >
                                                            {isPopular && !disabled && (
                                                                <span className="absolute -top-2 -right-2 bg-[var(--ml-primary)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  POPULAR
                                </span>
                                                            )}
                                                            <div className="font-semibold text-gray-900 text-sm">{plan.name}</div>
                                                            <div className="text-xs text-gray-600">
                                                                {formatMoney(d?.monthlyPrice ?? null)}
                                                                {d?.monthlyPrice !== null && '/mo'}
                                                            </div>
                                                            {typeof d?.includedMessages === 'number' && (
                                                                <div className="text-xs text-gray-500">{formatMessages(d.includedMessages)}</div>
                                                            )}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>

                                        {/* Selected plan feature bullets */}
                                        {selected && (
                                            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-700">
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
                                        )}
                                    </div>

                                    {/* Full Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--ml-primary)]/30 focus:border-[var(--ml-primary)] transition-all outline-none text-sm"
                                            placeholder="John Doe"
                                        />
                                    </div>

                                    {/* Company */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
                                        <input
                                            type="text"
                                            value={company}
                                            onChange={(e) => setCompany(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--ml-primary)]/30 focus:border-[var(--ml-primary)] transition-all outline-none text-sm"
                                            placeholder="Acme Inc."
                                        />
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Work Email *</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--ml-primary)]/30 focus:border-[var(--ml-primary)] transition-all outline-none text-sm"
                                            placeholder="john@company.com"
                                        />
                                    </div>

                                    {/* Password */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--ml-primary)]/30 focus:border-[var(--ml-primary)] pr-10 transition-all outline-none text-sm"
                                                placeholder="At least 10 characters"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                            >
                                                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                            </button>
                                        </div>
                                        <div className="mt-2">
                                            <div className="flex gap-1">
                                                {[0, 1, 2, 3].map((i) => (
                                                    <div key={i} className={`h-1 w-full rounded ${passScore > i ? 'bg-[var(--ml-primary)]' : 'bg-gray-200'}`} />
                                                ))}
                                            </div>
                                            <div className="mt-1 text-[10px] text-gray-500">Use upper & lower case, number, and symbol.</div>
                                        </div>
                                    </div>

                                    {/* Consent */}
                                    <div className="space-y-2">
                                        <label className="flex items-start gap-2">
                                            <input
                                                type="checkbox"
                                                checked={agree}
                                                onChange={(e) => setAgree(e.target.checked)}
                                                className="mt-0.5 rounded border-gray-300 text-[var(--ml-primary)] focus:ring-[var(--ml-primary)]"
                                            />
                                            <span className="text-xs text-gray-700">
                        I agree to the <a href="/legal/terms" className="text-[var(--ml-primary)] hover:underline">Terms</a> and{' '}
                                                <a href="/legal/privacy" className="text-[var(--ml-primary)] hover:underline">Privacy Policy</a>
                      </span>
                                        </label>

                                        <label className="flex items-start gap-2">
                                            <input
                                                type="checkbox"
                                                checked={marketingOptIn}
                                                onChange={(e) => setMarketingOptIn(e.target.checked)}
                                                className="mt-0.5 rounded border-gray-300 text-[var(--ml-primary)] focus:ring-[var(--ml-primary)]"
                                            />
                                            <span className="text-xs text-gray-700">Send me product updates and tips (optional)</span>
                                        </label>
                                    </div>

                                    {/* Stripe Payment (only for paid plans) */}
                                    {requireCard && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Payment method</label>
                                            {stripeSetupError && <p className="text-xs text-red-600 mb-2">{stripeSetupError}</p>}
                                            {stripeLoading && (
                                                <div className="rounded-xl border border-neutral-200 p-4 animate-pulse">
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
                                        </div>
                                    )}

                                    <button
                                        onClick={handleRegistration}
                                        disabled={loading || (requireCard && (!stripeClientSecret || !!stripeSetupError))}
                                        className="group relative inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ml-primary)] px-4 py-3 font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
                                    >
                                        {loading ? 'Creating your account…' : 'Start Free Trial'}
                                        <FiArrowRight className="transition-transform group-hover:translate-x-0.5" />
                                    </button>

                                    <p className="text-center text-xs text-gray-600">
                                        Already have an account?{' '}
                                        <a href="/login" className="text-[var(--ml-primary)] hover:underline font-medium">
                                            Sign in
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Promotional Section */}
            <section id="promo" className="py-16 border-t border-amber-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-6 text-center">
                        <div className="rounded-2xl border border-amber-200 bg-white p-6">
                            <div className="text-3xl font-extrabold text-[var(--ml-primary)]">99.99%</div>
                            <div className="mt-1 text-sm text-neutral-700">Uptime SLA</div>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-white p-6">
                            <div className="text-3xl font-extrabold text-[var(--ml-primary)]">5 min</div>
                            <div className="mt-1 text-sm text-neutral-700">Avg. setup time</div>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-white p-6">
                            <div className="text-3xl font-extrabold text-[var(--ml-primary)]">GDPR</div>
                            <div className="mt-1 text-sm text-neutral-700">& SOC 2 ready</div>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-white p-6">
                            <div className="text-3xl font-extrabold text-[var(--ml-primary)]">Global</div>
                            <div className="mt-1 text-sm text-neutral-700">Multi‑region sending</div>
                        </div>
                    </div>

                    <div className="mt-16">
                        <h3 className="text-2xl font-bold text-neutral-900 text-center">Campaign power‑ups</h3>
                        <p className="mt-2 text-center text-neutral-600 max-w-3xl mx-auto">Everything you need to plan, launch, and optimize high‑performing campaigns.</p>
                        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ml-primary)] text-white"><FiTrendingUp className="h-5 w-5" /></div>
                                <h4 className="font-semibold">A/B testing</h4>
                                <p className="mt-1 text-sm text-neutral-600">Test subject lines, content, and send windows—pick winners automatically.</p>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ml-primary)] text-white"><FiClock className="h-5 w-5" /></div>
                                <h4 className="font-semibold">Smart scheduling</h4>
                                <p className="mt-1 text-sm text-neutral-600">Send‑time optimization and throttling to protect reputation.</p>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ml-primary)] text-white"><FiUsers className="h-5 w-5" /></div>
                                <h4 className="font-semibold">Segmentation</h4>
                                <p className="mt-1 text-sm text-neutral-600">Target by behavior, attributes, and engagement—no SQL required.</p>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ml-primary)] text-white"><FiMail className="h-5 w-5" /></div>
                                <h4 className="font-semibold">Templates & versions</h4>
                                <p className="mt-1 text-sm text-neutral-600">Versioned templates with partials and handlebars support.</p>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ml-primary)] text-white"><FiShield className="h-5 w-5" /></div>
                                <h4 className="font-semibold">Compliance & safety</h4>
                                <p className="mt-1 text-sm text-neutral-600">One‑click unsubscribe, bounce handling, DMARC/DKIM/SPF checks.</p>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ml-primary)] text-white"><FiGlobe className="h-5 w-5" /></div>
                                <h4 className="font-semibold">Global deliverability</h4>
                                <p className="mt-1 text-sm text-neutral-600">Region‑aware routing, dedicated IP pools, and warming automation.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-16 bg-white border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need to Scale</h2>
                        <p className="text-gray-600">Powerful features trusted by 50,000+ developers</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-gradient-to-br from-[var(--ml-primary)] to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <FiSend className="h-6 w-6 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Powerful API</h3>
                            <p className="text-sm text-gray-600">RESTful API with SDKs for Node.js, Python, PHP, Ruby, and more</p>
                        </div>

                        <div className="text-center">
                            <div className="w-12 h-12 bg-gradient-to-br from-[var(--ml-primary)] to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <FiInbox className="h-6 w-6 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Inbound Processing</h3>
                            <p className="text-sm text-gray-600">Parse incoming emails and route them to webhooks instantly</p>
                        </div>

                        <div className="text-center">
                            <div className="w-12 h-12 bg-gradient-to-br from-[var(--ml-primary)] to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <FiCheckCircle className="h-6 w-6 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Email Validation</h3>
                            <p className="text-sm text-gray-600">Verify addresses before sending to improve deliverability</p>
                        </div>
                    </div>

                    {/* Code Example */}
                    <div className="mt-16 max-w-3xl mx-auto">
                        <div className="bg-gray-900 rounded-xl p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-3 w-3 rounded-full bg-red-500" />
                                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                                <div className="h-3 w-3 rounded-full bg-green-500" />
                                <span className="ml-4 text-xs text-gray-400">example.js</span>
                            </div>
                            <pre className="text-xs text-gray-300 overflow-x-auto">
                <code>{`// Send an email with MonkeysMail API
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
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-8 border-t border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <FiMail className="h-5 w-5 text-[var(--ml-primary)]" />
                            <span className="font-bold text-white">MonkeysMail</span>
                        </div>
                        <p className="text-sm text-center">© {new Date().getFullYear()} MonkeysMail. All rights reserved. • SOC 2 Ready • GDPR Compliant</p>
                        <div className="flex gap-6 text-sm">
                            <a href="#pricing" className="hover:text-white">Pricing</a>
                            <a href="#features" className="hover:text-white">Features</a>
                            <a href="/status" className="hover:text-white">Status</a>
                            <a href="/legal/terms" className="hover:text-white">Terms</a>
                            <a href="/legal/privacy" className="hover:text-white">Privacy</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
