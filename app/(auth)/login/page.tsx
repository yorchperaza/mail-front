"use client";

import { useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
    ShieldCheckIcon,
    BoltIcon,
    RocketLaunchIcon,
    ArrowRightIcon,
    EyeIcon,
    EyeSlashIcon,
} from "@heroicons/react/24/outline";

// ----- Wrapper that provides the Suspense boundary -----
export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-sky-50">
                <div className="text-blue-600">Loading...</div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}

// ----- Your original component logic moved here -----
function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [remember, setRemember] = useState(true);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const justRegistered = useMemo(
        () => searchParams?.get("registered") === "1",
        [searchParams]
    );

    function validate(): boolean {
        const errs: Record<string, string> = {};
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = "Enter a valid email address.";
        if (!password) errs.password = "Enter your password.";
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!validate()) return;

        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, remember }),
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                if (data.token) {
                    if (remember) localStorage.setItem("jwt", data.token as string);
                    else sessionStorage.setItem("jwt", data.token as string);
                }
                router.push("/dashboard");
            } else {
                setError((data.message as string) || "Login failed. Please try again.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unexpected error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-sky-50">
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

            <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-2">
                {/* Brand side */}
                <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden">
                    <header className="flex items-center gap-3">
                        <Image src="/logo.svg" alt="MonkeysLegion" width={160} height={38} className="rounded-xl" />
                    </header>

                    <div className="max-w-xl">
                        <h1 className="text-5xl font-black leading-tight">
                            <span className="text-blue-500">Welcome back</span>
                            <span className="block bg-gradient-to-br from-blue-900 via-blue-600 to-sky-600 bg-clip-text text-transparent">
                                Pick up where you left off.
                            </span>
                        </h1>

                        {/* Feature pills */}
                        <div className="mt-8 flex flex-wrap gap-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 backdrop-blur-sm px-4 py-2 text-sm">
                                <ShieldCheckIcon className="h-4 w-4 text-blue-600" />
                                <span>SSO-ready auth and secure sessions</span>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 backdrop-blur-sm px-4 py-2 text-sm">
                                <BoltIcon className="h-4 w-4 text-sky-600" />
                                <span>Instant access to projects</span>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 backdrop-blur-sm px-4 py-2 text-sm">
                                <RocketLaunchIcon className="h-4 w-4 text-cyan-600" />
                                <span>Built for teams with RBAC</span>
                            </div>
                        </div>

                        {/* Decorative elements */}
                        <div className="mt-12 grid grid-cols-3 gap-4 opacity-60">
                            <div className="h-2 bg-gradient-to-r from-blue-400 to-sky-400 rounded-full animate-pulse" />
                            <div className="h-2 bg-gradient-to-r from-sky-400 to-cyan-400 rounded-full animate-pulse animation-delay-2000" />
                            <div className="h-2 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full animate-pulse animation-delay-4000" />
                        </div>
                    </div>

                    <footer className="text-xs text-gray-500">
                        © {new Date().getFullYear()} MonkeysLegion. All rights reserved.
                    </footer>
                </aside>

                {/* Form side */}
                <main className="relative flex items-center justify-center p-6 sm:p-10">
                    <div className="w-full max-w-sm sm:max-w-md">
                        {/* Floating badge */}
                        <div className="absolute -right-4 -top-4 animate-float rounded-2xl bg-gradient-to-r from-green-400 to-green-600 px-4 py-2 text-sm font-bold text-white shadow-xl z-10">
                            ✨ Secure Login
                        </div>

                        <div className="rounded-3xl bg-white/90 backdrop-blur-xl shadow-2xl ring-1 ring-blue-200/50 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-sky-600 px-6 py-4">
                                {/* Mobile logo */}
                                <div className="flex items-center gap-3 lg:hidden mb-2">
                                    <Image src="/logo.svg" alt="MonkeysLegion" width={140} height={32} className="rounded-lg" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">Sign in to your account</h2>
                                <p className="text-blue-100 text-sm mt-1">Use your work email and password</p>
                            </div>

                            <div className="p-6 space-y-4">
                                {justRegistered && (
                                    <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                                        <div className="flex items-center gap-2">
                                            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-sm text-green-800">Account created successfully! You can log in now.</p>
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3">
                                        <div className="flex items-center gap-2">
                                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                            </svg>
                                            <p className="text-sm text-red-800">{error}</p>
                                        </div>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Email */}
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                            Work Email
                                        </label>
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className={`w-full rounded-lg border shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 ${
                                                fieldErrors.email ? "border-red-300" : "border-blue-200"
                                            }`}
                                            placeholder="you@company.com"
                                            autoComplete="email"
                                            required
                                        />
                                        {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
                                    </div>

                                    {/* Password */}
                                    <div>
                                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="password"
                                                type={showPass ? "text" : "password"}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className={`w-full rounded-lg border shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10 px-4 py-2 ${
                                                    fieldErrors.password ? "border-red-300" : "border-blue-200"
                                                }`}
                                                placeholder="Enter your password"
                                                autoComplete="current-password"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPass(!showPass)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700"
                                                aria-label={showPass ? "Hide password" : "Show password"}
                                            >
                                                {showPass ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                            </button>
                                        </div>
                                        {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
                                    </div>

                                    {/* Remember + Forgot */}
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={remember}
                                                onChange={(e) => setRemember(e.target.checked)}
                                                className="rounded border-blue-300 text-blue-500 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-600">Remember me</span>
                                        </label>
                                        <a href="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                                            Forgot password?
                                        </a>
                                    </div>

                                    {/* Submit */}
                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:from-blue-700 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                                        >
                                            {loading ? (
                                                <>
                                                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Signing in...
                                                </>
                                            ) : (
                                                <>
                                                    Sign in
                                                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                                </>
                                            )}
                                        </button>

                                        <div className="mt-4 relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-gray-200" />
                                            </div>
                                            <div className="relative flex justify-center text-sm">
                                                <span className="bg-white px-2 text-gray-500">Or</span>
                                            </div>
                                        </div>

                                        <p className="mt-4 text-center text-sm text-gray-600">
                                            Don&#39;t have an account?{' '}
                                            <a href="/register" className="font-medium text-blue-600 hover:text-blue-700">
                                                Create one
                                            </a>
                                        </p>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Trust indicators */}
                        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                                <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span>256-bit encryption</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span>SOC 2 compliant</span>
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

                @keyframes float {
                    0%, 100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-10px);
                    }
                }

                .animate-blob {
                    animation: blob 7s infinite;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
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