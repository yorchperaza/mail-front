// app/dashboard/companies/create/page.tsx
"use client";

import React, { useState, useMemo, FormEvent } from "react";
import { useRouter } from "next/navigation";
import PhoneInput from "react-phone-number-input";
import Select from "react-select";
import countryList from "react-select-country-list";
import "react-phone-number-input/style.css";

interface CompanyForm {
    name: string;
    phoneNumber: string;
    address: {
        street: string;
        city: string;
        zip: string;
        country: string;
    };
}

interface ApiError {
    error: true;
    message: string;
    fields?: Record<string, string>;
}

export default function CreateCompanyPage() {
    const router = useRouter();
    const [form, setForm] = useState<CompanyForm>({
        name: "",
        phoneNumber: "",
        address: { street: "", city: "", zip: "", country: "" },
    });
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState<ApiError | null>(null);

    const getToken = () =>
        typeof window !== "undefined" ? localStorage.getItem("jwt") : null;

    const countryOptions = useMemo(() => countryList().getData(), []);

    function handleTextChange(
        field: keyof Omit<CompanyForm, "address">,
        value: string
    ) {
        setForm((f) => ({ ...f, [field]: value }));
    }

    function handleAddressChange(
        field: keyof CompanyForm["address"],
        value: string
    ) {
        setForm((f) => ({
            ...f,
            address: { ...f.address, [field]: value },
        }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        setApiError(null);

        const payload = {
            name: form.name,
            phone_number: form.phoneNumber,
            address: form.address,
        };

        try {
            const token = getToken();
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!res.ok) {
                const errJson: ApiError = await res.json();
                setApiError(errJson);
                setSaving(false);
                return;
            }

            const { hash } = (await res.json()) as { hash: string };
            router.push(`/dashboard/companies/${hash}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setApiError({ error: true, message });
            setSaving(false);
        }
    }

    return (
        <div className="max-w-3xl mx-auto bg-white p-6 rounded-md shadow">
            <h1 className="text-2xl font-semibold mb-6">Create New Company</h1>

            {apiError && (
                <div
                    role="alert"
                    className="mb-4 rounded bg-red-50 p-3 text-red-700"
                >
                    {apiError.message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => handleTextChange("name", e.target.value)}
                        className="w-full border rounded p-2"
                    />
                    {apiError?.fields?.name && (
                        <p className="mt-1 text-sm text-red-600">
                            {apiError.fields.name}
                        </p>
                    )}
                </div>

                {/* Phone Number */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Phone Number
                    </label>
                    <PhoneInput
                        international
                        defaultCountry="US"
                        value={form.phoneNumber}
                        onChange={(value) =>
                            handleTextChange("phoneNumber", value || "")
                        }
                        className="w-full"
                    />
                    {apiError?.fields?.phone_number && (
                        <p className="mt-1 text-sm text-red-600">
                            {apiError.fields.phone_number}
                        </p>
                    )}
                </div>

                {/* Address */}
                <fieldset className="space-y-4 border-t pt-4">
                    <legend className="text-sm font-medium mb-2">Address</legend>

                    <div>
                        <label className="block text-sm mb-1">Street</label>
                        <input
                            type="text"
                            value={form.address.street}
                            onChange={(e) =>
                                handleAddressChange("street", e.target.value)
                            }
                            className="w-full border rounded p-2"
                        />
                        {apiError?.fields?.["address.street"] && (
                            <p className="mt-1 text-sm text-red-600">
                                {apiError.fields["address.street"]}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm mb-1">City</label>
                            <input
                                type="text"
                                value={form.address.city}
                                onChange={(e) =>
                                    handleAddressChange("city", e.target.value)
                                }
                                className="w-full border rounded p-2"
                            />
                            {apiError?.fields?.["address.city"] && (
                                <p className="mt-1 text-sm text-red-600">
                                    {apiError.fields["address.city"]}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm mb-1">ZIP</label>
                            <input
                                type="text"
                                value={form.address.zip}
                                onChange={(e) =>
                                    handleAddressChange("zip", e.target.value)
                                }
                                className="w-full border rounded p-2"
                            />
                            {apiError?.fields?.["address.zip"] && (
                                <p className="mt-1 text-sm text-red-600">
                                    {apiError.fields["address.zip"]}
                                </p>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm mb-1">Country</label>
                            <Select
                                options={countryOptions}
                                value={
                                    countryOptions.find(
                                        (c) => c.value === form.address.country
                                    ) || null
                                }
                                onChange={(option) =>
                                    handleAddressChange("country", option?.value || "")
                                }
                                className="w-full"
                            />
                            {apiError?.fields?.["address.country"] && (
                                <p className="mt-1 text-sm text-red-600">
                                    {apiError.fields["address.country"]}
                                </p>
                            )}
                        </div>
                    </div>
                </fieldset>

                {/* Actions */}
                <div className="flex justify-end space-x-2">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900 disabled:opacity-50"
                    >
                        {saving ? "Creating…" : "Create Company"}
                    </button>
                </div>
            </form>
        </div>
    );
}