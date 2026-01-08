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
    X,
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

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

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

            {/* Full-Screen Mobile Menu Overlay */}
            <div className={`${styles.mobileOverlay} ${mobileMenuOpen ? styles.mobileOverlayOpen : ''}`}>
                {/* Frosted backdrop */}
                <div className={styles.mobileBackdrop} onClick={() => setMobileMenuOpen(false)} />

                {/* Menu Content */}
                <div className={styles.mobileMenuContent}>
                    {/* Close Button */}
                    <button
                        className={styles.closeBtn}
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        <X size={28} />
                    </button>

                    {/* Balance Card */}
                    <div className={`${styles.mobileBalanceCard} ${styles.menuItem} ${styles.menuItem1}`}>
                        <span className={styles.balanceLabel}>USDC</span>
                        <span className={styles.mobileBalanceValue}>
                            ${displayBalance.toFixed(2)}
                        </span>
                    </div>

                    {/* Primary Navigation */}
                    <nav className={styles.mobileNavSection}>
                        <Link
                            href="/faq"
                            className={`${styles.mobileMenuItem} ${styles.menuItem} ${styles.menuItem2} ${isActiveLink('/faq') ? styles.mobileMenuItemActive : ''}`}
                        >
                            <span className={styles.menuItemIcon}>
                                <HelpCircle size={24} />
                            </span>
                            <span className={styles.menuItemText}>FAQ</span>
                        </Link>
                        <Link
                            href="/stats"
                            className={`${styles.mobileMenuItem} ${styles.menuItem} ${styles.menuItem3} ${isActiveLink('/stats') ? styles.mobileMenuItemActive : ''}`}
                        >
                            <span className={styles.menuItemIcon}>
                                <BarChart3 size={24} />
                            </span>
                            <span className={styles.menuItemText}>Stats</span>
                        </Link>
                        <Link
                            href="/leaderboard"
                            className={`${styles.mobileMenuItem} ${styles.menuItem} ${styles.menuItem4} ${isActiveLink('/leaderboard') ? styles.mobileMenuItemActive : ''}`}
                        >
                            <span className={styles.menuItemIcon}>
                                <Trophy size={24} />
                            </span>
                            <span className={styles.menuItemText}>Leaderboard</span>
                        </Link>
                    </nav>

                    {/* Controls Row */}
                    <div className={`${styles.mobileControlsRow} ${styles.menuItem} ${styles.menuItem5}`}>
                        <button
                            onClick={toggleSound}
                            className={styles.mobileControlItem}
                        >
                            {soundEnabled ? (
                                <Volume2 size={22} />
                            ) : (
                                <VolumeX size={22} />
                            )}
                            <span>{soundEnabled ? 'Sound On' : 'Sound Off'}</span>
                        </button>
                        <div className={styles.controlDivider} />
                        <button
                            onClick={toggleTheme}
                            className={styles.mobileControlItem}
                        >
                            {theme === 'dark' ? (
                                <Sun size={22} />
                            ) : (
                                <Moon size={22} />
                            )}
                            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                        </button>
                    </div>

                    {/* Wallet Actions */}
                    {primaryWallet && (
                        <div className={`${styles.mobileWalletRow} ${styles.menuItem} ${styles.menuItem6}`}>
                            <button onClick={openDeposit} className={styles.mobileDepositBtn}>
                                Deposit
                            </button>
                            <button onClick={openWithdraw} className={styles.mobileWithdrawBtn}>
                                Withdraw
                            </button>
                        </div>
                    )}

                    {/* Social Links */}
                    <div className={`${styles.mobileSocialRow} ${styles.menuItem} ${styles.menuItem7}`}>
                        <a href="https://twitter.com/ArcadeOnArc" target="_blank" rel="noopener noreferrer" className={styles.mobileSocialLink}>
                            <Twitter size={20} />
                        </a>
                        <a href="https://discord.com/invite/arcnetwork" target="_blank" rel="noopener noreferrer" className={styles.mobileSocialLink}>
                            <MessageCircle size={20} />
                        </a>
                    </div>

                    {/* Login/Wallet Widget - Bottom CTA */}
                    <div className={`${styles.mobileWalletCTA} ${styles.menuItem} ${styles.menuItem8}`}>
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
