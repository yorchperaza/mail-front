'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Select, { SingleValue } from 'react-select';
import TimezoneSelect, { ITimezone } from 'react-timezone-select';
import type { MultiValue } from 'react-select';

type ListGroup = { id: number; name: string };

type CreateContactBody = {
    email: string;
    name?: string | null;
    locale?: string | null;
    timezone?: string | null;
    status?: string | null;
    consent_source?: string | null;
    gdpr_consent_at?: string | null; // ISO
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

const LOCALE_OPTIONS = [
    'en-US','en-GB','es-ES','es-MX','fr-FR','de-DE','it-IT','pt-BR','nl-NL','sv-SE','pl-PL'
].map(v => ({ value: v, label: v }));

const STATUS_OPTIONS = ['active','unsubscribed','bounced','complained','inactive']
    .map(v => ({ value: v, label: v }));

const CONSENT_SOURCE_OPTIONS = ['signup_form','import','checkout','api','manual']
    .map(v => ({ value: v, label: v }));

const CREATE_LIST_VALUE = '__create__';

export default function ContactCreatePage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    // Lists
    const [lists, setLists] = useState<ListGroup[]>([]);
    const [loadingLists, setLoadingLists] = useState(true);

    // Form state
    const [email, setEmail] = useState('');
    const [emailCheck, setEmailCheck] = useState<EmailCheckState>({ state: 'idle' });
    const [name, setName] = useState('');

    // Timezone handling
    const guess = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const [locale, setLocale] = useState<string>('');
    const [timezone, setTimezone] = useState<string>(guess);
    const [tzOption, setTzOption] = useState<ITimezone | string>(guess);

    const [status, setStatus] = useState<string>('');
    const [consentSource, setConsentSource] = useState<string>('');
    const [gdprConsentAt, setGdprConsentAt] = useState(''); // datetime-local

    // Attributes builder
    const [attrsRows, setAttrsRows] = useState<Array<{ k: string; v: string }>>([{ k: '', v: '' }]);

    // Multi-select lists + modal
    const [selectedListIds, setSelectedListIds] = useState<number[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [creatingList, setCreatingList] = useState(false);

    // Submit state
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const authHeaders = useMemo(() => {
        return (): HeadersInit => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
            return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        };
    }, []);

    const backHref = `/dashboard/company/${hash}/contacts`;

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

    // Email existence check
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

    // Attributes helpers
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
            setSelectedListIds(prev => Array.from(new Set([...prev, id]))); // auto-select the new list
            setModalOpen(false);
            setNewListName('');
        } catch (e) {
            console.error(e);
        } finally {
            setCreatingList(false);
        }
    }

    // react-select helpers
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

    const listOptions = useMemo(() => {
        const opts = lists.map(l => ({ value: String(l.id), label: l.name }));
        return [{ value: '', label: '— None —' }, ...opts, { value: CREATE_LIST_VALUE, label: '＋ Create new list…' }];
    }, [lists]);

    // Submit
    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const em = email.trim().toLowerCase();
        if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
            setError('Please enter a valid email.');
            return;
        }

        setSaving(true);
        try {
            const body: CreateContactBody = {
                email: em,
                name: name.trim() || null,
                locale: locale || null,
                timezone: timezone || null, // plain IANA string
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

            router.push(`/dashboard/company/${hash}/contacts/${contactId}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create contact.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(`/dashboard/company/${hash}/contacts`)}
                    className="inline-flex items-center text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back to Contacts
                </button>
                <h1 className="text-2xl font-semibold">Create Contact</h1>
                <div />
            </div>

            {error && (
                <div className="rounded border border-red-300 bg-red-50 text-red-800 p-3 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={onSubmit} className="space-y-6 bg-white p-5 rounded border">
                {/* Identity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Email *</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => checkEmailExists(email)}
                            className="w-full rounded border px-3 py-2"
                            placeholder="user@example.com"
                        />
                        {emailCheck.state === 'checking' && (
                            <p className="text-xs text-gray-500 mt-1">Checking…</p>
                        )}
                        {emailCheck.state === 'exists' && (
                            <p className="text-xs mt-1">
                                <span className="text-amber-700 font-medium">This email already exists.</span>{' '}
                                <Link
                                    className="text-blue-700 underline"
                                    href={`/dashboard/company/${hash}/contacts/${emailCheck.id}`}
                                >
                                    View existing contact
                                </Link>
                            </p>
                        )}
                        {emailCheck.state === 'available' && (
                            <p className="text-xs text-green-700 mt-1">Email is available.</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded border px-3 py-2"
                            placeholder="Full name"
                        />
                    </div>
                </div>

                {/* Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Locale</label>
                        <Select
                            options={LOCALE_OPTIONS}
                            value={localeOption}
                            onChange={(opt: SingleValue<{value:string;label:string}>) => setLocale(opt?.value || '')}
                            placeholder="Select locale…"
                            isClearable
                            className="react-select-container"
                            classNamePrefix="react-select"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Timezone</label>
                        <TimezoneSelect
                            value={tzOption}
                            onChange={(selected: ITimezone | string) => {
                                if (typeof selected === 'string') {
                                    setTimezone(selected);
                                    setTzOption(selected);
                                } else if (selected && typeof selected === 'object' && 'value' in selected) {
                                    setTimezone(selected.value);   // store IANA for API
                                    setTzOption(selected);         // keep object for display
                                }
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <Select
                            options={STATUS_OPTIONS}
                            value={statusOption}
                            onChange={(opt: SingleValue<{value:string;label:string}>) => setStatus(opt?.value || '')}
                            placeholder="Select status…"
                            isClearable
                            className="react-select-container"
                            classNamePrefix="react-select"
                        />
                    </div>
                </div>

                {/* Consent */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">GDPR Consent At</label>
                        <input
                            type="datetime-local"
                            value={gdprConsentAt}
                            onChange={(e) => setGdprConsentAt(e.target.value)}
                            className="w-full rounded border px-3 py-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">Optional. Converted to ISO before sending.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Consent Source</label>
                        <Select
                            options={CONSENT_SOURCE_OPTIONS}
                            value={consentOption}
                            onChange={(opt: SingleValue<{value:string;label:string}>) => setConsentSource(opt?.value || '')}
                            placeholder="Select source…"
                            isClearable
                            className="react-select-container"
                            classNamePrefix="react-select"
                        />
                    </div>
                </div>

                {/* Attributes */}
                <div>
                    <label className="block text-sm font-medium mb-2">Attributes</label>
                    <div className="space-y-2">
                        {attrsRows.map((row, idx) => (
                            <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                <input
                                    value={row.k}
                                    onChange={(e) => setAttrsRows(r => r.map((x, i) => i === idx ? { ...x, k: e.target.value } : x))}
                                    className="rounded border px-3 py-2"
                                    placeholder="key (e.g. plan)"
                                />
                                <input
                                    value={row.v}
                                    onChange={(e) => setAttrsRows(r => r.map((x, i) => i === idx ? { ...x, v: e.target.value } : x))}
                                    className="rounded border px-3 py-2"
                                    placeholder='value (e.g. "pro", 42, true, {"a":1})'
                                />
                                <button
                                    type="button"
                                    onClick={() => removeAttrRow(idx)}
                                    className="inline-flex items-center justify-center px-3 rounded border hover:bg-gray-50"
                                    title="Remove row"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addAttrRow}
                            className="inline-flex items-center px-3 py-1.5 rounded border hover:bg-gray-50 text-sm"
                        >
                            <PlusIcon className="h-4 w-4 mr-1" /> Add attribute
                        </button>
                        <p className="text-xs text-gray-500">
                            Values are auto-parsed to boolean/number/object when possible; otherwise saved as strings.
                        </p>
                    </div>
                </div>

                {/* List subscription */}
                <fieldset className="border rounded p-4 space-y-3">
                    <legend className="text-sm font-medium px-2">Subscribe to List (optional)</legend>
                    <div>
                        <label className="block text-sm font-medium mb-1">Lists</label>
                        <Select
                            isDisabled={loadingLists}
                            isMulti
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
                            placeholder="Select lists…"
                            className="react-select-container"
                            classNamePrefix="react-select"
                        />
                    </div>
                </fieldset>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                    <Link href={backHref} className="px-4 py-2 rounded border hover:bg-gray-50">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={saving || creatingList}
                        className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900 disabled:opacity-60"
                    >
                        <PlusIcon className="h-5 w-5 mr-1" />
                        {saving ? 'Saving…' : 'Create Contact'}
                    </button>
                </div>
            </form>

            {/* Create List Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)} />
                    <div className="relative bg-white w-full max-w-md rounded-lg shadow-lg p-5 space-y-4 border">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Create New List</h2>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-1 rounded hover:bg-gray-100"
                                aria-label="Close"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">List name</label>
                            <input
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                className="w-full rounded border px-3 py-2"
                                placeholder="e.g. Newsletter"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 rounded border hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateList}
                                disabled={creatingList || !newListName.trim()}
                                className="px-4 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-60"
                            >
                                {creatingList ? 'Creating…' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
