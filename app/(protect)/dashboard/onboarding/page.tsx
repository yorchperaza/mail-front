'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import ProfileStep, { ProfileData } from '@/components/dashboard/onboarding/ProfileStep'
import CompanyStep from '@/components/dashboard/onboarding/CompanyStep'

export type Country = { label: string; value: string }

export default function OnboardingPage() {
    const router = useRouter()

    // UI & network state
    const [step, setStep] = useState<1 | 2>(1)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Lifted profile form state
    const [profileData, setProfileData] = useState<ProfileData>({ fullName: '', file: undefined })
    const [profileSaved, setProfileSaved] = useState(false)

    function authHeaders(): HeadersInit {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null
        return token ? { Authorization: `Bearer ${token}` } : {}
    }

    async function saveProfile(data: ProfileData) {
        const form = new FormData()
        form.append('fullName', data.fullName.trim())
        if (data.file) form.append('file', data.file)

        const res = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/me/profile`,
            {
                method: 'POST',
                headers: authHeaders(),
                body: form,
            }
        )

        let $responseMedia;
        // eslint-disable-next-line prefer-const
        $responseMedia = await res.json().catch(() => null)
        if ($responseMedia) {
            // Update local storage with new profile data
            localStorage.setItem('profile', JSON.stringify($responseMedia))
        }

        if (!res.ok) {
            throw new Error('Failed to save profile')
        }
    }

    // Step 1: Save profile
    async function handleSaveProfile() {
        setError(null)
        setSaving(true)
        try {
            await saveProfile(profileData)
            setProfileSaved(true)
            setStep(2)
        } catch (e: unknown) {
            if (e instanceof Error) setError(e.message)
            else setError('Profile update failed')
        } finally {
            setSaving(false)
        }
    }

    // Step 2: Create company
    async function handleCreateCompany(
        payload: {
            name: string
            phone_number?: string
            address?: { street?: string; city?: string; zip?: string; country?: string }
        }
    ) {
        setError(null)
        setSaving(true)
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders(),
                    },
                    body: JSON.stringify(payload),
                }
            )

            if (!res.ok) {
                const errBody = await res.json().catch(() => null)
                const msg = errBody?.message ?? 'Failed to create company'
                throw new Error(msg)
            }

            router.push('/dashboard')
        } catch (e: unknown) {
            if (e instanceof Error) setError(e.message)
            else setError('Company creation failed')
        } finally {
            setSaving(false)
        }
    }

    // Skip company: ensure profile is saved
    async function handleSkipCompany() {
        setError(null)
        setSaving(true)
        try {
            if (!profileSaved) {
                await saveProfile(profileData)
            }
            router.push('/dashboard')
        } catch (e: unknown) {
            if (e instanceof Error) setError(e.message)
            else setError('Could not save profile')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-lg bg-white p-8 rounded-xl shadow-lg">
                {error && (
                    <p className="mb-4 text-sm text-red-600 text-center">{error}</p>
                )}

                {step === 1 ? (
                    <ProfileStep
                        fullName={profileData.fullName}
                        file={profileData.file}
                        onChange={(d) => setProfileData(d)}
                        onSubmit={handleSaveProfile}
                        loading={saving}
                    />
                ) : (
                    <CompanyStep
                        onSubmit={handleCreateCompany}
                        onSkip={handleSkipCompany}
                        loading={saving}
                    />
                )}
            </div>
        </div>
    )
}