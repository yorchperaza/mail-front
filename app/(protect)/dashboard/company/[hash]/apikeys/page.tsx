// app/dashboard/companies/[hash]/apikeys/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TrashIcon, PlusIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

interface ApiKey {
    id: number;
    label: string | null;
    prefix: string;
    scopes: string[];
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
}

export default function ApiKeysListPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const authHeaders = () => {
        const token = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    useEffect(() => {
        async function loadKeys() {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/apikeys`,
                    { headers: authHeaders() }
                );
                if (!res.ok) throw new Error(`Failed to load API keys (${res.status})`);
                setKeys(await res.json());
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                setLoading(false);
            }
        }
        loadKeys();
    }, [hash]);

    async function handleDelete(id: number) {
        if (!confirm("Are you sure you want to delete this API key?")) return;
        setDeletingId(id);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/apikeys/${id}`,
                { method: "DELETE", headers: authHeaders() }
            );
            if (!res.ok) throw new Error(`Delete failed (${res.status})`);
            setKeys((k) => k.filter((key) => key.id !== id));
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    if (loading) return <p className="text-center mt-8">Loading API keys…</p>;
    if (error) return <p className="text-center mt-8 text-red-600">{error}</p>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(`/dashboard/company/${hash}`)}
                    className="inline-flex items-center text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <Link
                    href={`/dashboard/company/${hash}/apikeys/create`}
                    className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                >
                    <PlusIcon className="h-5 w-5 mr-1" /> Create API Key
                </Link>
            </div>

            {keys.length === 0 ? (
                <p className="text-gray-500">No API keys found.</p>
            ) : (
                <div className="space-y-4">
                    {keys.map((key) => (
                        <div
                            key={key.id}
                            className="flex items-center justify-between bg-white p-4 rounded shadow"
                        >
                            <div>
                                <p className="font-medium">{key.label || <span className="italic text-gray-500">(no label)</span>}</p>
                                <p className="text-sm text-gray-600">Prefix: {key.prefix}</p>
                                <p className="text-sm text-gray-600">Scopes: {key.scopes.join(", ")}</p>
                                <p className="text-xs text-gray-400">Created: {new Date(key.created_at).toLocaleString()}</p>
                            </div>
                            <button
                                onClick={() => handleDelete(key.id)}
                                disabled={deletingId === key.id}
                                className="p-2 text-red-600 hover:bg-red-100 rounded"
                                title="Delete API key"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
