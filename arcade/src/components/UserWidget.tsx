'use client';

import Link from 'next/link';
import { User as UserIcon } from 'lucide-react';
import styles from './Navbar.module.css';

interface UserWidgetProps {
    username: string;
}

export function UserWidget({ username }: UserWidgetProps) {
    return (
        <Link href="/profile" className={styles.userWidget}>
            <div className={styles.userIcon}>
                <UserIcon size={16} color="var(--neon-cyan)" />
            </div>
            <span className={styles.userLabel}>{username}</span>
        </Link>
    );
}
