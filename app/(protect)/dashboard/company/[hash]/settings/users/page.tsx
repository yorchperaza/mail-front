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
    UsersIcon,
    ExclamationTriangleIcon,
    ShieldCheckIcon,
    UserCircleIcon,
} from '@heroicons/react/24/outline';
import {
    UsersIcon as UsersSolid,
    UserCircleIcon as UserCircleSolid,
} from '@heroicons/react/24/solid';
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

const ROLE_CONFIG = {
    owner: { label: 'Owner', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    admin: { label: 'Admin', color: 'bg-red-100 text-red-700 border-red-200' },
    member: { label: 'Member', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    billing: { label: 'Billing', color: 'bg-green-100 text-green-700 border-green-200' },
    viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

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

    // memoize normalizeUser (it depends on `backend`)
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

    // include normalizeUser in loadUsers deps
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
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to remove user');
        } finally {
            setBusyUserId(null);
        }
    };

    if (!companyHash) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Invalid Company Path</h2>
                    </div>
                    <p className="text-gray-600">Unable to determine company from URL.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-6xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-24 rounded-xl bg-gray-200" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Users</h2>
                    </div>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => router.back()}
                        className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-6xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Company Users</h1>
                            <p className="text-sm text-gray-500">
                                Manage user access and permissions
                            </p>
                        </div>
                    </div>
                    <Link
                        href={`/dashboard/company/${companyHash}/settings/users/invite`}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                    >
                        <UserPlusIcon className="h-4 w-4" />
                        Invite User
                    </Link>
                </div>

                {/* Stats Card */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                        <div className="flex items-center gap-3 text-white">
                            <UsersSolid className="h-5 w-5" />
                            <h2 className="text-lg font-semibold">Team Overview</h2>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-900">{total}</div>
                                <div className="text-sm text-gray-500">Total Users</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-900">
                                    {users.filter(u => u.roles.includes('admin') || u.roles.includes('owner')).length}
                                </div>
                                <div className="text-sm text-gray-500">Admins & Owners</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-900">
                                    {users.filter(u => u.roles.includes('member')).length}
                                </div>
                                <div className="text-sm text-gray-500">Members</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Users List */}
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-white">
                                <UsersIcon className="h-5 w-5" />
                                <h2 className="text-lg font-semibold">Team Members</h2>
                            </div>
                            <span className="text-sm text-emerald-100">
                                Page {page} of {Math.max(1, Math.ceil(total / perPage))}
                            </span>
                        </div>
                    </div>

                    <div className="p-6">
                        {users.length === 0 ? (
                            <div className="text-center py-12">
                                <UserCircleSolid className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-lg font-semibold text-gray-900">No users found</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Invite your first team member to get started
                                </p>
                                <div className="mt-6">
                                    <Link
                                        href={`/dashboard/company/${companyHash}/settings/users/invite`}
                                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-white font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm"
                                    >
                                        <UserPlusIcon className="h-4 w-4" />
                                        Invite User
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {users.map((u) => {
                                    const isEditing = editingId === u.id;
                                    const currentRoles = isEditing ? (draftRoles[u.id] ?? []) : u.roles;

                                    return (
                                        <div key={u.id} className="rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50/50 to-white p-4 hover:shadow-sm transition-all">
                                            <div className="flex items-start justify-between">
                                                {/* Left: avatar + identity */}
                                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                                    <div className="relative">
                                                        <Image
                                                            src={
                                                                u.image ??
                                                                `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(u.name ?? u.email)}`
                                                            }
                                                            alt={u.name ?? u.email}
                                                            width={48}
                                                            height={48}
                                                            className="rounded-full object-cover bg-gray-100 ring-2 ring-white shadow-sm"
                                                        />
                                                        {u.roles.includes('owner') && (
                                                            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-purple-500 ring-2 ring-white" title="Owner" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-semibold text-gray-900 truncate text-lg">
                                                            {u.name ?? 'Unnamed User'}
                                                        </div>
                                                        <div className="text-sm text-gray-500 truncate">{u.email}</div>
                                                        {/* roles chips */}
                                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                            {currentRoles.length ? (
                                                                currentRoles.map((r) => {
                                                                    const config = ROLE_CONFIG[r as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.viewer;
                                                                    return (
                                                                        <span
                                                                            key={r}
                                                                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${config.color}`}
                                                                        >
                                                                            <ShieldCheckIcon className="h-3 w-3" />
                                                                            {config.label}
                                                                        </span>
                                                                    );
                                                                })
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-500">
                                                                    <UserCircleIcon className="h-3 w-3" />
                                                                    No roles assigned
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: actions */}
                                                <div className="flex items-center gap-2 ml-4">
                                                    {!isEditing ? (
                                                        <button
                                                            onClick={() => beginEdit(u)}
                                                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
                                                        >
                                                            <PencilSquareIcon className="h-4 w-4" />
                                                            Edit Roles
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => saveEdit(u)}
                                                                disabled={busyUserId === u.id}
                                                                className={classNames(
                                                                    'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-all',
                                                                    busyUserId === u.id && 'opacity-70 cursor-not-allowed'
                                                                )}
                                                            >
                                                                {busyUserId === u.id ? (
                                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                                ) : (
                                                                    <CheckIcon className="h-4 w-4" />
                                                                )}
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
                                                            >
                                                                <XMarkIcon className="h-4 w-4" />
                                                                Cancel
                                                            </button>
                                                        </>
                                                    )}

                                                    <button
                                                        onClick={() => removeFromCompany(u)}
                                                        disabled={busyUserId === u.id}
                                                        className={classNames(
                                                            'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-red-300 text-red-700 hover:bg-red-50 transition-all',
                                                            busyUserId === u.id && 'opacity-70 cursor-not-allowed'
                                                        )}
                                                    >
                                                        <UserMinusIcon className="h-4 w-4" />
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Edit panel */}
                                            {isEditing && (
                                                <div className="mt-4 rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white p-4">
                                                    <div className="flex items-center gap-2 text-sm font-medium text-indigo-900 mb-3">
                                                        <ShieldCheckIcon className="h-4 w-4" />
                                                        Role Permissions
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                        {ALL_ROLES.map((role) => {
                                                            const checked = (draftRoles[u.id] ?? []).includes(role);
                                                            const config = ROLE_CONFIG[role];
                                                            return (
                                                                <label
                                                                    key={role}
                                                                    className={classNames(
                                                                        'cursor-pointer flex items-center gap-3 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                                                                        checked
                                                                            ? `${config.color} ring-1 ring-current/20`
                                                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                                                    )}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                                        checked={checked}
                                                                        onChange={() => toggleRole(u.id, role)}
                                                                    />
                                                                    {config.label}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                                        <p className="text-xs text-amber-800">
                                                            <ExclamationTriangleIcon className="h-3 w-3 inline mr-1" />
                                                            Changes apply only to this company&#39;s relationship, not global account roles.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Pagination */}
                {users.length > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-white shadow-sm ring-1 ring-gray-200 px-6 py-4">
                        <div className="text-sm text-gray-700">
                            Showing <span className="font-semibold">{((page - 1) * perPage) + 1}</span> to{' '}
                            <span className="font-semibold">{Math.min(page * perPage, total)}</span> of{' '}
                            <span className="font-semibold">{total.toLocaleString()}</span> users
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { if (page > 1) loadUsers(page - 1); }}
                                disabled={page <= 1}
                                className={classNames(
                                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                                    page > 1
                                        ? 'bg-white text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50'
                                        : 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400'
                                )}
                            >
                                <ArrowLeftIcon className="h-4 w-4" />
                                Previous
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, Math.ceil(total / perPage)) }, (_, i) => {
                                    const pageNum = i + 1;
                                    const isActive = pageNum === page;

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => loadUsers(pageNum)}
                                            className={`h-8 w-8 rounded-lg text-sm font-medium transition-all ${
                                                isActive
                                                    ? 'bg-indigo-500 text-white shadow-sm'
                                                    : 'bg-white text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => { if (page < Math.ceil(total / perPage)) loadUsers(page + 1); }}
                                disabled={page >= Math.ceil(total / perPage)}
                                className={classNames(
                                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                                    page < Math.ceil(total / perPage)
                                        ? 'bg-white text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50'
                                        : 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400'
                                )}
                            >
                                Next
                                <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer nav back to company */}
                <div className="pt-2">
                    <Link
                        href={`/dashboard/company/${companyHash}`}
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to company overview
                    </Link>
                </div>
            </div>
        </div>
    );
}