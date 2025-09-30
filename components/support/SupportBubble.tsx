'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
    ChatBubbleLeftRightIcon,
    XMarkIcon,
    PaperClipIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type Props = { tokenStorageKey?: string; backendUrl?: string };
type SelFile = { file: File; id: string };

export default function SupportBubble({ tokenStorageKey = 'access_token', backendUrl }: Props) {
    const [open, setOpen] = useState(false);
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState<SelFile[]>([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const totalBytes = useMemo(() => files.reduce((n, f) => n + f.file.size, 0), [files]);
    const backend = backendUrl || process.env.NEXT_PUBLIC_BACKEND_URL || '';
    const tokenRef = useRef<string | null>(null);
    const subjectMax = 160;

    useEffect(() => {
        try {
            tokenRef.current = typeof window !== 'undefined' ? localStorage.getItem(tokenStorageKey) : null;
        } catch {}
    }, [tokenStorageKey]);

    function addFiles(list: FileList | File[]) {
        if (!list || (list as FileList).length === 0) return;
        setError(null);
        const next: SelFile[] = [...files];
        for (const f of Array.from(list as FileList)) {
            if (f.size > 10 * 1024 * 1024) { setError(`"${f.name}" exceeds 10 MB per file limit.`); continue; }
            next.push({ file: f, id: crypto.randomUUID() });
            if (next.length >= 10) break;
        }
        const sum = next.reduce((n, s) => n + s.file.size, 0);
        if (sum > 20 * 1024 * 1024) { setError('Total attachments must be ≤ 20 MB.'); return; }
        setFiles(next);
    }
    function onPickFiles(list: FileList | null) { if (list) addFiles(list); }
    function removeFile(id: string) { setFiles((curr) => curr.filter((f) => f.id !== id)); }
    function onDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); }
    function onPaste(e: React.ClipboardEvent) { const items = e.clipboardData?.files; if (items && items.length) addFiles(items); }

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setOk(false);

        if (!subject.trim() || !description.trim()) {
            setError('Please provide subject and description.');
            return;
        }
        if (!backend) {
            setError('Missing backend URL.');
            return;
        }

        const fd = new FormData();
        fd.append('subject', subject.trim());
        fd.append('description', description.trim());
        for (const f of files) fd.append('attachments', f.file, f.file.name);

        setSending(true);
        try {
            const res = await fetch(`${backend}/support`, {
                method: 'POST',
                headers: {
                    ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
                },
                body: fd,
                credentials: 'include',
            });

            if (res.status === 202) {
                // reset state
                setOk(true);
                setSubject('');
                setDescription('');
                setFiles([]);

                // ✅ close modal after short delay
                setTimeout(() => setOpen(false), 1500);
                return;
            }

            const payload = await res.json().catch(() => ({}));
            setError(
                (payload && typeof payload.message === 'string' && payload.message) ||
                `Request failed (${res.status})`
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send support request.');
        } finally {
            setSending(false);
        }
    }

    return (
        <>
            {/* Floating button with simple pulse ring (no custom CSS) */}
            <button
                type="button"
                aria-label="Open support"
                title="Contact support"
                onClick={() => setOpen(true)}
                className="group fixed bottom-5 right-5 z-[60] inline-flex h-14 w-14 items-center justify-center
             rounded-full bg-gradient-to-br from-blue-600 via-sky-600 to-cyan-500 text-white
             shadow-2xl ring-2 ring-white/10 transition hover:scale-105 hover:ring-white/30
             focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
                {/* hover-only ping */}
                <span className="absolute hidden h-14 w-14 rounded-full bg-blue-500/20 group-hover:inline-flex motion-safe:animate-ping" />
                <ChatBubbleLeftRightIcon className="relative h-6 w-6" />
                <span className="sr-only">Open support form</span>
            </button>

            <Transition show={open} appear>
                <Dialog onClose={() => setOpen(false)} className="relative z-[70]">
                    <Transition.Child
                        enter="transition-opacity ease-out duration-200"
                        enterFrom="opacity-0" enterTo="opacity-100"
                        leave="transition-opacity ease-in duration-150"
                        leaveFrom="opacity-100" leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-end sm:items-center justify-center p-4">
                            <Transition.Child
                                enter="transition transform ease-out duration-250"
                                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                enterTo="opacity-100 translate-y-0 sm:scale-100"
                                leave="transition transform ease-in duration-200"
                                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 shadow-2xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl ring-1 ring-black/5">
                                    <div className="h-2 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400" />
                                    <div className="flex items-start justify-between px-6 py-5">
                                        <div>
                                            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">Contact Support</Dialog.Title>
                                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Tell us what is going on and we will email you back.</p>
                                        </div>
                                        <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 focus:outline-none">
                                            <XMarkIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                                            <span className="sr-only">Close</span>
                                        </button>
                                    </div>

                                    <form onSubmit={submit} onPaste={onPaste} className="px-6 pb-6 space-y-5">
                                        {ok && (
                                            <div className="flex items-start gap-2 rounded-xl border border-green-200/70 bg-green-50/60 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800/50">
                                                <CheckCircleIcon className="h-5 w-5 mt-0.5" />
                                                Your message was sent. We will get back to you soon.
                                            </div>
                                        )}
                                        {error && (
                                            <div className="flex items-start gap-2 rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800/50">
                                                <ExclamationTriangleIcon className="h-5 w-5 mt-0.5" />
                                                {error}
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Subject *</label>
                                            <div className="relative">
                                                <input
                                                    value={subject}
                                                    onChange={(e) => setSubject(e.target.value)}
                                                    className="w-full rounded-xl border border-gray-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/60 px-4 py-2.5 pr-14 shadow-inner focus:border-blue-500 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                                                    placeholder="Brief summary"
                                                    maxLength={subjectMax}
                                                    required
                                                />
                                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          {subject.length}/{subjectMax}
                        </span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description *</label>
                                            <textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                className="w-full min-h-[160px] rounded-xl border border-gray-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/60 px-4 py-3 shadow-inner focus:border-blue-500 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                                                placeholder="Include steps, expected vs actual, and any error messages."
                                                required
                                            />
                                            <p className="mt-1 text-xs text-gray-500">Tip: you can paste a screenshot here and it will be attached.</p>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Attachments</label>
                                                <span className={`text-xs ${totalBytes > 20 * 1024 * 1024 ? 'text-red-600' : 'text-gray-500'}`}>≤10 MB each • ≤20 MB total</span>
                                            </div>

                                            <div
                                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                                onDragLeave={() => setDragOver(false)}
                                                onDrop={onDrop}
                                                className={`group relative rounded-2xl border-2 border-dashed ${dragOver ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-900/20' : 'border-gray-300 dark:border-neutral-700'} p-5 text-center transition`}
                                            >
                                                <input id="support-files" type="file" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
                                                <label
                                                    htmlFor="support-files"
                                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/60 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer"
                                                >
                                                    <PaperClipIcon className="h-5 w-5" />
                                                    Add files
                                                </label>
                                                <p className="mt-2 text-xs text-gray-500">or drop files here</p>

                                                {files.length > 0 && (
                                                    <ul className="mt-4 text-left grid gap-2 sm:grid-cols-2">
                                                        {files.map((f) => (
                                                            <li key={f.id} className="flex items-center justify-between rounded-xl bg-gray-50/70 dark:bg-neutral-800/60 px-3 py-2">
                                                                <span className="truncate text-sm text-gray-700 dark:text-gray-200">{f.file.name}</span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs text-gray-500">{formatBytes(f.file.size)}</span>
                                                                    <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeFile(f.id)}>remove</button>
                                                                </div>
                                                            </li>
                                                        ))}
                                                        <li className="col-span-full flex justify-end">
                                                            <span className={`text-xs ${totalBytes > 20 * 1024 * 1024 ? 'text-red-600' : 'text-gray-500'}`}>Total: {formatBytes(totalBytes)}</span>
                                                        </li>
                                                    </ul>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-3 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setOpen(false)}
                                                className="inline-flex items-center justify-center rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={sending}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-lg hover:from-blue-700 hover:via-sky-700 hover:to-cyan-600 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-blue-300"
                                            >
                                                {sending ? (<><ArrowPathIcon className="h-4 w-4 animate-spin" />Sending…</>) : (<>Send</>)}
                                            </button>
                                        </div>
                                    </form>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </>
    );
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    const kb = n / 1024; if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
    const mb = kb / 1024; return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}
