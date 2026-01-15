'use client';

import dynamic from 'next/dynamic';

const NavbarContent = dynamic(
    () => import('./NavbarContent').then(mod => mod.NavbarContent),
    { ssr: false }
);

export function Navbar() {
    return <NavbarContent />;
}
