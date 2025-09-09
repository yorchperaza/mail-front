'use client';

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SessionGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    useEffect(() => {
        const check = () => {
            const token = localStorage.getItem("jwt") || sessionStorage.getItem("jwt");
            if (!token || isTokenExpired(token)) {
                localStorage.removeItem("jwt");
                sessionStorage.removeItem("jwt");
                router.replace("/login");
            }
        };

        // check immediately
        check();

        // check every minute
        const t = setInterval(check, 60 * 1000);
        return () => clearInterval(t);
    }, [router]);

    return <>{children}</>;
}

function isTokenExpired(token: string): boolean {
    try {
        const [, payload] = token.split(".");
        const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        return decoded.exp && Date.now() >= decoded.exp * 1000;
    } catch {
        return true;
    }
}
