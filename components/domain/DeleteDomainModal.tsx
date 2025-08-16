'use client';

import React from 'react';
import { ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { DomainDetail } from '@/types/domain';

export default function ConfirmDeleteDomainModal({
                                                     open,
                                                     onClose,
                                                     onConfirm,
                                                     domain,
                                                     counts,
                                                     busy,
                                                     error,
                                                 }: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    domain: string | null;
    counts: DomainDetail['counts'] | null;
    busy: boolean;
    error: string | null;
}) {
    const [confirmText, setConfirmText] = React.useState('');

    React.useEffect(() => {
        if (open) {
            setConfirmText('');
        }
    }, [open]);

    if (!open) return null;

    const rows = counts
        ? [
            { label: 'DKIM keys', value: counts.dkimKeys },
            { label: 'Messages', value: counts.messages },
            { label: 'TLS RPT reports', value: counts.tlsRptReports },
            { label: 'MTA-STS policies', value: counts.mtaStsPolicies },
            { label: 'DMARC aggregates', value: counts.dmarcAggregates },
            { label: 'BIMI records', value: counts.bimiRecords },
            { label: 'Reputation samples', value: counts.reputation },
            { label: 'Inbound routes', value: counts.inboundRoutes },
            { label: 'Inbound messages', value: counts.inboundMessages },
            { label: 'Campaigns', value: counts.campaigns },
        ]
        : [];

    const matchDomain = confirmText.trim() === (domain ?? '');

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
        >
            <div
                className="absolute inset-0 bg-black/30"
                onClick={() => (!busy ? onClose() : null)}
            />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                        <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold">Delete domain</h3>
                        <p className="mt-1 text-sm text-gray-600">
                            This will permanently delete{' '}
                            <span className="font-medium">{domain ?? '—'}</span> and its
                            related data. This action cannot be undone.
                        </p>

                        <ul className="mt-4 space-y-1 text-sm text-gray-700">
                            {rows.map((r) => (
                                <li key={r.label} className="flex justify-between">
                                    <span className="text-gray-600">{r.label}</span>
                                    <span className="font-medium">{r.value}</span>
                                </li>
                            ))}
                        </ul>

                        {/* Confirmation input */}
                        <div className="mt-5">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Type <span className="font-semibold">{domain}</span> to confirm:
                            </label>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                disabled={busy}
                                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm
               focus:border-red-500 focus:ring-red-500
               disabled:opacity-50 disabled:bg-gray-100"
                                style={{ minHeight: '32px' }}
                            />
                        </div>

                        {error ? (
                            <div className="mt-4 rounded bg-red-50 p-3 text-red-700 text-sm">
                                {error}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy || !matchDomain}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        <TrashIcon className="h-5 w-5" />
                        {busy ? 'Deleting…' : 'Delete domain'}
                    </button>
                </div>
            </div>
        </div>
    );
}