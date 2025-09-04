'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon, CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Select, { MultiValue } from 'react-select';

type ListGroup = { id: number; name: string };

type ListsResponse = { items?: Array<{ id: number; name: string }> };

export default function ContactCsvImportPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // UI state
    const [dragOver, setDragOver] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [fileInfo, setFileInfo] = useState<{ name: string; size: number; preview?: string[] } | null>(null);

    // Lists
    const [lists, setLists] = useState<ListGroup[]>([]);
    const [selectedListIds, setSelectedListIds] = useState<number[]>([]);
    const [loadingLists, setLoadingLists] = useState(true);

    // Extra import options
    const [defaultName, setDefaultName] = useState('');
    const [subscribedAt, setSubscribedAt] = useState(''); // datetime-local
    const [hasHeaders, setHasHeaders] = useState(true);

    // Submit state
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<null | {
        file?: string;
        created: number;
        updated: number;
        attached: number;
        skipped: number;
        errors: number;
        total: number;
    }>(null);

    const authHeaders = useMemo(() => {
        return (): HeadersInit => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
            return token ? { Authorization: `Bearer ${token}` } : {};
        };
    }, []);

    const backHref = `/dashboard/company/${hash}/contacts`;

    // Load lists
    useEffect(() => {
        let abort = false;
        (async () => {
            try {
                const res = await fetch(`${backend}/companies/${hash}/lists?perPage=200`, { headers: authHeaders() });
                if (!res.ok) throw new Error(`Failed to load lists (${res.status})`);
                const json = (await res.json()) as ListsResponse;
                if (!abort) {
                    const items = Array.isArray(json?.items) ? json.items : [];
                    setLists(items.map((i) => ({ id: Number(i.id), name: String(i.name) })));
                }
            } catch {
                // leave empty
            } finally {
                if (!abort) setLoadingLists(false);
            }
        })();
        return () => {
            abort = true;
        };
    }, [backend, hash, authHeaders]);

    const listOptions = useMemo(
        () => lists.map((l) => ({ value: String(l.id), label: l.name })),
        [lists]
    );

    // Helpers
    const toIso = (dtLocal: string): string | null => {
        if (!dtLocal) return null;
        const d = new Date(dtLocal);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    };

    // File handlers
    const openPicker = () => fileInputRef.current?.click();

    const onFilePicked = async (f: File | null) => {
        setError(null);
        setSuccess(null);
        setFile(f);
        if (!f) { setFileInfo(null); return; }

        // Basic validation
        if (!f.name.toLowerCase().endsWith('.csv')) {
            setError('Please select a .csv file.');
            setFile(null);
            setFileInfo(null);
            return;
        }

        // Lightweight preview (first 5 lines, no heavy CSV parsing)
        try {
            const text = await f.text();
            const firstLines = text.split(/\r?\n/).slice(0, 5);
            setFileInfo({ name: f.name, size: f.size, preview: firstLines });
        } catch {
            setFileInfo({ name: f.name, size: f.size });
        }
    };

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const dt = e.dataTransfer;
        if (!dt?.files?.length) return;
        await onFilePicked(dt.files[0]);
    }, []);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    const clearFile = () => {
        setFile(null);
        setFileInfo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Submit
    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!file) {
            setError('Please attach a CSV file to import.');
            return;
        }

        const form = new FormData();
        form.append('file', file); // <-- backend expects 'file'
        if (selectedListIds.length) form.append('list_ids', JSON.stringify(selectedListIds));
        if (defaultName.trim()) form.append('default_name', defaultName.trim());
        if (toIso(subscribedAt)) form.append('subscribed_at', toIso(subscribedAt)!);
        form.append('has_headers', hasHeaders ? '1' : '0');

        setUploading(true);
        try {
            const res = await fetch(`${backend}/companies/${hash}/contacts-import`, {
                method: 'POST',
                headers: authHeaders(),
                body: form,
            });

            if (!res.ok) {
                let message = `Import failed (${res.status})`;
                try {
                    const j = await res.json();
                    if (j?.error) message = `${message}: ${j.error}`;
                } catch { /* ignore */ }
                throw new Error(message);
            }

            // Map backend fields → UI (created → added, processed → total)
            const json = await res.json();
            const sum = json?.summary ?? {};
            setSuccess({
                file: json?.file,
                created: Number(sum?.created ?? 0),
                updated: Number(sum?.updated ?? 0),
                attached: Number(sum?.attached ?? 0),
                skipped: Number(sum?.skipped ?? 0),
                errors: Number(sum?.errors ?? 0),
                total: Number(sum?.processed ?? sum?.total ?? 0),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(`/dashboard/company/${hash}/contacts`)}
                    className="inline-flex items-center text-gray-600 hover:text-gray-800"
                >
                    <ArrowLeftIcon className="h-5 w-5 mr-1" /> Back to Contacts
                </button>
                <h1 className="text-2xl font-semibold">Import Contacts (CSV)</h1>
                <div />
            </div>

            {error && (
                <div className="rounded border border-red-300 bg-red-50 text-red-800 p-3 text-sm">{error}</div>
            )}
            {success && (
                <div className="rounded border border-green-300 bg-green-50 text-green-800 p-3 text-sm">
                    <div className="font-medium">
                        Import complete{success.file ? <> — <code>{success.file}</code></> : null}
                    </div>
                    <div className="mt-1">
                        <span className="mr-3">created <strong>{success.created}</strong></span>
                        <span className="mr-3">updated <strong>{success.updated}</strong></span>
                        <span className="mr-3">skipped <strong>{success.skipped}</strong></span>
                        <span className="mr-3">errors <strong>{success.errors}</strong></span>
                        <span>total <strong>{success.total}</strong></span>
                    </div>
                </div>
            )}

            <form onSubmit={onSubmit} className="space-y-6 bg-white p-5 rounded border">
                {/* Dropzone */}
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={[
                        'flex flex-col items-center justify-center rounded border-2 border-dashed p-8 cursor-pointer transition',
                        dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
                    ].join(' ')}
                    onClick={openPicker}
                    role="button"
                    aria-label="Upload CSV"
                >
                    <CloudArrowUpIcon className="h-10 w-10 mb-2" />
                    <p className="text-sm">
                        <span className="font-medium">Drag and drop</span> your CSV here, or <span className="underline">browse</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Accepted format: .csv</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
                    />
                </div>

                {/* Selected file preview + actions */}
                {file && (
                    <div className="rounded border p-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm">
                                <div className="font-medium">{fileInfo?.name ?? file.name}</div>
                                <div className="text-gray-500">{(fileInfo?.size ?? file.size).toLocaleString()} bytes</div>
                            </div>
                            <button
                                type="button"
                                onClick={clearFile}
                                className="inline-flex items-center px-2 py-1 rounded border hover:bg-gray-50 text-sm"
                                title="Remove file"
                            >
                                <XMarkIcon className="h-4 w-4 mr-1" /> Remove
                            </button>
                        </div>
                        {fileInfo?.preview?.length ? (
                            <div className="mt-3">
                                <div className="text-xs font-medium mb-1">Preview (first lines)</div>
                                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
{fileInfo.preview.join('\n')}
                </pre>
                                <label className="mt-2 inline-flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={hasHeaders}
                                        onChange={(e) => setHasHeaders(e.target.checked)}
                                    />
                                    First row has headers
                                </label>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Options */}
                <fieldset className="border rounded p-4 space-y-3">
                    <legend className="text-sm font-medium px-2">Import Options</legend>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Default name (optional)
                            </label>
                            <input
                                value={defaultName}
                                onChange={(e) => setDefaultName(e.target.value)}
                                className="w-full rounded border px-3 py-2"
                                placeholder="Used when CSV rows don't have a name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Subscribed at (optional)
                            </label>
                            <input
                                type="datetime-local"
                                value={subscribedAt}
                                onChange={(e) => setSubscribedAt(e.target.value)}
                                className="w-full rounded border px-3 py-2"
                            />
                            <p className="text-xs text-gray-500 mt-1">Applied to imported memberships (if provided).</p>
                        </div>
                    </div>

                    {/* Subscribe to lists during import */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Subscribe to lists (optional)</label>
                        <Select
                            isDisabled={loadingLists}
                            isMulti
                            options={listOptions}
                            value={listOptions.filter((o) => selectedListIds.includes(Number(o.value)))}
                            onChange={(opts: MultiValue<{ value: string; label: string }>) => {
                                const ids = opts.map((o) => Number(o.value)).filter((n) => !Number.isNaN(n));
                                setSelectedListIds(Array.from(new Set(ids)));
                            }}
                            isSearchable
                            placeholder="Select lists…"
                            className="react-select-container"
                            classNamePrefix="react-select"
                        />
                    </div>
                </fieldset>

                {/* Hints */}
                <div className="text-xs text-gray-600">
                    <p className="mb-1 font-medium">CSV columns supported:</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                        <li><code>email</code> (required)</li>
                        <li><code>name</code>, <code>locale</code>, <code>timezone</code>, <code>status</code>, <code>consent_source</code>, <code>gdpr_consent_at</code></li>
                        <li><code>attributes</code> (JSON like <code>{"{\"plan\":\"pro\"}"}</code> or key=value;key2=value2)</li>
                    </ul>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                    <Link href={backHref} className="px-4 py-2 rounded border hover:bg-gray-50">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={uploading || !file}
                        className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900 disabled:opacity-60"
                    >
                        {uploading ? 'Importing…' : 'Start Import'}
                    </button>
                </div>
            </form>

            {/* Template */}
            <div className="text-sm">
                <a
                    className="text-blue-800 underline"
                    href="/example/contacts_example.csv"
                    download
                >
                    Download CSV template
                </a>
            </div>
        </div>
    );
}
