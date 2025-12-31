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
    TowerControl,
    Dice6,
    Bomb,
    Trophy,
    Volume2,
    VolumeX,
    Sun,
    Moon,
    Wallet,
    Twitter,
    MessageCircle,
} from './icons';
import styles from './Navbar.module.css';

export function NavbarContent() {
    const pathname = usePathname();
    const { primaryWallet } = useDynamicContext();
    const { theme, toggleTheme } = useTheme();
    const { soundEnabled, toggleSound } = useSound();
    const { demoMode, toggleDemoMode, effectiveBalance } = useGame();

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

                    {/* Desktop Navigation Links */}
                    <div className={styles.nav}>
                        <Link
                            href="/games/tower"
                            className={`${styles.navLink} ${isActiveLink('/games/tower') ? styles.navLinkActive : ''}`}
                        >
                            <TowerControl size={18} style={iconStyle('var(--neon-cyan)', isActiveLink('/games/tower'))} />
                            Tower
                        </Link>
                        <Link
                            href="/games/dice"
                            className={`${styles.navLink} ${isActiveLink('/games/dice') ? styles.navLinkActive : ''}`}
                        >
                            <Dice6 size={18} style={iconStyle('var(--neon-green)', isActiveLink('/games/dice'))} />
                            Dice
                        </Link>
                        <Link
                            href="/games/crash"
                            className={`${styles.navLink} ${isActiveLink('/games/crash') ? styles.navLinkActive : ''}`}
                        >
                            <Bomb size={18} style={iconStyle('var(--neon-pink)', isActiveLink('/games/crash'))} />
                            Cannon
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
                        {/* Balance Display */}
                        <div className={styles.balance}>
                            {demoMode && <span className={styles.demoTag}>DEMO</span>}
                            <span className={styles.balanceAmount}>
                                ${effectiveBalance.toFixed(2)}
                            </span>
                        </div>

                        {/* Deposit/Withdraw buttons for connected wallet */}
                        {primaryWallet && !demoMode && (
                            <div className={styles.walletActions}>
                                <button onClick={openDeposit} className={styles.depositBtn}>
                                    Deposit
                                </button>
                                <button onClick={openWithdraw} className={styles.withdrawBtn}>
                                    Withdraw
                                </button>
                            </div>
                        )}

                        {/* Desktop Controls */}
                        <div className={styles.controls}>
                            {/* Demo Mode Toggle */}
                            <button
                                onClick={toggleDemoMode}
                                className={styles.iconBtn}
                                title={demoMode ? 'Exit Demo Mode' : 'Enter Demo Mode'}
                            >
                                {demoMode ? (
                                    <Dice6 size={20} style={controlIconStyle} />
                                ) : (
                                    <Wallet size={20} style={controlIconStyle} />
                                )}
                            </button>

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

                        {/* Wallet */}
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
                        {demoMode && <span className={styles.demoTag}>DEMO</span>}
                        <span className={styles.mobileBalanceAmount}>
                            ${effectiveBalance.toFixed(2)}
                        </span>
                    </div>

                    {/* Mobile Navigation */}
                    <nav className={styles.mobileNav}>
                        <Link
                            href="/games/tower"
                            className={`${styles.mobileNavLink} ${isActiveLink('/games/tower') ? styles.mobileNavLinkActive : ''}`}
                        >
                            <span className={styles.mobileNavIcon}>
                                <TowerControl size={24} style={{ color: 'var(--neon-cyan)' }} />
                            </span>
                            Tower
                        </Link>
                        <Link
                            href="/games/dice"
                            className={`${styles.mobileNavLink} ${isActiveLink('/games/dice') ? styles.mobileNavLinkActive : ''}`}
                        >
                            <span className={styles.mobileNavIcon}>
                                <Dice6 size={24} style={{ color: 'var(--neon-green)' }} />
                            </span>
                            Dice
                        </Link>
                        <Link
                            href="/games/crash"
                            className={`${styles.mobileNavLink} ${isActiveLink('/games/crash') ? styles.mobileNavLinkActive : ''}`}
                        >
                            <span className={styles.mobileNavIcon}>
                                <Bomb size={24} style={{ color: 'var(--neon-pink)' }} />
                            </span>
                            Cannon
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
                            onClick={toggleDemoMode}
                            className={styles.mobileControlBtn}
                        >
                            <span>
                                {demoMode ? (
                                    <Dice6 size={20} style={{ color: 'var(--neon-cyan)' }} />
                                ) : (
                                    <Wallet size={20} style={{ color: 'var(--neon-cyan)' }} />
                                )}
                            </span>
                            {demoMode ? 'Exit Demo' : 'Demo Mode'}
                        </button>
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
                    {primaryWallet && !demoMode && (
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
