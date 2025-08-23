'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    UserPlusIcon,
    ClipboardIcon,
    XMarkIcon,
    TrashIcon,
    CheckIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type InviteStatus = 'added' | 'already_member' | 'needs_invite';

type ApiUser = { id: number; email: string; fullName?: string | null };
type ApiCompany = { hash: string; name?: string | null };
type ApiInvitePreview = {
    to: string;
    subject: string;
    body: string;
    acceptPath: string;
    roles: string[];
};
type AddedOrExistingResponse = { status: 'added' | 'already_member'; user: ApiUser; company: ApiCompany };
type NeedsInviteResponse = { status: 'needs_invite'; preview: ApiInvitePreview; company: ApiCompany };
type ApiInviteResponse = AddedOrExistingResponse | NeedsInviteResponse;

type InviteResult = {
    email: string;
    status: InviteStatus | 'error';
    user?: ApiUser;
    preview?: ApiInvitePreview;
    message?: string;
};

const ALL_ROLES = ['owner', 'admin', 'member', 'billing', 'viewer'] as const;

function classNames(...s: Array<string | false | null | undefined>) {
    return s.filter(Boolean).join(' ');
}

function validEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function parseEmails(input: string): string[] {
    const raw = input
        .split(/[\s,;]+/g)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    const uniq = Array.from(new Set(raw));
    return uniq.filter(validEmail);
}

function joinUrl(base: string, path: string) {
    const b = base.replace(/\/+$/, '');
    const p = path.replace(/^\/+/, '');
    return `${b}/${p}`;
}

