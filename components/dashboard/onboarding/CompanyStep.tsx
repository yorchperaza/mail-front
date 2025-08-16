'use client'

import React, { useMemo, useState } from 'react'
import { Combobox } from '@headlessui/react'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import countryList from 'react-select-country-list'

type Country = { label: string; value: string }

type Props = {
    loading?: boolean
    onSubmit: (p: {
        name: string
        phone_number?: string
        address?: { street?: string; city?: string; zip?: string; country?: string }
    }) => Promise<void>
    onSkip: () => void
}

export default function CompanyStep({ loading, onSubmit, onSkip }: Props) {
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [street, setStreet] = useState('')
    const [city, setCity] = useState('')
    const [zip, setZip] = useState('')
    const countries = useMemo(() => countryList().getData() as Country[], [])
    const [country, setCountry] = useState<Country | null>(null)
    const [filtered, setFiltered] = useState<Country[]>(countries)

    function filterCountries(q: string) {
        const query = q.toLowerCase()
        setFiltered(
            countries.filter((c) => c.label.toLowerCase().includes(query))
        )
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        await onSubmit({
            name: name.trim(),
            phone_number: phone.trim() || undefined,
            address: {
                street: street.trim() || undefined,
                city: city.trim() || undefined,
                zip: zip.trim() || undefined,
                country: country?.value || undefined,
            },
        })
    }

    return (
        <form onSubmit={submit} className="space-y-6">
            <header className="text-center">
                <h1 className="text-2xl font-bold">Step 2: Your Company (optional)</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Create a company now, or skip and do it later.
                </p>
            </header>

            <div>
                <label className="block text-sm font-medium mb-1">Company Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Awesome Co."
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    Phone Number (optional)
                </label>
                <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Street</label>
                    <input
                        type="text"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="123 Main St"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">City</label>
                    <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="San Francisco"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">ZIP / Postal</label>
                    <input
                        type="text"
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        placeholder="94105"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                </div>

                <div>
                    <Combobox value={country} onChange={setCountry}>
                        <Combobox.Label className="block text-sm font-medium mb-1">
                            Country
                        </Combobox.Label>
                        <div className="relative">
                            <Combobox.Input
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="flex-1 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                    {loading ? 'Creating…' : 'Create Company'}
                </button>

                <button
                    type="button"
                    onClick={onSkip}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    Skip
                </button>
            </div>
        </form>
    )
}