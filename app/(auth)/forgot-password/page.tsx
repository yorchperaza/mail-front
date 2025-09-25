"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";

export default function ForgotPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-sky-50">
                    <div className="text-blue-600">Loading...</div>
                </div>
            }
        >
            <ForgotPasswordContent />
        </Suspense>
    );
}

function ForgotPasswordContent() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // resend state
    const RESEND_WAIT = 60; // seconds
    const [cooldown, setCooldown] = useState(0); // seconds remaining
    const canResend = useMemo(() => cooldown <= 0 && !loading, [cooldown, loading]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const id = setInterval(() => setCooldown((c) => c - 1), 1000);
        return () => clearInterval(id);
    }, [cooldown]);

    function validate(): boolean {
        setFieldError(null);
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            setFieldError("Enter a valid email address.");
            return false;
        }
        return true;
    }

    async function requestReset(currentEmail: string) {
        setLoading(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/password/forgot`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: currentEmail }),
                }
            );

            // Always show success UX (avoid email enumeration)
            setSent(true);
            setCooldown(RESEND_WAIT);
            if (!res.ok) {
                // Optionally log, but do not reveal errors to user
                // setError("We couldn't send the email right now. Please try again.");
            }
        } catch (err) {
            // Still flip to "sent" UX for consistency, but surface a generic msg
            setSent(true);
            setCooldown(RESEND_WAIT);
            setError(
                err instanceof Error ? err.message : "Unexpected error. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!validate()) return;
        await requestReset(email);
    }

    async function handleResend() {
        if (!validate()) return;
        await requestReset(email);
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-sky-50">
            {/* background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -left-40 -top-40 h-96 w-96 animate-blob rounded-full bg-blue-300/30 mix-blend-multiply blur-3xl" />
                <div className="animation-delay-2000 absolute -right-40 top-20 h-96 w-96 animate-blob rounded-full bg-cyan-300/30 mix-blend-multiply blur-3xl" />
                <div className="animation-delay-4000 absolute -bottom-40 left-40 h-96 w-96 animate-blob rounded-full bg-sky-300/30 mix-blend-multiply blur-3xl" />
                <div className="absolute right-40 bottom-20 h-96 w-96 animate-blob rounded-full bg-indigo-300/30 mix-blend-multiply blur-3xl" />
            </div>

            <div
                className="fixed inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage:
                        "linear-gradient(90deg, #000 1px, transparent 1px), linear-gradient(#000 1px, transparent 1px)",
                    backgroundSize: "50px 50px",
                }}
            />

            <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-2">
                {/* Brand side */}
                <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden">
                    <header className="flex items-center gap-3">
                        <Image
                            src="/logo.svg"
                            alt="MonkeysLegion"
                            width={160}
                            height={38}
                            className="rounded-xl"
                        />
                    </header>

                    <div className="max-w-xl">
                        <h1 className="text-5xl font-black leading-tight">
                            <span className="text-blue-500">Forgot your password?</span>
                            <span className="block bg-gradient-to-br from-blue-900 via-blue-600 to-sky-600 bg-clip-text text-transparent">
                We’ll email you a reset link.
              </span>
                        </h1>
                        <p className="mt-6 text-gray-600">
                            Enter the work email associated with your account and we’ll send a
                            secure password reset link.
                        </p>
                    </div>

                    <footer className="text-xs text-gray-500">
                        © {new Date().getFullYear()} MonkeysLegion. All rights reserved.
                    </footer>
                </aside>

                {/* Form side */}
                <main className="relative flex items-center justify-center p-6 sm:p-10">
                    <div className="w-full max-w-sm sm:max-w-md">
                        <div className="rounded-3xl bg-white/90 backdrop-blur-xl shadow-2xl ring-1 ring-blue-200/50 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-sky-600 px-6 py-4">
                                <div className="flex items-center gap-3 lg:hidden mb-2">
                                    <Image
                                        src="/logo.svg"
                                        alt="MonkeysLegion"
                                        width={140}
                                        height={32}
                                        className="rounded-lg"
                                    />
                                </div>
                                <h2 className="text-xl font-semibold text-white">
                                    Reset your password
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    We’ll send a reset link to your email
                                </p>
                            </div>

                            <div className="p-6 space-y-4">
                                {sent ? (
                                    <>
                                        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                                            <div className="flex items-start gap-2">
                                                <svg
                                                    className="h-5 w-5 text-blue-600 mt-0.5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M16 12l-4-4-4 4m8 0l-4 4-4-4"
                                                    />
                                                </svg>
                                                <div className="text-sm text-blue-800">
                                                    <p>
                                                        If an account exists for <b>{email}</b>, we’ve sent a
                                                        password reset link. Check your inbox and spam folder.
                                                    </p>
                                                    {error && (
                                                        <p className="mt-2 text-blue-900/80">{error}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Didn't get it? helper */}
                                        <div className="rounded-lg border border-blue-100 bg-white p-3">
                                            <p className="text-sm font-medium text-gray-800">
                                                Didn’t get the email?
                                            </p>
                                            <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 space-y-1">
                                                <li>Give it a minute and check your spam/junk folder.</li>
                                                <li>
                                                    Search your inbox for{" "}
                                                    <code className="text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                                                        no-reply@monkeysmail.com
                                                    </code>
                                                    .
                                                </li>
                                            </ul>

                                            <div className="mt-3 flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleResend}
                                                    disabled={!canResend}
                                                    className={`rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition ${
                                                        canResend
                                                            ? "bg-blue-600 text-white hover:bg-blue-700"
                                                            : "bg-gray-200 text-gray-500 cursor-not-allowed"
                                                    }`}
                                                >
                                                    {canResend
                                                        ? "Resend email"
                                                        : `You can resend in ${cooldown}s`}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSent(false);
                                                        setCooldown(0);
                                                    }}
                                                    className="rounded-lg px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                                                    title="Use a different email"
                                                >
                                                    Use a different email
                                                </button>
                                            </div>
                                        </div>

                                        <p className="mt-4 text-center text-sm text-gray-600">
                                            Remembered your password?{" "}
                                            <a
                                                href="/login"
                                                className="font-medium text-blue-600 hover:text-blue-700"
                                            >
                                                Back to sign in
                                            </a>
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        {error && (
                                            <div
                                                role="alert"
                                                className="rounded-lg bg-red-50 border border-red-200 p-3"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <svg
                                                        className="h-5 w-5 text-red-400"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                    <p className="text-sm text-red-800">{error}</p>
                                                </div>
                                            </div>
                                        )}

                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <div>
                                                <label
                                                    htmlFor="email"
                                                    className="block text-sm font-medium text-gray-700 mb-1"
                                                >
                                                    Work Email
                                                </label>
                                                <input
                                                    id="email"
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className={`w-full rounded-lg border shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 ${
                                                        fieldError ? "border-red-300" : "border-blue-200"
                                                    }`}
                                                    placeholder="you@company.com"
                                                    autoComplete="email"
                                                    required
                                                />
                                                {fieldError && (
                                                    <p className="mt-1 text-xs text-red-600">
                                                        {fieldError}
                                                    </p>
                                                )}
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:from-blue-700 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                                            >
                                                {loading ? "Sending..." : "Email me a reset link"}
                                            </button>

                                            <p className="mt-4 text-center text-sm text-gray-600">
                                                Remembered your password?{" "}
                                                <a
                                                    href="/login"
                                                    className="font-medium text-blue-600 hover:text-blue-700"
                                                >
                                                    Back to sign in
                                                </a>
                                            </p>
                                        </form>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <style jsx>{`
                @keyframes blob {
                    0%,
                    100% {
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
