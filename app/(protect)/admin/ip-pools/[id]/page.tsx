'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';

/* ----------------------------- Types ----------------------------- */

type CompanyBrief = { id: number; name: string | null };

type IpPoolRow = {
    id: number;
    name: string | null;
    ips: string[] | null;
    reputation_score: number | null;
    warmup_state: string | null;
    created_at: string | null; // ISO
    company: { id: number; name: string | null } | null;
};

type PatchBody = Partial<{
    name: string;
    ips: string[];
    reputation_score: number | null;
    warmup_state: string | null;
    created_at: string | null; // ISO-8601 string
    companyId: number | null;
}>;

/* ----------------------------- Helpers ---------------------------- */

function isValidIp(ip: string): boolean {
    const ipv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
    const ipv6 =
        /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(::1)|([0-9a-fA-F]{1,4}::([0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){1,6}:))$/;
    return ipv4.test(ip) || ipv6.test(ip);
}

function parseIps(input: string): string[] {
    const raw = input
        .split(/[\s,]+/g)
        .map(s => s.trim())
        .filter(Boolean);
    return raw.filter(isValidIp);
}

function intOrNull(s: string): number | null {
    const t = s.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

// "YYYY-MM-DDTHH:mm" from ISO for <input type="datetime-local">
function toLocalInputValue(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    // Keep local timezone, strip seconds/ms
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
        d.getMinutes()
    )}`;
}

// pick a leading integer from a string like "123" or "123 - Acme"
function extractLeadingInt(s: string): number | null {
    const m = s.trim().match(/^(\d+)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

// strip undefined, keep nulls
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
    const out: Record<string, unknown> = {};
    (Object.keys(obj) as Array<keyof T>).forEach(k => {
        const v = obj[k];
        if (v !== undefined) out[k as string] = v;
    });
    return out as T;
}

// safe join for base URL + path
function joinUrl(base: string, path: string) {
    if (!base) return path;
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/* ------------------------------ Page ------------------------------ */

export default function IpPoolEditPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

    // 2) memoize getToken and authHeaders
    const getToken = useCallback(
        () => (typeof window !== 'undefined' ? localStorage.getItem('jwt') : null),
        []
    );

    const authHeaders = useCallback((): HeadersInit => {
        const token = getToken();
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }, [getToken]);

    const backHref = '/admin/ip-pools';

    // Load current pool
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [row, setRow] = useState<IpPoolRow | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [ipsText, setIpsText] = useState('');
    const [reputation, setReputation] = useState('');
    const [warmupState, setWarmupState] = useState<string>('');
    const [createdAt, setCreatedAt] = useState<string>(''); // datetime-local format

    // Company selection/search
    const [companyId, setCompanyId] = useState<number | null>(null); // the value to submit
    const [companyQuery, setCompanyQuery] = useState<string>(''); // what the user sees/types
    const [companyResults, setCompanyResults] = useState<CompanyBrief[]>([]);
    const [companyLoading, setCompanyLoading] = useState(false);
    const [companyErr, setCompanyErr] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const resultsBoxRef = useRef<HTMLDivElement | null>(null);

    // Close results when clicking outside
    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!resultsBoxRef.current) return;
            const target = e.target as Node;
            if (!resultsBoxRef.current.contains(target)) setShowResults(false);
        }
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, []);

    // Fetch current pool
    useEffect(() => {
        if (!backend || !id) return;
        let abort = false;

        (async () => {
            setLoading(true);
            setLoadErr(null);
            try {
                const res = await fetch(joinUrl(backend, `/ippools/${id}`), { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load IP pool (${res.status})`);
                const js: IpPoolRow = await res.json();
                if (abort) return;

                setRow(js);
                setName(js.name ?? '');
                setIpsText(Array.isArray(js.ips) ? js.ips.join('\n') : '');
                setReputation(js.reputation_score !== null && js.reputation_score !== undefined ? String(js.reputation_score) : '');
                setWarmupState(js.warmup_state ?? '');
                setCreatedAt(toLocalInputValue(js.created_at));
                if (js.company) {
                    setCompanyId(js.company.id);
                    setCompanyQuery(`${js.company.id} - ${js.company.name ?? `(Unnamed #${js.company.id})`}`);
                } else {
                    setCompanyId(null);
                    setCompanyQuery('');
                }
            } catch (e) {
                setLoadErr(e instanceof Error ? e.message : String(e));
            } finally {
                if (!abort) setLoading(false);
            }
        })();

        return () => {
            abort = true;
        };
    }, [backend, id, authHeaders]);

    // Debounced company search
    useEffect(() => {
        if (!backend) return;
        const q = companyQuery.trim();

        if (q === '' || (companyId !== null && q === String(companyId))) {
            setCompanyResults([]);
            setCompanyErr(null);
            setCompanyLoading(false);
            return;
        }

        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            try {
                setCompanyLoading(true);
                setCompanyErr(null);
                const url = joinUrl(backend, `/search-companies?q=${encodeURIComponent(q)}&limit=10`);
                const res = await fetch(url, { headers: authHeaders(), signal: ctrl.signal });
                if (!res.ok) throw new Error(`Search failed (${res.status})`);
                const rows = (await res.json()) as CompanyBrief[];
                setCompanyResults(rows);
                setShowResults(true);
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    setCompanyErr('Failed to search companies');
                    setCompanyResults([]);
                }
            } finally {
                setCompanyLoading(false);
            }
        }, 250);

        return () => {
            clearTimeout(t);
            ctrl.abort();
        };
    }, [backend, companyQuery, companyId, authHeaders]);

    const canSubmit = name.trim().length > 0;

    // Build PATCH body
    const payload: PatchBody = useMemo(() => {
        const ips = parseIps(ipsText);
        const rep = intOrNull(reputation);
        // Convert datetime-local to ISO; allow clearing if blank
        const createdISO = createdAt.trim() ? new Date(createdAt).toISOString() : null;

        const body: PatchBody = {
            name: name.trim(),
            ips: ips.length ? ips : [],
            reputation_score: rep,
            warmup_state: warmupState.trim() === '' ? null : warmupState.trim(),
            created_at: createdISO, // can be null to clear
            companyId: companyId === null ? null : companyId,
        };

        return stripUndefined(body);
    }, [name, ipsText, reputation, warmupState, createdAt, companyId]);

    async function onSave() {
        if (!backend) return alert('Missing NEXT_PUBLIC_BACKEND_URL');
        if (!canSubmit) return alert('Please enter a name.');
        if (!id) return;

        try {
            const res = await fetch(joinUrl(backend, `/ippools/${id}`), {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                let msg = `Update failed (${res.status})`;
                try {
                    const js = (await res.json()) as { error?: string; message?: string } | null;
                    if (js?.error) msg = js.error;
                    else if (js?.message) msg = js.message;
                } catch {
                    const t = await res.text().catch(() => '');
                    if (t) msg = t;
                }
                alert(msg);
                return;
            }

            router.push(backHref);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Update failed');
        }
    }

    async function onDelete() {
        if (!backend || !id) return;
        if (!confirm('Delete this IP pool?')) return;
        try {
            const res = await fetch(joinUrl(backend, `/ippools/${id}`), {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok && res.status !== 204) {
                let msg = `Delete failed (${res.status})`;
                try {
                    const js = (await res.json()) as { error?: string; message?: string } | null;
                    if (js?.error) msg = js.error;
                    else if (js?.message) msg = js.message;
                } catch {
                    // ignore
                }
                alert(msg);
                return;
            }
            router.push(backHref);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Delete failed');
        }
    }

    // When a result is chosen
    function chooseCompany(c: CompanyBrief) {
        setCompanyId(c.id);
        setCompanyQuery(`${c.id} - ${c.name ?? `(Unnamed #${c.id})`}`);
        setShowResults(false);
    }

    // Clear selection
    function clearCompany() {
        setCompanyId(null);
        setCompanyQuery('');
        setCompanyResults([]);
        setShowResults(false);
    }

    if (loading) return <p className="p-6 text-center text-gray-600">Loading IP pool…</p>;
    if (loadErr) return (
        <div className="p-6 text-center">
            <p className="text-red-600">{loadErr}</p>
            <button onClick={() => router.push(backHref)} className="mt-3 inline-flex items-center px-3 py-2 rounded border">
                <ArrowLeftIcon className="h-4 w-4 mr-1" /> Back
            </button>
        </div>
    );
    if (!row) return null;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={() => router.push(backHref)}
                    className="inline-flex items-center text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-semibold">Edit IP Pool</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onSave}
                        disabled={!canSubmit}
                        className="inline-flex items-center px-4 py-2 rounded bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-60"
                    >
                        <CheckIcon className="h-5 w-5 mr-1" />
                        Save changes
                    </button>
                    <button
                        onClick={onDelete}
                        className="inline-flex items-center px-3 py-2 rounded border text-red-600 hover:bg-red-50"
                        title="Delete"
                    >
                        <TrashIcon className="h-5 w-5 mr-1" />
                        Delete
                    </button>
                </div>
            </div>

            {/* Basics */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Name <span className="text-red-600">*</span>
                        </label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Transactional Pool A"
                            className="w-full rounded border px-3 py-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Reputation score</label>
                        <input
                            inputMode="numeric"
                            value={reputation}
                            onChange={e => setReputation(e.target.value)}
                            placeholder="e.g. 85"
                            className="w-full rounded border px-3 py-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">Integer 0–100; leave blank if unknown.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Warmup state</label>
                        <select
                            value={warmupState}
                            onChange={e => setWarmupState(e.target.value)}
                            className="w-full rounded border px-3 py-2"
                        >
                            <option value="">(none)</option>
                            <option value="not_started">not_started</option>
                            <option value="warming">warming</option>
                            <option value="ready">ready</option>
                            <option value="paused">paused</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Created at</label>
                        <input
                            type="datetime-local"
                            value={createdAt}
                            onChange={e => setCreatedAt(e.target.value)}
                            className="w-full rounded border px-3 py-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Leave blank to clear this value (server allows null), or set a specific date/time.
                        </p>
                    </div>
                </div>
            </div>

            {/* IPs */}
            <div className="bg-white border rounded-lg p-4 space-y-2">
                <label className="block text-sm font-medium mb-1">IPs</label>
                <textarea
                    rows={6}
                    value={ipsText}
                    onChange={e => setIpsText(e.target.value)}
                    placeholder={'One IP per line or comma-separated.\nExample:\n192.0.2.15\n203.0.113.8, 2001:db8::1'}
                    className="w-full rounded border px-3 py-2 font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                    Only valid IPv4/IPv6 are sent. Leave empty to clear. Use commas or new lines.
                </p>
                {ipsText.trim() !== '' && (
                    <p className="text-xs text-gray-600">Parsed: {parseIps(ipsText).join(', ') || '(none valid)'}</p>
                )}
            </div>

            {/* Company (search + select) */}
            <div className="bg-white border rounded-lg p-4 space-y-2">
                <label className="block text-sm font-medium mb-1">Company</label>

                <div className="relative" ref={resultsBoxRef}>
                    <div className="flex gap-2">
                        <input
                            value={companyQuery}
                            onChange={e => {
                                const v = e.target.value;
                                setCompanyQuery(v);
                                setShowResults(true);
                                const asId = extractLeadingInt(v); // auto-derive id if they type "123 - ..."
                                setCompanyId(asId);
                            }}
                            placeholder="Type company name or ID…"
                            className="w-full rounded border px-3 py-2"
                            onFocus={() => {
                                if (companyResults.length > 0) setShowResults(true);
                            }}
                        />
                        {companyQuery !== '' || companyId !== null ? (
                            <button
                                type="button"
                                onClick={clearCompany}
                                className="px-3 py-2 rounded border hover:bg-gray-50 text-sm"
                                title="Clear"
                            >
                                Clear
                            </button>
                        ) : null}
                    </div>

                    {/* Results popover */}
                    {showResults && (
                        <div className="absolute z-10 mt-1 w-full rounded border bg-white shadow">
                            {companyLoading ? (
                                <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
                            ) : companyErr ? (
                                <div className="px-3 py-2 text-sm text-amber-700">{companyErr}</div>
                            ) : companyResults.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-gray-500">No results</div>
                            ) : (
                                <ul className="max-h-64 overflow-auto">
                                    {companyResults.map(c => (
                                        <li key={c.id}>
                                            <button
                                                type="button"
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                                onClick={() => chooseCompany(c)}
                                            >
                                                <span className="font-medium">{c.name ?? `(Unnamed #${c.id})`}</span>
                                                <span className="ml-2 text-xs text-gray-500">ID: {c.id}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Helper text & current selection */}
                    <div className="mt-1 text-xs text-gray-500">
                        {companyId !== null ? (
                            <>
                                Selected company ID (will be submitted): <span className="font-mono">{companyId}</span>
                            </>
                        ) : (
                            <>Leave blank for no association.</>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-sm text-gray-500">
                <div>
                    <span>Fields with </span>
                    <span className="text-red-600">*</span>
                    <span> are required.</span>
                </div>
                <Link href={backHref} className="hover:text-gray-800">
                    ← Back to IP pools
                </Link>
            </div>
        </div>
    );
}
