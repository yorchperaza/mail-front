"use client"

import { useEffect, useState } from "react"
import { getConsent, setConsent, type ConsentState } from "@/lib/consent"

export default function CookiesBanner() {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        // show only if no cookie saved yet
        if (!getConsent()) setOpen(true)
    }, [])

    if (!open) return null

    const acceptAll = () => {
        const v: ConsentState = { necessary: true, analytics: true, marketing: true }
        setConsent(v)
        setOpen(false)
    }

    const rejectAll = () => {
        const v: ConsentState = { necessary: true, analytics: false, marketing: false }
        setConsent(v)
        setOpen(false)
    }

    // Example “preferences” path: allow analytics, reject marketing
    const acceptAnalyticsOnly = () => {
        const v: ConsentState = { necessary: true, analytics: true, marketing: false }
        setConsent(v)
        setOpen(false)
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Cookie consent"
            className="fixed inset-x-0 bottom-0 z-[120] mx-auto w-full max-w-monkeys px-4 pb-4"
        >
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-white/80">
                <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="max-w-3xl">
                        <h2 className="text-sm font-semibold text-slate-900">We use cookies</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            We use necessary cookies to make our site work. With your consent, we’ll also use cookies
                            for analytics and (optionally) marketing. You can change your choice anytime.
                        </p>
                    </div>
                    <div className="flex w-full flex-none flex-col gap-2 md:w-auto md:flex-row">
                        <button
                            onClick={rejectAll}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Reject non-essential
                        </button>
                        <button
                            onClick={acceptAnalyticsOnly}
                            className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        >
                            Allow analytics only
                        </button>
                        <button
                            onClick={acceptAll}
                            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:from-blue-700 hover:to-sky-700"
                        >
                            Accept all
                        </button>
                    </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                    Read our{" "}
                    <a className="text-blue-600 hover:underline" href="/privacy">
                        Privacy Policy
                    </a>
                    .
                </div>
            </div>
        </div>
    )
}
