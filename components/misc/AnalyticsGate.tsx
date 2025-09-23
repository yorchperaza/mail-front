"use client"

import { useEffect, useState } from "react"
import Script from "next/script"
import { hasConsent } from "@/lib/consent"

type Props = {
    // e.g. "G-XXXXXXXXXX" if using GA4
    gaMeasurementId?: string
}

export default function AnalyticsGate({ gaMeasurementId }: Props) {
    const [ok, setOk] = useState(false)

    useEffect(() => {
        // only allow if analytics consent is present
        setOk(hasConsent("analytics"))
        // watch cookie changes (simple polling—good enough for consent banner flows)
        const t = setInterval(() => setOk(hasConsent("analytics")), 1500)
        return () => clearInterval(t)
    }, [])

    if (!ok || !gaMeasurementId) return null

    return (
        <>
            {/* GA4 example */}
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
                strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
                {`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaMeasurementId}');
      `}
            </Script>
        </>
    )
}
