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
    const pathname = usePathname();
    const showCompanySidebar = pathname?.startsWith('/dashboard/company/');

    return (
        <div className="min-h-screen flex flex-col">
            {/* Top nav */}
            <nav className="bg-white border-b border-gray-200">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        {/* Left: burger + logo */}
                        <div className="flex items-center">
                            <button className="lg:hidden p-2 rounded-md hover:bg-gray-100">
                                <Bars3Icon className="h-6 w-6 text-gray-600" />
                                <span className="sr-only">Open sidebar</span>
                            </button>
                            <Link href="/dashboard" className="ml-4">
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

            {/* Body: conditionally show the company sidebar */}
            {showCompanySidebar ? (
                <div className="flex flex-1">
                    <CompanySidebar />
                    <main className="flex-1 bg-gray-50 p-6">{children}</main>
                </div>
            ) : (
                <main className="flex-1 bg-gray-50 p-6">{children}</main>
            )}
        </div>
    );
}