'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, http, formatUnits, parseAbiItem } from 'viem';
import { arcTestnet, CONTRACTS } from './constants';

export interface PlatformStats {
    biggestWin: {
        amount: number;
        player: string;
        game: 'tower' | 'dice' | 'crash';
    } | null;
    mostPreferredGame: {
        game: 'tower' | 'dice' | 'crash';
        count: number;
        percentage: number;
    } | null;
    totalUsdcWon: number;
    totalGamesPlayed: number;
    gameCounts: {
        tower: number;
        dice: number;
        crash: number;
    };
    isLoading: boolean;
    error: string | null;
}

const client = createPublicClient({
    chain: arcTestnet,
    transport: http(),
});

// Event signatures for each game
const TOWER_CASHOUT_EVENT = parseAbiItem('event GameCashedOut(address indexed player, uint8 row, uint256 multiplier, uint256 payout)');
const TOWER_GAME_STARTED = parseAbiItem('event GameStarted(address indexed player, uint256 betAmount, uint256 nonce)');
const DICE_ROLLED_EVENT = parseAbiItem('event DiceRolled(address indexed player, uint256 betAmount, uint8 target, bool betUnder, uint8 result, bool won, uint256 payout)');
const CRASH_CASHOUT_EVENT = parseAbiItem('event CashedOut(address indexed player, uint256 multiplier, uint256 payout)');
const CRASH_BET_PLACED = parseAbiItem('event BetPlaced(address indexed player, uint256 amount, uint256 autoCashout)');

export function useStats(): PlatformStats {
    const [stats, setStats] = useState<PlatformStats>({
        biggestWin: null,
        mostPreferredGame: null,
        totalUsdcWon: 0,
        totalGamesPlayed: 0,
        gameCounts: { tower: 0, dice: 0, crash: 0 },
        isLoading: true,
        error: null,
    });

    const fetchStats = useCallback(async () => {
        try {
            setStats(prev => ({ ...prev, isLoading: true, error: null }));

            // Fetch events from each game contract
            const [towerCashouts, towerStarts, diceRolls, crashCashouts, crashBets] = await Promise.all([
                client.getLogs({
                    address: CONTRACTS.TOWER_GAME,
                    event: TOWER_CASHOUT_EVENT,
                    fromBlock: BigInt(0),
                    toBlock: 'latest',
                }).catch(() => []),
                client.getLogs({
                    address: CONTRACTS.TOWER_GAME,
                    event: TOWER_GAME_STARTED,
                    fromBlock: BigInt(0),
                    toBlock: 'latest',
                }).catch(() => []),
                client.getLogs({
                    address: CONTRACTS.DICE_GAME,
                    event: DICE_ROLLED_EVENT,
                    fromBlock: BigInt(0),
                    toBlock: 'latest',
                }).catch(() => []),
                client.getLogs({
                    address: CONTRACTS.CANNON_CRASH,
                    event: CRASH_CASHOUT_EVENT,
                    fromBlock: BigInt(0),
                    toBlock: 'latest',
                }).catch(() => []),
                client.getLogs({
                    address: CONTRACTS.CANNON_CRASH,
                    event: CRASH_BET_PLACED,
                    fromBlock: BigInt(0),
                    toBlock: 'latest',
                }).catch(() => []),
            ]);

            // Track biggest win across all games
            let biggestWin: PlatformStats['biggestWin'] = null;
            let totalUsdcWon = 0;

            // Process Tower cashouts
            for (const log of towerCashouts) {
                const payout = Number(formatUnits(log.args.payout as bigint, 6));
                totalUsdcWon += payout;

                if (!biggestWin || payout > biggestWin.amount) {
                    biggestWin = {
                        amount: payout,
                        player: log.args.player as string,
                        game: 'tower',
                    };
                }
            }

            // Process Dice rolls (only winning ones)
            for (const log of diceRolls) {
                if (log.args.won) {
                    const payout = Number(formatUnits(log.args.payout as bigint, 6));
                    totalUsdcWon += payout;

                    if (!biggestWin || payout > biggestWin.amount) {
                        biggestWin = {
                            amount: payout,
                            player: log.args.player as string,
                            game: 'dice',
                        };
                    }
                }
            }

            // Process Crash cashouts
            for (const log of crashCashouts) {
                const payout = Number(formatUnits(log.args.payout as bigint, 6));
                totalUsdcWon += payout;

                if (!biggestWin || payout > biggestWin.amount) {
                    biggestWin = {
                        amount: payout,
                        player: log.args.player as string,
                        game: 'crash',
                    };
                }
            }

            // Count games played
            const gameCounts = {
                tower: towerStarts.length,
                dice: diceRolls.length,
                crash: crashBets.length,
            };

            const totalGamesPlayed = gameCounts.tower + gameCounts.dice + gameCounts.crash;

            // Determine most preferred game
            let mostPreferredGame: PlatformStats['mostPreferredGame'] = null;
            if (totalGamesPlayed > 0) {
                const maxGame = Object.entries(gameCounts).reduce((a, b) =>
                    a[1] > b[1] ? a : b
                );
                mostPreferredGame = {
                    game: maxGame[0] as 'tower' | 'dice' | 'crash',
                    count: maxGame[1],
                    percentage: Math.round((maxGame[1] / totalGamesPlayed) * 100),
                };
            }

            setStats({
                biggestWin,
                mostPreferredGame,
                totalUsdcWon,
                totalGamesPlayed,
                gameCounts,
                isLoading: false,
                error: null,
            });

        } catch (error) {
            console.error('Failed to fetch stats:', error);
            setStats(prev => ({
                ...prev,
                isLoading: false,
                error: 'Failed to load stats. Please try again.',
            }));
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return stats;
}
