"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Company {
    // Accept either numeric id or hash string
    id?: number;
    hash?: string;
    name: string;
}

interface User {
    id: number;
    email: string;
    fullName: string;
    avatarUrl?: { url: string };
}

type MeRedirect = { redirectTo: string };

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function toNumberOrNull(v: unknown): number | null {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
        return Number(v);
    }
    return null;
}

function maybeArray(v: unknown): unknown[] | null {
    if (Array.isArray(v)) return v;
    if (isObject(v)) {
        const poss = ["data", "items", "results"];
        for (const key of poss) {
            const val = v[key as keyof typeof v];
            if (Array.isArray(val)) return val as unknown[];
        }
    }
    return null;
}

function parseUser(v: unknown): User | null {
    if (!isObject(v)) return null;
    const id = toNumberOrNull(v.id);
    const email = typeof v.email === "string" ? v.email : null;
    const fullName = typeof v.fullName === "string" ? v.fullName : null;

    if (id === null || !email || !fullName) return null;

    let avatarUrl: User["avatarUrl"] | undefined;
    const a = v.avatarUrl;
    if (isObject(a) && typeof a.url === "string") {
        avatarUrl = { url: a.url };
    }

    return { id, email, fullName, avatarUrl };
}

function parseCompanies(v: unknown): Company[] {
    const arr = maybeArray(v);
    if (!arr) return [];

    const out: Company[] = [];
    for (const item of arr) {
        if (!isObject(item)) continue;

        // Accept either id or hash
        const id = toNumberOrNull(item.id);
        const hash = typeof item.hash === "string" && item.hash.trim() !== "" ? item.hash : undefined;
        const name = typeof item.name === "string" ? item.name : null;

        if ((id !== null || hash) && name) {
            out.push({
                ...(id !== null ? { id } : {}),
                ...(hash ? { hash } : {}),
                name,
            });
        }
    }
    return out;
}

function isMeRedirect(v: unknown): v is MeRedirect {
    return isObject(v) && typeof v.redirectTo === "string";
}

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    function authHeaders(): HeadersInit {
        const token = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }

    useEffect(() => {
        async function loadData() {
            try {
                // 1) /auth/me
                const meRes = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`,
                    { headers: authHeaders() }
                );
                if (!meRes.ok) {
                    throw new Error(`Failed to load user: ${meRes.status}`);
                }

                const rawMe: unknown = await meRes.json();

                if (isMeRedirect(rawMe)) {
                    router.push(rawMe.redirectTo);
                    return;
                }

                const parsedUser = parseUser(rawMe);
                if (!parsedUser) {
                    throw new Error("Unexpected /auth/me response shape");
                }
                setUser(parsedUser);

                // 2) companies
                const compsRes = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies`,
                    { headers: authHeaders() }
                );
                if (!compsRes.ok) {
                    throw new Error(`Failed to load companies: ${compsRes.status}`);
                }

                const rawCompanies: unknown = await compsRes.json();
                const parsedCompanies = parseCompanies(rawCompanies);
                setCompanies(parsedCompanies);
            } catch (err) {
                const message = err instanceof Error ? err.message : "An unexpected error occurred";
                setError(message);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading dashboard…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-red-600">{error}</p>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen p-6 bg-gray-50">
            <header className="max-w-3xl mx-auto mb-8">
                <h1 className="text-3xl font-bold">
                    Welcome, {user.fullName || user.email}!
                </h1>
            </header>

            <section className="max-w-3xl mx-auto">
                <h2 className="text-2xl font-semibold mb-4">Your Companies</h2>
                {companies.length > 0 ? (
                    <ul className="space-y-2">
                        {companies.map((c) => (
                            <li
                                key={c.id ?? c.hash!}  // safe: one of them exists by parser
                                className="px-4 py-2 bg-white shadow rounded-lg"
                            >
                                {c.name}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">You’re not part of any companies yet.</p>
                )}
            </section>
        </div>
    );
}
