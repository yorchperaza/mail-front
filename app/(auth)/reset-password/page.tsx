"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-sky-50">
                    <div className="text-blue-600">Loading...</div>
                </div>
            }
        >
            <ResetPasswordContent />
        </Suspense>
    );
}

function ResetPasswordContent() {
    const router = useRouter();
    const params = useSearchParams();

    const token = useMemo(() => params?.get("token") ?? "", [params]);

    const [emailMask, setEmailMask] = useState<string>("");
    const [emailFull, setEmailFull] = useState<string>("");
    const [loadingInfo, setLoadingInfo] = useState(true);

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        let ignore = false;
        async function fetchInfo() {
            if (!token) {
                setError("Missing reset token.");
                setLoadingInfo(false);
                return;
            }
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/password/token-info?token=${encodeURIComponent(
                        token
                    )}`
                );
                const data = await res.json().catch(() => ({}));
                if (!ignore) {
                    if (res.ok) {
                        setEmailMask(data.emailMask || data.email || "");
                        setEmailFull(data.email || "");
                    } else {
                        setError(data.message || "Invalid or expired reset link.");
                    }
                }
            } catch (e) {
                if (!ignore) {
                    setError(e instanceof Error ? e.message : "Unexpected error.");
                }
            } finally {
                if (!ignore) setLoadingInfo(false);
            }
        }
        fetchInfo();
        return () => {
            ignore = true;
        };
    }, [token]);

    function validate(): boolean {
        const errs: Record<string, string> = {};
        if (!token) errs.token = "Missing token.";
        if (!password || password.length < 8)
            errs.password = "Password must be at least 8 characters.";
        if (password !== confirm) errs.confirm = "Passwords do not match.";
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!validate()) return;

        setLoading(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/password/reset`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, password }), // <-- token-only
                }
            );

            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setDone(true);
                setTimeout(() => router.push("/login"), 2000);
            } else {
                setError(
                    (data.message as string) ||
                    "Invalid or expired reset link. Try again."
                );
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unexpected error. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-sky-50">
            {/* background blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -left-40 -top-40 h-96 w-96 animate-blob rounded-full bg-blue-300/30 mix-blend-multiply blur-3xl" />
                <div className="animation-delay-2000 absolute -right-40 top-20 h-96 w-96 animate-blob rounded-full bg-cyan-300/30 mix-blend-multiply blur-3xl" />
                <div className="animation-delay-4000 absolute -bottom-40 left-40 h-96 w-96 animate-blob rounded-full bg-sky-300/30 mix-blend-multiply blur-3xl" />
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
                            <span className="text-blue-500">Set a new password</span>
                            <span className="block bg-gradient-to-br from-blue-900 via-blue-600 to-sky-600 bg-clip-text text-transparent">
                You’re almost there.
              </span>
                        </h1>
                        <p className="mt-6 text-gray-600">
                            Choose a strong password you haven’t used before.
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
                                    Create your new password
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">Tokenized secure reset</p>
                            </div>

                            <div className="p-6 space-y-4">
                                {done ? (
                                    <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                                        <div className="flex items-start gap-2">
                                            <svg
                                                className="h-5 w-5 text-green-600 mt-0.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M9 12l2 2 4-4"
                                                />
                                            </svg>
                                            <div className="text-sm text-green-800">
                                                <p className="font-medium">Password updated!</p>
                                                <p className="mt-1">
                                                    You can now{" "}
                                                    <a className="text-green-700 underline" href="/login">
                                                        sign in
                                                    </a>{" "}
                                                    with your new password.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
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

                                        {/* account email from token */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Account
                                            </label>
                                            <input
                                                type="text"
                                                value={
                                                    loadingInfo
                                                        ? "Checking token…"
                                                        : (emailMask || emailFull || "")
                                                }
                                                readOnly
                                                className="w-full rounded-lg border border-blue-200 bg-gray-50 text-gray-700 shadow-sm"
                                            />
                                        </div>

                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            {/* password */}
                                            <div>
                                                <label
                                                    htmlFor="password"
                                                    className="block text-sm font-medium text-gray-700 mb-1"
                                                >
                                                    New Password
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        id="password"
                                                        type={showPass ? "text" : "password"}
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        className={`w-full rounded-lg border shadow-sm pr-10 focus:border-blue-500 focus:ring-blue-500 ${
                                                            fieldErrors.password
                                                                ? "border-red-300"
                                                                : "border-blue-200"
                                                        }`}
                                                        placeholder="At least 8 characters"
                                                        autoComplete="new-password"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPass((p) => !p)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700"
                                                        aria-label={showPass ? "Hide password" : "Show password"}
                                                    >
                                                        {showPass ? (
                                                            <EyeSlashIcon className="h-5 w-5" />
                                                        ) : (
                                                            <EyeIcon className="h-5 w-5" />
                                                        )}
                                                    </button>
                                                </div>
                                                {fieldErrors.password && (
                                                    <p className="mt-1 text-xs text-red-600">
                                                        {fieldErrors.password}
                                                    </p>
                                                )}
                                            </div>

                                            {/* confirm */}
                                            <div>
                                                <label
                                                    htmlFor="confirm"
                                                    className="block text-sm font-medium text-gray-700 mb-1"
                                                >
                                                    Confirm Password
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        id="confirm"
                                                        type={showConfirm ? "text" : "password"}
                                                        value={confirm}
                                                        onChange={(e) => setConfirm(e.target.value)}
                                                        className={`w-full rounded-lg border shadow-sm pr-10 focus:border-blue-500 focus:ring-blue-500 ${
                                                            fieldErrors.confirm
                                                                ? "border-red-300"
                                                                : "border-blue-200"
                                                        }`}
                                                        placeholder="Repeat your password"
                                                        autoComplete="new-password"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirm((p) => !p)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700"
                                                        aria-label={
                                                            showConfirm ? "Hide confirmation" : "Show confirmation"
                                                        }
                                                    >
                                                        {showConfirm ? (
                                                            <EyeSlashIcon className="h-5 w-5" />
                                                        ) : (
                                                            <EyeIcon className="h-5 w-5" />
                                                        )}
                                                    </button>
                                                </div>
                                                {fieldErrors.confirm && (
                                                    <p className="mt-1 text-xs text-red-600">
                                                        {fieldErrors.confirm}
                                                    </p>
                                                )}
                                            </div>

                                            {/* token error, if any */}
                                            {fieldErrors.token && (
                                                <p className="text-xs text-red-600">{fieldErrors.token}</p>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={loading || loadingInfo}
                                                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:from-blue-700 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                                            >
                                                {loading ? "Updating..." : "Set new password"}
                                            </button>

                                            <p className="mt-4 text-center text-sm text-gray-600">
                                                Not you? Open the reset link from the correct email inbox.
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
