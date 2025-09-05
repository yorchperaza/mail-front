"use client";

import React, { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClipboardDocumentIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import copy from "copy-to-clipboard";

interface ApiError {
    error: true;
    message: string;
    fields?: Record<string, string>;
}

const AVAILABLE_SCOPES = [
    { value: 'mail:send', label: 'Send Mail' },
    { value: 'mail:send:list', label: 'Send to Lists' },
    { value: 'mail:send:segment', label: 'Send to Segment' },
    { value: 'mail:read', label: 'Read Mail' },
    { value: 'domains:list', label: 'List Domains' },
    { value: 'users:manage', label: 'Manage Users' },
];

export default function CreateDomainApiKeyPage() {
    const router = useRouter();
    const { hash, id } = useParams<{ hash: string; id: string }>(); // company hash + domain id
    const domainId = Number(id);

    const [label, setLabel] = useState("");
    const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState<ApiError | null>(null);
    const [secret, setSecret] = useState<string | null>(null);

    const getToken = () =>
        typeof window !== "undefined" ? localStorage.getItem("jwt") : null;

    const toggleScope = (scope: string) => {
        setSelectedScopes((prev) =>
            prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
        );
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedScopes([]);
        } else {
            setSelectedScopes(AVAILABLE_SCOPES.map((s) => s.value));
        }
        setSelectAll((v) => !v);
    };

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();

        if (!label.trim()) {
            setApiError({
                error: true,
                message: "Label is required",
                fields: { label: "Required" },
            });
            return;
        }
        if (selectedScopes.length === 0) {
            setApiError({
                error: true,
                message: "At least one scope must be selected",
                fields: { scopes: "Select one or more" },
            });
            return;
        }

        setSaving(true);
        setApiError(null);

        const payload = {
            label: label.trim(),
            scopes: selectedScopes,
        };

        try {
            const token = getToken();
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains/${domainId}/apikeys`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!res.ok) {
                // Try to parse structured error, fall back to generic text
                let errJson: ApiError | null = null;
                try {
                    errJson = (await res.json()) as ApiError;
                } catch {}
                setApiError(
                    errJson ?? {
                        error: true,
                        message: `Failed to create key (${res.status})`,
                    }
                );
                setSaving(false);
                return;
            }

            const { secret: newSecret } = (await res.json()) as { secret: string };
            setSecret(newSecret);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setApiError({ error: true, message });
            setSaving(false);
        }
    }

    if (secret) {
        return (
            <div className="max-w-lg mx-auto bg-white p-6 rounded-md shadow">
                <button
                    onClick={() => router.back()}
                    className="inline-flex items-center mb-4 text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" />
                    Back
                </button>
                <h1 className="text-2xl font-semibold mb-4">API Key Created</h1>
                <p className="mb-2 text-sm text-gray-500">
                    Copy your secret now. You won’t see it again!
                </p>
                <div className="flex items-center bg-gray-100 rounded p-3 mb-4">
                    <code className="flex-1 font-mono break-all">{secret}</code>
                    <button
                        onClick={() => copy(secret)}
                        className="ml-2 p-2 rounded hover:bg-gray-200"
                        title="Copy to clipboard"
                    >
                        <ClipboardDocumentIcon className="h-5 w-5 text-gray-600" />
                    </button>
                </div>
                <button
                    onClick={() =>
                        router.push(`/dashboard/company/${hash}/domain/${domainId}?tab=keys`)
                    }
                    className="px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900"
                >
                    Done
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto bg-white p-6 rounded-md shadow">
            <button
                onClick={() => router.back()}
                className="inline-flex items-center mb-4 text-gray-600 hover:text-gray-800"
            >
                <ArrowLeftIcon className="h-5 w-5 mr-1" />
                Back
            </button>
            <h1 className="text-2xl font-semibold mb-6">
                Create Domain API Key <span className="text-gray-500 text-base">(# {domainId})</span>
            </h1>

            {apiError && (
                <div role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-700">
                    {apiError.message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Label (required) */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Label <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        className="w-full border rounded p-2"
                        placeholder="e.g. CI/CD token"
                        required
                    />
                    {apiError?.fields?.label && (
                        <p className="mt-1 text-sm text-red-600">{apiError.fields.label}</p>
                    )}
                </div>

                {/* Scopes */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium">Scopes</label>
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            {selectAll ? "Deselect All" : "Select All"}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {AVAILABLE_SCOPES.map((scope) => (
                            <label key={scope.value} className="inline-flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={selectedScopes.includes(scope.value)}
                                    onChange={() => toggleScope(scope.value)}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">{scope.label}</span>
                            </label>
                        ))}
                    </div>
                    {apiError?.fields?.scopes && (
                        <p className="mt-1 text-sm text-red-600">{apiError.fields.scopes}</p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900 disabled:opacity-50"
                    >
                        {saving ? "Creating…" : "Create Key"}
                    </button>
                </div>
            </form>
        </div>
    );
}
