"use client";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
            {children}
        </DashboardLayout>
    );
}