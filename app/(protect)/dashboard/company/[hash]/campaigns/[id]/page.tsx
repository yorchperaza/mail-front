'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeftIcon, PaperAirplaneIcon, CalendarDaysIcon, PauseIcon, PlayIcon, XMarkIcon,
} from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'cancelled';
type SendMode = 'immediate' | 'scheduled';
type TargetKind = 'list' | 'segment';

type Campaign = {
    id: number;
    name: string | null;
    subject: string | null;
    send_mode: SendMode;
    scheduled_at: string | null;
    target: TargetKind;
    status: CampaignStatus;
    created_at: string | null;
    template_id: number | null;
    domain_id: number | null;
    listGroup_id: number | null;
    segment_id: number | null;
    metrics: { sent: number; delivered: number; opens: number; clicks: number; bounces: number; complaints: number };
};

type StatsResponse = { metrics: Campaign['metrics']; status: CampaignStatus };

type RecipientsPage = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: { id: number; email: string | null; name: string | null; status: string | null }[];
};

type DomainSummary = { id: number; domain: string; statusDomain?: string };
type TemplateSummary = { id: number; name: string };
type ListSummary = { id: number; name: string };
type SegmentSummary = { id: number; name: string };

/* ----------------------------- Page ----------------------------- */

export default function CampaignDetailPage() {
    const router = useRouter();
    const search = useSearchParams();
    const { hash, id } = useParams<{ hash: string; id: string }>();

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    // Pager for recipients
    const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(search.get('perPage') || '25', 10) || 25));

    const [data, setData] = useState<Campaign | null>(null);
    const [stats, setStats] = useState<StatsResponse | null>(null);
    const [recips, setRecips] = useState<RecipientsPage | null>(null);

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [loadingRecips, setLoadingRecips] = useState(false);

    // UI state for actions
    const [actionMsg, setActionMsg] = useState<string | null>(null);
    const [actionErr, setActionErr] = useState<string | null>(null);
    const [acting, setActing] = useState(false);

    const backHref = `/dashboard/company/${hash}/campaigns`;
    const editHref = `/dashboard/company/${hash}/campaigns/${id}/edit`;

    const toLocale = (iso?: string | null) => {
        if (!iso) return '—';
        try { return new Date(iso).toLocaleString(); } catch { return iso; }
    };

    const campaignUrl   = useMemo(() => `${backend}/companies/${hash}/campaigns/${id}`, [backend, hash, id]);
    const statsUrl      = useMemo(() => `${backend}/companies/${hash}/campaigns/${id}/stats`, [backend, hash, id]);
    const recipientsUrl = useMemo(() => {
        const sp = new URLSearchParams({ page: String(page), perPage: String(perPage) });
        return `${backend}/companies/${hash}/campaigns/${id}/recipients?${sp.toString()}`;
    }, [backend, hash, id, page, perPage]);

    // Lookups for related names
    const [domains, setDomains] = useState<Record<number, DomainSummary>>({});
    const [templates, setTemplates] = useState<Record<number, TemplateSummary>>({});
    const [lists, setLists] = useState<Record<number, ListSummary>>({});
    const [segments, setSegments] = useState<Record<number, SegmentSummary>>({});

    const loadLookups = async () => {
        if (!backend) return;
        try {
            const [dRes, tRes, lRes, sRes] = await Promise.all([
                fetch(`${backend}/companies/${hash}/domains`, { headers: authHeaders() }),
                fetch(`${backend}/companies/${hash}/templates?perPage=200`, { headers: authHeaders() }),
                fetch(`${backend}/companies/${hash}/lists?perPage=200`, { headers: authHeaders() }),
                fetch(`${backend}/companies/${hash}/segments?perPage=200`, { headers: authHeaders() }),
            ]);
            if (dRes.ok) {
                const dJson: DomainSummary[] = await dRes.json();
                setDomains(Object.fromEntries(dJson.map(d => [d.id, d])));
            }
            if (tRes.ok) {
                const tJson = await tRes.json() as { items: TemplateSummary[] };
                setTemplates(Object.fromEntries((tJson.items ?? []).map(t => [t.id, t])));
            }
            if (lRes.ok) {
                const lJson = await lRes.json() as { items: ListSummary[] };
                setLists(Object.fromEntries((lJson.items ?? []).map(l => [l.id, l])));
            }
            if (sRes.ok) {
                const sJson = await sRes.json() as { items: SegmentSummary[] };
                setSegments(Object.fromEntries((sJson.items ?? []).map(s => [s.id, s])));
            }
        } catch {/* silent */}
    };

    // Fetch campaign + stats + lookups
    useEffect(() => {
        let abort = false;
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const [cRes, sRes] = await Promise.all([
                    fetch(campaignUrl, { headers: authHeaders() }),
                    fetch(statsUrl, { headers: authHeaders() }),
                ]);
                if (!cRes.ok) throw new Error(`Load failed (${cRes.status})`);
                const cJson: Campaign = await cRes.json();
                if (!abort) setData(cJson);
                if (sRes.ok) {
                    const sJson: StatsResponse = await sRes.json();
                    if (!abort) setStats(sJson);
                }
            } catch (e) {
                if (!abort) setErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [campaignUrl, statsUrl]);

    useEffect(() => { loadLookups(); /* fire & forget */ }, [backend, hash]);

    // Fetch recipients
    useEffect(() => {
        if (!backend) return;
        let abort = false;
        (async () => {
            setLoadingRecips(true);
            try {
                const res = await fetch(recipientsUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Recipients failed (${res.status})`);
                const json: RecipientsPage = await res.json();
                if (!abort) setRecips(json);
            } catch (e) {
                if (!abort) setRecips({ meta: { page: 1, perPage, total: 0, totalPages: 0 }, items: [] });
            } finally {
                if (!abort) setLoadingRecips(false);
            }
        })();
        return () => { abort = true; };
    }, [recipientsUrl, backend, perPage]);

    function updateQuery(partial: Record<string, unknown>) {
        const sp = new URLSearchParams(search.toString());
        Object.entries(partial).forEach(([k, v]) => {
            if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) sp.delete(k);
            else sp.set(k, String(v));
        });
        router.replace(`?${sp.toString()}`);
    }

    async function callAction(path: 'send' | 'schedule' | 'pause' | 'resume' | 'cancel') {
        if (!data) return;
        setActing(true); setActionErr(null); setActionMsg(null);
        try {
            // schedule needs a scheduled_at; since this is read-only, only allow if server already has one
            const body = path === 'schedule' && data.scheduled_at ? { scheduled_at: data.scheduled_at } : undefined;
            if (path === 'schedule' && !body) throw new Error('No schedule set. Use Edit to set a time.');
            const res = await fetch(`${backend}/companies/${hash}/campaigns/${data.id}/${path}`, {
                method: 'POST', headers: authHeaders(), body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) throw new Error(`Action failed (${res.status})`);
            const updated: Campaign = await res.json();
            setData(updated);
            setStats(prev => prev ? { ...prev, status: updated.status } : prev);
            setActionMsg(
                path === 'send' ? 'Sending started.'
                    : path === 'schedule' ? 'Scheduled.'
                        : path === 'pause' ? 'Paused.'
                            : path === 'resume' ? 'Resumed.'
                                : 'Cancelled.'
            );
        } catch (e) {
            setActionErr(e instanceof Error ? e.message : String(e));
        } finally { setActing(false); }
    }

    if (loading && !data) return <p className="p-6 text-center text-gray-600">Loading campaign…</p>;
    if (err) return (
        <div className="p-6 text-center">
            <p className="text-red-600">{err}</p>
            <button onClick={() => router.push(backHref)} className="mt-3 inline-flex items-center px-3 py-2 rounded border">
                <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back
            </button>
        </div>
    );
    if (!data) return null;

    const domainName   = data.domain_id   ? domains[data.domain_id]?.domain ?? `#${data.domain_id}` : '—';
    const templateName = data.template_id ? templates[data.template_id]?.name ?? `#${data.template_id}` : '—';
    const listName     = data.listGroup_id? lists[data.listGroup_id]?.name ?? `#${data.listGroup_id}` : '—';
    const segmentName  = data.segment_id  ? segments[data.segment_id]?.name ?? `#${data.segment_id}` : '—';

    const canPause    = data.status === 'sending' || data.status === 'scheduled';
    const canResume   = data.status === 'paused';
    const canSend     = data.status === 'draft';
    const canSchedule = data.status === 'draft';
    const canCancel   = !['completed','cancelled'].includes(data.status);

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={() => router.push(backHref)} className="inline-flex items-center text-gray-600 hover:text-gray-800">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">
                    Campaign: {data.name || <span className="text-gray-500 italic">(unnamed)</span>}
                </h1>
                <Link href={editHref} className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50">Edit</Link>
            </div>

            {/* Read-only basics */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <dl className="grid md:grid-cols-2 gap-4">
                    <div>
                        <dt className="text-sm text-gray-500">Subject</dt>
                        <dd className="mt-1">{data.subject || <span className="text-gray-500">—</span>}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-500">Status</dt>
                        <dd className="mt-1">
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                {data.status}
              </span>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-500">Send mode</dt>
                        <dd className="mt-1">{data.send_mode}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-500">Scheduled for</dt>
                        <dd className="mt-1">{toLocale(data.scheduled_at)}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-500">Created</dt>
                        <dd className="mt-1">{toLocale(data.created_at)}</dd>
                    </div>
                </dl>
            </div>

            {/* Read-only relationships */}
            <div className="bg-white border rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-3">Related</h2>
                <dl className="grid md:grid-cols-2 gap-4">
                    <div>
                        <dt className="text-sm text-gray-500">From domain</dt>
                        <dd className="mt-1">{domainName}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-500">Template</dt>
                        <dd className="mt-1">{templateName}</dd>
                    </div>

                    {data.target === 'list' ? (
                        <div className="md:col-span-2">
                            <dt className="text-sm text-gray-500">Target list</dt>
                            <dd className="mt-1">{listName}</dd>
                        </div>
                    ) : (
                        <div className="md:col-span-2">
                            <dt className="text-sm text-gray-500">Target segment</dt>
                            <dd className="mt-1">{segmentName}</dd>
                        </div>
                    )}
                </dl>
            </div>

            {/* Actions (no edit of fields, but lifecycle actions allowed) */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={() => callAction('send')}
                    disabled={!canSend || acting}
                    className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    title="Send immediately"
                >
                    <PaperAirplaneIcon className="h-5 w-5 mr-1" />
                    {acting ? 'Working…' : 'Send now'}
                </button>

                <button
                    onClick={() => callAction('schedule')}
                    disabled={!canSchedule || acting}
                    className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    title="Schedule sending"
                >
                    <CalendarDaysIcon className="h-5 w-5 mr-1" />
                    {acting ? 'Working…' : 'Schedule'}
                </button>

                <button
                    onClick={() => callAction('pause')}
                    disabled={!canPause || acting}
                    className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    title="Pause"
                >
                    <PauseIcon className="h-5 w-5 mr-1" /> Pause
                </button>

                <button
                    onClick={() => callAction('resume')}
                    disabled={!canResume || acting}
                    className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    title="Resume"
                >
                    <PlayIcon className="h-5 w-5 mr-1" /> Resume
                </button>

                <button
                    onClick={() => callAction('cancel')}
                    disabled={!canCancel || acting}
                    className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    title="Cancel"
                >
                    <XMarkIcon className="h-5 w-5 mr-1" /> Cancel
                </button>

                {(actionErr || actionMsg) && (
                    <div className="text-sm">
                        {actionErr && <span className="text-red-600 mr-3">{actionErr}</span>}
                        {actionMsg && <span className="text-green-700">{actionMsg}</span>}
                    </div>
                )}
            </div>

            {/* Metrics */}
            <div className="grid md:grid-cols-3 gap-4">
                {[
                    { label: 'Sent', value: stats?.metrics.sent ?? data.metrics.sent },
                    { label: 'Delivered', value: stats?.metrics.delivered ?? data.metrics.delivered },
                    { label: 'Opens', value: stats?.metrics.opens ?? data.metrics.opens },
                    { label: 'Clicks', value: stats?.metrics.clicks ?? data.metrics.clicks },
                    { label: 'Bounces', value: stats?.metrics.bounces ?? data.metrics.bounces },
                    { label: 'Complaints', value: stats?.metrics.complaints ?? data.metrics.complaints },
                ].map((m) => (
                    <div key={m.label} className="bg-white border rounded-lg p-4">
                        <div className="text-sm text-gray-500">{m.label}</div>
                        <div className="text-2xl font-semibold">{m.value}</div>
                    </div>
                ))}
            </div>

            {/* Recipients preview */}
            <div className="bg-white border rounded-lg overflow-hidden">
                <div className="p-3 border-b flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Recipients Preview</h2>
                    <div className="text-sm text-gray-600">
                        {loadingRecips
                            ? 'Loading…'
                            : recips?.meta
                                ? <>Page <span className="font-medium">{recips.meta.page}</span> / {recips.meta.totalPages} · {recips.meta.total} total</>
                                : '—'}
                    </div>
                </div>
                <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                        <tr className="text-left">
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">Status</th>
                        </tr>
                        </thead>
                        <tbody>
                        {loadingRecips && !recips ? (
                            <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={3}>Loading…</td></tr>
                        ) : !recips || recips.items.length === 0 ? (
                            <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={3}>No recipients.</td></tr>
                        ) : (
                            recips.items.map((r) => (
                                <tr key={r.id} className="border-t">
                                    <td className="px-3 py-2">{r.name || <span className="text-gray-500 italic">(no name)</span>}</td>
                                    <td className="px-3 py-2"><span className="font-mono text-xs">{r.email ?? '—'}</span></td>
                                    <td className="px-3 py-2">{r.status ?? '—'}</td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-3 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">Per page: <span className="font-medium">{perPage}</span></div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
                            disabled={!recips || page <= 1}
                            className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50 text-sm"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => updateQuery({ page: Math.min(recips?.meta?.totalPages ?? page, page + 1) })}
                            disabled={!recips || page >= (recips?.meta?.totalPages ?? 1)}
                            className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50 text-sm"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
                <Link href={backHref} className="text-sm text-gray-600 hover:text-gray-800">← Back to campaigns</Link>
                <div />
            </div>
        </div>
    );
}
