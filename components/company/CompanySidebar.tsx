'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Disclosure } from '@headlessui/react';
import {
    ChevronDownIcon,
    BuildingOffice2Icon,
    GlobeAltIcon,
    EnvelopeOpenIcon,
    UsersIcon,
    ChartBarIcon,
    Cog6ToothIcon,
    KeyIcon,
    CreditCardIcon,
    FolderIcon,
    LinkIcon,
    RectangleStackIcon,
} from '@heroicons/react/24/outline';

type Item = {
    title: string;
    href?: string;
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    children?: Item[];
};

function classNames(...s: Array<string | false | null | undefined>) {
    return s.filter(Boolean).join(' ');
}

export default function CompanySidebar() {
    const pathname = usePathname() ?? '';
    const [companyName, setCompanyName] = useState<string | null>(null);
    const [hash, setHash] = useState<string | null>(null);

    // Extract hash from URL: `/dashboard/company/{hash}/...`
    useEffect(() => {
        const parts = pathname.split('/');
        const hashIndex = parts.findIndex((p) => p === 'company') + 1;
        if (hashIndex > 0 && parts[hashIndex]) {
            setHash(parts[hashIndex]);
        }
    }, [pathname]);

    // Fetch company name when hash is available
    const authHeaders = (): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    };

    useEffect(() => {
        if (!hash) return;
        (async () => {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/name`,
                    { headers: authHeaders() }
                );
                if (!res.ok) throw new Error(`Failed: ${res.status}`);
                const data = await res.json();
                setCompanyName(data?.name ?? '—');
            } catch (err) {
                console.error(err);
                setCompanyName('—');
            }
        })();
    }, [hash]);

    const base = hash ? `/dashboard/company/${hash}` : '#';

    const nav: Item[] = [
        { title: 'Overview', href: `${base}`, icon: BuildingOffice2Icon },
        {
            title: 'Domains',
            icon: GlobeAltIcon,
            children: [
                { title: 'All domains', href: `${base}/domain` },
                { title: 'Add domain', href: `${base}/domain/new` },
            ],
        },
        {
            title: 'Messaging',
            icon: EnvelopeOpenIcon,
            children: [
                { title: 'SMTP credentials', href: `${base}/smtp` },
                { title: 'IP pools', href: `${base}/ip-pools` },
                { title: 'Messages', href: `${base}/messages` },
                { title: 'Inbound routes', href: `${base}/inbound/routes` },
                { title: 'Inbound messages', href: `${base}/inbound/messages` },
            ],
        },
        {
            title: 'Contacts',
            icon: UsersIcon,
            children: [
                { title: 'Lists', href: `${base}/lists` },
                { title: 'Segments', href: `${base}/segments` },
                { title: 'Contacts', href: `${base}/contacts` },
            ],
        },
        {
            title: 'Automation',
            icon: RectangleStackIcon,
            children: [
                { title: 'Campaigns', href: `${base}/campaigns` },
                { title: 'Automations', href: `${base}/automations` },
                { title: 'Templates', href: `${base}/templates` },
            ],
        },
        {
            title: 'Analytics',
            icon: ChartBarIcon,
            children: [
                { title: 'Usage', href: `${base}/usage` },
                { title: 'Reputation', href: `${base}/reputation` },
                { title: 'DMARC', href: `${base}/dmarc` },
                { title: 'TLS reports', href: `${base}/tlsrpt` },
            ],
        },
        {
            title: 'Integrations',
            icon: LinkIcon,
            children: [
                { title: 'Webhooks', href: `${base}/webhooks` },
                { title: 'Inbound', href: `${base}/inbound` },
            ],
        },
        {
            title: 'Settings',
            icon: Cog6ToothIcon,
            children: [
                { title: 'Users', href: `${base}/users` },
                { title: 'API keys', href: `${base}/api-keys`, icon: KeyIcon },
                { title: 'Billing', href: `${base}/billing`, icon: CreditCardIcon },
                { title: 'Files', href: `${base}/files`, icon: FolderIcon },
            ],
        },
    ];

    const isActive = (href?: string) => !!href && pathname === href;
    const isSectionActive = (section: Item): boolean => {
        const childrenActive = (section.children ?? []).some((c) =>
            pathname.startsWith(c.href ?? '')
        );
        const selfActive = !!(section.href && pathname.startsWith(section.href));
        return childrenActive || selfActive;
    };

    return (
        <aside className="w-72 shrink-0 border-r border-gray-200 bg-white">
            {/* Company header */}
            <div className="px-4 py-4 border-b">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Company
                </div>
                <div className="font-semibold truncate">{companyName || '—'}</div>
            </div>

            {/* Nav */}
            <nav className="p-2">
                <ul className="space-y-1">
                    {nav.map((item) => {
                        if ((item.children?.length ?? 0) > 0) {
                            const active = isSectionActive(item);
                            return (
                                <li key={item.title}>
                                    <Disclosure defaultOpen={active}>
                                        {({ open }) => (
                                            <div>
                                                <Disclosure.Button
                                                    className={classNames(
                                                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm',
                                                        active
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'hover:bg-gray-50 text-gray-700'
                                                    )}
                                                >
                          <span className="flex items-center gap-2">
                            {item.icon ? <item.icon className="h-5 w-5" /> : null}
                              <span className="font-medium">{item.title}</span>
                          </span>
                                                    <ChevronDownIcon
                                                        className={classNames(
                                                            'h-5 w-5 transition-transform',
                                                            open ? 'rotate-180' : ''
                                                        )}
                                                    />
                                                </Disclosure.Button>

                                                <Disclosure.Panel>
                                                    <ul className="mt-1 ml-2 pl-4 border-l border-gray-200 space-y-1">
                                                        {(item.children ?? []).map((child) => {
                                                            const activeChild = isActive(child.href);
                                                            return (
                                                                <li key={child.title}>
                                                                    <Link
                                                                        href={child.href ?? '#'}
                                                                        className={classNames(
                                                                            'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
                                                                            activeChild
                                                                                ? 'bg-blue-600 text-white'
                                                                                : 'hover:bg-gray-50 text-gray-700'
                                                                        )}
                                                                    >
                                                                        {child.icon ? (
                                                                            <child.icon className="h-4 w-4" />
                                                                        ) : (
                                                                            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                                                                        )}
                                                                        <span>{child.title}</span>
                                                                    </Link>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </Disclosure.Panel>
                                            </div>
                                        )}
                                    </Disclosure>
                                </li>
                            );
                        }

                        // single-level
                        return (
                            <li key={item.title}>
                                <Link
                                    href={item.href ?? '#'}
                                    className={classNames(
                                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                                        isActive(item.href)
                                            ? 'bg-blue-600 text-white'
                                            : 'hover:bg-gray-50 text-gray-700'
                                    )}
                                >
                                    {item.icon ? <item.icon className="h-5 w-5" /> : null}
                                    <span className="font-medium">{item.title}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </aside>
    );
}