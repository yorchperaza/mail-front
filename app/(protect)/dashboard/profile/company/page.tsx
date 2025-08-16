// app/dashboard/companies/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@heroicons/react/24/outline";

interface Company {
    id: number;
    hash: string;
    name: string;
}

export default function CompaniesListPage() {
    const router = useRouter();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const authHeaders = (): HeadersInit => {
        const token =
            typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies`,
                    { headers: authHeaders() }
                );
                if (!res.ok) throw new Error(`Failed: ${res.status}`);
                const data: Company[] = await res.json();
                setCompanies(data);
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : "Failed to load companies list"
                );
            } finally {
                setLoading(false);
            }
        }

        load();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading companies…</p>
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

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-semibold">Your Companies</h1>
                <button
                    onClick={() => router.push("/dashboard/profile/company/new")}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    <PlusIcon className="h-5 w-5" />
                    <span>New Company</span>
                </button>
            </div>

            {/* No companies yet */}
            {companies.length === 0 && (
                <p className="text-gray-500">
                    You haven’t created any companies yet. Click “New Company” to get
                    started.
                </p>
            )}

            {/* Cards grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {companies.map((c) => (
                    <Link
                        key={c.hash}
                        href={`/dashboard/company/${c.hash}`}
                        className="block border rounded-lg p-4 shadow hover:shadow-md transition"
                    >
                        <h2 className="text-lg font-medium mb-1">{c.name}</h2>
                        <p className="text-sm text-gray-500 break-all">{c.hash}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}