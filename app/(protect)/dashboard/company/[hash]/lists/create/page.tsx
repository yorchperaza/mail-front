'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';

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

    const [name, setName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createErr, setCreateErr] = useState<string | null>(null);
    const [createdList, setCreatedList] = useState<ListGroup | null>(null);

    // bulk add state
    const [bulkOpen, setBulkOpen] = useState(false);
    const [emailsText, setEmailsText] = useState('');
    const [defaultName, setDefaultName] = useState('');
    const [bulkWorking, setBulkWorking] = useState(false);
    const [bulkErr, setBulkErr] = useState<string | null>(null);
    const [bulkRes, setBulkRes] = useState<BulkResult | null>(null);

    const canCreate = useMemo(() => name.trim().length > 0, [name]);

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
            setBulkOpen(true); // open the bulk add section right away (optional)
        } catch (e) {
            setCreateErr(e instanceof Error ? e.message : String(e));
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
            return setBulkErr('Add at least one email (one per line).');
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
        } catch (e) {
            setBulkErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBulkWorking(false);
        }
    }

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={() => router.push(backHref)} className="inline-flex items-center text-gray-600 hover:text-gray-800">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">Create List</h1>
                <div />
            </div>

            {/* Create card */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">List name</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Spring Sale Leads"
                        className="w-full rounded border px-3 py-2"
                    />
                </div>

                {createErr && <div className="text-sm text-red-600">{createErr}</div>}

                <div className="flex items-center gap-3">
                    <button
                        onClick={onCreate}
                        disabled={!canCreate || creating}
                        className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    >
                        <CheckIcon className="h-5 w-5 mr-1" />
                        {creating ? 'Creating…' : 'Create list'}
                    </button>

                    {createdList && (
                        <span className="text-sm text-green-700">
              Created: <span className="font-medium">{createdList.name}</span> (ID {createdList.id})
            </span>
                    )}
                </div>
            </div>

            {/* Bulk add contacts (optional) */}
            <div className={classNames('transition-all', createdList ? 'opacity-100' : 'opacity-50')}>
                <div className="bg-white border rounded-lg">
                    <div className="p-4 border-b flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Add contacts (optional)</h2>
                        <label className="inline-flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                checked={bulkOpen}
                                onChange={(e) => setBulkOpen(e.target.checked)}
                                disabled={!createdList}
                            />
                            Enable
                        </label>
                    </div>

                    {bulkOpen && (
                        <div className="p-4 space-y-4">
                            {!createdList && (
                                <div className="text-sm text-gray-500">
                                    Create the list first to enable importing contacts.
                                </div>
                            )}

                            {createdList && (
                                <>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium mb-1">Emails (one per line)</label>
                                            <textarea
                                                value={emailsText}
                                                onChange={(e) => setEmailsText(e.target.value)}
                                                rows={8}
                                                placeholder={`alice@example.com\nbob@example.com\n...`}
                                                className="w-full rounded border px-3 py-2 font-mono text-xs"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Invalid emails will be skipped. Existing memberships are ignored (idempotent).
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">Default name (optional)</label>
                                            <input
                                                value={defaultName}
                                                onChange={(e) => setDefaultName(e.target.value)}
                                                placeholder="e.g. Subscriber"
                                                className="w-full rounded border px-3 py-2"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Used when creating a new contact and no name is provided.
                                            </p>
                                        </div>
                                    </div>

                                    {bulkErr && <div className="text-sm text-red-600">{bulkErr}</div>}

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={onBulkAdd}
                                            disabled={bulkWorking || !emailsText.trim()}
                                            className="px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                                        >
                                            {bulkWorking ? 'Importing…' : 'Import emails'}
                                        </button>

                                        {bulkRes && (
                                            <span className="text-sm text-gray-700">
                        Imported: <span className="font-medium">{bulkRes.summary.added}</span> · Skipped:{' '}
                                                <span className="font-medium">{bulkRes.summary.skipped}</span> / Total:{' '}
                                                <span className="font-medium">{bulkRes.summary.total}</span>
                      </span>
                                        )}
                                    </div>

                                    {bulkRes && bulkRes.results.length > 0 && (
                                        <div className="overflow-auto border rounded mt-3">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-gray-50">
                                                <tr className="text-left">
                                                    <th className="px-3 py-2">Email</th>
                                                    <th className="px-3 py-2">Status</th>
                                                    <th className="px-3 py-2">Membership ID</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {bulkRes.results.map((r, i) => (
                                                    <tr key={i} className="border-t">
                                                        <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                                                        <td className="px-3 py-2">{r.status}</td>
                                                        <td className="px-3 py-2">{r.membership_id}</td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
                <Link href={backHref} className="text-sm text-gray-600 hover:text-gray-800">
                    ← Back to lists
                </Link>
                <div />
            </div>
        </div>
    );
}

function classNames(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(' ');
}
