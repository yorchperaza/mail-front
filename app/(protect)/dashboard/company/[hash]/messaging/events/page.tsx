'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon, FunnelIcon, CalendarDaysIcon, MagnifyingGlassIcon,
    ExclamationTriangleIcon, InboxIcon, LinkIcon, GlobeAltIcon
} from '@heroicons/react/24/outline';
import {
    CheckCircleIcon as CheckCircleSolid,
    CursorArrowRaysIcon as CursorIcon,
    EnvelopeOpenIcon as OpenIcon,
    ArrowDownOnSquareIcon as DeliveredIcon,
    NoSymbolIcon as BouncedIcon,
    XMarkIcon as UnsubIcon,
} from '@heroicons/react/24/solid';

/* ========================= Types ========================= */

// Known event types we visualize explicitly
type KnownEventType =
    | 'opened'
    | 'clicked'
    | 'delivered'
    | 'bounced'
    | 'unsubscribed'
    | 'processed'
    | 'queued';

// Allow unknown/custom event types too (e.g., unsubscribe reasons)
type EventType = KnownEventType | string;

type EventItem = {
    id: number;
    type: EventType;            // stricter but tolerant
    at: string;                 // ISO
    recipient: { email?: string | null };
    message?: {
        id?: number | null;
        messageId?: string | null;
        subject?: string | null;
        domainName?: string | null;
    };
};

// Filters reflected in the URL/query string
type FilterParams = {
    page?: number;
    perPage?: number;
    order?: 'asc' | 'desc';
    type?: EventType | '';
    recipient?: string | '';
    since?: string | '';        // YYYY-MM-DD
    until?: string | '';        // YYYY-MM-DD
    domain_id?: string | '';    // id as string
};

type EventsApiResponse = {
    meta: {
        page: number;
        perPage: number;
        total: number;
        order: 'asc' | 'desc';
        filters: {
            type?: EventType | null;
            recipient?: string | null;
            since?: string | null;
            until?: string | null;
            domain_id?: string | null;
        };
    };
    // Known aggregates + any extra keys tolerated
    aggregates?: Partial<Record<KnownEventType, number>> & Record<string, number>;
    items: EventItem[];
};

type DomainItem = { id: number; domain: string };

/* ========================= Helpers ========================= */

type SvgIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface TypeCfgEntry {
    label: string;
    Icon: SvgIcon;
    color: string;
    bg: string;
    text: string;
    ring: string;
}

