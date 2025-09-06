import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        dangerouslyAllowSVG: true,
        contentSecurityPolicy:
            "default-src 'self'; script-src 'none'; sandbox;", // required when allowing SVG
        remotePatterns: [
            { protocol: "http",  hostname: "127.0.0.1", port: "8000", pathname: "/files/**" },
            { protocol: "http",  hostname: "localhost", port: "8000", pathname: "/files/**" },
            { protocol: "https", hostname: "monkeysmail.com",             pathname: "/files/**" },
            { protocol: "https", hostname: "api.dicebear.com",            pathname: "/**" }, // <- add pathname
        ],
    },
};

export default nextConfig;
