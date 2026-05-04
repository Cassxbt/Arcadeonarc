import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WheelGame from '@/app/games/wheel/page';
import LaserGame from '@/app/games/laser/page';
import TowerGame from '@/app/games/tower/page';
import CrashGame from '@/app/games/crash/page';
import { authFetch } from '@/lib/auth-fetch';
import { useGame } from '@/lib/game-context';

vi.mock('@/lib/auth-fetch', () => ({
    authFetch: vi.fn(),
}));

const mockedAuthFetch = vi.mocked(authFetch);
const mockedUseGame = vi.mocked(useGame);

function mockGameContext() {
    mockedUseGame.mockReturnValue({
        effectiveBalance: 100,
        betAmount: 1,
        setBetAmount: vi.fn(),
        canBet: vi.fn(() => true),
        addBetRecord: vi.fn(),
        refreshBalance: vi.fn(() => Promise.resolve()),
        demoMode: false,
        toggleDemoMode: vi.fn(),
        isDemoLimitReached: vi.fn(() => false),
        betHistory: [],
        balance: 100,
        syncBalanceAfterDeposit: vi.fn(() => Promise.resolve()),
    } as unknown as ReturnType<typeof useGame>);
}

describe('game responsiveness', () => {
    beforeEach(() => {
        vi.useRealTimers();
        mockedAuthFetch.mockReset();
        mockedUseGame.mockReset();
        mockGameContext();
    });

    it('does not retarget the wheel while the server result is still pending', async () => {
        let resolveSpin!: (value: Response) => void;
        mockedAuthFetch.mockReturnValue(new Promise<Response>(resolve => {
            resolveSpin = resolve;
        }) as ReturnType<typeof authFetch>);

        const { container } = render(<WheelGame />);
        const wheel = container.querySelector('svg[viewBox="0 0 400 400"]');

        fireEvent.click(screen.getByRole('button', { name: /spin/i }));

        expect(screen.getByRole('button', { name: /spinning/i })).toBeDisabled();
        expect(wheel).toHaveStyle({ transform: 'rotate(0deg)' });

        await act(async () => {
            resolveSpin({
                ok: true,
                json: async () => ({ segment: 3 }),
            } as Response);
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(wheel?.getAttribute('style')).toMatch(/rotate\((?!0deg)/);
        });
    });

    it('keeps wheel wager controls locked while a completed spin result is shown', async () => {
        vi.useFakeTimers();
        mockedAuthFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ segment: 3 }),
        } as Response);

        render(<WheelGame />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /spin/i }));
            await Promise.resolve();
        });
        expect(mockedAuthFetch).toHaveBeenCalledTimes(1);

        await act(async () => {
            vi.advanceTimersByTime(5000);
        });

        expect(screen.getByRole('button', { name: '$5' })).toBeDisabled();
    });

    it('keeps crash cashout pending instead of re-enabling launch before the server settles', async () => {
        let resolveCashout!: (value: Response) => void;
        mockedAuthFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    roundId: 'round-1',
                    version: 1,
                    startedAt: Date.now(),
                    serverTime: Date.now(),
                    betAmount: 1,
                    resumed: false,
                }),
            } as Response)
            .mockReturnValueOnce(new Promise<Response>(resolve => {
                resolveCashout = resolve;
            }) as ReturnType<typeof authFetch>);

        render(<CrashGame />);

        fireEvent.click(screen.getByRole('button', { name: /launch cannon/i }));
        const cashoutButton = await screen.findByRole('button', { name: /cash out/i });

        fireEvent.click(cashoutButton);

        expect(screen.getByRole('button', { name: /cashing out/i })).toBeDisabled();
        expect(screen.queryByRole('button', { name: /launch cannon/i })).not.toBeInTheDocument();

        await act(async () => {
            resolveCashout({
                ok: true,
                json: async () => ({
                    success: true,
                    multiplier: 1.1,
                    payout: 1.1,
                    newBalance: 100.1,
                    crashPoint: 25000,
                }),
            } as Response);
            await Promise.resolve();
        });
    });

    it('advances tower to cashout-ready state within one short reveal beat after a safe server response', async () => {
        vi.useFakeTimers();
        mockedAuthFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    roundId: 'round-1',
                    version: 1,
                    currentRow: 0,
                    state: { currentRow: 0, revealedDeaths: {}, selectedTiles: {} },
                    betAmount: 1,
                    resumed: false,
                }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    outcome: 'safe',
                    deathTile: 1,
                    row: 0,
                    currentRow: 1,
                    version: 2,
                    multiplier: 1.05,
                    payout: 1.05,
                }),
            } as Response);

        const { container } = render(<TowerGame />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /^play$/i }));
            await Promise.resolve();
        });
        expect(mockedAuthFetch).toHaveBeenCalledTimes(1);

        const enabledTile = Array.from(container.querySelectorAll('button'))
            .find(button => button.className.includes('tileClickable') && !button.hasAttribute('disabled')) as HTMLButtonElement | undefined;
        expect(enabledTile).toBeTruthy();

        await act(async () => {
            fireEvent.click(enabledTile as HTMLButtonElement);
            await Promise.resolve();
        });
        expect(mockedAuthFetch).toHaveBeenCalledTimes(2);

        await act(async () => {
            vi.advanceTimersByTime(150);
        });

        expect(screen.getByRole('button', { name: /cash out/i })).toBeEnabled();
    });

    it('advances laser turn within one short reveal beat after a safe server response', async () => {
        vi.useFakeTimers();
        mockedAuthFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    roundId: 'round-1',
                    version: 1,
                    currentTurn: 0,
                    columnsRemaining: 10,
                    rowsRemaining: 10,
                }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    outcome: 'safe',
                    laserTarget: 1,
                    isColumnAttack: true,
                    survived: true,
                    currentTurn: 1,
                    columnsRemaining: 9,
                    rowsRemaining: 10,
                    version: 2,
                }),
            } as Response);

        const { container } = render(<LaserGame />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /start game/i }));
            await Promise.resolve();
        });
        expect(mockedAuthFetch).toHaveBeenCalledTimes(1);

        const enabledCell = Array.from(container.querySelectorAll('button'))
            .find(button => button.className.includes('cell') && !button.hasAttribute('disabled')) as HTMLButtonElement | undefined;
        expect(enabledCell).toBeTruthy();

        await act(async () => {
            fireEvent.click(enabledCell as HTMLButtonElement);
            await Promise.resolve();
        });
        expect(mockedAuthFetch).toHaveBeenCalledTimes(2);

        await act(async () => {
            vi.advanceTimersByTime(250);
        });

        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cash out/i })).toBeEnabled();
    });

    it('shows the selected laser cell while the server is still resolving the turn', async () => {
        let resolveSelection!: (value: Response) => void;
        mockedAuthFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    roundId: 'round-1',
                    version: 1,
                    currentTurn: 0,
                    columnsRemaining: 10,
                    rowsRemaining: 10,
                }),
            } as Response)
            .mockReturnValueOnce(new Promise<Response>(resolve => {
                resolveSelection = resolve;
            }) as ReturnType<typeof authFetch>);

        const { container } = render(<LaserGame />);

        fireEvent.click(screen.getByRole('button', { name: /start game/i }));
        await waitFor(() => expect(mockedAuthFetch).toHaveBeenCalledTimes(1));

        let enabledCell: HTMLButtonElement | undefined;
        await waitFor(() => {
            enabledCell = Array.from(container.querySelectorAll('button'))
                .find(button => button.className.includes('cell') && !button.hasAttribute('disabled')) as HTMLButtonElement | undefined;
            expect(enabledCell).toBeTruthy();
        });

        fireEvent.click(enabledCell as HTMLButtonElement);

        await waitFor(() => expect((enabledCell as HTMLButtonElement).className).toContain('cellPlayer'));

        await act(async () => {
            resolveSelection({
                ok: true,
                json: async () => ({
                    outcome: 'safe',
                    laserTarget: 1,
                    isColumnAttack: true,
                    survived: true,
                    currentTurn: 1,
                    columnsRemaining: 9,
                    rowsRemaining: 10,
                    version: 2,
                }),
            } as Response);
            await new Promise(resolve => setTimeout(resolve, 0));
        });
    });

    it('does not enable laser cells until the wagered round is accepted', async () => {
        mockedAuthFetch.mockReturnValue(new Promise<Response>(() => undefined) as ReturnType<typeof authFetch>);

        const { container } = render(<LaserGame />);

        fireEvent.click(screen.getByRole('button', { name: /start game/i }));

        expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled();
        const enabledCells = Array.from(container.querySelectorAll('button'))
            .filter(button => button.className.includes('cell') && !button.hasAttribute('disabled'));

        expect(enabledCells).toHaveLength(0);
    });

    it('does not enable tower tiles until the wagered round is accepted', async () => {
        mockedAuthFetch.mockReturnValue(new Promise<Response>(() => undefined) as ReturnType<typeof authFetch>);

        const { container } = render(<TowerGame />);

        fireEvent.click(screen.getByRole('button', { name: /^play$/i }));

        expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled();
        const enabledTiles = Array.from(container.querySelectorAll('button'))
            .filter(button => button.className.includes('tileClickable') && !button.hasAttribute('disabled'));

        expect(enabledTiles).toHaveLength(0);
    });
});