// Only map known types; unknowns handled in cfgFor()
const TYPE_CFG: Record<KnownEventType, TypeCfgEntry> = {
    opened:       { label: 'Opened',       Icon: OpenIcon,      color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
    clicked:      { label: 'Clicked',      Icon: CursorIcon,    color: 'indigo',  bg: 'bg-indigo-50',  text: 'text-indigo-700',  ring: 'ring-indigo-200' },
    delivered:    { label: 'Delivered',    Icon: DeliveredIcon, color: 'blue',    bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200' },
    bounced:      { label: 'Bounced',      Icon: BouncedIcon,   color: 'red',     bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-200' },
    unsubscribed: { label: 'Unsubscribed', Icon: UnsubIcon,     color: 'amber',   bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200' },
    processed:    { label: 'Processed',    Icon: CheckCircleSolid, color:'gray',  bg: 'bg-gray-50',    text: 'text-gray-700',    ring: 'ring-gray-200' },
    queued:       { label: 'Queued',       Icon: CheckCircleSolid, color:'gray',  bg: 'bg-gray-50',    text: 'text-gray-700',    ring: 'ring-gray-200' },
};

function cfgFor(t?: EventType): TypeCfgEntry {
    const k = (t || '').toLowerCase() as KnownEventType;
    if (k in TYPE_CFG) return TYPE_CFG[k];
    return {
        label: t || 'Event',
        Icon: CheckCircleSolid,
        color: 'gray',
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        ring: 'ring-gray-200',
    };
}

function toLocal(s?: string | null) {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleString();
}

function short(s?: string | null, n = 10) {
    if (!s) return '—';
    return s.length <= n ? s : s.slice(0, n) + '…';
}

function fmtDateUTC(d: Date) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function buildQuery(params: FilterParams) {
    const sp = new URLSearchParams();
    (Object.entries(params) as [keyof FilterParams, FilterParams[keyof FilterParams]][]).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (typeof v === 'string' && v.trim() === '') return;
        sp.set(String(k), String(v));
    });
    return sp.toString();
}

/* ========================= Page ========================= */

export default function CompanyEventsPage() {
    const router = useRouter();
    const pathname = usePathname();
    const search = useSearchParams();
    const { hash } = useParams<{ hash: string }>();

    const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    // Query params (typed)
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '50', 10) || 50));
    const order = (search.get('order') || 'desc') as FilterParams['order'];
    const type = (search.get('type') || '') as FilterParams['type'];
    const recipient = (search.get('recipient') || '') as FilterParams['recipient'];
    const since = (search.get('since') || '') as FilterParams['since'];
    const until = (search.get('until') || '') as FilterParams['until'];
    const domain_id = (search.get('domain_id') || '') as FilterParams['domain_id'];

    const qs = useMemo(
        () => buildQuery({ page, perPage, order, type, recipient, since, until, domain_id }),
        [page, perPage, order, type, recipient, since, until, domain_id]
    );

    // Backend endpoints (company-wide events + domains)
    const eventsUrl = `${backend}/companies/${hash}/events?${qs}`;
    const domainsUrl = `${backend}/companies/${hash}/domains`;

    const [data, setData] = useState<EventsApiResponse | null>(null);
    const [domains, setDomains] = useState<DomainItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const formKey = search.toString();

    function updateQuery(partial: Partial<FilterParams>, resetPage = false) {
        const sp = new URLSearchParams(search.toString());
        (Object.entries(partial) as [keyof FilterParams, FilterParams[keyof FilterParams]][]).forEach(([k, v]) => {
            if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) sp.delete(String(k));
            else sp.set(String(k), String(v));
        });
        if (resetPage) sp.set('page', '1');
        router.replace(`${pathname}?${sp.toString()}`);
    }

    function submitFilters(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        updateQuery(
            {
                type: (fd.get('type') as EventType | '') || '',
                recipient: (fd.get('recipient') as string) || '',
                since: (fd.get('since') as string) || '',
                until: (fd.get('until') as string) || '',
                domain_id: (fd.get('domain_id') as string) || '',
            },
            true
        );
    }

    function clearFilters() {
        updateQuery({ page: 1, perPage, order, type: '', recipient: '', since: '', until: '', domain_id: '' });
    }

    function applyQuickRange(days: number) {
        const now = new Date();
        const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const from = new Date(to);
        from.setUTCDate(to.getUTCDate() - (days - 1));
        updateQuery({ since: fmtDateUTC(from), until: fmtDateUTC(to) }, true);
    }

    // Fetch events
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(eventsUrl, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
                if (!res.ok) throw new Error(`Failed to load events (${res.status})`);
                const json: EventsApiResponse = await res.json();
                console.log('Fetched events:', json);
                if (!abort) setData(json);
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [eventsUrl, token]);

    // Fetch domains
    useEffect(() => {
        let abort = false;
        (async () => {
            try {
                const res = await fetch(domainsUrl, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
                if (!res.ok) throw new Error(`Failed to load domains (${res.status})`);
                const json: DomainItem[] = await res.json();
                if (!abort) setDomains(json);
            } catch (e) {
                if (!abort) console.error(e);
            }
        })();
        return () => { abort = true; };
    }, [domainsUrl, token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-7xl mx-auto p-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 w-64 rounded-lg bg-gray-200" />
                        <div className="h-96 rounded-xl bg-gray-200" />
                    </div>
                </div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="min-h-screen grid place-items-center">
                <div className="bg-white rounded-xl shadow p-6 max-w-md w-full">
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                        <ExclamationTriangleIcon className="h-5 w-5" />
                        <h2 className="font-semibold">Error loading events</h2>
                    </div>
                    <p className="text-gray-600">{err}</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { items, meta, aggregates } = data;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Dashboard
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Events</h1>
                            <p className="text-sm text-gray-500">{meta.total.toLocaleString()} total events</p>
                        </div>
                    </div>
                </div>

                {/* Aggregates quick chips */}
                {aggregates && Object.keys(aggregates).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(aggregates).map(([k, v]) => {
                            const { label, bg, text, Icon } = cfgFor(k);
                            return (
                                <span key={k} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${bg} ${text} ring-1 ${cfgFor(k).ring}`}>
                  <Icon className="h-3.5 w-3.5" />
                                    {label}: <span className="font-semibold">{v}</span>
                </span>
                            );
                        })}
                    </div>
                )}

                {/* Filters */}
                <form key={formKey} onSubmit={submitFilters} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <FunnelIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Filters</h3>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Quick Ranges */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Quick Ranges:</span>
                            {[
                                { label: 'Today', days: 1 },
                                { label: 'Last 7 Days', days: 7 },
                                { label: 'Last 30 Days', days: 30 },
                                { label: 'Last 90 Days', days: 90 },
                            ].map(({ label, days }) => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => applyQuickRange(days)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                                >
                                    <CalendarDaysIcon className="h-3.5 w-3.5" />
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                                <select
                                    name="type"
                                    defaultValue={type}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">Any</option>
                                    {['opened','clicked','delivered','bounced','unsubscribed','processed', 'queued'].map(t => (
                                        <option key={t} value={t}>{cfgFor(t).label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Recipient</label>
                                <input
                                    name="recipient"
                                    defaultValue={recipient}
                                    placeholder="Email contains..."
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <GlobeAltIcon className="inline h-4 w-4 mr-1" />
                                    Domain
                                </label>
                                <select
                                    name="domain_id"
                                    defaultValue={domain_id}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">All domains</option>
                                    {domains.map((d) => (
                                        <option key={d.id} value={String(d.id)}>{d.domain}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Since</label>
                                <input
                                    type="date"
                                    name="since"
                                    defaultValue={since}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Until</label>
                                <input
                                    type="date"
                                    name="until"
                                    defaultValue={until}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                                    <select
                                        value={order}
                                        onChange={(e) => updateQuery({ order: e.target.value as FilterParams['order'] }, true)}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    >
                                        <option value="desc">Newest First</option>
                                        <option value="asc">Oldest First</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Per Page</label>
                                    <select
                                        value={perPage}
                                        onChange={(e) => updateQuery({ perPage: Number(e.target.value), page: 1 })}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    >
                                        {[25,50,100,200].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                            >
                                Clear All
                            </button>
                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-600 hover:to-indigo-700 shadow-sm"
                            >
                                <MagnifyingGlassIcon className="h-4 w-4" />
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </form>

                {/* Events list */}
                {items.length === 0 ? (
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-12">
                        <div className="text-center">
                            <InboxIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-lg font-semibold text-gray-900">No events found</h3>
                            <p className="mt-1 text-sm text-gray-500">Try adjusting filters or date range</p>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Event</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">At</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Recipient</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Message</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Domain</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {items.map((ev) => {
                                    const c = cfgFor(ev.type);
                                    const M = ev.message;
                                    const canLink = !!M?.messageId;
                                    const go = () => {
                                        if (!canLink) return;
                                        router.push(`/dashboard/company/${hash}/messaging/messages/${encodeURIComponent(String(M!.messageId))}`);
                                    };
                                    return (
                                        <tr
                                            key={ev.id}
                                            onClick={go}
                                            className={`hover:bg-gray-50 transition-colors ${canLink ? 'cursor-pointer' : 'cursor-default'}`}
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${c.bg} ${c.text} ring-1 ${c.ring}`}>
                            <c.Icon className="h-3.5 w-3.5" />
                              {c.label}
                          </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{toLocal(ev.at)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{ev.recipient?.email || '—'}</td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-gray-900">{M?.subject || <span className="text-gray-400 italic">No Subject</span>}</div>
                                                <div className="text-xs text-gray-500 font-mono mt-1">{short(M?.messageId, 24)}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-blue-600">{M?.domainName || '—'}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); go(); }}
                                                    disabled={!canLink}
                                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-all
                              ${canLink ? 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50' : 'bg-gray-100 text-gray-400 ring-gray-200 cursor-not-allowed'}`}
                                                    title={canLink ? 'Open message details' : 'Message-ID unavailable'}
                                                >
                                                    <LinkIcon className="h-4 w-4" />
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
                            <div className="text-sm text-gray-700">
                                Showing <span className="font-semibold">{((meta.page - 1) * meta.perPage) + 1}</span> to{' '}
                                <span className="font-semibold">{Math.min(meta.page * meta.perPage, meta.total)}</span> of{' '}
                                <span className="font-semibold">{meta.total.toLocaleString()}</span> results
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => updateQuery({ page: Math.max(1, meta.page - 1) })}
                                    disabled={meta.page <= 1}
                                    className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <ArrowLeftIcon className="h-4 w-4" />
                                    Previous
                                </button>

                                <button
                                    onClick={() => updateQuery({ page: Math.min(Math.max(1, Math.ceil(meta.total / meta.perPage)), meta.page + 1) })}
                                    disabled={meta.page >= Math.ceil(meta.total / meta.perPage)}
                                    className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Next
                                    <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
