'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDynamicContext, DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { useTheme } from '@/lib/theme';
import { useSound } from '@/lib/sounds';
import { useGame } from '@/lib/game-context';
import { DepositModal } from './DepositModal';
import { CashierWidget } from './CashierWidget';
import { UserWidget } from './UserWidget';
import {
    Gamepad2,
    HelpCircle,
    BarChart3,
    Trophy,
    Target,
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
    const { balance, username } = useGame();

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
    const displayUsername = username || (primaryWallet ? `${primaryWallet.address.slice(0, 6)}...` : 'Guest');

    return (
        <>
            <nav className={styles.navbar}>
                <div className={styles.container}>
                    <Link href="/" className={styles.logo}>
                        <span className={styles.logoIcon}>
                            <Gamepad2 size={28} style={{ color: 'var(--neon-pink)', filter: 'drop-shadow(0 0 10px var(--neon-pink))' }} />
                        </span>
                        <span className={styles.logoText}>ARCade</span>
                    </Link>

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
                            href="/quests"
                            className={`${styles.navLink} ${isActiveLink('/quests') ? styles.navLinkActive : ''}`}
                        >
                            <Target size={18} style={iconStyle('var(--neon-pink)', isActiveLink('/quests'))} />
                            Quests
                        </Link>
                        <Link
                            href="/leaderboard"
                            className={`${styles.navLink} ${isActiveLink('/leaderboard') ? styles.navLinkActive : ''}`}
                        >
                            <Trophy size={18} style={iconStyle('var(--neon-yellow)', isActiveLink('/leaderboard'))} />
                            Leaderboard
                        </Link>
                    </div>


                    <div className={styles.right}>
                        <div className={styles.desktopWidgets}>
                            {primaryWallet && (
                                <>
                                    <UserWidget username={displayUsername} />
                                    <CashierWidget
                                        balance={displayBalance}
                                        onDeposit={openDeposit}
                                        onWithdraw={openWithdraw}
                                    />
                                </>
                            )}
                        </div>

                        <div className={styles.controls}>
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

                        <div className={styles.walletWidget}>
                            <DynamicWidget />
                        </div>

                        <button
                            className={styles.mobileMenuBtn}
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Toggle menu"
                        >
                            <span className={`${styles.hamburger} ${mobileMenuOpen ? styles.hamburgerOpen : ''}`}>
                                ·
                                <span></span>
                                <span></span>
                                <span></span>
                            </span>
                        </button>
                    </div>
                </div>
            </nav>

            <div className={`${styles.mobileOverlay} ${mobileMenuOpen ? styles.mobileOverlayOpen : ''}`}>
                <div className={styles.mobileBackdrop} onClick={() => setMobileMenuOpen(false)} />

                <div className={styles.mobileMenuContent}>
                    <button
                        className={styles.closeBtn}
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        <X size={28} />
                    </button>

                    <div className={`${styles.mobileBalanceCard} ${styles.menuItem} ${styles.menuItem1}`}>
                        <span className={styles.balanceLabel}>USDC</span>
                        <span className={styles.mobileBalanceValue}>
                            ${displayBalance.toFixed(2)}
                        </span>
                    </div>

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
                            href="/quests"
                            className={`${styles.mobileMenuItem} ${styles.menuItem} ${styles.menuItem4} ${isActiveLink('/quests') ? styles.mobileMenuItemActive : ''}`}
                        >
                            <span className={styles.menuItemIcon}>
                                <Target size={24} />
                            </span>
                            <span className={styles.menuItemText}>Quests</span>
                        </Link>
                        <Link
                            href="/leaderboard"
                            className={`${styles.mobileMenuItem} ${styles.menuItem} ${styles.menuItem5} ${isActiveLink('/leaderboard') ? styles.mobileMenuItemActive : ''}`}
                        >
                            <span className={styles.menuItemIcon}>
                                <Trophy size={24} />
                            </span>
                            <span className={styles.menuItemText}>Leaderboard</span>
                        </Link>
                        <Link
                            href="/profile"
                            className={`${styles.mobileMenuItem} ${styles.menuItem} ${styles.menuItem6} ${isActiveLink('/profile') ? styles.mobileMenuItemActive : ''}`}
                        >
                            <span className={styles.menuItemIcon}>
                                <Gamepad2 size={24} />
                            </span>
                            <span className={styles.menuItemText}>Profile</span>
                        </Link>
                    </nav>

                    <div className={`${styles.mobileControlsRow} ${styles.menuItem} ${styles.menuItem7}`}>
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

                    {primaryWallet && (
                        <div className={`${styles.mobileWalletSection} ${styles.menuItem} ${styles.menuItem7}`}>
                            <Link href="/profile" className={styles.mobileProfileBtn}>
                                <div className={styles.mobileUserIcon}>
                                    <Gamepad2 size={20} />
                                </div>
                                <div className={styles.mobileUserInfo}>
                                    <span className={styles.mobileUsername}>{displayUsername}</span>
                                    <span className={styles.mobileViewProfile}>View Profile</span>
                                </div>
                            </Link>

                            <div className={styles.mobileActionButtons}>
                                <button onClick={openDeposit} className={styles.mobileDepositBtn}>
                                    Deposit
                                </button>
                                <button onClick={openWithdraw} className={styles.mobileWithdrawBtn}>
                                    Withdraw
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={`${styles.mobileControlsRow} ${styles.menuItem} ${styles.menuItem8}`}>

                        <div className={`${styles.mobileSocialRow} ${styles.menuItem} ${styles.menuItem9}`}>
                            <a href="https://twitter.com/ArcadeOnArc" target="_blank" rel="noopener noreferrer" className={styles.mobileSocialLink}>
                                <Twitter size={20} />
                            </a>
                            <a href="https://discord.com/invite/arcnetwork" target="_blank" rel="noopener noreferrer" className={styles.mobileSocialLink}>
                                <MessageCircle size={20} />
                            </a>
                        </div>

                        <div className={`${styles.mobileWalletCTA} ${styles.menuItem} ${styles.menuItem9}`}>
                            <DynamicWidget />
                        </div>
                    </div>
                </div>
            </div>

            <DepositModal
                isOpen={depositModalOpen}
                onClose={() => setDepositModalOpen(false)}
                mode={modalMode}
            />
        </>
    );
}
