"use client";

import React, { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ClipboardDocumentIcon,
    ArrowLeftIcon,
    KeyIcon,
    ShieldCheckIcon,
    CheckIcon,
    SparklesIcon,
    LockClosedIcon,
    DocumentTextIcon,
    CommandLineIcon,
    EnvelopeIcon,
    UsersIcon,
    ServerIcon,
    CheckCircleIcon
} from "@heroicons/react/24/outline";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import copy from "copy-to-clipboard";

interface ApiError {
    error: true;
    message: string;
    fields?: Record<string, string>;
}

const AVAILABLE_SCOPES = [
    { value: 'mail:send', label: 'Send Mail', icon: EnvelopeIcon, description: 'Send emails through the API' },
    { value: 'mail:send:list', label: 'Send to Lists', icon: UsersIcon, description: 'Send to mailing lists' },
    { value: 'mail:send:segment', label: 'Send to Segment', icon: UsersIcon, description: 'Send to user segments' },
    { value: 'mail:read', label: 'Read Mail', icon: DocumentTextIcon, description: 'Read email data' },
    { value: 'domains:list', label: 'List Domains', icon: ServerIcon, description: 'View all domains' },
    { value: 'users:manage', label: 'Manage Users', icon: UsersIcon, description: 'User administration' },
];

export default function CreateDomainApiKeyPage() {
    const router = useRouter();
    const { hash, id } = useParams<{ hash: string; id: string }>();
    const domainId = Number(id);

    const [label, setLabel] = useState("");
    const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState<ApiError | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

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

    const handleCopy = async () => {
        if (!secret) return;
        try {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            copy(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (secret) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-2xl mx-auto p-6">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow mb-6"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back
                    </button>

                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                            <div className="flex items-center gap-3 text-white">
                                <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm">
                                    <CheckCircleIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-semibold">API Key Created Successfully</h1>
                                    <p className="text-sm text-emerald-100 mt-0.5">Your key has been generated and is ready to use</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                                <div className="flex gap-3">
                                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-amber-800">
                                        <p className="font-semibold mb-1">Important Security Notice</p>
                                        <p>Copy your secret key now. For security reasons, you won&#39;t be able to see it again.</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Your API Secret Key
                                </label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 rounded-lg bg-gray-50 border border-gray-200 p-3">
                                        <code className="block font-mono text-sm text-gray-900 break-all">
                                            {secret}
                                        </code>
                                    </div>
                                    <button
                                        onClick={handleCopy}
                                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                                            copied
                                                ? 'bg-emerald-500 text-white shadow-sm'
                                                : 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm'
                                        }`}
                                        title="Copy to clipboard"
                                    >
                                        {copied ? (
                                            <>
                                                <CheckIcon className="h-4 w-4" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <ClipboardDocumentIcon className="h-4 w-4" />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                                    <div className="flex items-start gap-3">
                                        <CommandLineIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                                        <div>
                                            <h3 className="text-sm font-semibold text-blue-900 mb-1">Quick Start</h3>
                                            <p className="text-xs text-blue-700">
                                                Use this key in your API requests by including it in the Authorization header
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
                                    <div className="flex items-start gap-3">
                                        <ShieldCheckIcon className="h-5 w-5 text-purple-600 mt-0.5" />
                                        <div>
                                            <h3 className="text-sm font-semibold text-purple-900 mb-1">Security Tips</h3>
                                            <p className="text-xs text-purple-700">
                                                Store this key securely and never commit it to version control
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => router.push(`/dashboard/company/${hash}/domain/${domainId}?tab=keys`)}
                                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                                >
                                    <CheckIcon className="h-4 w-4" />
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-3xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Create API Key</h1>
                            <p className="text-sm text-gray-500">
                                Domain #{domainId}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error Alert */}
                {apiError && (
                    <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
                        <div className="flex gap-3">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-red-900">Error Creating API Key</h3>
                                <p className="mt-1 text-sm text-red-700">{apiError.message}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Key Label */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <DocumentTextIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Key Details</h3>
                            </div>
                        </div>
                        <div className="p-6">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <SparklesIcon className="h-4 w-4 text-gray-400" />
                                    Label
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    placeholder="e.g., Production API Key, CI/CD Integration"
                                    required
                                />
                                {apiError?.fields?.label && (
                                    <p className="mt-2 text-sm text-red-600">{apiError.fields.label}</p>
                                )}
                                <p className="mt-2 text-xs text-gray-500">
                                    Choose a descriptive name to help you identify this key later
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Scopes */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <ShieldCheckIcon className="h-5 w-5" />
                                    <h3 className="text-sm font-semibold uppercase tracking-wider">Permissions</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1 text-xs font-medium text-white hover:bg-white/30 transition-colors"
                                >
                                    {selectAll ? (
                                        <>
                                            <CheckCircleIcon className="h-3.5 w-3.5" />
                                            Deselect All
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircleIcon className="h-3.5 w-3.5" />
                                            Select All
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {AVAILABLE_SCOPES.map((scope) => {
                                    const isChecked = selectedScopes.includes(scope.value);
                                    const Icon = scope.icon;
                                    return (
                                        <label
                                            key={scope.value}
                                            className={`relative flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-all ${
                                                isChecked
                                                    ? 'bg-indigo-50 ring-2 ring-indigo-500'
                                                    : 'bg-gray-50 hover:bg-gray-100 ring-1 ring-gray-200'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleScope(scope.value)}
                                                className="sr-only"
                                            />
                                            <div className={`rounded-lg p-2 ${
                                                isChecked ? 'bg-indigo-500 text-white' : 'bg-white text-gray-400'
                                            }`}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1">
                                                <div className={`text-sm font-medium ${
                                                    isChecked ? 'text-indigo-900' : 'text-gray-900'
                                                }`}>
                                                    {scope.label}
                                                </div>
                                                <div className={`text-xs ${
                                                    isChecked ? 'text-indigo-700' : 'text-gray-500'
                                                }`}>
                                                    {scope.description}
                                                </div>
                                            </div>
                                            {isChecked && (
                                                <div className="absolute top-3 right-3">
                                                    <CheckIcon className="h-5 w-5 text-indigo-500" />
                                                </div>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                            {apiError?.fields?.scopes && (
                                <p className="mt-3 text-sm text-red-600">{apiError.fields.scopes}</p>
                            )}
                            <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
                                <p className="text-xs text-gray-600">
                                    <LockClosedIcon className="inline h-3.5 w-3.5 mr-1" />
                                    Selected permissions determine what operations this API key can perform. You can create multiple keys with different permission sets for various use cases.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6">
                        <div className="text-sm text-gray-600">
                            <KeyIcon className="inline h-4 w-4 mr-1" />
                            {selectedScopes.length} permission{selectedScopes.length !== 1 ? 's' : ''} selected
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                {saving ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <KeyIcon className="h-4 w-4" />
                                        Create API Key
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}