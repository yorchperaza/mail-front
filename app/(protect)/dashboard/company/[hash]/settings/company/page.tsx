'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    BuildingOfficeIcon,
    MapPinIcon,
    PowerIcon,
    DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import copy from 'copy-to-clipboard';

// Countries + phone input
import countries from 'world-countries';
import { PhoneInput } from 'react-international-phone';
import type { CountryIso2 } from 'react-international-phone';
import 'react-international-phone/style.css';

/* ---------------- Types ---------------- */
type Address = { street?: string; city?: string; zip?: string; country?: string } | null;
type PlanBrief = { id?: number; name: string | null } | null;
type CompanyDetail = {
    hash: string;
    name: string | null;
    phone_number: string | null;
    address: Address;
    status?: boolean | number | null;
    plan?: PlanBrief;
};

/* -------------- Helpers --------------- */
const authHeaders = (): HeadersInit => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

// Strong type for world-countries without using `any`
type WCountry = { cca2?: string; name?: { common?: string } };
type CountryOption = { value: string; label: string };

const COUNTRY_OPTIONS: CountryOption[] = (countries as unknown as WCountry[])
    .map((c) => ({
        value: String(c.cca2 ?? '').toUpperCase(),
        label: String(c.name?.common ?? ''),
    }))
    .filter((o) => o.value && o.label)
    .sort((a, b) => a.label.localeCompare(b.label));

const codeToName = (code?: string) =>
    COUNTRY_OPTIONS.find((o) => o.value === String(code ?? '').toUpperCase())?.label;

const nameToCode = (name?: string) => {
    if (!name) return '';
    const found = COUNTRY_OPTIONS.find((o) => o.label.toLowerCase() === String(name).toLowerCase());
    return found?.value ?? '';
};

// Normalize odd address payloads
function normalizeAddress(addr: unknown): Address {
    if (!addr) return null;
    if (Array.isArray(addr)) {
        try {
            const joined = (addr as unknown[]).join(',');
            const obj = JSON.parse(joined);
            return (obj && typeof obj === 'object') ? (obj as Address) : null;
        } catch { return null; }
    }
    if (typeof addr === 'string') {
        try {
            const obj = JSON.parse(addr);
            return (obj && typeof obj === 'object') ? (obj as Address) : null;
        } catch { return null; }
    }
    if (typeof addr === 'object') return addr as Address;
    return null;
}