export default function CompanyInvitePage() {
    const router = useRouter();
    const pathname = usePathname() ?? '';

    const companyHash = useMemo(() => {
        const parts = pathname.split('/').filter(Boolean);
        const idx = parts.findIndex((p) => p === 'company');
        return idx >= 0 ? parts[idx + 1] ?? null : null;
    }, [pathname]);

    const [emailsInput, setEmailsInput] = useState('');
    const [emails, setEmails] = useState<string[]>([]);
    const [invalids, setInvalids] = useState<string[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>(['member']);

    const [submitting, setSubmitting] = useState(false);
    const [results, setResults] = useState<InviteResult[]>([]);
    const [error, setError] = useState<string | null>(null);

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL as string;
    const frontend =
        (process.env.NEXT_PUBLIC_FRONTEND_URL as string | undefined) ??
        (typeof window !== 'undefined' ? window.location.origin : '');

    useEffect(() => {
        const parsed = parseEmails(emailsInput);
        const tokens = emailsInput
            .split(/[\s,;]+/g)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

        const invalid = tokens.filter((t) => !parsed.includes(t) && !validEmail(t) && t.length > 0);

        setEmails(parsed);
        setInvalids(invalid);
    }, [emailsInput]);

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const toggleRole = (role: string) => {
        setSelectedRoles((prev) => {
            const set = new Set(prev);
            set.has(role) ? set.delete(role) : set.add(role);
            const out = Array.from(set);
            return out.length ? out : ['member'];
        });
    };

    const removeEmail = (email: string) => {
        setEmails((prev) => prev.filter((e) => e !== email));
        setEmailsInput((prev) => {
            const parts = prev.split(/([\s,;]+)/);
            return parts
                .map((chunk) => (chunk.trim().toLowerCase() === email ? '' : chunk))
                .join('')
                .replace(/\s{2,}/g, ' ')
                .trim();
        });
    };

    const buildAcceptUrl = (acceptPath: string) => {
        if (/^https?:\/\//i.test(acceptPath)) return acceptPath;
        if (!frontend) return acceptPath;
        return joinUrl(frontend, acceptPath);
    };

    const inviteOne = useCallback(
        async (email: string): Promise<InviteResult> => {
            try {
                const res = await fetch(`${backend}/companies/${companyHash}/users/invite`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ email, roles: selectedRoles }),
                });

                if (res.status === 401 || res.status === 403) {
                    return { email, status: 'error', message: 'You do not have permission to invite to this company.' };
                }
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    return { email, status: 'error', message: `Failed (${res.status}) ${text}` };
                }

                const payload: ApiInviteResponse = await res.json();

                switch (payload.status) {
                    case 'added':
                    case 'already_member':
                        return { email, status: payload.status, user: payload.user };

                    case 'needs_invite':
                        return { email, status: 'needs_invite', preview: payload.preview };

                    default: {
                        const _exhaustiveCheck: never = payload;
                        return { email, status: 'error', message: 'Unexpected response' };
                    }
                }
            } catch (e) {
                return { email, status: 'error', message: e instanceof Error ? e.message : 'Network error' };
            }
        },
        [backend, companyHash, selectedRoles]
    );

    const sendInvites = async () => {
        if (!companyHash) {
            setError('Invalid company path.');
            return;
        }
        if (emails.length === 0) {
            setError('Please enter at least one valid email.');
            return;
        }
        setError(null);
        setSubmitting(true);
        setResults([]);

        const out: InviteResult[] = [];
        for (const e of emails) {
            /* eslint-disable no-await-in-loop */
            const r = await inviteOne(e);
            out.push(r);
            setResults([...out]); // progressive update
            /* eslint-enable no-await-in-loop */
        }
        setSubmitting(false);
    };

    const successes = results.filter((r) => r.status === 'added').length;
    const existing = results.filter((r) => r.status === 'already_member').length;
    const previews = results.filter((r) => r.status === 'needs_invite').length;
    const failures = results.filter((r) => r.status === 'error').length;

    if (!companyHash) {
        return (
            <div className="p-6">
                <p className="text-red-600">Invalid company path.</p>
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
                    <h1 className="text-2xl font-semibold">Invite Users</h1>
                </div>
                <Link href={`/dashboard/company/${companyHash}/settings/users`} className="text-sm text-blue-700 hover:underline">
                    View users
                </Link>
            </div>

            {/* Entry panel */}
            <div className="bg-white border rounded-lg shadow p-5 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Emails</label>
                    <textarea
                        className="w-full rounded border p-3 text-sm"
                        rows={4}
                        placeholder="Paste or type emails… e.g. alice@acme.com, bob@acme.com"
                        value={emailsInput}
                        onChange={(e) => setEmailsInput(e.target.value)}
                    />
                    <div className="mt-2 text-xs text-gray-500">
                        You can paste multiple emails separated by commas, semicolons, spaces or new lines.
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {emails.map((e) => (
                            <span key={e} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                {e}
                                <button
                                    onClick={() => removeEmail(e)}
                                    className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-blue-100"
                                    title="Remove"
                                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </span>
                        ))}
                        {invalids.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-50 text-red-700">
                <ExclamationTriangleIcon className="h-3 w-3" />
                                {invalids.length} invalid entr{invalids.length === 1 ? 'y' : 'ies'} ignored
              </span>
                        )}
                    </div>
                </div>

                {/* Roles selector */}
                <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Roles (applied to all)</div>
                    <div className="flex flex-wrap gap-2">
                        {ALL_ROLES.map((role) => {
                            const checked = selectedRoles.includes(role);
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
                                        onChange={() => toggleRole(role)}
                                    />
                                    {role}
                                </label>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        If no role is selected, <span className="font-medium">member</span> will be used.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={sendInvites}
                        disabled={submitting || emails.length === 0}
                        className={classNames(
                            'inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white',
                            submitting || emails.length === 0 ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'
                        )}
                    >
                        <UserPlusIcon className="h-5 w-5" />
                        {submitting ? 'Inviting…' : emails.length > 1 ? `Invite ${emails.length} users` : 'Invite user'}
                    </button>

                    <button
                        onClick={() => {
                            setEmailsInput('');
                            setResults([]);
                        }}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded border hover:bg-gray-50"
                    >
                        <TrashIcon className="h-5 w-5" />
                        Clear
                    </button>

                    {error && <span className="text-red-600 text-sm">{error}</span>}
                </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="bg-white border rounded-lg shadow p-5">
                    <div className="mb-4 text-sm text-gray-700">
            <span className="mr-4">
              <CheckIcon className="inline h-4 w-4 mr-1 text-green-600" />
              Added: <span className="font-medium">{successes}</span>
            </span>
                        <span className="mr-4">
              Already member: <span className="font-medium">{existing}</span>
            </span>
                        <span className="mr-4">
              Needs invite (preview): <span className="font-medium">{previews}</span>
            </span>
                        <span>
              Failed: <span className="font-medium">{failures}</span>
            </span>
                    </div>

                    <ul className="divide-y">
                        {results.map((r) => {
                            const pill =
                                r.status === 'added'
                                    ? 'bg-green-100 text-green-800'
                                    : r.status === 'already_member'
                                        ? 'bg-gray-100 text-gray-800'
                                        : r.status === 'needs_invite'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-red-100 text-red-800';

                            return (
                                <li key={r.email} className="py-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={classNames('text-[11px] px-2 py-0.5 rounded-full', pill)}>{r.status}</span>
                                                <span className="font-medium">{r.email}</span>
                                            </div>

                                            {r.status === 'added' && r.user && (
                                                <div className="mt-1 text-sm text-gray-600">
                                                    Added user #{r.user.id}
                                                    {r.user.fullName ? ` (${r.user.fullName})` : ''} to the company.
                                                </div>
                                            )}

                                            {r.status === 'already_member' && r.user && (
                                                <div className="mt-1 text-sm text-gray-600">
                                                    {r.user.fullName ?? r.user.email} is already in this company. Roles updated if applicable.
                                                </div>
                                            )}

                                            {r.status === 'needs_invite' && r.preview && (
                                                <InvitePreviewBlock preview={r.preview} buildAcceptUrl={buildAcceptUrl} />
                                            )}

                                            {r.status === 'error' && (
                                                <div className="mt-1 text-sm text-red-700">{r.message ?? 'Failed to invite.'}</div>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Footer */}
            <div className="pt-2">
                <Link
                    href={`/dashboard/company/${companyHash}/settings/users`}
                    className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back to users list
                </Link>
            </div>
        </div>
    );
}

function InvitePreviewBlock({
                                preview,
                                buildAcceptUrl,
                            }: {
    preview: ApiInvitePreview;
    buildAcceptUrl: (acceptPath: string) => string;
}) {
    return (
        <div className="mt-2">
            <div className="text-sm text-gray-700 mb-2">Invitation preview (not sent):</div>

            <div className="rounded border bg-gray-50 p-3 text-sm">
                <div>
                    <span className="text-gray-500">To:</span> {preview.to}
                </div>
                <div className="mt-1">
                    <span className="text-gray-500">Subject:</span> {preview.subject}
                </div>
                <div className="mt-2">
                    <span className="text-gray-500">Body:</span>
                    <pre className="mt-1 whitespace-pre-wrap text-gray-800">{preview.body}</pre>
                </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
                <button
                    onClick={async () => {
                        const url = buildAcceptUrl(preview.acceptPath);
                        try {
                            await navigator.clipboard.writeText(url);
                            alert('Invite link copied to clipboard');
                        } catch {
                            alert(url);
                        }
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded border hover:bg-white text-sm"
                >
                    <ClipboardIcon className="h-4 w-4" />
                    Copy invite link
                </button>
                <span className="text-xs text-gray-500">Link: {buildAcceptUrl(preview.acceptPath)}</span>
            </div>
        </div>
    );
}
