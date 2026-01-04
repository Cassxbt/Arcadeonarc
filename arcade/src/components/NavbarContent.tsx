'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDynamicContext, DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { useTheme } from '@/lib/theme';
import { useSound } from '@/lib/sounds';
import { useGame } from '@/lib/game-context';
import { DepositModal } from './DepositModal';
import {
    Gamepad2,
    HelpCircle,
    BarChart3,
    Trophy,
    Volume2,
    VolumeX,
    Sun,
    Moon,
    Twitter,
    MessageCircle,
} from './icons';
import styles from './Navbar.module.css';

export function NavbarContent() {
    const pathname = usePathname();
    const { primaryWallet } = useDynamicContext();
    const { theme, toggleTheme } = useTheme();
    const { soundEnabled, toggleSound } = useSound();
    const { balance } = useGame();

    const [depositModalOpen, setDepositModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'deposit' | 'withdraw'>('deposit');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileMenuOpen]);

    const openDeposit = () => {
        setModalMode('deposit');
        setDepositModalOpen(true);
        setMobileMenuOpen(false);
    };

    const openWithdraw = () => {
        setModalMode('withdraw');
        setDepositModalOpen(true);
        setMobileMenuOpen(false);
    };

    const isActiveLink = (href: string) => pathname === href;

    // Icon style helper
    const iconStyle = (color: string, glow: boolean = false) => ({
        color,
        filter: glow ? `drop-shadow(0 0 8px ${color})` : undefined,
        verticalAlign: 'middle',
        marginRight: '0.5rem',
    });

    const controlIconStyle = {
        color: 'var(--neon-cyan)',
        filter: 'drop-shadow(0 0 6px var(--neon-cyan))',
    };

    // Get display balance - real balance when connected, 0 otherwise
    const displayBalance = primaryWallet ? balance : 0;

    return (
        <>
            <nav className={styles.navbar}>
                <div className={styles.container}>
                    {/* Logo */}
                    <Link href="/" className={styles.logo}>
                        <span className={styles.logoIcon}>
                            <Gamepad2 size={28} style={{ color: 'var(--neon-pink)', filter: 'drop-shadow(0 0 10px var(--neon-pink))' }} />
                        </span>
                        <span className={styles.logoText}>ARCade</span>
                    </Link>

                    {/* Desktop Navigation Links - FAQ, STATS, LEADERBOARD */}
                    <div className={styles.nav}>
                        <Link
                            href="/faq"
                            className={`${styles.navLink} ${isActiveLink('/faq') ? styles.navLinkActive : ''}`}
                        >
                            <HelpCircle size={18} style={iconStyle('var(--neon-cyan)', isActiveLink('/faq'))} />
                            FAQ
                        </Link>
                        <Link
                            href="/stats"
                            className={`${styles.navLink} ${isActiveLink('/stats') ? styles.navLinkActive : ''}`}
                        >
                            <BarChart3 size={18} style={iconStyle('var(--neon-green)', isActiveLink('/stats'))} />
                            Stats
                        </Link>
                        <Link
                            href="/leaderboard"
                            className={`${styles.navLink} ${isActiveLink('/leaderboard') ? styles.navLinkActive : ''}`}
                        >
                            <Trophy size={18} style={iconStyle('var(--neon-yellow)', isActiveLink('/leaderboard'))} />
                            Leaderboard
                        </Link>
                    </div>

                    {/* Right side */}
                    <div className={styles.right}>
                        {/* Real-time USDC Balance Display */}
                        <div className={styles.balance}>
                            <span className={styles.balanceLabel}>USDC</span>
                            <span className={styles.balanceAmount}>
                                ${displayBalance.toFixed(2)}
                            </span>
                        </div>

                        {/* Deposit/Withdraw buttons for connected wallet */}
                        {primaryWallet && (
                            <div className={styles.walletActions}>
                                <button onClick={openDeposit} className={styles.depositBtn}>
                                    Deposit
                                </button>
                                <button onClick={openWithdraw} className={styles.withdrawBtn}>
                                    Withdraw
                                </button>
                            </div>
                        )}

                        {/* Desktop Controls - Sound and Theme only */}
                        <div className={styles.controls}>
                            {/* Sound Toggle */}
                            <button
                                onClick={toggleSound}
                                className={styles.iconBtn}
                                title={soundEnabled ? 'Mute Sounds' : 'Enable Sounds'}
                            >
                                {soundEnabled ? (
                                    <Volume2 size={20} style={controlIconStyle} />
                                ) : (
                                    <VolumeX size={20} style={controlIconStyle} />
                                )}
                            </button>

                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className={styles.iconBtn}
                                title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                            >
                                {theme === 'dark' ? (
                                    <Sun size={20} style={controlIconStyle} />
                                ) : (
                                    <Moon size={20} style={controlIconStyle} />
                                )}
                            </button>
                        </div>

                        {/* Arcade-styled Wallet/Login Widget */}
                        <div className={styles.walletWidget}>
                            <DynamicWidget />
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className={styles.mobileMenuBtn}
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Toggle menu"
                        >
                            <span className={`${styles.hamburger} ${mobileMenuOpen ? styles.hamburgerOpen : ''}`}>
                                <span></span>
                                <span></span>
                                <span></span>
                            </span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile Drawer */}
            <div className={`${styles.mobileDrawer} ${mobileMenuOpen ? styles.mobileDrawerOpen : ''}`}>
                <div className={styles.mobileDrawerBackdrop} onClick={() => setMobileMenuOpen(false)} />
                <div className={styles.mobileDrawerContent}>
                    {/* Mobile Balance */}
                    <div className={styles.mobileBalance}>
                        <span className={styles.balanceLabel}>USDC</span>
                        <span className={styles.mobileBalanceAmount}>
                            ${displayBalance.toFixed(2)}
                        </span>
                    </div>

                    {/* Mobile Navigation */}
                    <nav className={styles.mobileNav}>
                        <Link
                            href="/faq"
                            className={`${styles.mobileNavLink} ${isActiveLink('/faq') ? styles.mobileNavLinkActive : ''}`}
                        >
                            <span className={styles.mobileNavIcon}>
                                <HelpCircle size={24} style={{ color: 'var(--neon-cyan)' }} />
                            </span>
                            FAQ
                        </Link>
                        <Link
                            href="/stats"
                            className={`${styles.mobileNavLink} ${isActiveLink('/stats') ? styles.mobileNavLinkActive : ''}`}
                        >
                            <span className={styles.mobileNavIcon}>
                                <BarChart3 size={24} style={{ color: 'var(--neon-green)' }} />
                            </span>
                            Stats
                        </Link>
                        <Link
                            href="/leaderboard"
                            className={`${styles.mobileNavLink} ${isActiveLink('/leaderboard') ? styles.mobileNavLinkActive : ''}`}
                        >
                            <span className={styles.mobileNavIcon}>
                                <Trophy size={24} style={{ color: 'var(--neon-yellow)' }} />
                            </span>
                            Leaderboard
                        </Link>
                    </nav>

                    {/* Mobile Controls */}
                    <div className={styles.mobileControls}>
                        <button
                            onClick={toggleSound}
                            className={styles.mobileControlBtn}
                        >
                            <span>
                                {soundEnabled ? (
                                    <Volume2 size={20} style={{ color: 'var(--neon-cyan)' }} />
                                ) : (
                                    <VolumeX size={20} style={{ color: 'var(--neon-cyan)' }} />
                                )}
                            </span>
                            {soundEnabled ? 'Sound On' : 'Sound Off'}
                        </button>
                        <button
                            onClick={toggleTheme}
                            className={styles.mobileControlBtn}
                        >
                            <span>
                                {theme === 'dark' ? (
                                    <Sun size={20} style={{ color: 'var(--neon-cyan)' }} />
                                ) : (
                                    <Moon size={20} style={{ color: 'var(--neon-cyan)' }} />
                                )}
                            </span>
                            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                        </button>
                    </div>

                    {/* Mobile Wallet Actions */}
                    {primaryWallet && (
                        <div className={styles.mobileWalletActions}>
                            <button onClick={openDeposit} className={styles.mobileDepositBtn}>
                                Deposit
                            </button>
                            <button onClick={openWithdraw} className={styles.mobileWithdrawBtn}>
                                Withdraw
                            </button>
                        </div>
                    )}

                    {/* Mobile Social Links */}
                    <div className={styles.mobileSocials}>
                        <a href="https://twitter.com/ArcadeOnArc" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                            <Twitter size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                            Twitter
                        </a>
                        <a href="https://discord.com/invite/arcnetwork" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                            <MessageCircle size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                            Discord
                        </a>
                    </div>

                    {/* Mobile Wallet Widget */}
                    <div className={styles.mobileWalletWidget}>
                        <DynamicWidget />
                    </div>
                </div>
            </div>

            {/* Deposit/Withdraw Modal */}
            <DepositModal
                isOpen={depositModalOpen}
                onClose={() => setDepositModalOpen(false)}
                mode={modalMode}
            />
        </>
    );
}
