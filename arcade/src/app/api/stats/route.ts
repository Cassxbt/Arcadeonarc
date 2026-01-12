import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

interface GameStats {
    biggestWin: {
        amount: number;
        player: string;
        game: string;
    } | null;
    mostPreferredGame: {
        game: string;
        count: number;
        percentage: number;
    } | null;
    totalUsdcWon: number;
    totalGamesPlayed: number;
    gameCounts: {
        tower: number;
        dice: number;
        crash: number;
        wheel: number;
        laser: number;
    };
}

const GAME_TYPE_MAP: Record<string, keyof GameStats['gameCounts']> = {
    'tower': 'tower',
    'dice': 'dice',
    'crash': 'crash',
    'wheel': 'wheel',
    'laser': 'laser'
};

export async function GET() {
    try {
        const supabase = createServerClient();

        const { data: sessions, error } = await supabase
            .from('game_sessions')
            .select('game, wallet_address, payout, won')
            .order('payout', { ascending: false });

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch stats' },
                { status: 500 }
            );
        }

        if (!sessions || sessions.length === 0) {
            return NextResponse.json({
                biggestWin: null,
                mostPreferredGame: null,
                totalUsdcWon: 0,
                totalGamesPlayed: 0,
                gameCounts: { tower: 0, dice: 0, crash: 0, wheel: 0, laser: 0 }
            });
        }

        let biggestWin: GameStats['biggestWin'] = null;
        let totalUsdcWon = 0;
        const gameCounts: GameStats['gameCounts'] = {
            tower: 0,
            dice: 0,
            crash: 0,
            wheel: 0,
            laser: 0
        };

        for (const session of sessions) {
            const gameType = GAME_TYPE_MAP[session.game];
            if (!gameType) continue;

            gameCounts[gameType]++;

            if (session.won) {
                const payout = Number(session.payout);
                totalUsdcWon += payout;

                if (!biggestWin || payout > biggestWin.amount) {
                    biggestWin = {
                        amount: payout,
                        player: session.wallet_address,
                        game: session.game
                    };
                }
            }
        }

        const totalGamesPlayed = sessions.length;
        let mostPreferredGame: GameStats['mostPreferredGame'] = null;

        if (totalGamesPlayed > 0) {
            const maxEntry = Object.entries(gameCounts).reduce((max, current) =>
                current[1] > max[1] ? current : max
            );

            if (maxEntry[1] > 0) {
                mostPreferredGame = {
                    game: maxEntry[0],
                    count: maxEntry[1],
                    percentage: Math.round((maxEntry[1] / totalGamesPlayed) * 100)
                };
            }
        }

        return NextResponse.json({
            biggestWin,
            mostPreferredGame,
            totalUsdcWon,
            totalGamesPlayed,
            gameCounts
        });

    } catch (error) {
        console.error('Stats API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
