'use client';

import React from 'react';
import Link from 'next/link';

export type TabDef = {
    id: string;
    label: string;
};

type TabsProps = {
    tabs: TabDef[];
    activeId: string;
    onChange: (id: string) => void;
    /** Optional: generate an href for each tab (enables middle-click & sharing) */
    linkForId?: (id: string) => string;
    className?: string;
};

export default function Tabs({ tabs, activeId, onChange, linkForId, className }: TabsProps) {
    return (
        <div className={className}>
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-4" aria-label="Tabs">
                    {tabs.map((t) => {
                        const active = t.id === activeId;
                        const baseClasses =
                            "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition";
                        const activeClasses = active
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300";

                        // If linkForId exists, render as <Link>; otherwise as <button>
                        if (linkForId) {
                            const href = linkForId(t.id);
                            return (
                                <Link
                                    key={t.id}
                                    href={href}
                                    onClick={() => {
                                        // Let Next.js handle the client-side nav, but still sync local state
                                        // so panels switch instantly without waiting for URL state effect.
                                        onChange(t.id);
                                    }}
                                    className={[baseClasses, activeClasses].join(' ')}
                                >
                                    {t.label}
                                </Link>
                            );
                        }

                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => onChange(t.id)}
                                className={[baseClasses, activeClasses].join(' ')}
                            >
                                {t.label}
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
