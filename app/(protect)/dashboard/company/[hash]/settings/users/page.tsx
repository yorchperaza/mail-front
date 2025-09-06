'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    PencilSquareIcon,
    XMarkIcon,
    CheckIcon,
    UserMinusIcon,
    UserPlusIcon,
} from '@heroicons/react/24/outline';
import Image from 'next/image';

type BackendMedia = {
    id: number;
    url: string;
    type?: string | null;
} | null;

type BackendUser = {
    id: number;
    email: string;
    fullName?: string | null;
    media?: BackendMedia;
    roles?: string[] | null;
};

type PagedResponse<T> = {
    data: T[];
    page: number;
    per_page: number;
    total: number;
};

type UserItem = {
    id: number;
    email: string;
    name: string | null;
    image: string | null;   // normalized (absolute URL to same domain as backend)
    roles: string[];
};

const ALL_ROLES = ['owner', 'admin', 'member', 'billing', 'viewer'] as const;

function classNames(...s: Array<string | false | null | undefined>) {
    return s.filter(Boolean).join(' ');
}

// join path to backend origin, ensuring exactly one slash
function joinUrl(base: string, path: string) {
    const b = base.replace(/\/+$/, '');
    const p = path.replace(/^\/+/, '');
    return `${b}/${p}`;
}

// Normalize media URL to absolute on the same domain as `backend`
function normalizeImageUrl(backend: string, media?: BackendMedia): string | null {
    const raw = (typeof media === 'object' && media) ? media.url : null;
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return joinUrl(backend, raw);
}

