'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon,
    PlusIcon,
    XMarkIcon,
    UserIcon,
    EnvelopeIcon,
    GlobeAltIcon,
    ClockIcon,
    ShieldCheckIcon,
    CalendarDaysIcon,
    QueueListIcon,
    TagIcon,
    LanguageIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
} from '@heroicons/react/24/solid';
import Select, { SingleValue, StylesConfig } from 'react-select';
import TimezoneSelect, { ITimezone } from 'react-timezone-select';

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

type Option = { value: string; label: string };
type ListMembership = { id: number; name: string; subscribed_at?: string | null };
type ContactLookupResponse = { contact: Contact; lists: ListMembership[] };
type ListsResponse = { items?: Array<{ id: number; name: string }> };
type ListGroup = { id: number; name: string };
type KV = { k: string; v: string };

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

function tzFromString(tz: string): ITimezone {
    return { value: tz, label: tz, abbrev: '', offset: 0, altName: '' };
}

const LOCALE_OPTIONS = ['en-US','en-GB','es-ES','es-MX','fr-FR','de-DE','it-IT','pt-BR','nl-NL','sv-SE','pl-PL']
    .map(v => ({ value: v, label: v }));
const STATUS_OPTIONS = ['active','unsubscribed','bounced','complained','inactive']
    .map(v => ({ value: v, label: v }));
const CONSENT_SOURCE_OPTIONS = ['signup_form','import','checkout','api','manual']
    .map(v => ({ value: v, label: v }));

const CREATE_LIST_VALUE = '__create__';

