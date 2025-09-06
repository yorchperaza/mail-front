// File: GeneralInfoTab.tsx
'use client';

import React from 'react';
import {
    CalendarDaysIcon,
    GlobeAltIcon,
    ShieldCheckIcon,
    BuildingOfficeIcon,
    LockClosedIcon,
    DocumentCheckIcon,
    PhotoIcon,
    XCircleIcon,
    ChartBarIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline';
import {
    ShieldCheckIcon as ShieldCheckSolid,
    CheckCircleIcon as CheckCircleSolid,
} from '@heroicons/react/24/solid';
import { InlineCopy } from './CopyBits';

export function formatDate(iso?: string | null) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return '—';
    }
}

export function OverviewSection({
                                    created_at,
                                    verified_at,
                                    companyName,
                                    require_tls,
                                    arc_sign,
                                    bimi_enabled,
                                }: {
    created_at: string | null;
    verified_at: string | null;
    companyName: string | null;
    require_tls: boolean | null;
    arc_sign: boolean | null;
    bimi_enabled: boolean | null;
}) {
    return (
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider">
                    <GlobeAltIcon className="h-5 w-5" />
                    Domain Overview
                </h2>
            </div>

            <div className="p-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4 border border-blue-200">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider inline-flex items-center">
                            <CalendarDaysIcon className="h-4 w-4 mr-1.5 text-blue-600" />
                            Created
                        </p>
                        <p className="text-lg font-semibold text-gray-900 mt-1">
                            {formatDate(created_at)}
                        </p>
                    </div>

                    <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 p-4 border border-emerald-200">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider inline-flex items-center">
                            <ShieldCheckIcon className="h-4 w-4 mr-1.5 text-emerald-600" />
                            Verified
                        </p>
                        <p className="text-lg font-semibold text-gray-900 mt-1">
                            {formatDate(verified_at)}
                        </p>
                    </div>

                    <div className="rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 p-4 border border-purple-200">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider inline-flex items-center">
                            <BuildingOfficeIcon className="h-4 w-4 mr-1.5 text-purple-600" />
                            Company
                        </p>
                        <p className="text-lg font-semibold text-gray-900 mt-1 truncate">
                            {companyName || '—'}
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-2">
                            <LockClosedIcon className="h-5 w-5 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">Require TLS</span>
                        </div>
                        {require_tls ? (
                            <CheckCircleSolid className="h-5 w-5 text-emerald-500" />
                        ) : (
                            <XCircleIcon className="h-5 w-5 text-gray-400" />
                        )}
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-2">
                            <DocumentCheckIcon className="h-5 w-5 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">ARC Sign</span>
                        </div>
                        {arc_sign ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                Enabled
                            </span>
                        ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                Disabled
                            </span>
                        )}
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-2">
                            <PhotoIcon className="h-5 w-5 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">BIMI</span>
                        </div>
                        {bimi_enabled ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                Enabled
                            </span>
                        ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                Disabled
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export function DnsTxtSection({ txt }: { txt: { name: string | null; value: string | null } | null }) {
    return (
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider">
                    <ShieldCheckIcon className="h-5 w-5" />
                    DNS Verification (TXT Record)
                </h2>
            </div>

            <div className="p-6 space-y-4">
                <div className="flex items-start gap-2 p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <ShieldCheckSolid className="h-5 w-5 text-blue-600 mt-0.5" />
                    <p className="text-sm text-blue-900">
                        Add the following TXT record in your DNS provider to verify ownership of this domain.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                            TXT Name / Host
                        </label>
                        <InlineCopy value={txt?.name || ''} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                            TXT Value
                        </label>
                        <InlineCopy value={txt?.value || ''} />
                    </div>
                </div>
            </div>
        </section>
    );
}

export function EmailAuthSection({
                                     spf,
                                     dmarc,
                                     mx,
                                 }: {
    spf?: string | null;
    dmarc?: string | null;
    mx?: Array<string | { host?: string; priority?: number; value?: string }> | null;
}) {
    const mxRows = (mx ?? []).map((item, idx) => {
        if (typeof item === 'string') {
            return {
                host: '',
                priority: undefined as number | undefined,
                value: item,
                key: `mx-${idx}`
            };
        }
        return {
            host: item.host ?? '',
            priority: typeof item.priority === 'number' ? item.priority : undefined,
            value: item.value ?? item.host ?? '',
            key: `mx-${idx}`,
        };
    });

    return (
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider">
                    <ShieldCheckIcon className="h-5 w-5" />
                    Email Authentication
                </h2>
            </div>

            <div className="p-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                            SPF Record (TXT)
                        </label>
                        <InlineCopy value={spf || ''} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                            DMARC Record (TXT)
                        </label>
                        <InlineCopy value={dmarc || ''} />
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                        MX Records
                    </h3>
                    {mxRows.length === 0 ? (
                        <div className="rounded-lg bg-gray-50 p-4 text-center">
                            <p className="text-sm text-gray-500">No MX records configured</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Host
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Priority
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Value
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                        Action
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                {mxRows.map((row) => (
                                    <tr key={row.key} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-sm">
                                            <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono">
                                                {row.host || '—'}
                                            </code>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {typeof row.priority === 'number' ? (
                                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                                                        {row.priority}
                                                    </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono break-all">
                                                {row.value || '—'}
                                            </code>
                                        </td>
                                        <td className="px-4 py-3">
                                            <InlineCopy value={row.value} />
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export function RelatedSection({
                                   counts,
                                   companyHash,
                               }: {
    counts: {
        dkimKeys: number;
        messages: number;
        dmarcAggregates: number;
    };
    companyHash: string;
}) {
    return (
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider">
                    <ChartBarIcon className="h-5 w-5" />
                    Related Statistics
                </h2>
            </div>

            <div className="p-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50 p-6 text-center border border-indigo-200">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">DKIM Keys</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{counts.dkimKeys}</p>
                    </div>
                    <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 p-6 text-center border border-emerald-200">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Messages</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{counts.messages}</p>
                    </div>
                    <div className="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 p-6 text-center border border-amber-200">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">DMARC Reports</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{counts.dmarcAggregates}</p>
                    </div>
                </div>

                <div className="text-center">
                    <a
                        href={`/dashboard/company/${companyHash}/domain`}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                    >
                        View All Domains
                        <ArrowRightIcon className="h-4 w-4" />
                    </a>
                </div>
            </div>
        </section>
    );
}