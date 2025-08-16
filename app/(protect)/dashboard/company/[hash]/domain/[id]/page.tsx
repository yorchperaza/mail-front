'use client';

import React, { Fragment } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { normalizeMx } from '@/utils/dns';
import {
    ArrowLeftIcon,
    TrashIcon,
    EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';

import { StatusBadge } from '@/components/domain/Status';
import ConfirmDeleteDomainModal from '@/components/domain/DeleteDomainModal';
import {
    OverviewSection,
    RelatedSection,
} from '@/components/domain/Sections';
import SetupDnsSection from '@/components/domain/SetupDnsSection';
import type { DomainDetail } from '@/types/domain';

export default function DomainDetailPage() {
    const router = useRouter();
    const { hash, id } = useParams<{ hash: string; id: string }>();

    const [detail, setDetail] = React.useState<DomainDetail | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [deleteBusy, setDeleteBusy] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);

    const [refreshing, setRefreshing] = React.useState(false);

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    // Initial load
    React.useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains/${id}`,
                    { headers: authHeaders() }
                );
                if (res.status === 403 || res.status === 401) { setError('You don’t have access to this domain.'); return; }
                if (!res.ok) throw new Error(`Failed to load domain: ${res.status}`);
                const data: DomainDetail = await res.json();
                const mx = normalizeMx(data?.records?.mx_expected);
                const fixed: DomainDetail = { ...data, records: { ...data.records, mx_expected: mx } };
                setDetail(fixed);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load domain');
            } finally {
                setLoading(false);
            }
        })();
    }, [hash, id]);

    // Refresh button handler: POST /verify then reload
    const refreshDomain = async () => {
        setRefreshing(true);
        try {
            await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains/${id}/verify`,
                { method: 'POST', headers: authHeaders() }
            );

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains/${id}`,
                { headers: authHeaders() }
            );
            if (!res.ok) throw new Error(`Failed to load domain: ${res.status}`);
            const data: DomainDetail = await res.json();
            const mx = normalizeMx(data?.records?.mx_expected);
            setDetail({ ...data, records: { ...data.records, mx_expected: mx } });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to refresh');
        } finally {
            setRefreshing(false);
        }
    };

    async function handleDelete() {
        if (!detail) return;
        setDeleteBusy(true);
        setDeleteError(null);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/domains/${detail.id}`,
                { method: 'DELETE', headers: authHeaders() }
            );
            if (!res.ok && res.status !== 204) {
                let msg = `Delete failed: ${res.status}`;
                try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
                throw new Error(msg);
            }
            router.push(`/dashboard/company/${hash}/domain`);
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : String(err));
            setDeleteBusy(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading domain…</p>
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="max-w-md text-center space-y-4">
                    <p className="text-red-600">{error || 'Unknown error'}</p>
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

    const { company, status, domain, created_at, verified_at } = detail;

    return (
        <div className="p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100"
                >
                    <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
                    <span className="sr-only">Back</span>
                </button>
                <h1 className="text-3xl font-semibold">{domain || 'Domain'}</h1>
                <div className="ml-2">
                    <StatusBadge status={status} />
                </div>

                <div className="ml-auto flex items-center gap-3">
                    <Link
                        href={`/dashboard/company/${company.hash}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                    >
                        Back to {company.name || 'Company'} →
                    </Link>

                    {/* Actions dropdown */}
                    <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100 focus:outline-none">
                            <EllipsisHorizontalIcon className="h-6 w-6 text-gray-600" />
                            <span className="sr-only">Open actions</span>
                        </Menu.Button>

                        <Transition
                            as={Fragment}
                            enter="transition ease-out duration-100"
                            enterFrom="transform opacity-0 scale-95"
                            enterTo="transform opacity-100 scale-100"
                            leave="transition ease-in duration-75"
                            leaveFrom="transform opacity-100 scale-100"
                            leaveTo="transform opacity-0 scale-95"
                        >
                            <Menu.Items className="absolute right-0 mt-2 w-44 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                <div className="py-1">
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                type="button"
                                                onClick={() => setConfirmOpen(true)}
                                                className={`w-full px-3 py-2 text-left text-sm inline-flex items-center gap-2 ${
                                                    active ? 'bg-red-50 text-red-700' : 'text-red-700'
                                                }`}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                Delete domain
                                            </button>
                                        )}
                                    </Menu.Item>
                                </div>
                            </Menu.Items>
                        </Transition>
                    </Menu>
                </div>
            </div>

            {/* Overview */}
            <OverviewSection
                created_at={created_at}
                verified_at={verified_at}
                companyName={company.name}
                require_tls={detail.require_tls}
                arc_sign={detail.arc_sign}
                bimi_enabled={detail.bimi_enabled}
            />

            {/* DNS + Verification */}
            <SetupDnsSection
                detail={detail}
                onRefresh={refreshDomain}
                loadingRefresh={refreshing}
            />

            {/* Related */}
            <RelatedSection
                counts={{
                    dkimKeys: detail.counts.dkimKeys,
                    messages: detail.counts.messages,
                    dmarcAggregates: detail.counts.dmarcAggregates,
                }}
                companyHash={company.hash}
            />

            {/* Modal */}
            <ConfirmDeleteDomainModal
                open={confirmOpen}
                onClose={() => (deleteBusy ? null : setConfirmOpen(false))}
                onConfirm={handleDelete}
                domain={domain}
                counts={detail.counts}
                busy={deleteBusy}
                error={deleteError}
            />
        </div>
    );
}