// Custom styles for react-select to match our design
const customSelectStyles: StylesConfig<Option, false> = {
    control: (base) => ({
        ...base,
        borderRadius: '0.5rem',
        borderColor: '#d1d5db',
        '&:hover': { borderColor: '#6366f1' },
        '&:focus': {
            borderColor: '#6366f1',
            boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
        },
    }),
    menu: (base) => ({
        ...base,
        borderRadius: '0.5rem',
        overflow: 'hidden',
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

export default function ContactEditByEmailPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const search = useSearchParams();
    const emailQuery = (search.get('email') || '').trim();

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL!;
    const authHeaders = useMemo(() => {
        return (): HeadersInit => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
            return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        };
    }, []);

    // State
    const [contact, setContact] = useState<Contact | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);

    // Lists
    const [listsCatalog, setListsCatalog] = useState<ListGroup[]>([]);
    const [loadingLists, setLoadingLists] = useState(true);
    const [selectedListIds, setSelectedListIds] = useState<number[]>([]);

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [creatingList, setCreatingList] = useState(false);

    // Form
    const [saving, setSaving] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [locale, setLocale] = useState('');
    const [timezone, setTimezone] = useState('');
    const [tzOption, setTzOption] = useState<ITimezone | string>('');
    const [status, setStatus] = useState('');
    const [consentSource, setConsentSource] = useState('');
    const [gdprConsentAt, setGdprConsentAt] = useState('');
    const [attrsRows, setAttrsRows] = useState<KV[]>([{ k: '', v: '' }]);

    const backHref = `/dashboard/company/${hash}/contacts/detail?email=${encodeURIComponent(emailQuery)}`;

    const localeOption = useMemo(() => (locale ? { value: locale, label: locale } : null), [locale]);
    const statusOption = useMemo(() => (status ? { value: status, label: status } : null), [status]);
    const consentOption = useMemo(() => (consentSource ? { value: consentSource, label: consentSource } : null), [consentSource]);

    function showToast(kind: 'info' | 'success' | 'error', text: string) {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 3000);
    }

    // Load catalog of lists
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoadingLists(true);
            try {
                const res = await fetch(`${backend}/companies/${hash}/lists?perPage=200`, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load lists (${res.status})`);
                const json = (await res.json()) as ListsResponse;
                if (!abort) {
                    const items = Array.isArray(json?.items) ? json.items : [];
                    setListsCatalog(items.map(i => ({ id: Number(i.id), name: String(i.name) })));
                }
            } catch {
                // let it be empty
            } finally {
                if (!abort) setLoadingLists(false);
            }
        })();
        return () => { abort = true; };
    }, [backend, hash, authHeaders]);

    // Load contact
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                if (!emailQuery) throw new Error('Email query parameter is required.');
                const url = `${backend}/companies/contacts/${hash}/lookup?email=${encodeURIComponent(emailQuery)}`;
                const res = await fetch(url, { headers: authHeaders() });
                if (!res.ok) {
                    if (res.status === 404) throw new Error('Contact not found.');
                    const t = await res.text();
                    throw new Error(`Failed to load contact (${res.status}) ${t || ''}`);
                }
                const json: ContactLookupResponse = await res.json();
                if (abort) return;

                const c = json.contact;
                const ls = Array.isArray(json.lists) ? json.lists : [];

                setContact(c);

                // Populate form
                setEmail(c.email || '');
                setName(c.name || '');
                setLocale(c.locale || '');

                const tz = c.timezone || '';
                setTimezone(tz);
                setTzOption(tz ? tzFromString(tz) : '');

                setStatus(c.status || '');
                setConsentSource(c.consent_source || '');
                setGdprConsentAt(toLocalInput(c.gdpr_consent_at));
                setAttrsRows(toKVRows(c.attributes));

                setSelectedListIds(ls.map(l => l.id));
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : 'Failed to load contact');
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [backend, hash, emailQuery, authHeaders]);

    // Options for add list dropdown
    const addListOptions = useMemo(() => {
        const notSelected = listsCatalog
            .filter(l => !selectedListIds.includes(l.id))
            .map(l => ({ value: String(l.id), label: l.name }));
        return [...notSelected, { value: CREATE_LIST_VALUE, label: '＋ Create new list…' }];
    }, [listsCatalog, selectedListIds]);

    const onAddList = (opt: SingleValue<{ value: string; label: string }>) => {
        if (!opt) return;
        if (opt.value === CREATE_LIST_VALUE) {
            setModalOpen(true);
            return;
        }
        const id = Number(opt.value);
        if (Number.isFinite(id)) {
            setSelectedListIds(prev => Array.from(new Set([...prev, id])));
        }
    };

    async function handleRemoveList(listId: number) {
        if (!contact) return;
        setSelectedListIds(ids => ids.filter(id => id !== listId));
        try {
            const res = await fetch(
                `${backend}/companies/${hash}/lists/${listId}/contacts/${contact.id}`,
                { method: 'DELETE', headers: authHeaders() }
            );
            if (!res.ok && res.status !== 204) {
                setSelectedListIds(ids => Array.from(new Set([...ids, listId])));
                const t = await res.text();
                throw new Error(`Failed to remove from list (${res.status}) ${t || ''}`);
            }
            showToast('success', 'Removed from list');
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to remove list membership');
        }
    }

    async function handleCreateList() {
        if (!newListName.trim()) return;
        setCreatingList(true);
        try {
            const res = await fetch(`${backend}/companies/${hash}/lists`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ name: newListName.trim() }),
            });
            if (!res.ok) throw new Error(`Create list failed (${res.status})`);
            const json = (await res.json()) as { id?: number; name?: string; list?: { id: number } };
            const id = (json?.id ?? json?.list?.id)!;
            const name = json?.name ?? newListName.trim();

            setListsCatalog(prev => [...prev, { id, name }]);
            setSelectedListIds(prev => Array.from(new Set([...prev, id])));
            setModalOpen(false);
            setNewListName('');
            showToast('success', `Created list "${name}"`);
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to create list');
        } finally {
            setCreatingList(false);
        }
    }

    async function onSave(e: React.FormEvent) {
        e.preventDefault();
        if (!contact) return;
        setSaving(true);
        setErr(null);
        try {
            const validIds = selectedListIds.filter(id => listsCatalog.some(l => l.id === id));

            const body = {
                email: email.trim().toLowerCase() || null,
                name: name.trim() || null,
                locale: locale || null,
                timezone: timezone || null,
                status: status || null,
                consent_source: consentSource || null,
                gdpr_consent_at: toIso(gdprConsentAt),
                attributes: rowsToObj(attrsRows),
                list_ids: validIds,
            };

            const res = await fetch(`${backend}/companies/${hash}/contacts/${contact.id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Save failed (${res.status})`);

            showToast('success', 'Contact updated successfully');
            const nextEmail = (body.email ?? emailQuery) as string;
            setTimeout(() => {
                router.push(`/dashboard/company/${hash}/contacts/detail?email=${encodeURIComponent(nextEmail)}`);
            }, 1000);
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to save contact');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-4xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
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
                    <p className="text-gray-600">{err}</p>
                    <button
                        onClick={() => router.push(`/dashboard/company/${hash}/contacts`)}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
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
                            Back to Detail
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Edit Contact</h1>
                            <p className="text-sm text-gray-500">
                                Editing {contact.name || contact.email}
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={onSave} className="space-y-6">
                    {/* Identity Section */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <UserIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Identity</h3>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <EnvelopeIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                        Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <UserIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                        Full Name
                                    </label>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preferences Section */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <GlobeAltIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Preferences & Status</h3>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <LanguageIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                        Locale
                                    </label>
                                    <Select<Option, false>
                                        options={LOCALE_OPTIONS}
                                        value={localeOption}
                                        onChange={(opt) => setLocale(opt?.value ?? '')}
                                        placeholder="Select locale…"
                                        isClearable
                                        styles={customSelectStyles}
                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                                        menuPosition="fixed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <ClockIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                        Timezone
                                    </label>
                                    <TimezoneSelect
                                        value={tzOption}
                                        onChange={(selected) => {
                                            if (typeof selected === 'string') { setTimezone(selected); setTzOption(selected); }
                                            else { setTimezone(selected.value); setTzOption(selected); }
                                        }}
                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                                        menuPosition="fixed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <InformationCircleIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                        Status
                                    </label>
                                    <Select<Option, false>
                                        options={STATUS_OPTIONS}
                                        value={statusOption}
                                        onChange={(opt) => setStatus(opt?.value ?? '')}
                                        placeholder="Select status…"
                                        isClearable
                                        styles={customSelectStyles}
                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                                        menuPosition="fixed"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* GDPR Section */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <ShieldCheckIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">GDPR & Consent</h3>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <CalendarDaysIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                        GDPR Consent Date
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={gdprConsentAt}
                                        onChange={(e) => setGdprConsentAt(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Optional. Converted to ISO format when saved.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <ShieldCheckIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                        Consent Source
                                    </label>
                                    <Select<Option, false>
                                        options={CONSENT_SOURCE_OPTIONS}
                                        value={consentOption}
                                        onChange={(opt) => setConsentSource(opt?.value ?? '')}
                                        placeholder="Select source…"
                                        isClearable
                                        styles={customSelectStyles}
                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                                        menuPosition="fixed"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Attributes Section */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <TagIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Custom Attributes</h3>
                            </div>
                        </div>
                        <div className="p-6 space-y-3">
                            {attrsRows.map((row, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-3">
                                    <input
                                        value={row.k}
                                        onChange={(e) => setAttrsRows(r => r.map((x, i) => (i === idx ? { ...x, k: e.target.value } : x)))}
                                        className="rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        placeholder="Key (e.g. plan)"
                                    />
                                    <input
                                        value={row.v}
                                        onChange={(e) => setAttrsRows(r => r.map((x, i) => (i === idx ? { ...x, v: e.target.value } : x)))}
                                        className="rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        placeholder='Value (e.g. "pro", 42, true)'
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setAttrsRows(r => r.filter((_, i) => i !== idx))}
                                        className="inline-flex items-center justify-center px-3 rounded-lg border border-gray-300 hover:bg-red-50 hover:border-red-300 transition-colors"
                                        title="Remove attribute"
                                    >
                                        <XMarkIcon className="h-5 w-5 text-red-600" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => setAttrsRows(r => [...r, { k: '', v: '' }])}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Add Attribute
                            </button>
                            <p className="text-xs text-gray-500">
                                Values are auto-parsed to boolean/number/object when possible; otherwise saved as strings.
                            </p>
                        </div>
                    </div>

                    {/* Lists Section */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <QueueListIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">List Memberships</h3>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <Select
                                isDisabled={loadingLists || addListOptions.length === 0}
                                isMulti={false}
                                options={addListOptions}
                                value={null}
                                onChange={onAddList}
                                isSearchable
                                placeholder={loadingLists ? 'Loading lists…' : 'Add to a list…'}
                                styles={customSelectStyles}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                                menuPosition="fixed"
                            />

                            {selectedListIds.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {selectedListIds.map(id => {
                                        const g = listsCatalog.find(l => l.id === id);
                                        const label = g?.name ?? `List #${id}`;
                                        return (
                                            <span
                                                key={id}
                                                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 transition-colors"
                                            >
                                                <QueueListIcon className="h-4 w-4 text-gray-500" />
                                                {label}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveList(id)}
                                                    className="p-0.5 rounded-full hover:bg-red-100 transition-colors"
                                                    title="Remove from list"
                                                >
                                                    <XMarkIcon className="h-4 w-4 text-red-600" />
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">Not subscribed to any lists yet.</p>
                            )}

                            <p className="text-xs text-gray-500">
                                Changes are saved when you press &#34;Save&#34;. Removing with the × immediately unsubscribes from that list.
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        <Link
                            href={backHref}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={saving || creatingList}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                        >
                            <CheckCircleSolid className="h-5 w-5" />
                            {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </form>

                {/* Create List Modal */}
                {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
                        <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl border overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-white">Create New List</h2>
                                    <button
                                        onClick={() => setModalOpen(false)}
                                        className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                                        aria-label="Close"
                                    >
                                        <XMarkIcon className="h-5 w-5 text-white" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">List Name</label>
                                    <input
                                        value={newListName}
                                        onChange={(e) => setNewListName(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        placeholder="e.g. Newsletter Subscribers"
                                        autoFocus
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        onClick={() => setModalOpen(false)}
                                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateList}
                                        disabled={creatingList || !newListName.trim()}
                                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                    >
                                        {creatingList ? 'Creating…' : 'Create List'}
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

/* ---------- Helpers ---------- */
function toLocalInput(iso?: string | null) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(dtLocal: string): string | null {
    if (!dtLocal) return null;
    const d = new Date(dtLocal);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
}

function toKVRows(obj: Record<string, unknown> | null | undefined): KV[] {
    if (!obj) return [{ k: '', v: '' }];
    const rows = Object.entries(obj).map(([k, v]) => ({ k, v: typeof v === 'string' ? v : JSON.stringify(v) }));
    return rows.length ? rows : [{ k: '', v: '' }];
}

function rowsToObj(rows: KV[]): Record<string, unknown> | null {
    const out: Record<string, unknown> = {};
    for (const { k, v } of rows) {
        const key = k.trim();
        if (!key) continue;
        const raw = v.trim();
        if (raw === '') { out[key] = ''; continue; }
        if (raw === 'true' || raw === 'false') { out[key] = raw === 'true'; continue; }
        if (!Number.isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw)) { out[key] = Number(raw); continue; }
        if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
            try { out[key] = JSON.parse(raw); continue; } catch {}
        }
        out[key] = raw;
    }
    return Object.keys(out).length ? out : null;
}