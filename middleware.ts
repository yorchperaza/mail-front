import { NextResponse, NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Only protect /protect and its subpaths
    if (pathname.startsWith("/protect")) {
        const token = req.cookies.get("token")?.value;
        if (!token) {
            // Redirect to /login if no token
            const loginUrl = req.nextUrl.clone();
            loginUrl.pathname = "/login";
            return NextResponse.redirect(loginUrl);
        }
    }

    // Otherwise — let the request through
    return NextResponse.next();
}