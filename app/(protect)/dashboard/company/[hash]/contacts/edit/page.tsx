'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, CheckIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Select, { SingleValue } from 'react-select';
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

type ListMembership = { id: number; name: string; subscribed_at?: string | null };
type ContactLookupResponse = { contact: Contact; lists: ListMembership[] };

type ListsResponse = { items?: Array<{ id: number; name: string }> };
type ListGroup = { id: number; name: string };

type KV = { k: string; v: string };

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

    // base data
    const [contact, setContact] = useState<Contact | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // lists catalog + selection
    const [listsCatalog, setListsCatalog] = useState<ListGroup[]>([]);
    const [loadingLists, setLoadingLists] = useState(true);
    const [selectedListIds, setSelectedListIds] = useState<number[]>([]);

    // create-list modal
    const [modalOpen, setModalOpen] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [creatingList, setCreatingList] = useState(false);

    // saving state
    const [saving, setSaving] = useState(false);

    // form fields
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [locale, setLocale] = useState('');
    const [timezone, setTimezone] = useState('');                     // IANA string for API
    const [tzOption, setTzOption] = useState<ITimezone | string>(''); // controlled value for TimezoneSelect
    const [status, setStatus] = useState('');
    const [consentSource, setConsentSource] = useState('');
    const [gdprConsentAt, setGdprConsentAt] = useState('');
    const [attrsRows, setAttrsRows] = useState<KV[]>([{ k: '', v: '' }]);

    const backHref = `/dashboard/company/${hash}/contacts/detail?email=${encodeURIComponent(emailQuery)}`;

    const localeOption = useMemo(() => (locale ? { value: locale, label: locale } : null), [locale]);
    const statusOption = useMemo(() => (status ? { value: status, label: status } : null), [status]);
    const consentOption = useMemo(() => (consentSource ? { value: consentSource, label: consentSource } : null), [consentSource]);

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

    // Load contact + memberships
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

                // populate form
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

                // preselect lists
                setSelectedListIds(ls.map(l => l.id));
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : 'Failed to load contact');
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [backend, hash, emailQuery, authHeaders]);

    // Options for the "Add list…" dropdown: only lists NOT already selected + create
    const addListOptions = useMemo(() => {
        const notSelected = listsCatalog
            .filter(l => !selectedListIds.includes(l.id))
            .map(l => ({ value: String(l.id), label: l.name }));
        return [...notSelected, { value: CREATE_LIST_VALUE, label: '＋ Create new list…' }];
    }, [listsCatalog, selectedListIds]);

    // Selecting from the dropdown only ADDS a list (or opens create)
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

    // Remove one membership (optimistic; also calls backend endpoint)
    async function handleRemoveList(listId: number) {
        if (!contact) return;
        setSelectedListIds(ids => ids.filter(id => id !== listId)); // optimistic UI
        try {
            const res = await fetch(
                `${backend}/companies/${hash}/lists/${listId}/contacts/${contact.id}`,
                { method: 'DELETE', headers: authHeaders() }
            );
            if (!res.ok && res.status !== 204) {
                // revert
                setSelectedListIds(ids => Array.from(new Set([...ids, listId])));
                const t = await res.text();
                throw new Error(`Failed to remove from list (${res.status}) ${t || ''}`);
            }
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Failed to remove list membership');
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

            // Add to catalog and select it
            setListsCatalog(prev => [...prev, { id, name }]);
            setSelectedListIds(prev => Array.from(new Set([...prev, id])));
            setModalOpen(false);
            setNewListName('');
        } catch (e) {
            console.error(e);
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
            // only keep lists that still exist in the catalog
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
                list_ids: validIds, // authoritative replace
            };

            const res = await fetch(`${backend}/companies/${hash}/contacts/${contact.id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Save failed (${res.status})`);

            const nextEmail = (body.email ?? emailQuery) as string;
            router.push(`/dashboard/company/${hash}/contacts/detail?email=${encodeURIComponent(nextEmail)}`);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Failed to save contact');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <p className="p-6 text-center text-gray-600">Loading…</p>;
    if (err) {
        return (
            <div className="p-6 text-center space-y-3">
                <p className="text-red-600">{err}</p>
                <button
                    onClick={() => router.push(`/dashboard/company/${hash}/contacts`)}
                    className="inline-flex items-center px-3 py-2 rounded border"
                >
                    <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back
                </button>
            </div>
        );
    }
    if (!contact) return null;

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <button onClick={() => router.push(backHref)} className="inline-flex items-center text-gray-600 hover:text-gray-800">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back to Detail
                </button>
                <h1 className="text-2xl font-semibold">Edit Contact</h1>
                <div />
            </div>

            <form onSubmit={onSave} className="space-y-6 bg-white p-5 rounded border">
                {/* Identity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Email *</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded border px-3 py-2"
                            placeholder="user@example.com"
                        />
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
                            onChange={(opt: SingleValue<{ value: string; label: string }>) => setLocale(opt?.value || '')}
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
                                } else {
                                    setTimezone(selected.value);
                                    setTzOption(selected);
                                }
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <Select
                            options={STATUS_OPTIONS}
                            value={statusOption}
                            onChange={(opt: SingleValue<{ value: string; label: string }>) => setStatus(opt?.value || '')}
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
                        <p className="text-xs text-gray-500 mt-1">Optional. Converted to ISO before saving.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Consent Source</label>
                        <Select
                            options={CONSENT_SOURCE_OPTIONS}
                            value={consentOption}
                            onChange={(opt: SingleValue<{ value: string; label: string }>) => setConsentSource(opt?.value || '')}
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
                                    onChange={(e) => setAttrsRows(r => r.map((x, i) => (i === idx ? { ...x, k: e.target.value } : x)))}
                                    className="rounded border px-3 py-2"
                                    placeholder="key (e.g. plan)"
                                />
                                <input
                                    value={row.v}
                                    onChange={(e) => setAttrsRows(r => r.map((x, i) => (i === idx ? { ...x, v: e.target.value } : x)))}
                                    className="rounded border px-3 py-2"
                                    placeholder='value (e.g. "pro", 42, true, {"a":1})'
                                />
                                <button
                                    type="button"
                                    onClick={() => setAttrsRows(r => r.filter((_, i) => i !== idx))}
                                    className="inline-flex items-center justify-center px-3 rounded border hover:bg-gray-50"
                                    title="Remove row"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setAttrsRows(r => [...r, { k: '', v: '' }])}
                            className="inline-flex items-center px-3 py-1.5 rounded border hover:bg-gray-50 text-sm"
                        >
                            <PlusIcon className="h-4 w-4 mr-1" /> Add attribute
                        </button>
                        <p className="text-xs text-gray-500">
                            Values are auto-parsed to boolean/number/object when possible; otherwise saved as strings.
                        </p>
                    </div>
                </div>

                {/* Lists */}
                <fieldset className="border rounded p-4 space-y-3">
                    <legend className="text-sm font-medium px-2">Lists</legend>

                    {/* Single-select "Add list…" dropdown */}
                    <Select
                        isDisabled={loadingLists || addListOptions.length === 0}
                        isMulti={false}
                        options={addListOptions}
                        value={null} // always show placeholder; selection adds and clears
                        onChange={onAddList}
                        isSearchable
                        placeholder={loadingLists ? 'Loading lists…' : 'Add to a list…'}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                        styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                    />

                    {/* Chips for current memberships (deselect here) */}
                    {selectedListIds.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {selectedListIds.map(id => {
                                const g = listsCatalog.find(l => l.id === id);
                                const label = g?.name ?? `List #${id}`;
                                return (
                                    <span
                                        key={id}
                                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm bg-gray-50"
                                    >
                    {label}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveList(id)}
                                            className="p-1 rounded hover:bg-gray-100"
                                            title="Remove from this list"
                                        >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </span>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500">Not in any list yet.</p>
                    )}

                    <p className="text-xs text-gray-500">
                        Changes are saved when you press “Save”. Removing with the X sends an immediate unsubscribe for that list.
                    </p>
                </fieldset>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                    <Link href={backHref} className="px-4 py-2 rounded border hover:bg-gray-50">Cancel</Link>
                    <button
                        type="submit"
                        disabled={saving || creatingList}
                        className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900 disabled:opacity-60"
                    >
                        <CheckIcon className="h-5 w-5 mr-1" />
                        {saving ? 'Saving…' : 'Save'}
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
                            <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
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
                            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded border hover:bg-gray-50">
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

/* ---------- helpers ---------- */

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
