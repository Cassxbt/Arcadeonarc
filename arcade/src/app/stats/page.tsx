'use client';

import { useStats } from '@/lib/useStats';
import {
    BarChart3,
    Trophy,
    TowerControl,
    Dice6,
    Bomb,
    DollarSign,
    Zap,
} from '@/components/icons';
import styles from './page.module.css';

function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getGameIcon(game: 'tower' | 'dice' | 'crash') {
    switch (game) {
        case 'tower':
            return <TowerControl size={32} style={{ color: 'var(--neon-cyan)' }} />;
        case 'dice':
            return <Dice6 size={32} style={{ color: 'var(--neon-green)' }} />;
        case 'crash':
            return <Bomb size={32} style={{ color: 'var(--neon-pink)' }} />;
    }
}

function getGameName(game: 'tower' | 'dice' | 'crash'): string {
    switch (game) {
        case 'tower': return 'Tower';
        case 'dice': return 'Dice';
        case 'crash': return 'Cannon';
    }
}

export default function StatsPage() {
    const stats = useStats();

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <BarChart3 size={48} style={{ color: 'var(--neon-green)', filter: 'drop-shadow(0 0 20px var(--neon-green))' }} />
                <h1 className={styles.title}>Platform Stats</h1>
                <p className={styles.subtitle}>Real-time on-chain statistics</p>
            </div>

            {stats.error && (
                <div className={styles.error}>
                    <p>{stats.error}</p>
                </div>
            )}

            <div className={styles.statsGrid}>
                {/* Biggest Win Card */}
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>
                        <Trophy size={36} style={{ color: 'var(--neon-yellow)', filter: 'drop-shadow(0 0 15px var(--neon-yellow))' }} />
                    </div>
                    <h3 className={styles.statTitle}>Biggest Win</h3>
                    {stats.isLoading ? (
                        <div className={styles.skeleton}></div>
                    ) : stats.biggestWin ? (
                        <>
                            <div className={styles.bigValue}>
                                ${stats.biggestWin.amount.toFixed(2)}
                            </div>
                            <div className={styles.statMeta}>
                                <span className={styles.gameTag}>
                                    {getGameIcon(stats.biggestWin.game)}
                                    {getGameName(stats.biggestWin.game)}
                                </span>
                                <span className={styles.address}>
                                    by {formatAddress(stats.biggestWin.player)}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className={styles.noData}>No wins yet</div>
                    )}
                </div>

                {/* Most Preferred Game Card */}
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>
                        <Zap size={36} style={{ color: 'var(--neon-pink)', filter: 'drop-shadow(0 0 15px var(--neon-pink))' }} />
                    </div>
                    <h3 className={styles.statTitle}>Most Played Game</h3>
                    {stats.isLoading ? (
                        <div className={styles.skeleton}></div>
                    ) : stats.mostPreferredGame ? (
                        <>
                            <div className={styles.gameDisplay}>
                                {getGameIcon(stats.mostPreferredGame.game)}
                                <span className={styles.gameName}>
                                    {getGameName(stats.mostPreferredGame.game)}
                                </span>
                            </div>
                            <div className={styles.statMeta}>
                                <span>{stats.mostPreferredGame.count} games</span>
                                <span className={styles.percentage}>
                                    {stats.mostPreferredGame.percentage}% of all games
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className={styles.noData}>No games played yet</div>
                    )}
                </div>

                {/* Total USDC Won Card */}
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>
                        <DollarSign size={36} style={{ color: 'var(--neon-green)', filter: 'drop-shadow(0 0 15px var(--neon-green))' }} />
                    </div>
                    <h3 className={styles.statTitle}>Total USDC Won</h3>
                    {stats.isLoading ? (
                        <div className={styles.skeleton}></div>
                    ) : (
                        <div className={styles.bigValue}>
                            ${stats.totalUsdcWon.toFixed(2)}
                        </div>
                    )}
                </div>

                {/* Total Games Played Card */}
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>
                        <BarChart3 size={36} style={{ color: 'var(--neon-cyan)', filter: 'drop-shadow(0 0 15px var(--neon-cyan))' }} />
                    </div>
                    <h3 className={styles.statTitle}>Total Games Played</h3>
                    {stats.isLoading ? (
                        <div className={styles.skeleton}></div>
                    ) : (
                        <>
                            <div className={styles.bigValue}>
                                {stats.totalGamesPlayed}
                            </div>
                            <div className={styles.gameBreakdown}>
                                <div className={styles.breakdownItem}>
                                    <TowerControl size={16} style={{ color: 'var(--neon-cyan)' }} />
                                    <span>{stats.gameCounts.tower}</span>
                                </div>
                                <div className={styles.breakdownItem}>
                                    <Dice6 size={16} style={{ color: 'var(--neon-green)' }} />
                                    <span>{stats.gameCounts.dice}</span>
                                </div>
                                <div className={styles.breakdownItem}>
                                    <Bomb size={16} style={{ color: 'var(--neon-pink)' }} />
                                    <span>{stats.gameCounts.crash}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className={styles.footer}>
                <p>Stats are fetched directly from the Arc L1 blockchain</p>
            </div>
        </div>
    );
}
