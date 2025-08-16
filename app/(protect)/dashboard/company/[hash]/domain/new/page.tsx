'use client';

import React, { useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface DomainForm {
    domain: string;
}

interface ApiError {
    error: true;
    message: string;
    fields?: Record<string, string>;
}

export default function CreateDomainPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const [form, setForm] = useState<DomainForm>({ domain: '' });
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState<ApiError|null>(null);

    const getToken = () =>
        typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setForm({ domain: e.target.value });
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        setApiError(null);

        try {
            const token = getToken();
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ domain: form.domain }),
                }
            );

            if (!res.ok) {
                const errJson: ApiError = await res.json();
                setApiError(errJson);
                setSaving(false);
                return;
            }

            // on success, go back to domains list
            router.push(`/dashboard/company/${hash}/domain`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setApiError({ error: true, message });
            setSaving(false);
        }
    }

    return (
        <div className="max-w-md mx-auto bg-white p-6 rounded-md shadow">
            {/* Header */}
            <div className="flex items-center mb-6">
                <button onClick={() => router.back()}
                        className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-gray-100">
                    <ArrowLeftIcon className="h-5 w-5 text-gray-600"/><span className="sr-only">Back</span>
                </button>
                <h1 className="text-xl font-semibold ml-3">Add New Domain</h1>
            </div>

            {/* API Error */}
            {apiError && (
                <div role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-700">
                    {apiError.message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Domain */}
                <div>
                    <label className="block text-sm font-medium mb-1">Domain</label>
                    <input
                        type="text"
                        value={form.domain}
                        onChange={handleChange}
                        className="w-full border rounded p-2"
                        placeholder="example.com"
                    />
                    {apiError?.fields?.domain && (
                        <p className="mt-1 text-sm text-red-600">
                            {apiError.fields.domain}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-2 pt-4 border-t">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? 'Adding…' : 'Add Domain'}
                    </button>
                </div>
            </form>
        </div>
    );
}