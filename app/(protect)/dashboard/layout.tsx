"use client";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SessionKeeper from "@/components/session/SessionKeeper";
import SessionGuard from "@/components/session/SessionGuard";
import SupportBubble from '@/components/support/SupportBubble';

interface User {
    media: {
        url: string | null;
    }
    id: number;
    email: string;
    fullName: string;
    avatarUrl ?: {
        url: string;
    }
}

async function fetchMe(): Promise<User> {
    const token = localStorage.getItem("jwt");
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`,
        {
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        }
    );
    if (!res.ok) throw new Error("Not authenticated");
    return res.json();
}

export default function DashboardPageLayout({
                                                children,
                                            }: {
    children: ReactNode;
}) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchMe()
            .then((me) => setUser(me))
            .catch(() => {
                // if not authenticated, send them to /login
                router.replace("/login");
            })
            .finally(() => setLoading(false));
    }, [router]);
    // while we’re checking auth, render nothing (or a spinner)
    if (loading || !user) {
        return null;
    }

    // pass only the props DashboardLayout needs
    return (
        <DashboardLayout
            user={{
                fullName: user.fullName,
                avatarUrl: {
                    url: user.media?.url || '',
                },
            }}
        >
            <SessionKeeper
                idleMs={30 * 60 * 1000}        // 30 minutes inactivity window
                refreshSkewMs={2 * 60 * 1000}  // refresh 2 min before exp
                checkEveryMs={30 * 1000}       // check every 30s
                heartbeatEveryMs={5 * 60 * 1000} // server ping (optional)
            />
            <SessionGuard>
                {children}
            </SessionGuard>
            <SupportBubble />
        </DashboardLayout>
    );
}