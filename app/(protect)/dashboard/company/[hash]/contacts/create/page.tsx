'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
    ExclamationTriangleIcon,
    UserPlusIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
} from '@heroicons/react/24/solid';
import Select, { SingleValue, type StylesConfig } from 'react-select';
import TimezoneSelect, { ITimezone } from 'react-timezone-select';
import type { MultiValue } from 'react-select';

type ListGroup = { id: number; name: string };
type Option = { value: string; label: string };

type CreateContactBody = {
    email: string;
    name?: string | null;
    locale?: string | null;
    timezone?: string | null;
    status?: string | null;
    consent_source?: string | null;
    gdpr_consent_at?: string | null;
    attributes?: Record<string, unknown> | null;
    list_ids?: number[];
};

type EmailCheckState =
    | { state: 'idle' }
    | { state: 'checking' }
    | { state: 'exists'; id: number; name?: string | null }
    | { state: 'available' };

type ContactSummary = { id: number; email?: string | null; name?: string | null };
type ListsResponse = { items?: Array<{ id: number; name: string }> };
type ContactsResponse = { items?: ContactSummary[] };

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

const LOCALE_OPTIONS = [
    'en-US','en-GB','es-ES','es-MX','fr-FR','de-DE','it-IT','pt-BR','nl-NL','sv-SE','pl-PL'
].map(v => ({ value: v, label: v }));

const STATUS_OPTIONS = ['active','unsubscribed','bounced','complained','inactive']
    .map(v => ({ value: v, label: v }));

const CONSENT_SOURCE_OPTIONS = ['signup_form','import','checkout','api','manual']
    .map(v => ({ value: v, label: v }));

const CREATE_LIST_VALUE = '__create__';

