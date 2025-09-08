'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    QueueListIcon,
    UserPlusIcon,
    EnvelopeIcon,
    UserIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    DocumentTextIcon,
    PlusIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
} from '@heroicons/react/24/solid';

type ListGroup = {
    id: number;
    name: string;
    created_at: string | null;
    counts?: { contacts: number | null; campaigns: number | null };
};

type BulkResult = {
    summary: { added: number; skipped: number; total: number };
    results: Array<{ email: string; status: 'added' | 'exists'; membership_id: number }>;
};

/* ---------- Components ---------- */
function Toast({
                   kind = 'info',
                   text,
                   onClose,
               }: {
    kind?: 'info' | 'success' | 'error';
    text: string;
    onClose: () => void;
}) {
    const styles = {
        success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        error: 'bg-rose-50 border-rose-200 text-rose-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    return (
        <div
            className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border px-4 py-3 shadow-lg ${styles[kind]}`}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{text}</span>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1 hover:bg-white/40 transition-colors"
                    aria-label="Close"
                    title="Close"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function StatCard({
                      label,
                      value,
                      icon,
                      color,
                  }: {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: 'emerald' | 'amber' | 'blue';
}) {
    const colors = {
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        blue: 'from-blue-500 to-blue-600',
    };

    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className={`bg-gradient-to-r ${colors[color]} p-2`}>
                <div className="flex items-center justify-between text-white">
                    {icon}
                    <span className="text-[10px] font-medium uppercase tracking-wider opacity-90">{label}</span>
                </div>
            </div>
            <div className="p-3">
                <div className="text-xl font-bold text-gray-900">{value.toLocaleString()}</div>
            </div>
        </div>
    );
}

export default function ListCreatePage() {
    const router = useRouter();
    const params = useParams<{ hash: string }>();
    const hash = params.hash;

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const backHref = `/dashboard/company/${hash}/lists`;

    // State
    const [name, setName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createErr, setCreateErr] = useState<string | null>(null);
    const [createdList, setCreatedList] = useState<ListGroup | null>(null);
    const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);

    // Bulk add state
    const [bulkOpen, setBulkOpen] = useState(false);
    const [emailsText, setEmailsText] = useState('');
    const [defaultName, setDefaultName] = useState('');
    const [bulkWorking, setBulkWorking] = useState(false);
    const [bulkErr, setBulkErr] = useState<string | null>(null);
    const [bulkRes, setBulkRes] = useState<BulkResult | null>(null);

    const canCreate = useMemo(() => name.trim().length > 0, [name]);

    function showToast(kind: 'info' | 'success' | 'error', text: string) {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 3000);
    }

    async function onCreate() {
        if (!backend) return setCreateErr('Missing backend URL');
        setCreating(true);
        setCreateErr(null);
        setCreatedList(null);

        try {
            const res = await fetch(`${backend}/companies/${hash}/lists`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ name: name.trim() }),
            });
            const payload: ListGroup | { error?: string } = await res.json();
            if (!res.ok) throw new Error(('error' in payload && payload.error) ? payload.error : `Create failed (${res.status})`);
            setCreatedList(payload as ListGroup);
            setBulkOpen(true);
            showToast('success', `List "${name.trim()}" created successfully!`);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setCreateErr(message);
            showToast('error', message);
        } finally {
            setCreating(false);
        }
    }

    async function onBulkAdd() {
        if (!backend) return setBulkErr('Missing backend URL');
        if (!createdList) return setBulkErr('Create the list first.');
        const emails = emailsText
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean);

        if (emails.length === 0) {
            setBulkErr('Add at least one email (one per line).');
            return;
        }

        setBulkWorking(true);
        setBulkErr(null);
        setBulkRes(null);

        try {
            const res = await fetch(`${backend}/companies/${hash}/lists/${createdList.id}/contacts/bulk`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ emails, default_name: defaultName || undefined }),
            });
            const payload: BulkResult | { error?: string } = await res.json();
            if (!res.ok) throw new Error(('error' in payload && payload.error) ? payload.error : `Import failed (${res.status})`);
            setBulkRes(payload as BulkResult);
            const result = payload as BulkResult;
            showToast('success', `Import complete! ${result.summary.added} added, ${result.summary.skipped} skipped.`);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setBulkErr(message);
            showToast('error', message);
        } finally {
            setBulkWorking(false);
        }
    }

    const emailCount = emailsText.split(/\r?\n/).filter(s => s.trim()).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                {toast && <Toast kind={toast.kind} text={toast.text} onClose={() => setToast(null)} />}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(backHref)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Lists
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Create New List</h1>
                            <p className="text-sm text-gray-500">Create a list and optionally add contacts</p>
                        </div>
                    </div>
                </div>

                {/* Create List Section */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <QueueListIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">List Details</h3>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <QueueListIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                List Name *
                            </label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Newsletter Subscribers, Spring Sale Leads"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                disabled={!!createdList}
                            />
                        </div>

                        {createErr && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5" />
                                <div className="text-sm text-red-800">{createErr}</div>
                            </div>
                        )}

                        {createdList ? (
                            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircleSolid className="h-5 w-5 text-emerald-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-emerald-900">
                                            List created successfully!
                                        </p>
                                        <p className="text-xs text-emerald-700 mt-1">
                                            <span className="font-semibold">{createdList.name}</span> •
                                            ID: {createdList.id}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={onCreate}
                                disabled={!canCreate || creating}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                            >
                                <PlusIcon className="h-5 w-5" />
                                {creating ? 'Creating…' : 'Create List'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Bulk Add Contacts Section */}
                <div className={`rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden transition-all ${
                    createdList ? 'opacity-100' : 'opacity-50 pointer-events-none'
                }`}>
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <UserPlusIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Add Contacts (Optional)</h3>
                            </div>
                            <label className="inline-flex items-center gap-2 text-white text-sm">
                                <input
                                    type="checkbox"
                                    checked={bulkOpen}
                                    onChange={(e) => setBulkOpen(e.target.checked)}
                                    disabled={!createdList}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs">Enable bulk import</span>
                            </label>
                        </div>
                    </div>

                    {bulkOpen && (
                        <div className="p-6 space-y-4">
                            {!createdList ? (
                                <div className="text-center py-8">
                                    <InformationCircleIcon className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-500">
                                        Create the list first to enable importing contacts
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="lg:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                <EnvelopeIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                                Email Addresses
                                                {emailCount > 0 && (
                                                    <span className="ml-2 text-xs text-gray-500">
                                                        ({emailCount} {emailCount === 1 ? 'email' : 'emails'})
                                                    </span>
                                                )}
                                            </label>
                                            <textarea
                                                value={emailsText}
                                                onChange={(e) => setEmailsText(e.target.value)}
                                                rows={8}
                                                placeholder="Enter email addresses, one per line:&#10;alice@example.com&#10;bob@example.com&#10;charlie@example.com"
                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Invalid emails will be skipped. Duplicates are handled automatically.
                                            </p>
                                        </div>

                                        <div className="lg:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                <UserIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                                Default Name (Optional)
                                            </label>
                                            <input
                                                value={defaultName}
                                                onChange={(e) => setDefaultName(e.target.value)}
                                                placeholder="e.g. Subscriber, Customer"
                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Used when creating new contacts without a name
                                            </p>
                                        </div>
                                    </div>

                                    {bulkErr && (
                                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                                            <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mt-0.5" />
                                            <div className="text-sm text-red-800">{bulkErr}</div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={onBulkAdd}
                                            disabled={bulkWorking || !emailsText.trim()}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                        >
                                            <UserPlusIcon className="h-5 w-5" />
                                            {bulkWorking ? 'Importing…' : 'Import Emails'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Results Section */}
                {bulkRes && (
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <CheckCircleSolid className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Import Results</h3>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-4">
                                <StatCard
                                    label="Added"
                                    value={bulkRes.summary.added}
                                    icon={<CheckCircleIcon className="h-4 w-4" />}
                                    color="emerald"
                                />
                                <StatCard
                                    label="Skipped"
                                    value={bulkRes.summary.skipped}
                                    icon={<XMarkIcon className="h-4 w-4" />}
                                    color="amber"
                                />
                                <StatCard
                                    label="Total"
                                    value={bulkRes.summary.total}
                                    icon={<DocumentTextIcon className="h-4 w-4" />}
                                    color="blue"
                                />
                            </div>

                            {/* Detailed Results Table */}
                            {bulkRes.results.length > 0 && (
                                <div className="rounded-lg border border-gray-200 overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                Email
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                Status
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                Membership ID
                                            </th>
                                        </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                        {bulkRes.results.map((r, i) => (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-sm text-gray-700">{r.email}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                                            r.status === 'added'
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}>
                                                            {r.status === 'added' ? (
                                                                <CheckCircleSolid className="h-3 w-3" />
                                                            ) : (
                                                                <InformationCircleIcon className="h-3 w-3" />
                                                            )}
                                                            {r.status}
                                                        </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    #{r.membership_id}
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                    <Link
                        href={backHref}
                        className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        ← Back to all lists
                    </Link>

                    {createdList && (
                        <Link
                            href={`/dashboard/company/${hash}/lists/${createdList.id}/contacts`}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all"
                        >
                            View List Members
                            <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}