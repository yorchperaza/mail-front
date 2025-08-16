"use client";

import { useState, useEffect, FormEvent } from "react";

interface Company {
    id: number;
    name: string;
}

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [newName, setNewName]     = useState("");
    const [error, setError]         = useState<string | null>(null);
    const [loading, setLoading]     = useState(false);

    function authHeaders() {
        const token = typeof window !== "undefined"
            ? localStorage.getItem("jwt")
            : null;
        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }
    // 1) Load existing companies
    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies`,
                    { headers: authHeaders() }
                );
                if (!res.ok) {
                    throw new Error(`Failed to load: ${res.status}`);
                }
                setCompanies(await res.json());
            } catch (err) {
                const message = err instanceof Error ? err.message : "An unexpected error occurred";
                setError(message);
            }
        }
        load();
    }, []);

    // 2) Handle creation
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) {
            setError("Name can’t be empty");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies`,
                {
                    method: "POST",
                    headers: authHeaders(),
                    body: JSON.stringify({ name: newName.trim() }),
                }
            );
            const body = await res.json();
            if (res.status === 201) {
                setCompanies((cur) => [...cur, body]);
                setNewName("");
            } else {
                setError(body.message || "Failed to create");
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "An unexpected error occurred";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center p-6 bg-gray-50">
            <h1 className="text-3xl font-bold mb-6">Your Companies</h1>

            {error && <p className="mb-4 text-red-600">{error}</p>}

            <ul className="w-full max-w-md mb-8 space-y-2">
                {companies.length > 0 ? companies.map(c => (
                    <li key={c.id} className="px-4 py-2 bg-white shadow rounded">
                        {c.name}
                    </li>
                )) : (
                    <li className="px-4 py-2 text-gray-500">No companies yet.</li>
                )}
            </ul>

            <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-6 rounded-lg shadow space-y-4">
                <div>
                    <label htmlFor="name" className="block font-medium mb-1">
                        New Company Name
                    </label>
                    <input
                        id="name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Acme Corp"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                    {loading ? "Saving…" : "Create Company"}
                </button>
            </form>
        </div>
    );
}