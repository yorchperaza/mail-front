'use client';

import React from 'react';
import { CalendarDaysIcon, GlobeAltIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { InlineCopy } from './CopyBits';

export function formatDate(iso?: string | null) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
        <section className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-medium">Overview</h2>
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="bg-gray-50 rounded p-4">
                    <p className="text-xs text-gray-500 inline-flex items-center">
                        <CalendarDaysIcon className="h-4 w-4 mr-1" /> Created
                    </p>
                    <p className="text-sm font-medium mt-1">{formatDate(created_at)}</p>
                </div>
                <div className="bg-gray-50 rounded p-4">
                    <p className="text-xs text-gray-500 inline-flex items-center">
                        <ShieldCheckIcon className="h-4 w-4 mr-1" /> Verified
                    </p>
                    <p className="text-sm font-medium mt-1">{formatDate(verified_at)}</p>
                </div>
                <div className="bg-gray-50 rounded p-4">
                    <p className="text-xs text-gray-500 inline-flex items-center">
                        <GlobeAltIcon className="h-4 w-4 mr-1" /> Company
                    </p>
                    <p className="text-sm font-medium mt-1 truncate">{companyName || '—'}</p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="text-sm text-gray-700">
                    <span className="text-gray-500">Require TLS:</span> {require_tls ? 'Yes' : 'No'}
                </div>
                <div className="text-sm text-gray-700">
                    <span className="text-gray-500">ARC Sign:</span> {arc_sign ? 'Enabled' : 'Disabled'}
                </div>
                <div className="text-sm text-gray-700">
                    <span className="text-gray-500">BIMI:</span> {bimi_enabled ? 'Enabled' : 'Disabled'}
                </div>
            </div>
        </section>
    );
}

export function DnsTxtSection({ txt }: { txt: { name: string | null; value: string | null } | null }) {
    return (
        <section className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-medium">DNS Verification (TXT)</h2>
            <p className="text-sm text-gray-600">Add the following TXT record in your DNS provider to verify this domain.</p>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <span className="block text-xs text-gray-500 mb-1">TXT Name / Host</span>
                    <InlineCopy value={txt?.name || ''} />
                </div>
                <div>
                    <span className="block text-xs text-gray-500 mb-1">TXT Value</span>
                    <InlineCopy value={txt?.value || ''} />
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
        if (typeof item === 'string') return { host: '', priority: undefined as number | undefined, value: item, key: `mx-${idx}` };
        return {
            host: item.host ?? '',
            priority: typeof item.priority === 'number' ? item.priority : undefined,
            value: item.value ?? item.host ?? '',
            key: `mx-${idx}`,
        };
    });

    return (
        <section className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-medium">Email Authentication</h2>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <span className="block text-xs text-gray-500 mb-1">SPF (TXT)</span>
                    <InlineCopy value={spf || ''} />
                </div>
                <div>
                    <span className="block text-xs text-gray-500 mb-1">DMARC (TXT)</span>
                    <InlineCopy value={dmarc || ''} />
                </div>
            </div>

            <div className="mt-4">
                <span className="block text-xs text-gray-500 mb-2">MX Records</span>
                {mxRows.length === 0 ? (
                    <p className="text-sm text-gray-500">No expected MX records provided.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                            <tr className="text-left text-gray-500">
                                <th className="py-2 pr-4">Host</th>
                                <th className="py-2 pr-4">Priority</th>
                                <th className="py-2 pr-4">Value</th>
                                <th className="py-2"></th>
                            </tr>
                            </thead>
                            <tbody className="divide-y">
                            {mxRows.map((row) => (
                                <tr key={row.key}>
                                    <td className="py-2 pr-4">
                                        <code className="bg-gray-100 rounded px-2 py-0.5">{row.host || '—'}</code>
                                    </td>
                                    <td className="py-2 pr-4">{typeof row.priority === 'number' ? row.priority : '—'}</td>
                                    <td className="py-2 pr-4 max-w-[28rem]">
                                        <code className="bg-gray-100 rounded px-2 py-0.5 break-all">{row.value || '—'}</code>
                                    </td>
                                    <td className="py-2">
                                        {/* per-row copy */}
                                        <InlineCopy value={row.value} />
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
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
        <section className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-medium">Related</h2>
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="bg-gray-50 rounded p-4 text-center">
                    <p className="text-xs text-gray-500">DKIM Keys</p>
                    <p className="text-lg font-semibold">{counts.dkimKeys}</p>
                </div>
                <div className="bg-gray-50 rounded p-4 text-center">
                    <p className="text-xs text-gray-500">Messages</p>
                    <p className="text-lg font-semibold">{counts.messages}</p>
                </div>
                <div className="bg-gray-50 rounded p-4 text-center">
                    <p className="text-xs text-gray-500">DMARC Agg.</p>
                    <p className="text-lg font-semibold">{counts.dmarcAggregates}</p>
                </div>
            </div>

            <div className="text-right">
                <a href={`/dashboard/company/${companyHash}/domain`} className="text-sm text-blue-600 hover:text-blue-700">
                    View all domains →
                </a>
            </div>
        </section>
    );
}