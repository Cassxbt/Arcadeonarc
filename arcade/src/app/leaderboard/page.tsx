'use client';

import { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useGame } from '@/lib/game-context';
import { Trophy, Medal, Gamepad2, Link, Flame } from '@/components/icons';
import styles from './page.module.css';

type TimeFrame = 'week' | 'season' | 'alltime';

interface LeaderboardEntry {
    rank: number;
    username: string;
    wallet_address: string;
    points: number;
    games_played: number;
    wins: number;
    total_won: number;
    streak: number;
}

export default function Leaderboard() {
    const { primaryWallet } = useDynamicContext();
    const { isRegistered } = useGame();
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        totalPaidOut: 0,
        totalGames: 0,
        activePlayers: 0,
    });

    // Fetch leaderboard data
    useEffect(() => {
        async function fetchLeaderboard() {
            if (!primaryWallet) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(`/api/leaderboard?period=${timeFrame}&limit=50`);
                const data = await response.json();

                if (response.ok) {
                    setLeaderboard(data.leaderboard || []);

                    // Calculate aggregate stats
                    const entries = data.leaderboard || [];
                    setStats({
                        totalPaidOut: entries.reduce((sum: number, e: LeaderboardEntry) => sum + e.total_won, 0),
                        totalGames: entries.reduce((sum: number, e: LeaderboardEntry) => sum + e.games_played, 0),
                        activePlayers: entries.length,
                    });
                } else {
                    console.error('Failed to fetch leaderboard:', data.error);
                    setLeaderboard([]);
                }
            } catch (error) {
                console.error('Failed to fetch leaderboard:', error);
                setLeaderboard([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchLeaderboard();
    }, [timeFrame, primaryWallet]);

    const getRankDisplay = (rank: number) => {
        switch (rank) {
            case 1: return <Medal size={24} style={{ color: '#FFD700', filter: 'drop-shadow(0 0 8px #FFD700)' }} />;
            case 2: return <Medal size={24} style={{ color: '#C0C0C0', filter: 'drop-shadow(0 0 6px #C0C0C0)' }} />;
            case 3: return <Medal size={24} style={{ color: '#CD7F32', filter: 'drop-shadow(0 0 6px #CD7F32)' }} />;
            default: return `#${rank}`;
        }
    };

    const getTimeFrameLabel = () => {
        switch (timeFrame) {
            case 'week': return 'This Week';
            case 'season': return 'This Season';
            case 'alltime': return 'All Time';
        }
    };

    // Show connect wallet message if not connected
    if (!primaryWallet) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>
                        <Trophy size={36} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--neon-yellow)', filter: 'drop-shadow(0 0 12px var(--neon-yellow))' }} />
                        Leaderboard
                    </h1>
                    <p className={styles.subtitle}>Top players on ARCade</p>
                </div>

                <div className={styles.connectPrompt}>
                    <Gamepad2 size={60} style={{ color: 'var(--neon-cyan)', filter: 'drop-shadow(0 0 15px var(--neon-cyan))', marginBottom: '1rem' }} />
                    <h3>Connect Wallet to View</h3>
                    <p>Connect your wallet to see the leaderboard and start earning points!</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <Trophy size={36} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--neon-yellow)', filter: 'drop-shadow(0 0 12px var(--neon-yellow))' }} />
                    Leaderboard
                </h1>
                <p className={styles.subtitle}>Top players on ARCade • {getTimeFrameLabel()}</p>
            </div>

            {/* Time Frame Toggle */}
            <div className={styles.toggleContainer}>
                <button
                    onClick={() => setTimeFrame('week')}
                    className={`${styles.toggleBtn} ${timeFrame === 'week' ? styles.toggleActive : ''}`}
                >
                    This Week
                </button>
                <button
                    onClick={() => setTimeFrame('season')}
                    className={`${styles.toggleBtn} ${timeFrame === 'season' ? styles.toggleActive : ''}`}
                >
                    Season
                </button>
                <button
                    onClick={() => setTimeFrame('alltime')}
                    className={`${styles.toggleBtn} ${timeFrame === 'alltime' ? styles.toggleActive : ''}`}
                >
                    All Time
                </button>
            </div>

            {/* Leaderboard Table */}
            <div className={styles.tableContainer}>
                {isLoading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <p>Loading leaderboard...</p>
                    </div>
                ) : leaderboard.length > 0 ? (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Player</th>
                                <th>Points</th>
                                <th>Wins</th>
                                <th>Total Won</th>
                                <th>Streak</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((entry) => (
                                <tr
                                    key={entry.rank}
                                    className={`${entry.rank <= 3 ? styles.topThree : ''} ${entry.wallet_address === primaryWallet?.address?.toLowerCase() ? styles.currentUser : ''}`}
                                >
                                    <td className={styles.rank}>
                                        <span className={entry.rank <= 3 ? styles.rankEmoji : ''}>
                                            {getRankDisplay(entry.rank)}
                                        </span>
                                    </td>
                                    <td className={styles.username}>
                                        {entry.username}
                                    </td>
                                    <td className={styles.points}>
                                        {entry.points.toLocaleString()}
                                    </td>
                                    <td className={styles.wins}>
                                        {entry.wins}/{entry.games_played}
                                    </td>
                                    <td className={styles.totalWon}>
                                        ${entry.total_won.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className={styles.streak}>
                                        {entry.streak > 0 && (
                                            <>
                                                <Flame size={14} style={{ color: 'var(--neon-orange)', marginRight: '4px', verticalAlign: 'middle' }} />
                                                {entry.streak}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className={styles.empty}>
                        <span className={styles.emptyIcon}>
                            <Gamepad2 size={80} style={{ color: 'var(--neon-cyan)', filter: 'drop-shadow(0 0 20px var(--neon-cyan))' }} />
                        </span>
                        <h3>No players yet</h3>
                        <p>Be the first to earn points on ARCade!</p>
                        <p className={styles.emptyHint}>
                            Play at least 3 games this week to appear on the leaderboard.
                        </p>
                    </div>
                )}
            </div>

            {/* Stats Summary */}
            <div className={styles.stats}>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>
                        ${stats.totalPaidOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className={styles.statLabel}>Total Won</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{stats.totalGames.toLocaleString()}</span>
                    <span className={styles.statLabel}>Total Games</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{stats.activePlayers.toLocaleString()}</span>
                    <span className={styles.statLabel}>Active Players</span>
                </div>
            </div>

            {/* Info Note */}
            <div className={styles.infoNote}>
                <p>
                    <Link size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--neon-cyan)' }} />
                    Points are calculated weekly: (Wins + USDC/10 + Games) × Streak Multiplier
                </p>
            </div>
        </div>
    );
}
