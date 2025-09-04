"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

type BrandStyle = CSSProperties & { ["--ml-primary"]?: string };

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [remember, setRemember] = useState(true);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const justRegistered = useMemo(() => searchParams?.get("registered") === "1", [searchParams]);
    const brandStyle: BrandStyle = { "--ml-primary": "#ea8a0a" };

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
        <div className="min-h-screen w-full bg-neutral-50" style={brandStyle}>
            <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
                {/* Brand side */}
                <aside className="relative hidden lg:block overflow-hidden">
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-orange-200/60 via-amber-100/70 to-white" />
                    {/* soft accents */}
                    <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-[420px] rounded-full bg-[var(--ml-primary)]/10 blur-3xl" />
                    <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 size-[380px] rounded-full bg-orange-400/10 blur-3xl" />

                    <div className="relative mx-auto flex h-full max-w-2xl flex-col justify-between px-12 py-12">
                        <header className="flex items-center gap-3">
                            <Image src="/logo.svg" alt="MonkeysLegion" width={160} height={38} className="rounded-xl" />
                        </header>

                        <div className="pr-4">
                            <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight text-neutral-900">
                                Welcome back
                                <span className="block text-[var(--ml-primary)]">Pick up where you left off.</span>
                            </h1>
                            <ul className="mt-8 space-y-3 text-neutral-700">
                                <li className="flex gap-3">
                                    <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-[var(--ml-primary)]" />
                                    SSO-ready auth and secure sessions.
                                </li>
                                <li className="flex gap-3">
                                    <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-[var(--ml-primary)]" />
                                    Instant access to projects and deploys.
                                </li>
                                <li className="flex gap-3">
                                    <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-[var(--ml-primary)]" />
                                    Built for teams: RBAC and audit logs.
                                </li>
                            </ul>
                        </div>

                        <footer className="text-xs text-neutral-500">© {new Date().getFullYear()} MonkeysLegion. All rights reserved.</footer>
                    </div>
                </aside>

                {/* Form side */}
                <main className="flex items-center justify-center p-6 sm:p-10">
                    <div className="w-full max-w-sm sm:max-w-md">
                        <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
                            {/* Mobile logo */}
                            <div className="mb-4 flex items-center gap-3 lg:hidden">
                                <Image src="/logo.svg" alt="MonkeysLegion" width={32} height={32} className="rounded-lg" />
                                <div className="text-lg font-bold tracking-tight">
                                    Monkeys<span className="text-[var(--ml-primary)]">Legion</span>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
                            <p className="mt-1 text-sm text-neutral-600">Use your work email and password.</p>

                            {justRegistered && (
                                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                    Account created successfully. You can log in now.
                                </div>
                            )}

                            {error && (
                                <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                                {/* Email */}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium">Work email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={`mt-1 w-full rounded-xl border px-3 py-2 outline-none transition focus:ring-2 ${
                                            fieldErrors.email ? "border-red-300 ring-red-200" : "border-neutral-300 focus:ring-[var(--ml-primary)]/30"
                                        }`}
                                        placeholder="you@company.com"
                                        autoComplete="email"
                                        required
                                    />
                                    {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
                                </div>

                                {/* Password */}
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium">Password</label>
                                    <div className="relative">
                                        <input
                                            id="password"
                                            type={showPass ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className={`mt-1 w-full rounded-xl border px-3 py-2 pr-12 outline-none transition focus:ring-2 ${
                                                fieldErrors.password ? "border-red-300 ring-red-200" : "border-neutral-300 focus:ring-[var(--ml-primary)]/30"
                                            }`}
                                            placeholder="Your password"
                                            autoComplete="current-password"
                                            required
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
                                    {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
                                </div>

                                {/* Remember + Forgot */}
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                                        <input
                                            type="checkbox"
                                            checked={remember}
                                            onChange={(e) => setRemember(e.target.checked)}
                                            className="size-4 rounded border-neutral-300 text-[var(--ml-primary)] focus:ring-[var(--ml-primary)]"
                                        />
                                        Remember me
                                    </label>
                                    <a href="/forgot-password" className="text-sm text-[var(--ml-primary)] hover:underline">
                                        Forgot password?
                                    </a>
                                </div>

                                {/* Submit */}
                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="group relative inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ml-primary)] px-4 py-2.5 font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
                                    >
                                        {loading ? "Logging in…" : "Sign in"}
                                        <span aria-hidden className="transition -translate-x-0 group-hover:translate-x-0.5">→</span>
                                    </button>

                                    <p className="mt-3 text-center text-sm text-neutral-600">
                                        Don’t have an account?{" "}
                                        <a href="/register" className="text-[var(--ml-primary)] hover:underline">Create one</a>
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
