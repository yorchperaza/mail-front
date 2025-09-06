'use client';

import React, { Fragment } from 'react';
import Link from 'next/link';
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation';
import { normalizeMx } from '@/utils/dns';
import {
    ArrowLeftIcon,
    TrashIcon,
    EllipsisHorizontalIcon,
    GlobeAltIcon,
    CheckCircleIcon,
    ClockIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ServerIcon,
    KeyIcon,
    InformationCircleIcon,
    ShieldCheckIcon,
    DocumentTextIcon,
    CalendarIcon,
    BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import {
    GlobeAltIcon as GlobeAltSolid,
    CheckCircleIcon as CheckCircleSolid,
} from '@heroicons/react/24/solid';
import { Menu, Transition } from '@headlessui/react';

import ConfirmDeleteDomainModal from '@/components/domain/DeleteDomainModal';
import type { DomainDetail } from '@/types/domain';

import GeneralInfoTab from '@/components/domain/tabs/GeneralInfoTab';
import RecordsTab from '@/components/domain/tabs/RecordsTab';
import KeysTab from '@/components/domain/tabs/KeysTab';

/* ---------- Status typing & helpers ---------- */
type DomainStatus = 'active' | 'pending' | 'failed' | 'unknown';
const normalizeStatus = (s: string | null | undefined): DomainStatus =>
    s === 'active' || s === 'pending' || s === 'failed' ? s : 'unknown';

/* ---------- Components ---------- */
function EnhancedStatusBadge({ status }: { status: DomainStatus }) {
    const statusConfig = {
        active: {
            bgClass: 'bg-emerald-50',
            textClass: 'text-emerald-700',
            borderClass: 'border-emerald-200',
            dotClass: 'bg-emerald-500',
            icon: CheckCircleIcon,
            label: 'Active',
        },
        pending: {
            bgClass: 'bg-amber-50',
            textClass: 'text-amber-700',
            borderClass: 'border-amber-200',
            dotClass: 'bg-amber-500',
            icon: ClockIcon,
            label: 'Pending',
        },
        failed: {
            bgClass: 'bg-red-50',
            textClass: 'text-red-700',
            borderClass: 'border-red-200',
            dotClass: 'bg-red-500',
            icon: XCircleIcon,
            label: 'Failed',
        },
        unknown: {
            bgClass: 'bg-gray-50',
            textClass: 'text-gray-700',
            borderClass: 'border-gray-200',
            dotClass: 'bg-gray-500',
            icon: ExclamationTriangleIcon,
            label: 'Unknown',
        },
    } as const;

    const config = statusConfig[status];
    const StatusIcon = config.icon;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${config.bgClass} ${config.textClass} border ${config.borderClass}`}
        >
      <StatusIcon className="h-4 w-4" />
            {config.label}
    </span>
    );
}

function StatCard({
                      title,
                      value,
                      subtitle,
                      icon,
                      color,
                  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'purple' | 'amber';
}) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        purple: 'from-purple-500 to-purple-600',
        amber: 'from-amber-500 to-amber-600',
    };

    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className={`bg-gradient-to-r ${colors[color]} p-3`}>
                <div className="flex items-center justify-between text-white">
                    {icon}
                    <span className="text-xs font-medium uppercase tracking-wider opacity-90">{title}</span>
                </div>
            </div>
            <div className="p-4">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                {subtitle && <div className="mt-1 text-xs text-gray-500">{subtitle}</div>}
            </div>
        </div>
    );
}

export default function DomainDetailPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { hash, id } = useParams<{ hash: string; id: string }>();

    const [detail, setDetail] = React.useState<DomainDetail | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [deleteBusy, setDeleteBusy] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);

    const [refreshing, setRefreshing] = React.useState(false);

    // URL-synced tab state
    type TabId = 'general' | 'records' | 'keys';
    const paramTab = (searchParams.get('tab') as TabId | null) ?? 'general';
    const [activeTab, setActiveTab] = React.useState<TabId>(paramTab);

    React.useEffect(() => {
        setActiveTab(paramTab);
    }, [paramTab]);

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
                if (res.status === 403 || res.status === 401) {
                    setError("You don't have access to this domain.");
                    return;
                }
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

    // Refresh handler
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
                try {
                    const j = await res.json();
                    if (j?.message) msg = j.message;
                } catch {}
                throw new Error(msg);
            }
            router.push(`/dashboard/company/${hash}/domain`);
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : String(err));
            setDeleteBusy(false);
        }
    }

    function onTabChange(id: string) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', id);
        router.replace(`${pathname}?${params.toString()}`);
        setActiveTab(id as TabId);
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-32 rounded-xl bg-gray-200" />
                            ))}
                        </div>
                        <div className="h-96 rounded-xl bg-gray-200" />
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !detail) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                <div className="rounded-xl bg-white p-8 shadow-lg max-w-md w-full">
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-6 w-6" />
                        <h2 className="text-lg font-semibold">Error Loading Domain</h2>
                    </div>
                    <p className="text-gray-600">{error || 'Unknown error'}</p>
                    <button
                        onClick={() => router.back()}
                        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const { company, status, domain, created_at, counts } = detail;

    // ✅ Coalesce nullable status safely
    const safeStatus: DomainStatus = normalizeStatus(status);

    // Calculate stats
    const toNum = (v: unknown) =>
        typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0;

    const totalRecords =
        toNum(counts?.records) +
        toNum(counts?.mx) +
        toNum(counts?.txt) +
        toNum(counts?.cname);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}/domain`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <div className="flex items-center gap-3">
                                <GlobeAltSolid className="h-8 w-8 text-blue-600" />
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">{domain || 'Domain'}</h1>
                                    <div className="mt-1 flex items-center gap-3">
                                        {/* ✅ use safeStatus */}
                                        <EnhancedStatusBadge status={safeStatus} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={refreshDomain}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-all"
                        >
                            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>

                        <Link
                            href={`/dashboard/company/${company.hash}`}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all"
                        >
                            <BuildingOfficeIcon className="h-4 w-4" />
                            {company.name || 'Company'}
                        </Link>

                        <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all">
                                <EllipsisHorizontalIcon className="h-4 w-4" />
                            </Menu.Button>

                            <Transition
                                as={Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-gray-200 focus:outline-none">
                                    <div className="p-1">
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmOpen(true)}
                                                    className={`w-full rounded-md px-3 py-2 text-left text-sm inline-flex items-center gap-2 transition-colors ${
                                                        active ? 'bg-red-50 text-red-700' : 'text-red-600'
                                                    }`}
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                    Delete Domain
                                                </button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        title="Status"
                        value={safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1)}
                        subtitle="Domain verification"
                        icon={<CheckCircleIcon className="h-5 w-5" />}
                        color="emerald"
                    />
                    <StatCard
                        title="DNS Records"
                        value={totalRecords}
                        subtitle="Total configured"
                        icon={<ServerIcon className="h-5 w-5" />}
                        color="blue"
                    />
                    <StatCard
                        title="Keys"
                        value={counts?.keys || 0}
                        subtitle="DKIM keys"
                        icon={<KeyIcon className="h-5 w-5" />}
                        color="purple"
                    />
                    <StatCard
                        title="Created"
                        value={created_at ? new Date(created_at).toLocaleDateString() : 'N/A'}
                        subtitle="Registration date"
                        icon={<CalendarIcon className="h-5 w-5" />}
                        color="amber"
                    />
                </div>

                {/* Tabs Section */}
                <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-white uppercase tracking-wider">
                            <GlobeAltIcon className="h-5 w-5" />
                            Domain Configuration
                        </h2>
                    </div>

                    {/* Enhanced Tabs */}
                    <div className="border-b border-gray-200 bg-gray-50/50">
                        <div className="flex gap-1 p-1">
                            {[
                                { id: 'general', label: 'General Info', icon: <InformationCircleIcon className="h-4 w-4" /> },
                                { id: 'records', label: 'DNS Records', icon: <ServerIcon className="h-4 w-4" /> },
                                { id: 'keys', label: 'DKIM Keys', icon: <KeyIcon className="h-4 w-4" /> },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => onTabChange(tab.id)}
                                    className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                    }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tab Panels */}
                    <div className="p-6">
                        {activeTab === 'general' && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-6">
                                <GeneralInfoTab detail={detail} />
                            </div>
                        )}
                        {activeTab === 'records' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">DNS Records Configuration</h3>
                                    <button
                                        onClick={refreshDomain}
                                        disabled={refreshing}
                                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                    >
                                        <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                                        Verify Records
                                    </button>
                                </div>
                                <RecordsTab detail={detail} onRefresh={refreshDomain} loadingRefresh={refreshing} />
                            </div>
                        )}
                        {activeTab === 'keys' && (
                            <div className="space-y-4">
                                <div className="mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">DKIM Key Management</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Manage DomainKeys Identified Mail (DKIM) signatures for email authentication.
                                    </p>
                                </div>
                                <KeysTab
                                    backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL as string}
                                    companyHash={company.hash}
                                    domainId={detail.id}
                                    authHeaders={authHeaders}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Additional Info Card */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                            <ShieldCheckIcon className="h-5 w-5 text-indigo-600" />
                            Security Status
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">SPF Record</span>
                                <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                                        counts?.txt ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                                    }`}
                                >
                  {counts?.txt ? <CheckCircleSolid className="h-3 w-3" /> : null}
                                    {counts?.txt ? 'Configured' : 'Not Set'}
                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">DKIM Keys</span>
                                <span className="text-sm font-medium text-gray-900">{counts?.keys || 0} Active</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">MX Records</span>
                                <span className="text-sm font-medium text-gray-900">{counts?.mx || 0} Configured</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                            <DocumentTextIcon className="h-5 w-5 text-indigo-600" />
                            Domain Details
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Company</span>
                                <Link
                                    href={`/dashboard/company/${company.hash}`}
                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                >
                                    {company.name || 'View Company'}
                                </Link>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Domain ID</span>
                                <span className="text-sm font-mono text-gray-900">{detail.id}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Created</span>
                                <span className="text-sm text-gray-900">
                  {created_at ? new Date(created_at).toLocaleString() : '—'}
                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                <ConfirmDeleteDomainModal
                    open={confirmOpen}
                    onClose={() => (deleteBusy ? null : setConfirmOpen(false))}
                    onConfirm={handleDelete}
                    domain={domain}
                    counts={counts}
                    busy={deleteBusy}
                    error={deleteError}
                />
            </div>
        </div>
    );
}
