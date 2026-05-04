import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSessionWallet: vi.fn(),
    checkRateLimit: vi.fn(),
    getClientIp: vi.fn(),
    createServerClient: vi.fn(),
    rpc: vi.fn(),
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

function createJsonRequest(method: 'POST' | 'PUT', body: unknown) {
    return new Request('http://localhost/api/balance/withdraw', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function loadRouteHandlers() {
    vi.resetModules();
    return import('@/app/api/balance/withdraw/route');
}

describe('/api/balance/withdraw', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getClientIp.mockReturnValue('127.0.0.1');
        mocks.checkRateLimit.mockResolvedValue({ success: true });
        mocks.getSessionWallet.mockResolvedValue('0x1111111111111111111111111111111111111111');
        mocks.createServerClient.mockReturnValue({ rpc: mocks.rpc });
        mocks.rpc.mockResolvedValue({
            data: { success: true, reserved: 25 },
            error: null,
        });
    });

    it('rate-limits withdrawal reservations before reading session state', async () => {
        mocks.checkRateLimit.mockResolvedValue({ success: false });
        const { POST } = await loadRouteHandlers();

        const response = await POST(createJsonRequest('POST', { amount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(body.error).toBe('Too many requests');
        expect(mocks.getSessionWallet).not.toHaveBeenCalled();
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated withdrawal reservations', async () => {
        mocks.getSessionWallet.mockResolvedValue(null);
        const { POST } = await loadRouteHandlers();

        const response = await POST(createJsonRequest('POST', { amount: 10 }) as never);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('rejects invalid reservation amounts before calling Supabase', async () => {
        const { POST } = await loadRouteHandlers();

        const response = await POST(createJsonRequest('POST', { amount: 0 }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Invalid amount');
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('reserves a withdrawal against the authenticated session wallet', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        const { POST } = await loadRouteHandlers();

        const response = await POST(createJsonRequest('POST', {
            wallet: '0x9999999999999999999999999999999999999999',
            amount: 25,
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, reserved: 25 });
        expect(mocks.rpc).toHaveBeenCalledWith('reserve_withdrawal', {
            p_wallet: wallet,
            p_amount: 25,
        });
    });

    it('returns insufficient-balance details from reservation failures', async () => {
        mocks.rpc.mockResolvedValue({
            data: { success: false, error: 'Insufficient balance', available: 3 },
            error: null,
        });
        const { POST } = await loadRouteHandlers();

        const response = await POST(createJsonRequest('POST', { amount: 25 }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({
            error: 'Insufficient balance',
            available: 3,
        });
    });

    it('returns a server error when reservation RPC fails', async () => {
        mocks.rpc.mockResolvedValue({
            data: null,
            error: { message: 'database unavailable' },
        });
        const { POST } = await loadRouteHandlers();

        const response = await POST(createJsonRequest('POST', { amount: 25 }) as never);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe('Failed to process withdrawal');
    });

    it('rejects unauthenticated withdrawal actions', async () => {
        mocks.getSessionWallet.mockResolvedValue(null);
        const { PUT } = await loadRouteHandlers();

        const response = await PUT(createJsonRequest('PUT', { amount: 10, action: 'confirm' }) as never);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('rejects invalid withdrawal action amounts before calling Supabase', async () => {
        const { PUT } = await loadRouteHandlers();

        const response = await PUT(createJsonRequest('PUT', { amount: -5, action: 'confirm' }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Invalid amount');
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('rejects unknown withdrawal actions before calling Supabase', async () => {
        const { PUT } = await loadRouteHandlers();

        const response = await PUT(createJsonRequest('PUT', { amount: 10, action: 'release' }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Invalid withdrawal action');
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('confirms a reserved withdrawal against the authenticated session wallet', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.rpc.mockResolvedValue({ error: null });
        const { PUT } = await loadRouteHandlers();

        const response = await PUT(createJsonRequest('PUT', {
            wallet: '0x9999999999999999999999999999999999999999',
            amount: 25,
            action: 'confirm',
        }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, confirmed: true });
        expect(mocks.rpc).toHaveBeenCalledWith('confirm_withdrawal', {
            p_wallet: wallet,
            p_amount: 25,
        });
    });

    it('cancels a reserved withdrawal against the authenticated session wallet', async () => {
        const wallet = '0x1111111111111111111111111111111111111111';
        mocks.rpc.mockResolvedValue({ error: null });
        const { PUT } = await loadRouteHandlers();

        const response = await PUT(createJsonRequest('PUT', { amount: 25, action: 'cancel' }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true, cancelled: true });
        expect(mocks.rpc).toHaveBeenCalledWith('cancel_withdrawal', {
            p_wallet: wallet,
            p_amount: 25,
        });
    });

    it('returns a server error when withdrawal action RPC fails', async () => {
        mocks.rpc.mockResolvedValue({ error: { message: 'database unavailable' } });
        const { PUT } = await loadRouteHandlers();

        const response = await PUT(createJsonRequest('PUT', { amount: 25, action: 'confirm' }) as never);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe('Internal server error');
    });
});