// Custom styles for react-select
const customSelectStyles: StylesConfig<Option, boolean> = {
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

export default function ContactCreatePage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    // State
    const [lists, setLists] = useState<ListGroup[]>([]);
    const [loadingLists, setLoadingLists] = useState(true);
    const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);

    // Form
    const [email, setEmail] = useState('');
    const [emailCheck, setEmailCheck] = useState<EmailCheckState>({ state: 'idle' });
    const [name, setName] = useState('');

    // Timezone
    const guess = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const [locale, setLocale] = useState<string>('');
    const [timezone, setTimezone] = useState<string>(guess);
    const [tzOption, setTzOption] = useState<ITimezone | string>(guess);

    const [status, setStatus] = useState<string>('');
    const [consentSource, setConsentSource] = useState<string>('');
    const [gdprConsentAt, setGdprConsentAt] = useState('');

    // Attributes
    const [attrsRows, setAttrsRows] = useState<Array<{ k: string; v: string }>>([{ k: '', v: '' }]);

    // Lists
    const [selectedListIds, setSelectedListIds] = useState<number[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [creatingList, setCreatingList] = useState(false);

    // Submit
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const authHeaders = useMemo(() => {
        return (): HeadersInit => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
            return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        };
    }, []);

    const backHref = `/dashboard/company/${hash}/contacts`;

    const localeOption = useMemo(
        () => (locale ? { value: locale, label: locale } : null),
        [locale]
    );
    const statusOption = useMemo(
        () => (status ? { value: status, label: status } : null),
        [status]
    );
    const consentOption = useMemo(
        () => (consentSource ? { value: consentSource, label: consentSource } : null),
        [consentSource]
    );

    function showToast(kind: 'info' | 'success' | 'error', text: string) {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 3000);
    }

    // Load lists
    useEffect(() => {
        let abort = false;
        (async () => {
            try {
                const res = await fetch(`${backend}/companies/${hash}/lists?perPage=200`, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load lists (${res.status})`);
                const json = (await res.json()) as ListsResponse;
                if (!abort) {
                    const items = Array.isArray(json?.items) ? json.items : [];
                    setLists(items.map((i) => ({ id: Number(i.id), name: String(i.name) })));
                }
            } catch {
                // allow empty
            } finally {
                if (!abort) setLoadingLists(false);
            }
        })();
        return () => { abort = true; };
    }, [backend, hash, authHeaders]);

    // Email check
    async function checkEmailExists(value: string) {
        const em = value.trim().toLowerCase();
        if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
            setEmailCheck({ state: 'idle' });
            return;
        }
        setEmailCheck({ state: 'checking' });
        try {
            const res = await fetch(
                `${backend}/companies/${hash}/contacts?perPage=1&search=${encodeURIComponent(em)}`,
                { headers: authHeaders() }
            );
            if (!res.ok) throw new Error(String(res.status));
            const json = (await res.json()) as ContactsResponse;
            const items = Array.isArray(json?.items) ? json.items : [];
            const match = items.find((c) => (c?.email ?? '').toLowerCase() === em);
            if (match) {
                setEmailCheck({ state: 'exists', id: match.id, name: match.name });
            } else {
                setEmailCheck({ state: 'available' });
            }
        } catch {
            setEmailCheck({ state: 'idle' });
        }
    }

    function toIso(dtLocal: string): string | null {
        if (!dtLocal) return null;
        const d = new Date(dtLocal);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    }

    function addAttrRow() {
        setAttrsRows(rows => [...rows, { k: '', v: '' }]);
    }

    function removeAttrRow(idx: number) {
        setAttrsRows(rows => rows.filter((_, i) => i !== idx));
    }

    function toAttributesObject(): Record<string, unknown> | null {
        const obj: Record<string, unknown> = {};
        for (const { k, v } of attrsRows) {
            const key = k.trim();
            if (!key) continue;
            const raw = v.trim();
            if (raw === '') { obj[key] = ''; continue; }
            if (raw === 'true' || raw === 'false') { obj[key] = raw === 'true'; continue; }
            if (!Number.isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw)) { obj[key] = Number(raw); continue; }
            if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
                try { obj[key] = JSON.parse(raw); continue; } catch {}
            }
            obj[key] = raw;
        }
        return Object.keys(obj).length ? obj : null;
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

            setLists(prev => [...prev, { id, name }]);
            setSelectedListIds(prev => Array.from(new Set([...prev, id])));
            setModalOpen(false);
            setNewListName('');
            showToast('success', `Created list "${name}"`);
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Failed to create list.');
        } finally {
            setCreatingList(false);
        }
    }

    const listOptions = useMemo(() => {
        const opts = lists.map(l => ({ value: String(l.id), label: l.name }));
        return [{ value: '', label: '— None —' }, ...opts, { value: CREATE_LIST_VALUE, label: '＋ Create new list…' }];
    }, [lists]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const em = email.trim().toLowerCase();
        if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
            setError('Please enter a valid email address.');
            return;
        }

        setSaving(true);
        try {
            const body: CreateContactBody = {
                email: em,
                name: name.trim() || null,
                locale: locale || null,
                timezone: timezone || null,
                status: status || null,
                consent_source: consentSource || null,
                gdpr_consent_at: toIso(gdprConsentAt),
                attributes: toAttributesObject(),
                ...(selectedListIds.length ? { list_ids: selectedListIds } : {}),
            };

            const res = await fetch(`${backend}/companies/${hash}/contacts`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Create contact failed (${res.status})`);

            const contact = (await res.json()) as { id?: number };
            const contactId = contact?.id;
            if (!contactId) throw new Error('Server did not return contact id.');

            showToast('success', 'Contact created successfully');
            setTimeout(() => {
                router.push(`/dashboard/company/${hash}/contacts/detail?email=${encodeURIComponent(email)}`);
            }, 1000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create contact.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                {toast && <Toast kind={toast.kind} text={toast.text} onClose={() => setToast(null)} />}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}/contacts`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Contacts
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Create Contact</h1>
                            <p className="text-sm text-gray-500">Add a new contact to your database</p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5" />
                        <div className="flex-1 text-sm text-red-800">{error}</div>
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-6">
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
                                        onBlur={() => checkEmailExists(email)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        placeholder="user@example.com"
                                    />
                                    {emailCheck.state === 'checking' && (
                                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                            <ArrowPathIcon className="h-3 w-3 animate-spin" />
                                            Checking availability...
                                        </p>
                                    )}
                                    {emailCheck.state === 'exists' && (
                                        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2">
                                            <p className="text-xs text-amber-800">
                                                This email already exists.{' '}
                                                <Link
                                                    className="text-blue-700 underline hover:text-blue-800"
                                                    href={`/dashboard/company/${hash}/contacts/detail?email=${encodeURIComponent(email)}`}
                                                >
                                                    View existing contact
                                                </Link>
                                            </p>
                                        </div>
                                    )}
                                    {emailCheck.state === 'available' && (
                                        <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                                            <CheckCircleSolid className="h-3 w-3" />
                                            Email is available
                                        </p>
                                    )}
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
                                        onChange={(opt: SingleValue<Option>) => setLocale(opt?.value || '')}
                                        menuPortalTarget={mounted ? document.body : undefined}
                                        menuPosition="fixed"
                                        styles={customSelectStyles}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <ClockIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                        Timezone
                                    </label>
                                    <TimezoneSelect
                                        value={tzOption}
                                        menuPortalTarget={mounted ? document.body : undefined}
                                        menuPosition="fixed"
                                        onChange={(selected: ITimezone | string) => {
                                            if (typeof selected === 'string') {
                                                setTimezone(selected);
                                                setTzOption(selected);
                                            } else if (selected && typeof selected === 'object' && 'value' in selected) {
                                                setTimezone(selected.value);
                                                setTzOption(selected);
                                            }
                                        }}
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
                                        onChange={(opt: SingleValue<Option>) => setStatus(opt?.value || '')}
                                        menuPortalTarget={mounted ? document.body : undefined}
                                        menuPosition="fixed"
                                        styles={customSelectStyles}
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
                                        onChange={(opt: SingleValue<Option>) => setConsentSource(opt?.value || '')}
                                        menuPortalTarget={mounted ? document.body : undefined}
                                        menuPosition="fixed"
                                        styles={customSelectStyles}
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
                                        onChange={(e) => setAttrsRows(r => r.map((x, i) => i === idx ? { ...x, k: e.target.value } : x))}
                                        className="rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        placeholder="Key (e.g. plan)"
                                    />
                                    <input
                                        value={row.v}
                                        onChange={(e) => setAttrsRows(r => r.map((x, i) => i === idx ? { ...x, v: e.target.value } : x))}
                                        className="rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        placeholder='Value (e.g. "pro", 42, true)'
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeAttrRow(idx)}
                                        className="inline-flex items-center justify-center px-3 rounded-lg border border-gray-300 hover:bg-red-50 hover:border-red-300 transition-colors"
                                        title="Remove attribute"
                                    >
                                        <XMarkIcon className="h-5 w-5 text-red-600" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addAttrRow}
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
                                <h3 className="text-sm font-semibold uppercase tracking-wider">List Subscriptions</h3>
                            </div>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Subscribe to Lists (Optional)
                            </label>
                            <Select
                                isDisabled={loadingLists}
                                isMulti
                                menuPosition="fixed"
                                options={listOptions}
                                value={listOptions.filter(
                                    o => o.value && o.value !== CREATE_LIST_VALUE && selectedListIds.includes(Number(o.value))
                                )}
                                onChange={(opts: MultiValue<{ value: string; label: string }>) => {
                                    const hasCreate = opts.some(o => o.value === CREATE_LIST_VALUE);
                                    const choseNone = opts.some(o => o.value === '');

                                    let next = opts;
                                    if (hasCreate) {
                                        setModalOpen(true);
                                        next = next.filter(o => o.value !== CREATE_LIST_VALUE);
                                    }
                                    if (choseNone) {
                                        setSelectedListIds([]);
                                        return;
                                    }

                                    const ids = next
                                        .map(o => o.value)
                                        .filter(v => v && v !== CREATE_LIST_VALUE)
                                        .map(v => Number(v));

                                    setSelectedListIds(Array.from(new Set(ids)));
                                }}
                                isSearchable
                                placeholder={loadingLists ? "Loading lists..." : "Select lists…"}
                                styles={customSelectStyles}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                The contact will be automatically subscribed to the selected lists upon creation.
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
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                        >
                            <UserPlusIcon className="h-5 w-5" />
                            {saving ? 'Creating…' : 'Create Contact'}
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