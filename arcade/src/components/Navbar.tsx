'use client';

import dynamic from 'next/dynamic';

// Dynamically import Navbar with no SSR to avoid hydration issues
const NavbarContent = dynamic(
    () => import('./NavbarContent').then(mod => mod.NavbarContent),
    { ssr: false }
);

export function Navbar() {
    return <NavbarContent />;
}
