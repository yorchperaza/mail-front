'use client';

import React from 'react';
import { CheckIcon, ClipboardIcon } from '@heroicons/react/24/outline';
import copy from 'copy-to-clipboard';

export function CopyButton({
                               text,
                               title = 'Copy',
                               className = '',
                           }: {
    text?: string | null;
    title?: string;
    className?: string;
}) {
    const [copied, setCopied] = React.useState(false);
    if (!text) return null;

    return (
        <button
            type="button"
            title={copied ? 'Copied' : title}
            onClick={() => {
                if (!text) return;
                copy(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1000);
            }}
            className={`inline-flex items-center justify-center h-7 w-7 rounded hover:bg-gray-200 ${className}`}
        >
            {copied ? <CheckIcon className="h-4 w-4 text-green-600" /> : <ClipboardIcon className="h-4 w-4 text-gray-600" />}
        </button>
    );
}

export function InlineCopy({
                               value,
                               className = '',
                           }: {
    value?: string | null;
    className?: string;
}) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <code className="font-mono text-xs bg-gray-100 rounded px-2 py-1 break-all">{value || '—'}</code>
            <CopyButton text={value} />
        </div>
    );
}