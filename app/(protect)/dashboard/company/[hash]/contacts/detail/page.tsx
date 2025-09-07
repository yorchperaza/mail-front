'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    PencilSquareIcon,
    TrashIcon,
    EnvelopeIcon,
    UserIcon,
    ClockIcon,
    ShieldCheckIcon,
    CalendarDaysIcon,
    QueueListIcon,
    InformationCircleIcon,
    XMarkIcon,
    LanguageIcon,
    TagIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';

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
    value: string | number;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'amber' | 'purple';
}) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        purple: 'from-purple-500 to-purple-600',
    };

    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className={`bg-gradient-to-r ${colors[color]} p-3`}>
                <div className="flex items-center justify-between text-white">
                    {icon}
                    <span className="text-xs font-medium uppercase tracking-wider opacity-90">{label}</span>
                </div>
            </div>
            <div className="p-4">
                <div className="text-lg font-bold text-gray-900 truncate">{value}</div>
            </div>
        </div>
    );
}

function InfoField({
                       icon,
                       label,
                       value,
                       mono = false,
                   }: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    mono?: boolean;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 text-gray-400">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">{label}</div>
                <div className={`text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>
                    {value || <span className="text-gray-400">—</span>}
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string | null }) {
    if (!status) return <span className="text-gray-400">—</span>;

    const statusColors: Record<string, string> = {
        active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        subscribed: 'bg-blue-50 text-blue-700 border-blue-200',
        unsubscribed: 'bg-gray-50 text-gray-700 border-gray-200',
        bounced: 'bg-red-50 text-red-700 border-red-200',
        cleaned: 'bg-amber-50 text-amber-700 border-amber-200',
    };

    const colorClass = statusColors[status.toLowerCase()] || 'bg-gray-50 text-gray-700 border-gray-200';

    return (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium border ${colorClass}`}>
            {status}
        </span>
    );
}

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
    const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);

    const backHref = `/dashboard/company/${hash}/contacts`;

    function showToast(kind: 'info' | 'success' | 'error', text: string) {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 3000);
    }

    // Fetch contact + lists by email
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
            showToast('success', 'Contact deleted successfully');
            setTimeout(() => router.push(`/dashboard/company/${hash}/contacts`), 1000);
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to delete contact');
        } finally {
            setDeleting(false);
            setConfirmDelete(false);
        }
    }

    function formatDate(s?: string | null) {
        if (!s) return '—';
        const d = new Date(s);
        if (isNaN(d.getTime())) return s;
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function formatShortDate(s?: string | null) {
        if (!s) return '—';
        const d = new Date(s);
        if (isNaN(d.getTime())) return s;
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }

    // Calculate stats
    const stats = useMemo(() => {
        const attributeCount = contact?.attributes ? Object.keys(contact.attributes).length : 0;
        const hasGdpr = !!contact?.gdpr_consent_at;

        return {
            listCount: lists.length,
            attributeCount,
            hasGdpr,
        };
    }, [contact, lists]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-5xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-32 rounded-xl bg-gray-200" />
                            ))}
                        </div>
                        <div className="h-96 rounded-xl bg-gray-200" />
                    </div>
                </div>
            </div>
        );
    }

    if (err && !contact) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <XMarkIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Contact</h2>
                    </div>
                    <p className="text-gray-600 mb-3">{err}</p>
                    <p className="text-sm text-gray-500 mb-4">
                        Example: <code className="text-xs bg-gray-100 px-2 py-1 rounded">/contacts/detail?email=user%40example.com</code>
                    </p>
                    <button
                        onClick={() => router.push(backHref)}
                        className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Contacts
                    </button>
                </div>
            </div>
        );
    }

    if (!contact) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-5xl mx-auto p-6 space-y-6">
                {toast && <Toast kind={toast.kind} text={toast.text} onClose={() => setToast(null)} />}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(backHref)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Contacts
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {contact.name || contact.email || 'Contact'}
                            </h1>
                            <p className="text-sm text-gray-500">
                                Contact #{contact.id}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            href={`/dashboard/company/${hash}/contacts/edit?email=${encodeURIComponent(contact.email || '')}`}
                            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                        >
                            <PencilSquareIcon className="h-4 w-4" />
                            Edit Contact
                        </Link>
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 transition-colors"
                        >
                            <TrashIcon className="h-4 w-4" />
                            Delete
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Status"
                        value={contact.status || 'Unknown'}
                        icon={<InformationCircleIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="Lists"
                        value={stats.listCount}
                        icon={<QueueListIcon className="h-5 w-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="Attributes"
                        value={stats.attributeCount}
                        icon={<TagIcon className="h-5 w-5" />}
                        color="purple"
                    />
                    <StatCard
                        label="GDPR Consent"
                        value={stats.hasGdpr ? 'Yes' : 'No'}
                        icon={<ShieldCheckIcon className="h-5 w-5" />}
                        color="amber"
                    />
                </div>

                {/* Contact Information */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                        <div className="flex items-center gap-2 text-white">
                            <UserIcon className="h-5 w-5" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Contact Information</h3>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InfoField
                                icon={<EnvelopeIcon className="h-4 w-4" />}
                                label="Email Address"
                                value={contact.email ? (
                                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{contact.email}</code>
                                ) : null}
                                mono
                            />
                            <InfoField
                                icon={<UserIcon className="h-4 w-4" />}
                                label="Full Name"
                                value={contact.name}
                            />
                            <InfoField
                                icon={<LanguageIcon className="h-4 w-4" />}
                                label="Locale"
                                value={contact.locale}
                            />
                            <InfoField
                                icon={<ClockIcon className="h-4 w-4" />}
                                label="Timezone"
                                value={contact.timezone}
                            />
                            <InfoField
                                icon={<InformationCircleIcon className="h-4 w-4" />}
                                label="Status"
                                value={<StatusBadge status={contact.status} />}
                            />
                            <InfoField
                                icon={<ShieldCheckIcon className="h-4 w-4" />}
                                label="Consent Source"
                                value={contact.consent_source}
                            />
                            <InfoField
                                icon={<CalendarDaysIcon className="h-4 w-4" />}
                                label="GDPR Consent Date"
                                value={formatDate(contact.gdpr_consent_at)}
                            />
                            <InfoField
                                icon={<CalendarDaysIcon className="h-4 w-4" />}
                                label="Created Date"
                                value={formatDate(contact.created_at)}
                            />
                        </div>
                    </div>
                </div>

                {/* Attributes */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <TagIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Custom Attributes</h3>
                            </div>
                            <span className="text-xs text-purple-100">
                                {stats.attributeCount} {stats.attributeCount === 1 ? 'attribute' : 'attributes'}
                            </span>
                        </div>
                    </div>

                    <div className="p-6">
                        {contact.attributes && Object.keys(contact.attributes).length > 0 ? (
                            <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto max-h-64">
                                {JSON.stringify(contact.attributes, null, 2)}
                            </pre>
                        ) : (
                            <div className="text-center py-8">
                                <DocumentTextIcon className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500">No custom attributes</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lists */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <QueueListIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">List Memberships</h3>
                            </div>
                            <span className="text-xs text-emerald-100">
                                {lists.length} {lists.length === 1 ? 'list' : 'lists'}
                            </span>
                        </div>
                    </div>

                    <div className="p-6">
                        {lists.length === 0 ? (
                            <div className="text-center py-8">
                                <QueueListIcon className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500">This contact isn&#39;t subscribed to any lists</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {lists.map((l) => (
                                    <div
                                        key={l.id}
                                        className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <QueueListIcon className="h-5 w-5 text-gray-400" />
                                            <div>
                                                <div className="font-medium text-gray-900">{l.name}</div>
                                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                    <CalendarDaysIcon className="h-3 w-3" />
                                                    Subscribed {formatShortDate(l.subscribed_at)}
                                                </div>
                                            </div>
                                        </div>
                                        <Link
                                            href={`/dashboard/company/${hash}/lists/${l.id}/contacts`}
                                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                        >
                                            View List
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                {confirmDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
                        <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl border overflow-hidden">
                            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                                <h3 className="text-lg font-semibold text-white">Delete Contact</h3>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-full bg-red-100 p-2">
                                        <TrashIcon className="h-5 w-5 text-red-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-600">
                                            Are you sure you want to delete <span className="font-semibold">{contact.name || contact.email}</span>?
                                        </p>
                                        <p className="text-sm text-gray-500 mt-2">
                                            This action cannot be undone. The contact will be permanently removed from all lists.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        onClick={() => setConfirmDelete(false)}
                                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={onDelete}
                                        disabled={deleting}
                                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                    >
                                        {deleting ? 'Deleting…' : 'Delete Contact'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}