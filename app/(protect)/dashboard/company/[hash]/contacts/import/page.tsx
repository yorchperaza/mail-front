'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeftIcon,
    CloudArrowUpIcon,
    XMarkIcon,
    DocumentTextIcon,
    QueueListIcon,
    UserIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ArrowDownTrayIcon,
    InformationCircleIcon,
    DocumentArrowUpIcon,
    ClockIcon,
    ArrowPathIcon,
    AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import Select, { type MultiValue, type StylesConfig } from 'react-select';

type ListGroup = { id: number; name: string };
type ListsResponse = { items?: Array<{ id: number; name: string }> };

// Option type for react-select
type Option = { value: string; label: string };

/* ---------- Components ---------- */
function Toast({
                   kind = 'info',
                   text,
                   onClose,
               }: {
    kind?: 'info' | 'success' | 'error';
    text: string;
    onClose: () => void;
}) {
    const styles = {
        success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        error: 'bg-rose-50 border-rose-200 text-rose-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
    } as const;

    return (
        <div
            className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border px-4 py-3 shadow-lg ${styles[kind]}`}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{text}</span>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1 hover:bg-white/40 transition-colors"
                    aria-label="Close"
                    title="Close"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

// Typed styles for react-select (no `any`)
const customSelectStyles: StylesConfig<Option, true> = {
    control: (base) => ({
        ...base,
        borderRadius: '0.5rem',
        borderColor: '#d1d5db',
        ':hover': {
            borderColor: '#6366f1',
        },
        ':focus-within': {
            borderColor: '#6366f1',
            boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
        },
    }),
    menu: (base) => ({
        ...base,
        borderRadius: '0.5rem',
        overflow: 'hidden',
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

function StatCard({
                      label,
                      value,
                      icon,
                      color,
                  }: {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: 'blue' | 'emerald' | 'amber' | 'red' | 'gray';
}) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        red: 'from-red-500 to-red-600',
        gray: 'from-gray-500 to-gray-600',
    };

    return (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className={`bg-gradient-to-r ${colors[color]} p-2`}>
                <div className="flex items-center justify-between text-white">
                    {icon}
                    <span className="text-[10px] font-medium uppercase tracking-wider opacity-90">{label}</span>
                </div>
            </div>
            <div className="p-3">
                <div className="text-xl font-bold text-gray-900">{value.toLocaleString()}</div>
            </div>
        </div>
    );
}

export default function ContactCsvImportPage() {
    const router = useRouter();
    const { hash } = useParams<{ hash: string }>();
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // State
    const [dragOver, setDragOver] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [fileInfo, setFileInfo] = useState<{ name: string; size: number; preview?: string[] } | null>(null);
    const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(null);

    // Lists
    const [lists, setLists] = useState<ListGroup[]>([]);
    const [selectedListIds, setSelectedListIds] = useState<number[]>([]);
    const [loadingLists, setLoadingLists] = useState(true);

    // Options
    const [defaultName, setDefaultName] = useState('');
    const [subscribedAt, setSubscribedAt] = useState('');
    const [hasHeaders, setHasHeaders] = useState(true);

    // Submit
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

    function showToast(kind: 'info' | 'success' | 'error', text: string) {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 3000);
    }

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

    const listOptions = useMemo<Option[]>(
        () => lists.map((l) => ({ value: String(l.id), label: l.name })),
        [lists]
    );

    const toIso = (dtLocal: string): string | null => {
        if (!dtLocal) return null;
        const d = new Date(dtLocal);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    };

    const openPicker = () => fileInputRef.current?.click();

    const onFilePicked = async (f: File | null) => {
        setError(null);
        setSuccess(null);
        setFile(f);
        if (!f) {
            setFileInfo(null);
            return;
        }

        if (!f.name.toLowerCase().endsWith('.csv')) {
            setError('Please select a .csv file.');
            setFile(null);
            setFileInfo(null);
            return;
        }

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

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!file) {
            setError('Please attach a CSV file to import.');
            return;
        }

        const form = new FormData();
        form.append('file', file);
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
                } catch {
                    /* ignore */
                }
                throw new Error(message);
            }

            const json = await res.json();
            const sum = json?.summary ?? {};
            const result = {
                file: json?.file,
                created: Number(sum?.created ?? 0),
                updated: Number(sum?.updated ?? 0),
                attached: Number(sum?.attached ?? 0),
                skipped: Number(sum?.skipped ?? 0),
                errors: Number(sum?.errors ?? 0),
                total: Number(sum?.processed ?? sum?.total ?? 0),
            };
            setSuccess(result);
            showToast('success', `Import complete! ${result.created} created, ${result.updated} updated.`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Import failed.';
            setError(message);
            showToast('error', message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                {toast && <Toast kind={toast.kind} text={toast.text} onClose={() => setToast(null)} />}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/dashboard/company/${hash}/contacts`)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-all hover:shadow"
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Contacts
                        </button>
                        <div className="h-8 w-px bg-gray-200" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Import Contacts</h1>
                            <p className="text-sm text-gray-500">Upload a CSV file to bulk import contacts</p>
                        </div>
                    </div>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5" />
                        <div className="flex-1 text-sm text-red-800">{error}</div>
                    </div>
                )}

                {/* Success Results */}
                {success && (
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <CheckCircleSolid className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Import Complete</h3>
                                {success.file && <code className="text-xs opacity-90">— {success.file}</code>}
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <StatCard label="Created" value={success.created} icon={<CheckCircleIcon className="h-4 w-4" />} color="emerald" />
                                <StatCard label="Updated" value={success.updated} icon={<ArrowPathIcon className="h-4 w-4" />} color="blue" />
                                <StatCard label="Attached" value={success.attached} icon={<QueueListIcon className="h-4 w-4" />} color="blue" />
                                <StatCard label="Skipped" value={success.skipped} icon={<XMarkIcon className="h-4 w-4" />} color="amber" />
                                <StatCard label="Errors" value={success.errors} icon={<ExclamationTriangleIcon className="h-4 w-4" />} color="red" />
                                <StatCard label="Total" value={success.total} icon={<DocumentTextIcon className="h-4 w-4" />} color="gray" />
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-6">
                    {/* File Upload Section */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <DocumentArrowUpIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Upload CSV File</h3>
                            </div>
                        </div>
                        <div className="p-6">
                            {/* Dropzone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all ${
                                    dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                                }`}
                                onClick={openPicker}
                                role="button"
                                aria-label="Upload CSV"
                            >
                                <CloudArrowUpIcon className={`h-12 w-12 mb-3 transition-colors ${dragOver ? 'text-blue-600' : 'text-gray-400'}`} />
                                <p className="text-sm font-medium text-gray-900">Drag and drop your CSV here</p>
                                <p className="text-xs text-gray-500 mt-1">or click to browse</p>
                                <p className="text-xs text-gray-400 mt-2">Accepted format: .csv</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
                                />
                            </div>

                            {/* Selected File */}
                            {file && (
                                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <DocumentTextIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                                            <div>
                                                <div className="font-medium text-gray-900">{fileInfo?.name ?? file.name}</div>
                                                <div className="text-xs text-gray-500">{formatFileSize(fileInfo?.size ?? file.size)}</div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={clearFile}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-xs font-medium text-red-700 transition-colors"
                                            title="Remove file"
                                        >
                                            <XMarkIcon className="h-3 w-3" />
                                            Remove
                                        </button>
                                    </div>

                                    {fileInfo?.preview?.length ? (
                                        <div className="mt-4">
                                            <div className="text-xs font-medium text-gray-700 mb-2">Preview (first 5 lines)</div>
                                            <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto max-h-32">
                        {fileInfo.preview.join('\n')}
                      </pre>
                                            <label className="mt-3 inline-flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={hasHeaders}
                                                    onChange={(e) => setHasHeaders(e.target.checked)}
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-gray-700">First row contains headers</span>
                                            </label>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Import Options */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <AdjustmentsHorizontalIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">Import Options</h3>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <UserIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                        Default Name
                                    </label>
                                    <input
                                        value={defaultName}
                                        onChange={(e) => setDefaultName(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        placeholder="Used when CSV rows don't have a name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <ClockIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                        Subscribed Date
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={subscribedAt}
                                        onChange={(e) => setSubscribedAt(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Applied to imported list memberships</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <QueueListIcon className="inline h-4 w-4 mr-1 text-gray-400" />
                                    Subscribe to Lists
                                </label>
                                <Select<Option, true>
                                    isDisabled={loadingLists}
                                    isMulti
                                    options={listOptions}
                                    value={listOptions.filter((o) => selectedListIds.includes(Number(o.value)))}
                                    onChange={(opts: MultiValue<Option>) => {
                                        const ids = opts.map((o) => Number(o.value)).filter((n) => !Number.isNaN(n));
                                        setSelectedListIds(Array.from(new Set(ids)));
                                    }}
                                    isSearchable
                                    placeholder={loadingLists ? 'Loading lists...' : 'Select lists…'}
                                    styles={customSelectStyles}
                                />
                                <p className="text-xs text-gray-500 mt-1">All imported contacts will be added to these lists</p>
                            </div>
                        </div>
                    </div>

                    {/* CSV Format Info */}
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
                            <div className="flex items-center gap-2 text-white">
                                <InformationCircleIcon className="h-5 w-5" />
                                <h3 className="text-sm font-semibold uppercase tracking-wider">CSV Format</h3>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-700 mb-3">Supported CSV columns:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="flex items-start gap-2">
                                    <CheckCircleSolid className="h-4 w-4 text-emerald-500 mt-0.5" />
                                    <div>
                                        <code className="text-xs font-semibold text-gray-900">email</code>
                                        <span className="text-xs text-red-600 ml-1">*required</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircleIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <div>
                                        <code className="text-xs text-gray-700">name</code>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircleIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <div>
                                        <code className="text-xs text-gray-700">locale</code>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircleIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <div>
                                        <code className="text-xs text-gray-700">timezone</code>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircleIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <div>
                                        <code className="text-xs text-gray-700">status</code>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircleIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <div>
                                        <code className="text-xs text-gray-700">consent_source</code>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircleIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <div>
                                        <code className="text-xs text-gray-700">gdpr_consent_at</code>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircleIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                                    <div>
                                        <code className="text-xs text-gray-700">attributes</code>
                                        <span className="text-xs text-gray-500 ml-1">(JSON or key=value)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <a
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
                                    href="/example/contacts_example.csv"
                                    download
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                    Download CSV Template
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        <Link
                            href={backHref}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={uploading || !file}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                        >
                            <CloudArrowUpIcon className="h-5 w-5" />
                            {uploading ? 'Importing…' : 'Start Import'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
