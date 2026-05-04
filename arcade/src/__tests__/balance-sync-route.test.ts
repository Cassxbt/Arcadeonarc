import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSessionWallet: vi.fn(),
    checkRateLimit: vi.fn(),
    getClientIp: vi.fn(),
    createServerClient: vi.fn(),
    readContract: vi.fn(),
    from: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
    getSessionWallet: mocks.getSessionWallet,
}));

vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: mocks.checkRateLimit,
    getClientIp: mocks.getClientIp,
}));

vi.mock('@/lib/supabase-server', () => ({
    createServerClient: mocks.createServerClient,
}));

vi.mock('viem', async () => {
    const actual = await vi.importActual<typeof import('viem')>('viem');

    return {
        ...actual,
        createPublicClient: vi.fn(() => ({
            readContract: mocks.readContract,
        })),
        http: vi.fn(),
    };
});

function createRequest() {
    return new Request('http://localhost/api/balance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
}

async function loadPostHandler() {
    vi.resetModules();
    const route = await import('@/app/api/balance/sync/route');
    return route.POST;
}

describe('/api/balance/sync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getClientIp.mockReturnValue('127.0.0.1');
        mocks.checkRateLimit.mockResolvedValue({ success: true });
        mocks.createServerClient.mockReturnValue({ from: mocks.from });
        mocks.from.mockReturnValue({ update: mocks.update });
        mocks.update.mockReturnValue({ eq: mocks.eq });
        mocks.eq.mockResolvedValue({ error: null });
        mocks.readContract.mockResolvedValue(BigInt(12_500_000));
    });

    it('rate-limits sync requests before reading session or vault state', async () => {
        mocks.checkRateLimit.mockResolvedValue({ success: false });
        const POST = await loadPostHandler();

        const response = await POST(createRequest() as never);
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(body.error).toBe('Too many requests');
        expect(mocks.getSessionWallet).not.toHaveBeenCalled();
        expect(mocks.readContract).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated balance syncs', async () => {
        mocks.getSessionWallet.mockResolvedValue(null);
        const POST = await loadPostHandler();

        const response = await POST(createRequest() as never);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
        expect(mocks.readContract).not.toHaveBeenCalled();
        expect(mocks.from).not.toHaveBeenCalled();
    });

    it('reads the vault balance for the session wallet and stores it in Supabase', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.getSessionWallet.mockResolvedValue(wallet);
        const POST = await loadPostHandler();

        const response = await POST(createRequest() as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, balance: 12.5 });
        expect(mocks.readContract).toHaveBeenCalledWith(expect.objectContaining({
            functionName: 'balances',
            args: [wallet],
        }));
        expect(mocks.from).toHaveBeenCalledWith('users');
        expect(mocks.update).toHaveBeenCalledWith({ server_balance: 12.5 });
        expect(mocks.eq).toHaveBeenCalledWith('wallet_address', wallet);
    });

    it('returns a server error if Supabase rejects the balance update', async () => {
        mocks.getSessionWallet.mockResolvedValue('0x1111111111111111111111111111111111111111');
        mocks.eq.mockResolvedValue({ error: { message: 'database unavailable' } });
        const POST = await loadPostHandler();

        const response = await POST(createRequest() as never);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe('Failed to sync balance');
    });

    it('returns a server error if the vault balance read fails', async () => {
        mocks.getSessionWallet.mockResolvedValue('0x1111111111111111111111111111111111111111');
        mocks.readContract.mockRejectedValue(new Error('rpc unavailable'));
        const POST = await loadPostHandler();

        const response = await POST(createRequest() as never);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe('Internal server error');
        expect(mocks.from).not.toHaveBeenCalled();
    });
});
