// Server-side game logic functions
// Used by API routes to calculate and verify payouts

const HOUSE_EDGE = 0.10;

const WHEEL_MULTIPLIERS = [
    0, 1.1, 0, 1.3, 0, 1.1, 2.2, 0, 1.3, 1.1,
    0, 1.5, 0, 1.3, 3.5, 1.1, 0, 2.2, 0, 1.5
];

const TOWER_ROWS = [7, 6, 5, 4, 3, 4, 5, 6, 7, 6, 5, 4, 3, 4, 5, 6, 7, 6, 5, 4];

export function calculateDicePayout(
    betAmount: number,
    target: number,
    betUnder: boolean,
    result: number
): { payout: number; multiplier: number; won: boolean } {
    const won = betUnder ? result < target : result > target;
    if (!won) return { payout: 0, multiplier: 0, won: false };

    const winChance = betUnder ? (target - 1) : (100 - target);
    const multiplier = Number(((100 / winChance) * (1 - HOUSE_EDGE)).toFixed(4));
    return { payout: betAmount * multiplier, multiplier, won: true };
}

export function calculateWheelPayout(
    betAmount: number,
    segment: number
): { payout: number; multiplier: number; won: boolean } {
    const multiplier = WHEEL_MULTIPLIERS[segment] || 0;
    const won = multiplier > 0;
    return { payout: won ? betAmount * multiplier : 0, multiplier, won };
}

export function calculateTowerPayout(
    betAmount: number,
    row: number
): { payout: number; multiplier: number } {
    let cumulativeProb = 1.0;
    for (let i = 0; i <= row; i++) {
        const tilesInRow = TOWER_ROWS[i];
        const survivalRate = (tilesInRow - 1) / tilesInRow;
        cumulativeProb *= survivalRate;
    }
    const multiplier = (1 / cumulativeProb) * (1 - HOUSE_EDGE);
    return { payout: betAmount * multiplier, multiplier: Number(multiplier.toFixed(4)) };
}

export function calculateCrashPayout(
    betAmount: number,
    cashoutMultiplier: number,
    crashPoint: number
): { payout: number; multiplier: number; won: boolean } {
    const won = cashoutMultiplier <= crashPoint;
    if (!won) return { payout: 0, multiplier: 0, won: false };

    const multiplier = cashoutMultiplier / 10000;
    return { payout: betAmount * multiplier, multiplier, won: true };
}

export function calculateLaserPayout(
    betAmount: number,
    survivedTurns: number
): { payout: number; multiplier: number } {
    if (survivedTurns === 0) {
        return { payout: 0, multiplier: 0 };
    }

    let cumulative = 1.0;
    let colsRemaining = 10;
    let rowsRemaining = 10;

    for (let i = 0; i < survivedTurns; i++) {
        const isColumnTurn = (i % 2 === 0);
        const remaining = isColumnTurn ? colsRemaining : rowsRemaining;
        cumulative *= remaining / (remaining - 1);
        if (isColumnTurn) colsRemaining--;
        else rowsRemaining--;
    }

    const multiplier = cumulative * 0.96;
    return { payout: betAmount * multiplier, multiplier: Number(multiplier.toFixed(4)) };
}

export function verifyGamePayout(
    game: string,
    betAmount: number,
    claimedPayout: number,
    gameParams: Record<string, unknown>
): { verified: boolean; calculatedPayout: number } {
    let calculated: { payout: number };

    switch (game) {
        case 'dice':
            calculated = calculateDicePayout(
                betAmount,
                gameParams.target as number,
                gameParams.betUnder as boolean,
                gameParams.result as number
            );
            break;
        case 'wheel':
            calculated = calculateWheelPayout(betAmount, gameParams.segment as number);
            break;
        case 'tower':
            calculated = calculateTowerPayout(betAmount, gameParams.row as number);
            break;
        case 'crash':
            calculated = calculateCrashPayout(
                betAmount,
                gameParams.cashoutMultiplier as number,
                gameParams.crashPoint as number
            );
            break;
        case 'laser':
            calculated = calculateLaserPayout(betAmount, gameParams.survivedTurns as number);
            break;
        default:
            return { verified: false, calculatedPayout: 0 };
    }

    const tolerance = 0.01;
    const verified = Math.abs(calculated.payout - claimedPayout) <= tolerance;
    return { verified, calculatedPayout: calculated.payout };
}

/**
 * Calculate payout server-side based on game type and parameters.
 * This is the source of truth - client cannot manipulate these calculations.
 */
export function calculateServerPayout(
    game: string,
    betAmount: number,
    gameParams: Record<string, unknown>
): { payout: number; multiplier: number; won: boolean } {
    switch (game) {
        case 'dice': {
            const target = gameParams.target as number;
            const betUnder = gameParams.betUnder as boolean;
            const result = gameParams.result as number;
            if (typeof target !== 'number' || typeof result !== 'number') {
                throw new Error('Invalid dice game params');
            }
            return calculateDicePayout(betAmount, target, betUnder, result);
        }
        case 'wheel': {
            const segment = gameParams.segment as number;
            if (typeof segment !== 'number') {
                throw new Error('Invalid wheel game params');
            }
            return calculateWheelPayout(betAmount, segment);
        }
        case 'tower': {
            const row = gameParams.row as number;
            if (typeof row !== 'number') {
                throw new Error('Invalid tower game params');
            }
            const result = calculateTowerPayout(betAmount, row);
            return { ...result, won: true };
        }
        case 'crash': {
            const cashoutMultiplier = gameParams.cashoutMultiplier as number;
            const crashPoint = gameParams.crashPoint as number;
            if (typeof cashoutMultiplier !== 'number' || typeof crashPoint !== 'number') {
                throw new Error('Invalid crash game params');
            }
            return calculateCrashPayout(betAmount, cashoutMultiplier, crashPoint);
        }
        case 'laser': {
            const survivedTurns = gameParams.survivedTurns as number;
            if (typeof survivedTurns !== 'number') {
                throw new Error('Invalid laser game params');
            }
            const result = calculateLaserPayout(betAmount, survivedTurns);
            return { ...result, won: survivedTurns > 0 };
        }
        default:
            throw new Error(`Unknown game type: ${game}`);
    }
}
