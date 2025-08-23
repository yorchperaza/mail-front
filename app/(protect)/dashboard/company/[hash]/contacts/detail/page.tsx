'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

type Contact = {
    id: number;
    email: string | null;
    name: string | null;
    locale: string | null;
    timezone: string | null;
    status: string | null;
    consent_source: string | null;
    gdpr_consent_at: string | null;
    attributes: Record<string, unknown> | null;
    created_at: string | null;
};

type ListMembership = {
    id: number;
    name: string;
    subscribed_at: string | null;
};

type ContactLookupResponse = {
    contact: Contact;
    lists: ListMembership[];
};

export default function ContactDetailPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const search = useSearchParams();

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = useMemo(
        () => (): HeadersInit => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
            return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        },
        []
    );

    const emailQuery = (search.get('email') || '').trim();

    const [contact, setContact] = useState<Contact | null>(null);
    const [lists, setLists] = useState<ListMembership[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const backHref = `/dashboard/company/${hash}/contacts`;

    // fetch contact + lists by email
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);

            if (!emailQuery) {
                setContact(null);
                setLists([]);
                setLoading(false);
                setErr('Add ?email=<address> to the URL to view a contact.');
                return;
            }

            try {
                const url = `${backend}/companies/contacts/${hash}/lookup?email=${encodeURIComponent(emailQuery)}`;
                const res = await fetch(url, { headers: authHeaders() });
                if (!res.ok) {
                    if (res.status === 404) throw new Error('Contact not found.');
                    throw new Error(`Failed to load contact (${res.status})`);
                }

                const json: ContactLookupResponse = await res.json();
                if (abort) return;

                setContact(json.contact ?? null);
                setLists(Array.isArray(json.lists) ? json.lists : []);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : 'Failed to load contact');
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => {
            abort = true;
        };
    }, [backend, hash, emailQuery, authHeaders]);

    async function onDelete() {
        if (!contact) return;
        setDeleting(true);
        setErr(null);
        try {
            const res = await fetch(`${backend}/companies/${hash}/contacts/${contact.id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
            router.push(`/dashboard/company/${hash}/contacts`);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Failed to delete contact');
        } finally {
            setDeleting(false);
            setConfirmDelete(false);
        }
    }

    if (loading) return <p className="p-6 text-center text-gray-600">Loading contact…</p>;

    if (err && !contact) {
        return (
            <div className="p-6 max-w-lg mx-auto space-y-4 text-center">
                <p className="text-red-600">{err}</p>
                <p className="text-sm text-gray-600">
                    Example: <code className="text-xs">/dashboard/company/{hash}/contacts/detail?email=user%40example.com</code>
                </p>
                <button onClick={() => router.push(backHref)} className="inline-flex items-center px-3 py-2 rounded border">
                    <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back
                </button>
            </div>
        );
    }

    if (!contact) return null;

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(backHref)}
                    className="inline-flex items-center text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back to Contacts
                </button>
                <h1 className="text-2xl font-semibold">Contact Detail</h1>
                <div className="flex items-center gap-2">
                    <Link
                        href={`/dashboard/company/${hash}/contacts/edit?email=${encodeURIComponent(contact.email || '')}`}
                        className="inline-flex items-center px-3 py-2 rounded border hover:bg-gray-50"
                    >
                        <PencilSquareIcon className="h-5 w-5 mr-1" /> Edit
                    </Link>
                    <button
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center px-3 py-2 rounded border text-red-700 hover:bg-red-50"
                    >
                        <TrashIcon className="h-5 w-5 mr-1" /> Delete
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="bg-white border rounded p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Email" value={<code className="text-xs">{contact.email || '—'}</code>} />
                    <Field label="Name" value={contact.name || '—'} />
                    <Field label="Locale" value={contact.locale || '—'} />
                    <Field label="Timezone" value={contact.timezone || '—'} />
                    <Field label="Status" value={contact.status || '—'} />
                    <Field label="Consent Source" value={contact.consent_source || '—'} />
                    <Field label="GDPR Consent At" value={formatDate(contact.gdpr_consent_at)} />
                    <Field label="Created" value={formatDate(contact.created_at)} />
                </div>

                <div>
                    <div className="text-sm font-medium mb-1">Attributes</div>
                    {contact.attributes && Object.keys(contact.attributes).length > 0 ? (
                        <pre className="text-xs bg-gray-50 border rounded p-3 overflow-auto">
              {JSON.stringify(contact.attributes, null, 2)}
            </pre>
                    ) : (
                        <div className="text-gray-500 text-sm">—</div>
                    )}
                </div>
            </div>

            {/* Lists */}
            <div className="bg-white border rounded p-5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">Lists</h2>
                    <span className="text-xs text-gray-500">{lists.length} subscribed</span>
                </div>

                {lists.length === 0 ? (
                    <div className="text-sm text-gray-500">This contact isn’t subscribed to any lists.</div>
                ) : (
                    <ul className="divide-y">
                        {lists.map((l) => (
                            <li key={l.id} className="py-3 flex items-center justify-between">
                                <div>
                                    <div className="font-medium">{l.name}</div>
                                    <div className="text-xs text-gray-500">
                                        Subscribed {l.subscribed_at ? formatDate(l.subscribed_at) : '—'}
                                    </div>
                                </div>
                                {/* If you have a list detail route, you can link it here.
                    Otherwise leave the button out or point to the lists index. */}
                                <Link
                                    href={`/dashboard/company/${hash}/lists`} // change to `/lists/${l.id}` if you have that route
                                    className="text-sm px-3 py-1 rounded border hover:bg-gray-50"
                                >
                                    View
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Delete confirm modal */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmDelete(false)} />
                    <div className="relative bg-white w-full max-w-md rounded-lg shadow-lg p-5 space-y-4 border">
                        <h3 className="text-lg font-semibold">Delete Contact</h3>
                        <p className="text-sm text-gray-600">
                            Are you sure you want to delete <span className="font-mono">{contact.email}</span>? This action cannot be
                            undone.
                        </p>
                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded border hover:bg-gray-50">
                                Cancel
                            </button>
                            <button
                                onClick={onDelete}
                                disabled={deleting}
                                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                            >
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between">
                <Link href={backHref} className="text-sm text-gray-600 hover:underline">
                    ← Back to Contacts
                </Link>
                <div className="text-xs text-gray-500">
                    Created: {formatDate(contact.created_at)}
                </div>
            </div>
        </div>
    );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-sm">{value}</div>
        </div>
    );
}

function formatDate(s?: string | null) {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString();
}
