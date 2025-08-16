'use client';

import React from 'react';
import { ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export function badgeClasses(status?: string | null) {
    switch (status) {
        case 'active':  return 'bg-green-100 text-green-800';
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'failed':  return 'bg-red-100 text-red-800';
        default:        return 'bg-gray-100 text-gray-800';
    }
}

export function StatusIcon({ status }: { status?: string | null }) {
    if (status === 'active') return <ShieldCheckIcon className="h-4 w-4 mr-1" />;
    return <ExclamationTriangleIcon className="h-4 w-4 mr-1" />;
}

export function StatusBadge({ status }: { status?: string | null }) {
    return (
        <span className={`inline-flex items-center px-2 py-1 text-[11px] font-medium rounded ${badgeClasses(status)}`}>
      <StatusIcon status={status} />
            {status ?? 'unknown'}
    </span>
    );
}