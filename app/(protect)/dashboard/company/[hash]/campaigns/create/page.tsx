'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    CheckIcon,
    PaperAirplaneIcon,
    CalendarDaysIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon as CheckMini, ChevronUpDownIcon } from '@heroicons/react/20/solid';

/* ----------------------- Reusable SelectBox ----------------------- */

type OptionValue = string | number;
type SBOption = { value: OptionValue; label: string; hint?: string };

type SelectBoxProps = {
    label?: string;
    value: OptionValue | '';
    onChange: (v: OptionValue | '') => void;
    options: readonly SBOption[];
    placeholder?: string;
    disabled?: boolean;
    id?: string;

    /** Footer action (optional) */
    footerActionLabel?: string;
    onFooterAction?: () => void;
};

function classNames(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(' ');
}

function SelectBox({
                       label,
                       value,
                       onChange,
                       options,
                       placeholder = '(select)',
                       disabled,
                       id,
                       footerActionLabel,
                       onFooterAction,
                   }: SelectBoxProps) {
    const selected =
        useMemo(() => options.find((o) => String(o.value) === String(value)) ?? null, [options, value]);

    // Build final options list with an optional footer special item
    const FINAL_CREATE_VALUE = '__create__';
    const hasFooter = !!footerActionLabel && !!onFooterAction;
    const finalOptions: SBOption[] = hasFooter
        ? [...options, { value: FINAL_CREATE_VALUE, label: footerActionLabel }]
        : [...options];

    return (
        <div className="w-full">
            {label && (
                <label htmlFor={id} className="block text-sm font-medium mb-1">
                    {label}
                </label>
            )}

            <Listbox
                value={selected}
                onChange={(opt: SBOption | null) => {
                    if (!opt) return onChange('');
                    if (hasFooter && String(opt.value) === FINAL_CREATE_VALUE) {
                        // Trigger footer action and keep current selection
                        onFooterAction?.();
                        return;
                    }
                    onChange(opt.value);
                }}
                disabled={disabled}
            >
                {({ open }) => (
                    <div className="relative">
                        <Listbox.Button
                            id={id}
                            className={classNames(
                                'relative w-full cursor-default rounded border px-3 py-2 text-left',
                                'bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500',
                                'disabled:opacity-60'
                            )}
                        >
              <span className="block truncate">
                {selected ? selected.label : <span className="text-gray-400">{placeholder}</span>}
              </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
              </span>
                        </Listbox.Button>

                        <Transition
                            as="div"
                            show={open}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none text-sm">
                                {finalOptions.length === 0 ? (
                                    <div className="px-3 py-2 text-gray-500">No options</div>
                                ) : (
                                    finalOptions.map((opt, idx) => {
                                        const isFooter = hasFooter && String(opt.value) === FINAL_CREATE_VALUE;
                                        return (
                                            <Listbox.Option
                                                key={`${opt.value}-${idx}`}
                                                value={opt}
                                                className={({ active }) =>
                                                    classNames(
                                                        isFooter
                                                            ? 'text-blue-700'
                                                            : active
                                                                ? 'bg-blue-50 text-blue-900'
                                                                : 'text-gray-900',
                                                        'relative cursor-default select-none py-2 pl-9 pr-3',
                                                        isFooter && 'border-t mt-1 pt-2'
                                                    )
                                                }
                                            >
                                                {({ selected: isSel, active }) => (
                                                    <>
                            <span
                                className={classNames(
                                    isFooter
                                        ? 'font-medium'
                                        : isSel
                                            ? 'font-medium'
                                            : 'font-normal',
                                    'block truncate'
                                )}
                            >
                              {opt.label}
                            </span>
                                                        {!isFooter && opt.hint && (
                                                            <span className="block truncate text-xs text-gray-500">{opt.hint}</span>
                                                        )}
                                                        {!isFooter && isSel ? (
                                                            <span
                                                                className={classNames(
                                                                    active ? 'text-blue-700' : 'text-blue-600',
                                                                    'absolute inset-y-0 left-0 flex items-center pl-2'
                                                                )}
                                                            >
                                <CheckMini className="h-5 w-5" aria-hidden="true" />
                              </span>
                                                        ) : null}
                                                    </>
                                                )}
                                            </Listbox.Option>
                                        );
                                    })
                                )}
                            </Listbox.Options>
                        </Transition>
                    </div>
                )}
            </Listbox>
        </div>
    );
}

