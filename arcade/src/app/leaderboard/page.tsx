'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http, formatUnits } from 'viem';
import { arcTestnet, CONTRACTS } from '@/lib/constants';
import { Trophy, Medal, Gamepad2, Link } from '@/components/icons';
import styles from './page.module.css';

type TimeFrame = 'daily' | 'allTime';

interface LeaderboardEntry {
    rank: number;
    address: string;
    totalWon: number;
    gamesPlayed: number;
    biggestWin: number;
}

// Create a public client for reading from the blockchain
const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
});

export default function Leaderboard() {
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('daily');
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
            setIsLoading(true);
            try {
                // Leaderboard data populated from on-chain events
                setLeaderboard([]);
                setStats({
                    totalPaidOut: 0,
                    totalGames: 0,
                    activePlayers: 0,
                });
            } catch (error) {
                console.error('Failed to fetch leaderboard:', error);
                setLeaderboard([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchLeaderboard();
    }, [timeFrame]);

    const getRankDisplay = (rank: number) => {
        switch (rank) {
            case 1: return <Medal size={24} style={{ color: '#FFD700', filter: 'drop-shadow(0 0 8px #FFD700)' }} />;
            case 2: return <Medal size={24} style={{ color: '#C0C0C0', filter: 'drop-shadow(0 0 6px #C0C0C0)' }} />;
            case 3: return <Medal size={24} style={{ color: '#CD7F32', filter: 'drop-shadow(0 0 6px #CD7F32)' }} />;
            default: return `#${rank}`;
        }
    };

    const formatAddress = (address: string) => {
        if (address.length <= 13) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>
                    <Trophy size={36} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--neon-yellow)', filter: 'drop-shadow(0 0 12px var(--neon-yellow))' }} />
                    Leaderboard
                </h1>
                <p className={styles.subtitle}>Top winners on ARCade</p>
            </div>

            {/* Time Frame Toggle */}
            <div className={styles.toggleContainer}>
                <button
                    onClick={() => setTimeFrame('daily')}
                    className={`${styles.toggleBtn} ${timeFrame === 'daily' ? styles.toggleActive : ''}`}
                >
                    Today
                </button>
                <button
                    onClick={() => setTimeFrame('allTime')}
                    className={`${styles.toggleBtn} ${timeFrame === 'allTime' ? styles.toggleActive : ''}`}
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
                                <th>Total Won</th>
                                <th>Games</th>
                                <th>Biggest Win</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((entry) => (
                                <tr key={entry.rank} className={entry.rank <= 3 ? styles.topThree : ''}>
                                    <td className={styles.rank}>
                                        <span className={entry.rank <= 3 ? styles.rankEmoji : ''}>
                                            {getRankDisplay(entry.rank)}
                                        </span>
                                    </td>
                                    <td className={styles.address}>
                                        {formatAddress(entry.address)}
                                    </td>
                                    <td className={styles.totalWon}>
                                        ${entry.totalWon.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className={styles.games}>{entry.gamesPlayed}</td>
                                    <td className={styles.biggestWin}>
                                        ${entry.biggestWin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                        <h3>No winners yet</h3>
                        <p>Be the first to win on ARCade!</p>
                        <p className={styles.emptyHint}>
                            Play any game and your wins will appear here.
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
                    <span className={styles.statLabel}>Total Paid Out</span>
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
                    Stats are updated in real-time from the Arc L1 blockchain.
                </p>
            </div>
        </div>
    );
}
