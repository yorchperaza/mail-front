"use client";

import React, {
    useState,
    useEffect,
    useCallback,
    ChangeEvent,
    FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { PhotoIcon, XCircleIcon } from "@heroicons/react/24/outline";
import Image from "next/image";

interface Settings {
    id: number;
    email: string;
    fullName: string;
    mfaEnabled: boolean;
    mfaSecret: string | null;
    lastLoginAt: string | null;
    media: { url: string; type: string } | null;
}

interface ApiError {
    error: true;
    message: string;
    fields?: Record<string, string>;
}

export default function SettingsPage() {
    const router = useRouter();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [form, setForm] = useState({
        fullName: "",
        currentPassword: "",
        newPassword: "",
        mfaEnabled: false,
        mfaSecret: "",
        file: null as File | null,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState<ApiError | null>(null);

    const getToken = () =>
        typeof window !== "undefined" ? localStorage.getItem("jwt") : null;

    // Load existing settings
    useEffect(() => {
        async function load() {
            try {
                const token = getToken();
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/me/settings`,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                    }
                );
                if (!res.ok) throw new Error("Failed to fetch settings");
                const data: Settings = await res.json();
                setSettings(data);
                setForm({
                    fullName: data.fullName,
                    currentPassword: "",
                    newPassword: "",
                    mfaEnabled: data.mfaEnabled,
                    mfaSecret: data.mfaSecret || "",
                    file: null,
                });
            } catch {
                router.replace("/login");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [router]);

    // Dropzone
    const onDrop = useCallback((accepted: File[]) => {
        if (accepted[0]) {
            setForm((f) => ({ ...f, file: accepted[0] }));
        }
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false,
        accept: { "image/*": [] },
    });

    const handleChange = (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, type, checked, value } = e.target as HTMLInputElement;
        setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setApiError(null);

        try {
            const token = getToken();
            const body = new FormData();
            body.append("fullName", form.fullName);
            if (form.currentPassword && form.newPassword) {
                body.append("currentPassword", form.currentPassword);
                body.append("newPassword", form.newPassword);
            }
            body.append("mfaEnabled", String(form.mfaEnabled));
            if (form.mfaEnabled && form.mfaSecret) {
                body.append("mfaSecret", form.mfaSecret);
            }
            if (form.file) {
                body.append("file", form.file);
            }

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/me/settings`,
                {
                    method: "POST",
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    body,
                }
            );

            // handle validation errors
            if (!res.ok) {
                const errJson: ApiError = await res.json();
                setApiError(errJson);
                return;
            }

            const updated: Settings = await res.json();
            setSettings(updated);
            setForm((f) => ({
                ...f,
                currentPassword: "",
                newPassword: "",
                file: null,
            }));
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setApiError({ error: true, message });
        } finally {
            setSaving(false);
        }
    };

    if (loading || !settings) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading settings…</p>
            </div>
        );
    }

    // Preview URL
    const previewSrc = form.file
        ? URL.createObjectURL(form.file)
        : settings.media?.url
            ? `${process.env.NEXT_PUBLIC_BACKEND_URL}${settings.media.url}`
            : null;

    return (
        <div className="max-w-3xl mx-auto bg-white p-6 rounded-md shadow">
            <h1 className="text-2xl font-semibold mb-4">Profile Settings</h1>

            {/* Global error */}
            {apiError && (
                <div
                    role="alert"
                    className="mb-4 rounded bg-red-50 p-3 text-red-700"
                >
                    {apiError.message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Avatar */}
                <div>
                    <label className="block text-sm font-medium mb-1">Avatar</label>
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded p-4 flex items-center justify-center cursor-pointer ${
                            isDragActive
                                ? "border-blue-400 bg-blue-50"
                                : "border-gray-300"
                        }`}
                    >
                        <input {...getInputProps()} />
                        {previewSrc ? (
                            <div className="relative h-16 w-16">
                                <Image
                                    src={previewSrc}
                                    alt="Avatar preview"
                                    fill
                                    sizes="64px"
                                    className="rounded-full object-cover"
                                    unoptimized
                                    priority
                                />
                                <button
                                    type="button"
                                    onClick={() => setForm((f) => ({ ...f, file: null }))}
                                    className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow"
                                >
                                    <XCircleIcon className="h-5 w-5 text-red-500" />
                                </button>
                            </div>
                        ) : (
                            <PhotoIcon className="h-10 w-10 text-gray-400" />
                        )}
                    </div>
                </div>

                {/* Full Name */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Full Name
                    </label>
                    <input
                        type="text"
                        name="fullName"
                        value={form.fullName}
                        onChange={handleChange}
                        className="w-full border rounded p-2"
                    />
                    {apiError?.fields?.fullName && (
                        <p className="mt-1 text-sm text-red-600">
                            {apiError.fields.fullName}
                        </p>
                    )}
                </div>

                {/* Email */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Email (read-only)
                    </label>
                    <input
                        type="email"
                        value={settings.email}
                        readOnly
                        className="w-full border rounded p-2 bg-gray-50"
                    />
                </div>

                {/* Password */}
                <div className="grid grid-cols-2 gap-x-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Current Password
                        </label>
                        <input
                            type="password"
                            name="currentPassword"
                            value={form.currentPassword}
                            onChange={handleChange}
                            className="w-full border rounded p-2"
                        />
                        {apiError?.fields?.currentPassword && (
                            <p className="mt-1 text-sm text-red-600">
                                {apiError.fields.currentPassword}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            New Password
                        </label>
                        <input
                            type="password"
                            name="newPassword"
                            value={form.newPassword}
                            onChange={handleChange}
                            className="w-full border rounded p-2"
                        />
                        {apiError?.fields?.newPassword && (
                            <p className="mt-1 text-sm text-red-600">
                                {apiError.fields.newPassword}
                            </p>
                        )}
                    </div>
                </div>

                {/* MFA */}
                <div>
                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            name="mfaEnabled"
                            checked={form.mfaEnabled}
                            onChange={handleChange}
                            className="h-4 w-4"
                        />
                        <span className="text-sm">Enable MFA</span>
                    </label>
                    {apiError?.fields?.mfaEnabled && (
                        <p className="mt-1 text-sm text-red-600">
                            {apiError.fields.mfaEnabled}
                        </p>
                    )}
                    {form.mfaEnabled && (
                        <div className="mt-2">
                            <label className="block text-sm font-medium mb-1">
                                MFA Secret
                            </label>
                            <input
                                type="text"
                                name="mfaSecret"
                                value={form.mfaSecret}
                                onChange={handleChange}
                                className="w-full border rounded p-2"
                            />
                            {apiError?.fields?.mfaSecret && (
                                <p className="mt-1 text-sm text-red-600">
                                    {apiError.fields.mfaSecret}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Last Login */}
                <p className="text-sm text-gray-500">
                    Last login:{" "}
                    {settings.lastLoginAt
                        ? new Date(settings.lastLoginAt).toLocaleString()
                        : "Never"}
                </p>

                <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? "Saving…" : "Save Changes"}
                </button>
            </form>
        </div>
    );
}