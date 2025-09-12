'use client';

import React, { useEffect, useState, Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog, Disclosure, Transition } from '@headlessui/react';
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
    LinkIcon,
    RectangleStackIcon,
    XMarkIcon,
    Bars3Icon,
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    // --- PATH HELPER: match exact or deeper subpaths on segment boundaries ---
    const pathStartsWith = (path: string, href?: string) => {
        if (!href) return false;
        if (path === href) return true;
        // ensure we don't mark /domains as active for /domain
        return path.startsWith(href.endsWith('/') ? href : `${href}/`);
    };

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
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/companies/${hash}/name`, {
                    headers: authHeaders(),
                });
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
            ],
        },
        {
            title: 'Messaging',
            icon: EnvelopeOpenIcon,
            children: [
                { title: 'SMTP credentials', href: `${base}/messaging/smtp` },
                { title: 'IP pools', href: `${base}/ip-pools` },
                { title: 'Messages', href: `${base}/messaging/messages` },
                { title: 'Events', href: `${base}/messaging/events` },
                { title: 'Inbound routes', href: `${base}/inbound/routes` },
                { title: 'Inbound messages', href: `${base}/inbound/messages` },
            ],
        },
        {
            title: 'Contacts',
            icon: UsersIcon,
            children: [
                { title: 'Contacts', href: `${base}/contacts` },
                { title: 'Lists', href: `${base}/lists` },
                { title: 'Segments', href: `${base}/segments` },
            ],
        },
        {
            title: 'Automation',
            icon: RectangleStackIcon,
            children: [
                { title: 'Templates', href: `${base}/templates` },
                { title: 'Campaigns', href: `${base}/campaigns` },
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
            ],
        },
        {
            title: 'Settings',
            icon: Cog6ToothIcon,
            children: [
                { title: 'Users', href: `${base}/settings/users` },
                { title: 'API keys', href: `${base}/settings/apikeys`, icon: KeyIcon },
                { title: 'Company info', href: `${base}/settings/company`, icon: BuildingOffice2Icon },
                { title: 'Billing', href: `${base}/settings/billing`, icon: CreditCardIcon },
            ],
        },
    ];

    // --- ACTIVE CHECKS ---
    const isActiveExact = (href?: string) => !!href && pathname === href;
    const isActiveDeep = (href?: string) => pathStartsWith(pathname, href);

    const isSectionActive = (section: Item): boolean => {
        const childrenActive = (section.children ?? []).some((c) => isActiveDeep(c.href));
        const selfActive = isActiveDeep(section.href);
        return childrenActive || selfActive;
    };

    // Sidebar content component (reusable for both desktop and mobile)
    const SidebarContent = () => (
        <>
            {/* Company header */}
            <div className="px-4 py-4 border-b border-gray-200">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Company</div>
                <div className="font-semibold truncate text-gray-900">{companyName || '—'}</div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto p-2">
                <ul className="space-y-1">
                    {nav.map((item) => {
                        const hasChildren = (item.children?.length ?? 0) > 0;

                        if (hasChildren) {
                            const active = isSectionActive(item);

                            return (
                                <li key={item.title}>
                                    <Disclosure defaultOpen={active} key={`${item.title}-${active ? 'open' : 'closed'}`}>
                                        {({ open }) => (
                                            <div>
                                                <Disclosure.Button
                                                    className={classNames(
                                                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                                                        active
                                                            ? 'bg-blue-50 text-blue-700 font-semibold'
                                                            : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
                                                    )}
                                                    aria-expanded={open}
                                                    aria-current={active ? 'page' : undefined}
                                                >
                                                    <span className="flex items-center gap-3">
                                                        {item.icon ? <item.icon className="h-5 w-5 flex-shrink-0" /> : null}
                                                        <span className="font-medium">{item.title}</span>
                                                    </span>
                                                    <ChevronDownIcon
                                                        className={classNames(
                                                            'h-4 w-4 flex-shrink-0 transition-transform duration-200',
                                                            open ? 'rotate-180' : ''
                                                        )}
                                                    />
                                                </Disclosure.Button>

                                                <Transition
                                                    enter="transition duration-100 ease-out"
                                                    enterFrom="transform scale-95 opacity-0"
                                                    enterTo="transform scale-100 opacity-100"
                                                    leave="transition duration-75 ease-out"
                                                    leaveFrom="transform scale-100 opacity-100"
                                                    leaveTo="transform scale-95 opacity-0"
                                                >
                                                    <Disclosure.Panel>
                                                        <ul className="mt-1 ml-2 pl-4 border-l-2 border-gray-100 space-y-1">
                                                            {(item.children ?? []).map((child) => {
                                                                const activeChild = isActiveDeep(child.href);
                                                                return (
                                                                    <li key={child.title}>
                                                                        <Link
                                                                            href={child.href ?? '#'}
                                                                            className={classNames(
                                                                                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150',
                                                                                activeChild
                                                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                                                    : 'hover:bg-gray-50 text-gray-600 hover:text-gray-900'
                                                                            )}
                                                                            aria-current={activeChild ? 'page' : undefined}
                                                                        >
                                                                            {child.icon ? (
                                                                                <child.icon className="h-4 w-4 flex-shrink-0" />
                                                                            ) : (
                                                                                <span
                                                                                    className={classNames(
                                                                                        'h-1.5 w-1.5 rounded-full flex-shrink-0',
                                                                                        activeChild ? 'bg-white' : 'bg-gray-400'
                                                                                    )}
                                                                                />
                                                                            )}
                                                                            <span>{child.title}</span>
                                                                        </Link>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </Disclosure.Panel>
                                                </Transition>
                                            </div>
                                        )}
                                    </Disclosure>
                                </li>
                            );
                        }

                        // single-level
                        const activeSingle = isActiveExact(item.href);
                        return (
                            <li key={item.title}>
                                <Link
                                    href={item.href ?? '#'}
                                    className={classNames(
                                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                                        activeSingle
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
                                    )}
                                    aria-current={activeSingle ? 'page' : undefined}
                                >
                                    {item.icon ? <item.icon className="h-5 w-5 flex-shrink-0" /> : null}
                                    <span className="font-medium">{item.title}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </>
    );

    return (
        <>
            {/* Mobile menu button */}
            <button
                type="button"
                className="lg:hidden fixed top-4 left-4 z-50 inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-700 shadow-lg hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                onClick={() => setMobileMenuOpen(true)}
            >
                <span className="sr-only">Open sidebar</span>
                <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Mobile sidebar */}
            <Transition.Root show={mobileMenuOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50 lg:hidden" onClose={setMobileMenuOpen}>
                    <Transition.Child
                        as={Fragment}
                        enter="transition-opacity ease-linear duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity ease-linear duration-300"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 flex">
                        <Transition.Child
                            as={Fragment}
                            enter="transition ease-in-out duration-300 transform"
                            enterFrom="-translate-x-full"
                            enterTo="translate-x-0"
                            leave="transition ease-in-out duration-300 transform"
                            leaveFrom="translate-x-0"
                            leaveTo="-translate-x-full"
                        >
                            <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                                <Transition.Child
                                    as={Fragment}
                                    enter="ease-in-out duration-300"
                                    enterFrom="opacity-0"
                                    enterTo="opacity-100"
                                    leave="ease-in-out duration-300"
                                    leaveFrom="opacity-100"
                                    leaveTo="opacity-0"
                                >
                                    <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                                        <button
                                            type="button"
                                            className="-m-2.5 p-2.5"
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            <span className="sr-only">Close sidebar</span>
                                            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                                        </button>
                                    </div>
                                </Transition.Child>

                                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white">
                                    <SidebarContent />
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </Dialog>
            </Transition.Root>

            {/* Desktop sidebar */}
            <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:z-40 border-r border-gray-200 bg-white">
                <div className="flex grow flex-col">
                    <SidebarContent />
                </div>
            </aside>
        </>
    );
}