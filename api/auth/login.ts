import type { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";

type Data = { success: true } | { error: string };

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Data>
) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { email, password } = req.body as {
        email?: string;
        password?: string;
    };
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
    }

    // 1) Proxy to your existing backend login endpoint
    const backendRes = await fetch(
        `${process.env.BACKEND_URL}/auth/login`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        }
    );

    if (!backendRes.ok) {
        const err = await backendRes.json().catch(() => null);
        return res
            .status(backendRes.status)
            .json({ error: err?.message || "Login failed" });
    }

    const { token } = (await backendRes.json()) as { token: string };

    // 2) Set the JWT as a secure, HTTP-only cookie
    res.setHeader(
        "Set-Cookie",
        serialize("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24,    // 1 day
            sameSite: "lax",
        })
    );

    // 3) Return success
    return res.status(200).json({ success: true });
}