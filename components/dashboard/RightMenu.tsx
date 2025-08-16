// components/dashboard/RightMenu.tsx
"use client";

import React from "react";
import { Menu } from "@headlessui/react";
import { BellIcon } from "@heroicons/react/24/outline";
import Image from "next/image";

interface RightMenuProps {
    user: {
        fullName: string;
        avatarUrl: {
            url: string;
        };
    };
}

export default function RightMenu({ user }: RightMenuProps) {
    const initial = user.fullName.charAt(0).toUpperCase();
    const avatarPath = user.avatarUrl?.url;
    const avatarSrc = avatarPath
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}${avatarPath}`
        : null;

    const handleLogout = () => {
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/logout`, { method: "POST" })
            .then(() => {
                localStorage.removeItem("jwt");
                window.location.href = "/login";
            });
    };

    return (
        <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button className="p-2 rounded-full hover:bg-gray-100">
                <BellIcon className="h-6 w-6 text-gray-600" />
                <span className="sr-only">View notifications</span>
            </button>

            {/* User dropdown */}
            <Menu as="div" className="relative">
                <Menu.Button className="flex items-center text-sm rounded-full hover:bg-gray-100 p-1 data-active:bg-gray-100">
                    {avatarSrc ? (
                        <div className="relative h-8 w-8">
                            <Image
                                src={avatarSrc}
                                alt={user.fullName}
                                fill
                                sizes="32px"
                                className="rounded-full object-cover"
                                unoptimized   // required if domain is not configured in next.config.js
                            />
                        </div>
                    ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-medium">
                            {initial}
                        </div>
                    )}
                    <span className="ml-2 text-gray-700 font-medium">
            {user.fullName}
          </span>
                </Menu.Button>

                <Menu.Items
                    className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1
                     shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none
                     transition duration-100 ease-out transform data-closed:scale-95 data-closed:opacity-0"
                >
                    <Menu.Item
                        as="button"
                        onClick={() => window.location.href = "/dashboard/profile/user"}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        Account Settings
                    </Menu.Item>
                    <Menu.Item
                        as="button"
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100"
                    >
                        Logout
                    </Menu.Item>
                </Menu.Items>
            </Menu>
        </div>
    );
}