/* ------------ Types (align with your backend) ------------ */

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

type ApiPaged<T> = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: T[];
};

type ListSummary = { id: number; name: string };
type SegmentSummary = { id: number; name: string; materialized_count?: number | null };
type TemplateSummary = { id: number; name: string };
type DomainSummary = { id: number; domain: string; statusDomain?: string };

type RecipientRow = { id: number; email: string | null; name: string | null; status: string | null };
type RecipientsPage = {
    meta: { page: number; perPage: number; total: number; totalPages: number };
    items: RecipientRow[];
};

/* ----------------------------- Page ----------------------------- */

export default function CampaignCreatePage() {
    const router = useRouter();
    const params = useParams<{ hash: string }>();
    const hash = params.hash;

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    const backHref = `/dashboard/company/${hash}/campaigns`;
    const templateCreateHref = `/dashboard/company/${hash}/templates/create`;
    const domainCreateHref   = `/dashboard/company/${hash}/domains/create`;
    const listCreateHref     = `/dashboard/company/${hash}/lists/create`;
    const segmentCreateHref  = `/dashboard/company/${hash}/segments/create`;

    /* ------------------------ Picklist data ------------------------ */

    const listsUrl = useMemo(() => (backend ? `${backend}/companies/${hash}/lists?perPage=200` : null), [backend, hash]);
    const segmentsUrl = useMemo(() => (backend ? `${backend}/companies/${hash}/segments?perPage=200` : null), [backend, hash]);
    const templatesUrl = useMemo(() => (backend ? `${backend}/companies/${hash}/templates?perPage=200` : null), [backend, hash]);
    const domainsUrl = useMemo(() => (backend ? `${backend}/companies/${hash}/domains` : null), [backend, hash]);

    const [lists, setLists] = useState<ListSummary[]>([]);
    const [segments, setSegments] = useState<SegmentSummary[]>([]);
    const [templates, setTemplates] = useState<TemplateSummary[]>([]);
    const [domains, setDomains] = useState<DomainSummary[]>([]);
    const [pickErr, setPickErr] = useState<string | null>(null);

    useEffect(() => {
        if (!listsUrl || !segmentsUrl || !templatesUrl) return;
        let abort = false;
        (async () => {
            setPickErr(null);
            try {
                const [lRes, sRes, tRes] = await Promise.all([
                    fetch(listsUrl, { headers: authHeaders() }),
                    fetch(segmentsUrl, { headers: authHeaders() }),
                    fetch(templatesUrl, { headers: authHeaders() }),
                ]);
                if (!lRes.ok) throw new Error(`Lists failed (${lRes.status})`);
                if (!sRes.ok) throw new Error(`Segments failed (${sRes.status})`);
                if (!tRes.ok) throw new Error(`Templates failed (${tRes.status})`);

                const lJson: ApiPaged<ListSummary> = await lRes.json();
                const sJson: ApiPaged<SegmentSummary> = await sRes.json();
                const tJson: ApiPaged<TemplateSummary> = await tRes.json();

                if (!abort) {
                    setLists(lJson.items ?? []);
                    setSegments(sJson.items ?? []);
                    setTemplates(tJson.items ?? []);
                }
            } catch (e) {
                if (!abort) setPickErr(e instanceof Error ? e.message : String(e));
            }
        })();
        return () => {
            abort = true;
        };
    }, [listsUrl, segmentsUrl, templatesUrl]);

    useEffect(() => {
        if (!domainsUrl) return;
        let abort = false;
        (async () => {
            try {
                const res = await fetch(domainsUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Domains failed (${res.status})`);
                const dJson: DomainSummary[] = await res.json();
                if (!abort) setDomains(Array.isArray(dJson) ? dJson : []);
            } catch (e) {
                if (!abort) setPickErr((prev) => prev ?? (e instanceof Error ? e.message : String(e)));
            }
        })();
        return () => {
            abort = true;
        };
    }, [domainsUrl]);

    /* -------------------------- Form state ------------------------- */

    const [campaignId, setCampaignId] = useState<number | null>(null);
    const [name, setName] = useState<string>('');
    const [subject, setSubject] = useState<string>('');
    const [templateId, setTemplateId] = useState<number | ''>('');
    const [domainId, setDomainId] = useState<number | ''>('');
    const [target, setTarget] = useState<TargetKind>('list');
    const [listGroupId, setListGroupId] = useState<number | ''>('');
    const [segmentId, setSegmentId] = useState<number | ''>('');
    const [sendMode, setSendMode] = useState<SendMode>('immediate');
    const [scheduledAtLocal, setScheduledAtLocal] = useState<string>(''); // yyyy-MM-ddThh:mm (local)

    // Save/create state
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);

    // Actions state
    const [actionErr, setActionErr] = useState<string | null>(null);
    const [actionMsg, setActionMsg] = useState<string | null>(null);
    const [acting, setActing] = useState(false);

    // Recipients preview
    const [recips, setRecips] = useState<RecipientsPage | null>(null);
    const [recipsLoading, setRecipsLoading] = useState(false);
    const [recipsErr, setRecipsErr] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const perPage = 25;

    const recipientsUrl = useMemo(() => {
        if (!backend || !campaignId) return null;
        const sp = new URLSearchParams({ page: String(page), perPage: String(perPage) });
        return `${backend}/companies/${hash}/campaigns/${campaignId}/recipients?${sp.toString()}`;
    }, [backend, hash, campaignId, page]);

    useEffect(() => {
        if (!recipientsUrl) return;
        let abort = false;
        (async () => {
            setRecipsLoading(true);
            setRecipsErr(null);
            try {
                const res = await fetch(recipientsUrl, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load recipients (${res.status})`);
                const json: RecipientsPage = await res.json();
                if (!abort) setRecips(json);
            } catch (e) {
                if (!abort) setRecipsErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setRecipsLoading(false);
            }
        })();
        return () => {
            abort = true;
        };
    }, [recipientsUrl]);

    /* ---------------------------- Helpers --------------------------- */

    const toISOFromLocal = (local: string): string | null => {
        if (!local) return null;
        const d = new Date(local);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    };

    const toLocale = (iso?: string | null) => {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleString();
        } catch {
            return iso;
        }
    };

    const resetPreviewPage = () => setPage(1);

    /* ---------------------------- Save (draft) --------------------------- */

    async function ensureCreatedOrPatched(): Promise<number> {
        if (!backend) throw new Error('Missing backend URL');

        if (target === 'list' && !listGroupId) throw new Error('Please choose a list.');
        if (target === 'segment' && !segmentId) throw new Error('Please choose a segment.');

        const body: Record<string, unknown> = {
            name: name.trim(),
            subject: subject.trim() || undefined,
            template_id: templateId || undefined,
            domain_id: domainId || undefined,
            target,
            list_group_id: target === 'list' ? listGroupId : undefined,
            segment_id: target === 'segment' ? segmentId : undefined,
            send_mode: sendMode,
            scheduled_at: sendMode === 'scheduled' ? toISOFromLocal(scheduledAtLocal) : undefined,
        };
        if (!body.name) throw new Error('Please enter a campaign name');

        if (campaignId == null) {
            const res = await fetch(`${backend}/companies/${hash}/campaigns`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            const payload = (await res.json()) as Campaign | { error?: string };
            if (!res.ok) throw new Error(('error' in payload && payload.error) ? payload.error : `Create failed (${res.status})`);
            setCampaignId((payload as Campaign).id);
            return (payload as Campaign).id;
        } else {
            const res = await fetch(`${backend}/companies/${hash}/campaigns/${campaignId}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            const payload = (await res.json()) as Campaign | { error?: string };
            if (!res.ok) throw new Error(('error' in payload && payload.error) ? payload.error : `Save failed (${res.status})`);
            return (payload as Campaign).id;
        }
    }

    async function onSaveDraft() {
        setSaveErr(null);
        setSaveMsg(null);
        setSaving(true);
        try {
            const id = await ensureCreatedOrPatched();
            setSaveMsg(`Campaign saved (ID ${id}).`);
        } catch (e) {
            setSaveErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    }

    /* ---------------------------- Actions ---------------------------- */

    async function onSchedule() {
        setActionErr(null);
        setActionMsg(null);
        setActing(true);
        try {
            if (sendMode !== 'scheduled') throw new Error('Select “Scheduled” and a date/time to schedule.');
            if (!scheduledAtLocal) throw new Error('Please pick a date & time.');
            const id = await ensureCreatedOrPatched();
            const iso = toISOFromLocal(scheduledAtLocal);
            if (!iso) throw new Error('Invalid schedule date/time.');

            const res = await fetch(`${backend}/companies/${hash}/campaigns/${id}/schedule`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ scheduled_at: iso }),
            });
            const payload = (await res.json()) as Campaign | { error?: string };
            if (!res.ok) throw new Error(('error' in payload && payload.error) ? payload.error : `Schedule failed (${res.status})`);
            setActionMsg(`Scheduled for ${toLocale((payload as Campaign).scheduled_at)}.`);
        } catch (e) {
            setActionErr(e instanceof Error ? e.message : String(e));
        } finally {
            setActing(false);
        }
    }

    async function onSendNow() {
        setActionErr(null);
        setActionMsg(null);
        setActing(true);
        try {
            const id = await ensureCreatedOrPatched();
            const res = await fetch(`${backend}/companies/${hash}/campaigns/${id}/send`, {
                method: 'POST',
                headers: authHeaders(),
            });
            const payload = (await res.json()) as Campaign | { error?: string };
            if (!res.ok) throw new Error(('error' in payload && payload.error) ? payload.error : `Send failed (${res.status})`);
            setActionMsg('Sending started.');
        } catch (e) {
            setActionErr(e instanceof Error ? e.message : String(e));
        } finally {
            setActing(false);
        }
    }

    async function refreshRecipients() {
        if (!campaignId) return;
        resetPreviewPage();
        setPage((p) => (p === 1 ? 2 : 1));
        setPage(1);
    }

    /* ----------------------------- Render ---------------------------- */

    const targetOptions = [
        { value: 'list', label: 'List' },
        { value: 'segment', label: 'Segment' },
    ] as const satisfies readonly SBOption[];

    const sendModeOptions = [
        { value: 'immediate', label: 'Immediate' },
        { value: 'scheduled', label: 'Scheduled' },
    ] as const satisfies readonly SBOption[];

    const domainOptions: SBOption[] = domains.map((d) => ({
        value: d.id,
        label: d.domain,
        hint: d.statusDomain,
    }));

    const templateOptions: SBOption[] = templates.map((t) => ({
        value: t.id,
        label: t.name,
    }));

    const listOptions: SBOption[] = lists.map((l) => ({ value: l.id, label: l.name }));
    const segmentOptions: SBOption[] = segments.map((s) => ({ value: s.id, label: s.name }));

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button onClick={() => router.push(backHref)} className="inline-flex items-center text-gray-600 hover:text-gray-800">
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">Create Campaign</h1>
                <div className="flex gap-2">
                    <button
                        onClick={onSaveDraft}
                        disabled={saving}
                        className="px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                        title="Save as draft"
                    >
                        <CheckIcon className="h-5 w-5 inline-block mr-1" />
                        {saving ? 'Saving…' : 'Save draft'}
                    </button>
                </div>
            </div>

            {/* Basic details */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Campaign name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Spring promo"
                            className="w-full rounded border px-3 py-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Subject</label>
                        <input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Subject line"
                            className="w-full rounded border px-3 py-2"
                        />
                    </div>

                    <SelectBox
                        label="From domain"
                        value={domainId === '' ? '' : domainId}
                        onChange={(v) => setDomainId(typeof v === 'number' ? v : '')}
                        options={domainOptions}
                        placeholder="Choose a domain"
                        footerActionLabel="+ Add new domain"
                        onFooterAction={() => router.push(domainCreateHref)}
                    />

                    <SelectBox
                        label="Template"
                        value={templateId === '' ? '' : templateId}
                        onChange={(v) => setTemplateId(typeof v === 'number' ? v : '')}
                        options={templateOptions}
                        placeholder="Choose a template"
                        footerActionLabel="+ Create new template"
                        onFooterAction={() => router.push(templateCreateHref)}
                    />
                </div>

                {pickErr && <div className="text-sm text-red-600">{pickErr}</div>}
            </div>

            {/* Targeting */}
            <div className="bg-white border rounded-lg p-4 space-y-3">
                <h2 className="text-lg font-semibold">Recipients</h2>

                <div className="grid md:grid-cols-3 gap-4 items-end">
                    <SelectBox
                        label="Target"
                        value={target}
                        onChange={(v) => {
                            const val = (v as TargetKind) || 'list';
                            setTarget(val);
                            if (val === 'list') setSegmentId('');
                            else setListGroupId('');
                        }}
                        options={targetOptions}
                    />

                    {target === 'list' ? (
                        <SelectBox
                            label="List"
                            value={listGroupId === '' ? '' : listGroupId}
                            onChange={(v) => setListGroupId(typeof v === 'number' ? v : '')}
                            options={listOptions}
                            placeholder="Select a list"
                            footerActionLabel="+ Create new list"
                            onFooterAction={() => router.push(listCreateHref)}
                        />
                    ) : (
                        <SelectBox
                            label="Segment"
                            value={segmentId === '' ? '' : segmentId}
                            onChange={(v) => setSegmentId(typeof v === 'number' ? v : '')}
                            options={segmentOptions}
                            placeholder="Select a segment"
                            footerActionLabel="+ Create new segment"
                            onFooterAction={() => router.push(segmentCreateHref)}
                        />
                    )}

                    <div>
                        <SelectBox
                            label="Send mode"
                            value={sendMode}
                            onChange={(v) => setSendMode((v as SendMode) || 'immediate')}
                            options={sendModeOptions}
                        />
                        {sendMode === 'scheduled' && (
                            <div className="mt-2">
                                <label className="block text-sm font-medium mb-1">Scheduled for</label>
                                <input
                                    type="datetime-local"
                                    value={scheduledAtLocal}
                                    onChange={(e) => setScheduledAtLocal(e.target.value)}
                                    className="w-full rounded border px-3 py-2"
                                />
                                <p className="text-xs text-gray-500 mt-1">Local time; will be stored as UTC.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={onSendNow}
                    disabled={acting}
                    className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    title="Send immediately"
                >
                    <PaperAirplaneIcon className="h-5 w-5 mr-1" />
                    {acting ? 'Working…' : 'Send now'}
                </button>

                <button
                    onClick={onSchedule}
                    disabled={acting}
                    className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    title="Schedule this campaign"
                >
                    <CalendarDaysIcon className="h-5 w-5 mr-1" />
                    {acting ? 'Working…' : 'Schedule'}
                </button>

                <button
                    onClick={async () => {
                        try {
                            const id = await ensureCreatedOrPatched();
                            if (!id) return;
                            await refreshRecipients();
                        } catch (e) {
                            setActionErr(e instanceof Error ? e.message : String(e));
                        }
                    }}
                    disabled={!campaignId && acting}
                    className="inline-flex items-center px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-60"
                    title="Preview recipients"
                >
                    <EyeIcon className="h-5 w-5 mr-1" />
                    Preview recipients
                </button>

                {saveErr && <span className="text-sm text-red-600">{saveErr}</span>}
                {saveMsg && <span className="text-sm text-green-700">{saveMsg}</span>}
                {actionErr && <span className="text-sm text-red-600">{actionErr}</span>}
                {actionMsg && <span className="text-sm text-green-700">{actionMsg}</span>}

                <div className="ml-auto text-sm text-gray-500">
                    {campaignId ? (
                        <>
                            Campaign ID: <span className="font-mono">{campaignId}</span>
                        </>
                    ) : (
                        'Not saved yet'
                    )}
                </div>
            </div>

            {/* Recipients preview */}
            <div className="bg-white border rounded-lg overflow-hidden">
                <div className="p-3 border-b flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Recipients</h2>
                    <div className="text-sm text-gray-600">
                        {recips?.meta
                            ? (
                                <>
                                    Page <span className="font-medium">{recips.meta.page}</span> / {recips.meta.totalPages} · {recips.meta.total} total
                                </>
                            )
                            : recipsLoading
                                ? 'Loading…'
                                : campaignId
                                    ? 'Click “Preview recipients”'
                                    : 'Save the campaign first'}
                    </div>
                </div>

                {recipsErr ? (
                    <div className="p-4 text-red-600">{recipsErr}</div>
                ) : (
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
                            {recipsLoading && !recips ? (
                                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={3}>Loading…</td></tr>
                            ) : !recips || recips.items.length === 0 ? (
                                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={3}>No recipients.</td></tr>
                            ) : (
                                recips.items.map((c) => (
                                    <tr key={c.id} className="border-t">
                                        <td className="px-3 py-2">{c.name || <span className="text-gray-500 italic">(no name)</span>}</td>
                                        <td className="px-3 py-2"><span className="font-mono text-xs">{c.email ?? '—'}</span></td>
                                        <td className="px-3 py-2">{c.status ?? '—'}</td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <div className="p-3 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">Per page: <span className="font-medium">{perPage}</span></div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={!recips || page <= 1}
                            className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50 text-sm"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(recips?.meta?.totalPages ?? p, p + 1))}
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
