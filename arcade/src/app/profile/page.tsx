'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useProfile } from '@/lib/useProfile';
import { Trophy, Star, Zap, DollarSign, Gamepad2, Crown, Shield, Activity, Calendar } from 'lucide-react';
import styles from './page.module.css';

export default function ProfilePage() {
    const { user } = useDynamicContext();
    const isAuthenticated = !!user;
    const router = useRouter();
    const { profile, isLoading } = useProfile();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    if (!profile) return null;

    const { user: userData, badges, gameStats, favoriteGame, weeklyPoints } = profile;

    const getRankIcon = (xp: number) => {
        if (xp > 5000) return <Crown size={32} />;
        if (xp > 1000) return <Shield size={32} />;
        return <Star size={32} />;
    };

    return (
        <div className={styles.profilePage}>
            <div className={styles.container}>

                <div className={styles.header}>
                    <div className={styles.identityLeft}>
                        <div className={styles.rankIcon}>
                            {getRankIcon(userData.lifetime_xp)}
                        </div>
                        <div className={styles.userIdentity}>
                            <h1 className={styles.username}>{userData.username || 'Player'}</h1>
                            <div className={styles.walletBadge}>{userData.wallet_address}</div>
                        </div>
                    </div>
                    <div className={styles.joinDate}>
                        <Calendar size={14} style={{ display: 'inline', marginRight: 4 }} />
                        Joined {new Date(userData.created_at).toLocaleDateString()}
                    </div>
                </div>


                <div className={styles.bentoGrid}>


                    <div className={`${styles.card} ${styles.large}`}>
                        <div className={styles.cardLabel}>
                            <Zap size={16} color="var(--neon-cyan)" /> Lifetime XP
                        </div>
                        <div className={styles.heroValue}>{userData.lifetime_xp.toLocaleString()}</div>
                        <div className={styles.xpBarContainer}>
                            <div className={styles.xpBarFill} style={{ width: `${Math.min(userData.lifetime_xp % 1000 / 10, 100)}%` }}></div>
                        </div>
                        <div className={styles.cardSubtext}>Rank 12 • Top 5% OF PLAYERS</div>
                    </div>


                    <div className={`${styles.card} ${styles.medium}`}>
                        <div className={styles.cardLabel}>
                            <Activity size={16} color="var(--neon-green)" /> This Week
                        </div>
                        <div className={styles.cardValue} style={{ color: 'var(--neon-green)' }}>
                            {weeklyPoints.toLocaleString()}
                        </div>
                        <div className={styles.cardSubtext}>{userData.current_streak} Day Streak 🔥</div>
                    </div>


                    <div className={`${styles.card} ${styles.medium}`}>
                        <div className={styles.cardLabel}>
                            <Trophy size={16} color="var(--neon-pink)" /> Win Rate
                        </div>
                        <div className={styles.cardValue} style={{ color: 'var(--neon-pink)' }}>
                            {gameStats.winRate}%
                        </div>
                        <div className={styles.cardSubtext}>{gameStats.totalWins} Wins</div>
                    </div>


                    <div className={`${styles.card} ${styles.medium}`}>
                        <div className={styles.cardLabel}>
                            <DollarSign size={16} color="var(--neon-yellow)" /> Earnings
                        </div>
                        <div className={styles.cardValue} style={{ color: 'var(--neon-yellow)', fontSize: '1.5rem' }}>
                            ${gameStats.totalWon.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className={styles.cardSubtext}>Total Payouts</div>
                    </div>


                    <div className={`${styles.card} ${styles.medium}`}>
                        <div className={styles.cardLabel}>
                            <Gamepad2 size={16} color="#ffffff" /> Returns
                        </div>
                        <div className={styles.cardValue} style={{ color: '#ffffff', fontSize: '1.5rem' }}>
                            ${(gameStats.totalWon - gameStats.totalWagered).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className={styles.cardSubtext}>Net Profit</div>
                    </div>

                    {/* Wide Tile: Favorite Game */}
                    {favoriteGame && (
                        <div className={`${styles.card} ${styles.wide} ${styles.favoriteGameCard}`}>
                            <div className={styles.favGameInfo}>
                                <div className={styles.cardLabel} style={{ color: 'var(--neon-cyan)' }}>Most Played</div>
                                <div className={styles.favGameTitle}>{favoriteGame.game}</div>
                                <div className={styles.favGameStats}>
                                    <span>{favoriteGame.count} Sessions</span>
                                    <span>•</span>
                                    <span>{favoriteGame.percentage}% of History</span>
                                </div>
                            </div>
                            <div className={styles.favGameIcon}>
                                <Gamepad2 />
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.badgesSection}>
                    <div className={styles.sectionHeader}>
                        <Trophy size={18} /> Trophy Case ({badges.length})
                    </div>
                    <div className={styles.badgesContainer}>
                        {/* Render Earned Badges */}
                        {badges.map((badge, i) => (
                            <div key={i} className={`${styles.badgeSlot} ${styles.earned}`} title={badge.name}>
                                {badge.icon}
                            </div>
                        ))}
                        {/* Render Empty Slots for aesthetics */}
                        {[...Array(Math.max(8 - badges.length, 0))].map((_, i) => (
                            <div key={`empty-${i}`} className={styles.badgeSlot}></div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
