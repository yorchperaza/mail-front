'use client';

import React, { useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Combobox } from '@headlessui/react';
import { ArrowLeftIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import countryList from 'react-select-country-list';

type Country = { label: string; value: string };

type Address = {
    street?: string;
    city?: string;
    zip?: string;
    country?: string; // ISO code
};

type CompanyPayload = {
    name: string;
    phone_number?: string;
    address?: Address;
};

type ApiError = {
    error?: true;
    message: string;
    fields?: Record<string, string>;
};

export default function CreateCompanyPage() {
    const router = useRouter();

    // Form state
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [zip, setZip] = useState('');

    // Countries
    const countries = useMemo(() => countryList().getData() as Country[], []);
    const [country, setCountry] = useState<Country | null>(null);
    const [filtered, setFiltered] = useState<Country[]>(countries);

    // UX
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState<ApiError | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const getToken = () =>
        typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;

    function filterCountries(q: string) {
        const query = q.toLowerCase();
        setFiltered(countries.filter((c) => c.label.toLowerCase().includes(query)));
    }

    function validate(): boolean {
        const errs: Record<string, string> = {};
        if (!name.trim()) errs['name'] = 'Company name is required.';

        // Address all-or-nothing (mirror backend)
        const anyAddr = [street, city, zip, country?.value ?? ''].some((v) => v?.trim());
        if (anyAddr) {
            if (!street.trim()) errs['street'] = 'Street is required.';
            if (!city.trim()) errs['city'] = 'City is required.';
            if (!zip.trim()) errs['zip'] = 'ZIP / Postal is required.';
            if (!country?.value) errs['country'] = 'Country is required.';
        }

        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setApiError(null);
        if (!validate()) return;

        setSaving(true);

        const fullAddr =
            [street, city, zip, country?.value ?? ''].every((v) => !!v?.trim());

        const payload: CompanyPayload = {
            name: name.trim(),
            ...(phone.trim() ? { phone_number: phone.trim() } : {}),
            ...(fullAddr
                ? {
                    address: {
                        street: street.trim(),
                        city: city.trim(),
                        zip: zip.trim(),
                        country: country!.value,
                    },
                }
                : {}),
        };

        try {
            const token = getToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                let err: ApiError | undefined;
                try { err = await res.json(); } catch {}
                setApiError(err ?? { message: `Failed to create company: ${res.status}` });
                if (err?.fields) setFieldErrors(err.fields);
                setSaving(false);
                return;
            }

            const json = await res.json(); // expects { hash, ... }
            if (json?.hash) router.push(`/dashboard/company/${json.hash}`);
            else router.push('/dashboard/company');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setApiError({ message });
            setSaving(false);
        }
    }

    return (
        <div className="p-6 space-y-8">
            {/* Header — matches CompanyDetailPage */}
            <div className="flex items-center space-x-3">
                <button
                    onClick={() => router.push('/dashboard/company')}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
                    aria-label="Back"
                >
                    <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
                </button>
                <h1 className="text-3xl font-semibold">Create Company</h1>
                <div className="ml-auto text-sm">
                    <Link href="/dashboard/company" className="text-blue-600 hover:text-blue-700">
                        All companies →
                    </Link>
                </div>
            </div>

            {/* Company Info */}
            <section className="bg-white rounded-lg shadow p-6 space-y-4">
                <h2 className="text-lg font-medium">Company Info</h2>

                {apiError && (
                    <div role="alert" className="rounded bg-red-50 p-3 text-red-700">
                        {apiError.message}
                    </div>
                )}

                <div className="grid gap-y-4 sm:grid-cols-2 sm:gap-x-6">
                    <div className="sm:col-span-2">
                        <label className="block text-sm text-gray-500 mb-1">Company Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setFieldErrors((f) => ({ ...f, name: '' })); }}
                            placeholder="My Awesome Co."
                            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                fieldErrors['name'] ? 'border-red-500' : 'border-gray-300'
                            }`}
                        />
                        {fieldErrors['name'] && (
                            <p className="mt-1 text-sm text-red-600">{fieldErrors['name']}</p>
                        )}
                    </div>

                    <div>
                        <span className="block text-sm text-gray-500 mb-1">Phone</span>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 (555) 123-4567"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>
                </div>
            </section>

            {/* Address */}
            <section className="bg-white rounded-lg shadow p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium">Address (optional)</h2>
                    <span className="text-xs text-gray-500">If you fill any field, all four are required.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                        <label className="block text-sm text-gray-500 mb-1">Street</label>
                        <input
                            type="text"
                            value={street}
                            onChange={(e) => { setStreet(e.target.value); setFieldErrors((f) => ({ ...f, street: '' })); }}
                            placeholder="123 Main St"
                            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                fieldErrors['street'] ? 'border-red-500' : 'border-gray-300'
                            }`}
                        />
                        {fieldErrors['street'] && (
                            <p className="mt-1 text-sm text-red-600">{fieldErrors['street']}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm text-gray-500 mb-1">City</label>
                        <input
                            type="text"
                            value={city}
                            onChange={(e) => { setCity(e.target.value); setFieldErrors((f) => ({ ...f, city: '' })); }}
                            placeholder="San Francisco"
                            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                fieldErrors['city'] ? 'border-red-500' : 'border-gray-300'
                            }`}
                        />
                        {fieldErrors['city'] && (
                            <p className="mt-1 text-sm text-red-600">{fieldErrors['city']}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm text-gray-500 mb-1">ZIP / Postal</label>
                        <input
                            type="text"
                            value={zip}
                            onChange={(e) => { setZip(e.target.value); setFieldErrors((f) => ({ ...f, zip: '' })); }}
                            placeholder="94105"
                            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                fieldErrors['zip'] ? 'border-red-500' : 'border-gray-300'
                            }`}
                        />
                        {fieldErrors['zip'] && (
                            <p className="mt-1 text-sm text-red-600">{fieldErrors['zip']}</p>
                        )}
                    </div>

                    <div>
                        <Combobox value={country} onChange={(val) => { setCountry(val); setFieldErrors((f) => ({ ...f, country: '' })); }}>
                            <Combobox.Label className="block text-sm text-gray-500 mb-1">Country</Combobox.Label>
                            <div className="relative">
                                <Combobox.Input
                                    className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                        fieldErrors['country'] ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    displayValue={(c: Country) => c?.label || ''}
                                    placeholder="Select country"
                                    onChange={(e) => filterCountries(e.target.value)}
                                />
                                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                                </Combobox.Button>

                                <Combobox.Options className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 overflow-auto rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    {filtered.map((c) => (
                                        <Combobox.Option
                                            key={c.value}
                                            value={c}
                                            className={({ active }) =>
                                                `cursor-pointer select-none relative py-2 pl-4 pr-4 ${
                                                    active ? 'bg-blue-100 text-blue-900' : 'text-gray-700'
                                                }`
                                            }
                                        >
                                            {({ selected }) => (
                                                <span className={`block truncate ${selected ? 'font-semibold' : ''}`}>
                          {c.label}
                        </span>
                                            )}
                                        </Combobox.Option>
                                    ))}
                                </Combobox.Options>
                            </div>
                        </Combobox>
                        {fieldErrors['country'] && (
                            <p className="mt-1 text-sm text-red-600">{fieldErrors['country']}</p>
                        )}
                    </div>
                </div>
            </section>

            {/* Actions (mirrors your spacing/buttons) */}
            <section className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-end gap-3">
                    <Link
                        href="/dashboard/company"
                        className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        form="create-company-form"
                        disabled={saving || !name.trim()}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? 'Creating…' : 'Create Company'}
                    </button>
                </div>
            </section>

            {/* Hidden form element so the Actions footer stays clean */}
            <form id="create-company-form" onSubmit={onSubmit} className="hidden" />
        </div>
    );
}