export default function CompanyUsersPage() {
    const router = useRouter();
    const pathname = usePathname() ?? '';

    // /dashboard/company/{hash}/users
    const companyHash = useMemo(() => {
        const parts = pathname.split('/').filter(Boolean);
        const idx = parts.findIndex((p) => p === 'company');
        return idx >= 0 ? parts[idx + 1] ?? null : null;
    }, [pathname]);

    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [editingId, setEditingId] = useState<number | null>(null);
    const [draftRoles, setDraftRoles] = useState<Record<number, string[]>>({});
    const [busyUserId, setBusyUserId] = useState<number | null>(null);

    // pagination state
    const [page, setPage] = useState(1);
    const [perPage] = useState(25);
    const [total, setTotal] = useState(0);

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL as string;

// 2) memoize normalizeUser (it depends on `backend`)
    const normalizeUser = useCallback(
        (raw: BackendUser): UserItem => ({
            id: raw.id,
            email: raw.email,
            name: raw.fullName ?? null,
            image: normalizeImageUrl(backend, raw.media),
            roles: Array.isArray(raw.roles) ? raw.roles : [],
        }),
        [backend]
    );

// 3) include normalizeUser in loadUsers deps
    const loadUsers = useCallback(
        async (targetPage: number) => {
            if (!companyHash) return;
            setLoading(true);
            setError(null);

            try {
                const url = new URL(`${backend}/companies/${companyHash}/users`);
                url.searchParams.set('page', String(targetPage));
                url.searchParams.set('per_page', String(perPage));

                const res = await fetch(url.toString(), { headers: authHeaders() });
                if (res.status === 403 || res.status === 401) {
                    setError('You do not have access to this company.');
                    setUsers([]);
                    setTotal(0);
                    return;
                }
                if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);

                const payload = (await res.json()) as PagedResponse<BackendUser>;
                const normalized = (payload.data ?? []).map(normalizeUser);

                setUsers(normalized);
                setPage(payload.page ?? targetPage);
                setTotal(payload.total ?? normalized.length);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load users');
                setUsers([]);
                setTotal(0);
            } finally {
                setLoading(false);
            }
        },
        [backend, companyHash, perPage, normalizeUser]
    );

    useEffect(() => {
        if (!companyHash) return;
        loadUsers(1);
    }, [companyHash, loadUsers]);

    const beginEdit = (u: UserItem) => {
        setEditingId(u.id);
        setDraftRoles((prev) => ({ ...prev, [u.id]: [...(u.roles ?? [])] }));
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const toggleRole = (userId: number, role: string) => {
        setDraftRoles((prev) => {
            const current = new Set(prev[userId] ?? []);
            if (current.has(role)) {
                current.delete(role);
            } else {
                current.add(role);
            }
            return { ...prev, [userId]: Array.from(current) };
        });
    };

    const saveEdit = async (u: UserItem) => {
        if (!companyHash) return;
        setBusyUserId(u.id);
        try {
            const roles = draftRoles[u.id] ?? [];
            const res = await fetch(`${backend}/companies/${companyHash}/users/${u.id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ roles }),
            });
            if (!res.ok) throw new Error(`Failed to update roles: ${res.status}`);

            // Optimistic update
            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, roles } : x)));
            setEditingId(null);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to update relationship');
        } finally {
            setBusyUserId(null);
        }
    };

    const removeFromCompany = async (u: UserItem) => {
        if (!companyHash) return;
        if (!confirm(`Remove ${u.name ?? u.email} from this company?`)) return;
        setBusyUserId(u.id);
        try {
            const res = await fetch(`${backend}/companies/${companyHash}/users/${u.id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error(`Failed to remove user: ${res.status}`);

            setUsers((prev) => prev.filter((x) => x.id !== u.id));
            if (editingId === u.id) setEditingId(null);
            // Optionally refresh counts:
            // loadUsers(page);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to remove user');
        } finally {
            setBusyUserId(null);
        }
    };

    if (!companyHash) {
        return (
            <div className="p-6">
                <p className="text-red-600">Invalid company path.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading users…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="max-w-md text-center space-y-4">
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center space-x-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        <span>Back</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
                    >
                        <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
                        <span className="sr-only">Back</span>
                    </button>
                    <h1 className="text-2xl font-semibold">Company Users</h1>
                </div>
                {/* Optional: invite/add user entry point */}
                <Link
                    href={`/dashboard/company/${companyHash}/settings/users/invite`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                    <UserPlusIcon className="h-5 w-5" />
                    Invite User
                </Link>
            </div>

            {/* List */}
            <div className="bg-white border rounded-lg shadow divide-y">
                {users.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No users yet.</div>
                ) : (
                    users.map((u) => {
                        const isEditing = editingId === u.id;
                        const currentRoles = isEditing ? (draftRoles[u.id] ?? []) : u.roles;

                        return (
                            <div key={u.id} className="p-4">
                                <div className="flex items-start justify-between">
                                    {/* Left: avatar + identity */}
                                    <div className="flex items-center gap-4 min-w-0">
                                        <Image
                                            src={
                                                u.image ??
                                                `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(u.name ?? u.email)}`
                                            }
                                            alt={u.name ?? u.email}
                                            width={48}
                                            height={48}
                                            className="rounded-full object-cover bg-gray-100"
                                        />
                                        <div className="min-w-0">
                                            <div className="font-medium text-gray-900 truncate">{u.name ?? '—'}</div>
                                            <div className="text-sm text-gray-500 truncate">{u.email}</div>
                                            {/* roles chips */}
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {currentRoles.length ? (
                                                    currentRoles.map((r) => (
                                                        <span
                                                            key={r}
                                                            className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800"
                                                        >
                              {r}
                            </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-400">no roles</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: actions */}
                                    <div className="flex items-center gap-2">
                                        {!isEditing ? (
                                            <button
                                                onClick={() => beginEdit(u)}
                                                className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded border hover:bg-gray-50"
                                            >
                                                <PencilSquareIcon className="h-4 w-4" />
                                                Edit relationship
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => saveEdit(u)}
                                                    disabled={busyUserId === u.id}
                                                    className={classNames(
                                                        'inline-flex items-center gap-1 px-3 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700',
                                                        busyUserId === u.id && 'opacity-70 cursor-not-allowed'
                                                    )}
                                                >
                                                    <CheckIcon className="h-4 w-4" /> Save
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded border hover:bg-gray-50"
                                                >
                                                    <XMarkIcon className="h-4 w-4" /> Cancel
                                                </button>
                                            </>
                                        )}

                                        <button
                                            onClick={() => removeFromCompany(u)}
                                            disabled={busyUserId === u.id}
                                            className={classNames(
                                                'inline-flex items-center gap-1 px-3 py-2 text-sm rounded border text-red-600 hover:bg-red-50',
                                                busyUserId === u.id && 'opacity-70 cursor-not-allowed'
                                            )}
                                        >
                                            <UserMinusIcon className="h-4 w-4" /> Remove
                                        </button>
                                    </div>
                                </div>

                                {/* Edit panel */}
                                {isEditing && (
                                    <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                                        <div className="text-sm font-medium text-gray-700 mb-2">Roles</div>
                                        <div className="flex flex-wrap gap-2">
                                            {ALL_ROLES.map((role) => {
                                                const checked = (draftRoles[u.id] ?? []).includes(role);
                                                return (
                                                    <label
                                                        key={role}
                                                        className={classNames(
                                                            'cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded border text-sm',
                                                            checked ? 'bg-blue-50 border-blue-300 text-blue-700' : 'hover:bg-white'
                                                        )}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="accent-blue-600"
                                                            checked={checked}
                                                            onChange={() => toggleRole(u.id, role)}
                                                        />
                                                        {role}
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        <p className="text-xs text-gray-500 mt-3">
                                            Changes apply only to this company’s relationship (not global account roles).
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                    Page {page} of {Math.max(1, Math.ceil(total / perPage))} · {total} {total === 1 ? 'user' : 'users'}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { if (page > 1) loadUsers(page - 1); }}
                        disabled={page <= 1}
                        className={classNames(
                            'px-3 py-1.5 rounded border text-sm',
                            page > 1 ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => { if (page < Math.max(1, Math.ceil(total / perPage))) loadUsers(page + 1); }}
                        disabled={page >= Math.max(1, Math.ceil(total / perPage))}
                        className={classNames(
                            'px-3 py-1.5 rounded border text-sm',
                            page < Math.max(1, Math.ceil(total / perPage)) ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Footer nav back to company */}
            <div className="pt-2">
                <Link
                    href={`/dashboard/company/${companyHash}`}
                    className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back to company overview
                </Link>
            </div>
        </div>
    );
}
