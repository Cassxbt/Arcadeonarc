'use server';

const HOUSE_EDGE = 0.10;

const WHEEL_MULTIPLIERS = [
    0, 1.5, 1.8, 1.5, 0, 2.0, 1.5, 3.0, 1.8, 1.5,
    0, 1.5, 2.0, 1.8, 5.0, 1.5, 0, 2.0, 3.0, 1.8
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
    let multiplier = 1.0;
    for (let i = 0; i <= row; i++) {
        const tilesInRow = TOWER_ROWS[i];
        const survivalRate = (tilesInRow - 1) / tilesInRow;
        multiplier = multiplier * (1 / survivalRate) * (1 - HOUSE_EDGE);
    }
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
    const baseMultiplier = 1.15;
    const multiplier = Math.pow(baseMultiplier, survivedTurns) * (1 - HOUSE_EDGE);
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
