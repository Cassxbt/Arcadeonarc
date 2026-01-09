'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useProfile } from '@/lib/useProfile';
import { User, Trophy, Star, Zap, DollarSign, Gamepad2, Medal } from 'lucide-react';
import styles from './page.module.css';

export default function ProfilePage() {
    const { user, handleLogOut } = useDynamicContext();
    const router = useRouter();
    const isAuthenticated = !!user;
    const { profile, isLoading, error } = useProfile();

    // Redirect if not authenticated (optional, or show empty state)
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p>LOADING PROFILE...</p>
            </div>
        );
    }

    if (!profile) {
        return null; // Or some empty state
    }

    const { user: userData, badges, gameStats, favoriteGame, weeklyPoints } = profile;

    return (
        <div className={styles.profilePage}>
            <div className={styles.container}>

                {/* Header: Identity */}
                <div className={styles.header}>
                    <div className={styles.avatarContainer}>
                        <div className={styles.avatar}>
                            <User className={styles.avatarIcon} />
                        </div>
                    </div>
                    <div className={styles.userInfo}>
                        <h1 className={styles.username}>{userData.username || 'Player'}</h1>
                        <span className={styles.walletAddress}>
                            {userData.wallet_address}
                        </span>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div className={styles.statsGrid}>
                    <div className={`${styles.statCard} ${styles.purple}`}>
                        <div className={styles.statHeader}>
                            <Zap size={20} />
                            <span>Lifetime XP</span>
                        </div>
                        <div className={styles.statValue}>
                            {userData.lifetime_xp.toLocaleString()}
                        </div>
                        <div className={styles.statSubtext}>Rank: 12 (Coming Soon)</div>
                    </div>

                    <div className={`${styles.statCard} ${styles.green}`}>
                        <div className={styles.statHeader}>
                            <Star size={20} />
                            <span>Weekly Points</span>
                        </div>
                        <div className={styles.statValue}>
                            {weeklyPoints.toLocaleString()}
                        </div>
                        <div className={styles.statSubtext}>Current Streak: {userData.current_streak}🔥</div>
                    </div>

                    <div className={`${styles.statCard} ${styles.pink}`}>
                        <div className={styles.statHeader}>
                            <Trophy size={20} />
                            <span>Win Rate</span>
                        </div>
                        <div className={styles.statValue}>
                            {gameStats.winRate}%
                        </div>
                        <div className={styles.statSubtext}>
                            {gameStats.totalWins} Wins / {gameStats.totalGames} Games
                        </div>
                    </div>

                    <div className={`${styles.statCard} ${styles.yellow}`}>
                        <div className={styles.statHeader}>
                            <DollarSign size={20} />
                            <span>Total Winnings</span>
                        </div>
                        <div className={styles.statValue}>
                            ${gameStats.totalWon.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className={styles.statSubtext}>
                            Wagered: ${gameStats.totalWagered.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Favorite Game */}
                {favoriteGame && (
                    <div className={styles.favoriteGame}>
                        <div className={styles.gameInfo}>
                            <div className={styles.sectionTitle}>
                                <Gamepad2 size={24} color="var(--neon-cyan)" />
                                FAVORITE GAME
                            </div>
                            <div className={styles.gameName}>{favoriteGame.game}</div>
                            <div className={styles.gameStats}>
                                Played {favoriteGame.count} times ({favoriteGame.percentage}% of all games)
                            </div>
                        </div>
                        <div className={styles.gameIcon}>
                            <Gamepad2 />
                        </div>
                    </div>
                )}

                {/* Badges Collection */}
                <div className={styles.badgesSection}>
                    <div className={styles.sectionTitle}>
                        <Medal size={24} color="var(--neon-yellow)" />
                        BADGES COLLECTION
                    </div>

                    <div className={styles.badgesGrid}>
                        {badges.length > 0 ? (
                            badges.map((badge, index) => (
                                <div key={index} className={styles.badgeCard}>
                                    <div className={styles.badgeIcon}>{badge.icon}</div>
                                    <h3 className={styles.badgeName}>{badge.name}</h3>
                                    <p className={styles.badgeDescription}>{badge.description}</p>
                                </div>
                            ))
                        ) : (
                            <div className={styles.emptyState}>
                                <p>No badges earned yet. Play games to unlock achievements!</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
