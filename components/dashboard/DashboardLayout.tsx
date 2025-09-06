'use client';

import React from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import RightMenu from '@/components/dashboard/RightMenu';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CompanySidebar from '@/components/company/CompanySidebar';

interface DashboardLayoutProps {
    user: { fullName: string; avatarUrl: { url: string } };
    children: React.ReactNode;
}

export default function DashboardLayout({ user, children }: DashboardLayoutProps) {
    const rawPath = usePathname() || '';
    const pathname = rawPath.replace(/\/+$/, ''); // normalize trailing slash

    const isCompanyRoute = pathname.startsWith('/dashboard/company/');
    const isNewCompanyPage = pathname === '/dashboard/company/new';
    const showCompanySidebar = isCompanyRoute && !isNewCompanyPage;

    return (
        <div className="min-h-screen flex flex-col">
            {/* Top nav */}
            <nav className="bg-white border-b border-gray-200 relative z-30">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        {/* Left: burger + logo */}
                        <div className="flex items-center">
                            {/* This button is now handled by CompanySidebar on company routes */}
                            {!showCompanySidebar && (
                                <button className="lg:hidden p-2 rounded-md hover:bg-gray-100">
                                    <Bars3Icon className="h-6 w-6 text-gray-600" />
                                    <span className="sr-only">Open sidebar</span>
                                </button>
                            )}
                            {/* Add left margin on desktop when sidebar is shown to avoid overlap */}
                            <Link
                                href="/dashboard"
                                className={classNames(
                                    "ml-4",
                                    showCompanySidebar && "lg:ml-[19rem]" // 72 (sidebar width) + 4 (margin) = 76 = 19rem
                                )}
                            >
                                <Image
                                    className="h-10 w-auto"
                                    src="/logo.svg"
                                    alt="Logo"
                                    width={300}
                                    height={120}
                                    priority
                                />
                            </Link>
                        </div>

                        {/* Right: user menu */}
                        {user?.fullName ? <RightMenu user={user} /> : null}
                    </div>
                </div>
            </nav>

            {/* Body */}
            <div className="flex-1 flex">
                {showCompanySidebar && <CompanySidebar />}

                {/* Main content with proper left margin when sidebar is visible */}
                <main
                    className={classNames(
                        "flex-1 bg-gray-50 p-4 sm:p-6 lg:p-8 min-w-0", // min-w-0 prevents content from pushing out
                        showCompanySidebar && "lg:ml-72" // Add left margin on desktop to account for fixed sidebar
                    )}
                >
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

// Helper function for classNames
function classNames(...s: Array<string | false | null | undefined>) {
    return s.filter(Boolean).join(' ');
}