/* -------------- Page ------------------ */
export default function CompanyEditPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();

    const [initial, setInitial] = useState<CompanyDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const [name, setName] = useState('');
    const [phone, setPhone] = useState<string>('');
    const [street, setStreet] = useState<string>('');
    const [city, setCity] = useState<string>('');
    const [zip, setZip] = useState<string>('');
    // store ISO code; convert to name for backend
    const [countryCode, setCountryCode] = useState<string>('');
    const [active, setActive] = useState<boolean>(true);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // load current company
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}`, {
                    headers: authHeaders(),
                });
                if (res.status === 403) throw new Error(`You don't have access to this company.`);
                if (!res.ok) throw new Error(`Failed to load company (${res.status})`);

                const data = (await res.json()) as CompanyDetail;
                const address = normalizeAddress(data.address);
                const derivedCode = nameToCode(address?.country || '');

                if (!cancelled) {
                    setInitial({ ...data, address, status: data.status ?? true });
                    setName(data.name ?? '');
                    setPhone(data.phone_number ?? '');
                    setStreet(address?.street ?? '');
                    setCity(address?.city ?? '');
                    setZip(address?.zip ?? '');
                    setCountryCode(derivedCode || '');
                    setActive(Boolean(data.status ?? true));
                }
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load company');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [hash]);

    // Build address if any field present
    const currentAddress: Address = useMemo(() => {
        const any =
            Boolean(street && street.trim() !== '') ||
            Boolean(city && city.trim() !== '') ||
            Boolean(zip && zip.trim() !== '') ||
            Boolean(countryCode && countryCode.trim() !== '');
        if (!any) return null;
        return {
            street: street.trim(),
            city: city.trim(),
            zip: zip.trim(),
            country: codeToName(countryCode) || '',
        };
    }, [street, city, zip, countryCode]);

    // Detect changes
    const dirty = useMemo(() => {
        if (!initial) return false;
        const nameChanged = (initial.name ?? '') !== name;
        const phoneChanged = (initial.phone_number ?? '') !== phone;
        const statusChanged = Boolean(initial.status ?? true) !== active;

        const iAddr = initial.address ?? null;
        const aChanged =
            (iAddr?.street ?? '') !== (currentAddress?.street ?? '') ||
            (iAddr?.city ?? '') !== (currentAddress?.city ?? '') ||
            (iAddr?.zip ?? '') !== (currentAddress?.zip ?? '') ||
            (iAddr?.country ?? '') !== (currentAddress?.country ?? '');

        return nameChanged || phoneChanged || statusChanged || aChanged;
    }, [initial, name, phone, active, currentAddress]);

    // Minimal PATCH
    function buildPatch(): Record<string, unknown> {
        if (!initial) return {};
        const patch: Record<string, unknown> = {};

        if ((initial.name ?? '') !== name) patch.name = name.trim();
        if ((initial.phone_number ?? '') !== phone) patch.phone_number = phone.trim() || null;

        const iAddr = initial.address ?? null;
        const nowAddr = currentAddress;
        const addressChanged =
            (iAddr?.street ?? '') !== (nowAddr?.street ?? '') ||
            (iAddr?.city ?? '') !== (nowAddr?.city ?? '') ||
            (iAddr?.zip ?? '') !== (nowAddr?.zip ?? '') ||
            (iAddr?.country ?? '') !== (nowAddr?.country ?? '');

        if (addressChanged) {
            if (nowAddr) {
                (['street', 'city', 'zip', 'country'] as const).forEach((k) => {
                    if (!nowAddr[k] || String(nowAddr[k]).trim() === '') {
                        throw new Error(`Address ${k} is required when providing address.`);
                    }
                });
                patch.address = nowAddr;
            } else {
                patch.address = null;
            }
        }

        if (Boolean(initial.status ?? true) !== active) patch.status = active;
        return patch;
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setNotice(null);

        try {
            const patch = buildPatch();
            if (Object.keys(patch).length === 0) {
                setNotice('No changes to save.');
                return;
            }
            setSaving(true);
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(patch),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Failed to save changes (${res.status})`);
            }
            const updated = (await res.json()) as CompanyDetail;

            const updAddr = normalizeAddress(updated.address);
            setInitial({ ...updated, address: updAddr, status: updated.status ?? true });
            setName(updated.name ?? '');
            setPhone(updated.phone_number ?? '');
            setStreet(updAddr?.street ?? '');
            setCity(updAddr?.city ?? '');
            setZip(updAddr?.zip ?? '');
            setCountryCode(nameToCode(updAddr?.country || '') || '');
            setActive(Boolean(updated.status ?? true));
            setNotice('Company updated successfully.');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save changes.');
        } finally {
            setSaving(false);
        }
    }

    function onCopyHash() {
        if (!initial?.hash) return;
        copy(initial.hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-5xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-10 w-64 rounded-lg bg-gray-200" />
                        <div className="h-64 rounded-xl bg-gray-200" />
                    </div>
                </div>
            </div>
        );
    }

    if (!initial) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="max-w-md w-full rounded-xl bg-white p-6 shadow ring-1 ring-gray-200">
                    <div className="flex items-center gap-2 text-red-600">
                        <ExclamationTriangleIcon className="h-5 w-5" />
                        <h2 className="font-semibold">Error</h2>
                    </div>
                    <p className="mt-2 text-gray-600">{error ?? 'Company not found'}</p>
                    <button
                        onClick={() => router.push(`/dashboard/company/${hash}`)}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
                    >
                        Back
                    </button>
                </div>
            </div>
        );
    }

    // boolean coercion fixes `disabled` typing
    const addressIncomplete: boolean = Boolean(street || city || zip) && !Boolean(countryCode);
    const saveDisabled: boolean = Boolean(saving || !dirty || addressIncomplete);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-5xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold text-gray-900">Edit Company</h1>
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                        active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                                    }`}
                                >
                  <PowerIcon className="h-3.5 w-3.5" />
                                    {active ? 'Active' : 'Inactive'}
                </span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                                <span className="font-mono text-xs">{initial.hash}</span>
                                <button
                                    onClick={onCopyHash}
                                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 transition-colors"
                                    title="Copy hash"
                                >
                                    {copied ? (
                                        <>
                                            <CheckCircleIcon className="h-3 w-3 text-emerald-600" />
                                            Copied
                                        </>
                                    ) : (
                                        <>
                                            <DocumentDuplicateIcon className="h-3 w-3" />
                                            Copy
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setName(initial.name ?? '');
                                setPhone(initial.phone_number ?? '');
                                const a = normalizeAddress(initial.address);
                                setStreet(a?.street ?? '');
                                setCity(a?.city ?? '');
                                setZip(a?.zip ?? '');
                                setCountryCode(nameToCode(a?.country || '') || '');
                                setActive(Boolean(initial.status ?? true));
                                setNotice('Changes reverted.');
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                        >
                            Reset
                        </button>
                        <button
                            form="company-edit-form"
                            type="submit"
                            disabled={saveDisabled}
                            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all shadow-sm
                ${saveDisabled ? 'bg-indigo-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800'}
              `}
                        >
                            {saving ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4" />
                            <span>{error}</span>
                        </div>
                    </div>
                )}
                {notice && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        <div className="flex items-center gap-2">
                            <CheckCircleIcon className="h-4 w-4" />
                            <span>{notice}</span>
                        </div>
                    </div>
                )}
                {addressIncomplete && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                        Provide a country when entering address details.
                    </div>
                )}

                {/* Form Card */}
                <form id="company-edit-form" onSubmit={onSubmit} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider">
                            <BuildingOfficeIcon className="h-5 w-5" />
                            Company Profile
                        </h2>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Name + Status */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Company name"
                                    className="mt-1 w-full rounded-lg border-gray-300 focus:ring-indigo-600 focus:border-indigo-600"
                                    required
                                />
                            </div>

                            <div className="flex flex-col">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</label>
                                <div className="mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setActive((v) => !v)}
                                        className={`inline-flex items-center justify-between w-full rounded-lg px-3 py-2 ring-1 transition-all
                      ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-50 text-gray-700 ring-gray-200'}
                    `}
                                    >
                    <span className="flex items-center gap-2">
                      <PowerIcon className="h-4 w-4" />
                        {active ? 'Active' : 'Inactive'}
                    </span>
                                        <span className={`ml-3 h-5 w-9 rounded-full p-0.5 transition ${active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <span className={`block h-4 w-4 rounded-full bg-white transition ${active ? 'translate-x-4' : ''}`} />
                    </span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Phone (with country picker) */}
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</label>
                            <div className="mt-1 rounded-lg ring-1 ring-gray-300 focus-within:ring-2 focus-within:ring-indigo-600">
                                <PhoneInput
                                    defaultCountry={((countryCode || 'US').toLowerCase() as CountryIso2)}
                                    value={phone}
                                    onChange={(val) => setPhone(val)}
                                    forceDialCode
                                    className="w-full"
                                    inputClassName="!w-full !h-10 !border-0 !rounded-lg !bg-transparent !pl-2 !text-sm"
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">Stored in international format (e.g., +1 415…)</p>
                        </div>

                        {/* Address Card */}
                        <div className="rounded-lg ring-1 ring-gray-200">
                            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3">
                                <h3 className="flex items-center gap-2 text-xs font-semibold text-white uppercase tracking-wider">
                                    <MapPinIcon className="h-4 w-4" />
                                    Business Address
                                </h3>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Street</label>
                                    <input
                                        type="text"
                                        value={street}
                                        onChange={(e) => setStreet(e.target.value)}
                                        placeholder="123 Main St"
                                        className="mt-1 w-full rounded-lg border-gray-300 focus:ring-emerald-600 focus:border-emerald-600"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">City</label>
                                        <input
                                            type="text"
                                            value={city}
                                            onChange={(e) => setCity(e.target.value)}
                                            placeholder="City"
                                            className="mt-1 w-full rounded-lg border-gray-300 focus:ring-emerald-600 focus:border-emerald-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Zip</label>
                                        <input
                                            type="text"
                                            value={zip}
                                            onChange={(e) => setZip(e.target.value)}
                                            placeholder="Postal code"
                                            className="mt-1 w-full rounded-lg border-gray-300 focus:ring-emerald-600 focus:border-emerald-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Country</label>
                                        <select
                                            value={countryCode}
                                            onChange={(e) => setCountryCode(e.target.value)}
                                            className="mt-1 w-full rounded-lg border-gray-300 focus:ring-emerald-600 focus:border-emerald-600"
                                        >
                                            <option value="">{'— Select country —'}</option>
                                            {COUNTRY_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500">
                                        Leave all fields empty to remove the saved address.
                                    </p>
                                    {(street || city || zip || countryCode) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStreet(''); setCity(''); setZip(''); setCountryCode('');
                                            }}
                                            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                                        >
                                            Clear address
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Sticky “unsaved changes” hint */}
                <div
                    className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-40 transition-all ${
                        dirty ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                    }`}
                >
                    <div className="rounded-full bg-white text-gray-700 shadow-lg ring-1 ring-gray-200 px-4 py-2 text-sm">
                        You have unsaved changes
                    </div>
                </div>
            </div>
        </div>
    );
}
