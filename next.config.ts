import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    matcher: ["/dashboard/:path*"],
    images: {
        remotePatterns: [
            // your local backend
            {
                protocol: "http",
                hostname: "127.0.0.1",
                port: "8000",
                pathname: "/files/**",
            },
            {
                protocol: "http",
                hostname: "localhost",
                port: "8000",
                pathname: "/files/**",
            },
            // your production host
            {
                protocol: "https",
                hostname: "monkeysmail.com",
                pathname: "/files/**",
            },
        ],
    },
};

export default nextConfig;