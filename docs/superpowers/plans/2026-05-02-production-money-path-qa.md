# Production Money Path QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repeatable QA system for ARCade's money path before Vercel deployment, then run a live wallet checklist on the deployed Vercel URL.

**Architecture:** Split QA into two lanes. Pre-deploy QA uses deterministic Vitest tests and build checks to prove auth, balance, game settlement, rewards, and bridge UI contracts. Live QA runs only on a Vercel preview or production URL with real env vars, wallet connection, Supabase, vault contracts, and Circle bridge behavior.

**Tech Stack:** Next.js App Router, Vitest, Testing Library, Supabase RPCs, Viem, Circle Bridge Kit, Dynamic wallet context, Vercel preview deployments.

---

## Current Baseline

- Existing game route tests cover Wheel, Dice, Tower, Crash, Laser, auth challenges, and game-round helpers.
- `npm test -- --run` passes.
- `npm run lint` passes with warnings.
- `npx tsc --noEmit` passes.
- `npm run build` passes.
- True live money-path QA is blocked until a Vercel deployment exists with real env vars.

## Production Readiness Target

The product is not production-ready until these flows pass on a Vercel URL:

- Wallet connect and ARCade session creation.
- User registration/profile creation.
- Deposit or faucet-funded balance sync.
- Every existing game can start and settle.
- Wins, losses, cashouts, and insufficient-balance cases update balances correctly.
- `game_rounds` and `game_sessions` agree for each play.
- Stats, leaderboard, quests, milestones, and daily bonus reflect authoritative settlement.
- Withdraw reserve, contract withdraw, confirm, and cancel paths behave safely.
- Bridge modal and Circle Bridge Kit path are verified against official Circle behavior before any bridge mechanics change.

---

## File Structure

- Create: `docs/2026-05-02-production-money-path-qa-checklist.md`
  Human-run live checklist for Vercel preview/production.
- Create: `arcade/src/__tests__/balance-sync-route.test.ts`
  Unit tests for `/api/balance/sync` auth, vault read, and Supabase balance update.
- Create: `arcade/src/__tests__/balance-withdraw-route.test.ts`
  Unit tests for `/api/balance/withdraw` reserve, confirm, cancel, unauthorized, and insufficient balance responses.
- Create: `arcade/src/__tests__/money-path-invariants.test.ts`
  Pure tests documenting balance invariants across round start/finalize responses.
- Modify: `docs/2026-05-01-arcade-rebuild-audit.md`
  Update readiness status after this QA plan is implemented and after live QA runs.

---

## Task 1: Create The Live Vercel QA Checklist

**Files:**
- Create: `docs/2026-05-02-production-money-path-qa-checklist.md`

- [ ] **Step 1: Create the checklist document**

Create `docs/2026-05-02-production-money-path-qa-checklist.md` with this content:

```markdown
# ARCade Production Money Path QA Checklist

Date started:
Vercel URL:
Supabase project:
Tester wallet:
Network:

## Preconditions

- [ ] Vercel deployment is linked to the correct project.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set.
- [ ] `SESSION_SECRET` is set.
- [ ] `SIGNER_PRIVATE_KEY` is set and the signer is authorized where required.
- [ ] `NEXT_PUBLIC_SITE_URL` points to the deployed URL.
- [ ] Vault, USDC, and RPC env vars point to the intended Arc testnet/mainnet environment.
- [ ] Supabase migrations `20260501143000` and `20260501164513` are present remotely.
- [ ] Tester wallet has enough gas and test USDC.
- [ ] DB password used during setup has been rotated.

## Smoke Gates

- [ ] `/` loads with no runtime overlay.
- [ ] `/games/wheel` loads.
- [ ] `/games/dice` loads.
- [ ] `/games/tower` loads.
- [ ] `/games/crash` loads.
- [ ] `/games/laser` loads.
- [ ] Browser console has no application errors.
- [ ] Missing sound warnings are absent or confirmed harmless.

## Wallet Session

- [ ] Connect external wallet.
- [ ] ARCade auth challenge is generated.
- [ ] Wallet signature succeeds.
- [ ] `/api/auth/session` returns authenticated wallet.
- [ ] Refresh page and session persists.
- [ ] Disconnect/logout clears session.

## User Profile

- [ ] First wallet connection creates or fetches user.
- [ ] Username prompt completes successfully.
- [ ] Username update cannot spoof another wallet.
- [ ] Profile page shows wallet and stats shell.

## Deposit And Balance Sync

- [ ] Open deposit modal.
- [ ] Wallet balance loads.
- [ ] Vault balance loads.
- [ ] Deposit transaction submits.
- [ ] Transaction confirms on explorer.
- [ ] `/api/balance/sync` updates `users.server_balance`.
- [ ] Navbar balance matches Supabase `users.server_balance`.
- [ ] Refresh page and balance persists.

## Game Settlement Matrix

Record initial `server_balance` before each game.

### Wheel
- [ ] Spin with valid bet.
- [ ] `game_rounds` row starts then finalizes.
- [ ] `game_sessions` row is written once.
- [ ] Balance decreases by bet and increases by payout when won.
- [ ] Insufficient balance is rejected without a session row.

### Dice
- [ ] Roll with valid bet.
- [ ] Result is server-returned, not client-generated for real mode.
- [ ] Win/loss updates balance correctly.
- [ ] Invalid target is rejected.
- [ ] `game_sessions.game = dice`.

### Tower
- [ ] Start round debits bet.
- [ ] Valid reveal advances version.
- [ ] Skipped row is rejected.
- [ ] Loss finalizes once.
- [ ] Cashout finalizes using last completed row.
- [ ] Refresh during active round does not create duplicate settlement.

### Crash
- [ ] Start round stores `crashPoint`, `startTime`, `crashTime`.
- [ ] Polling before crash does not reveal crash point.
- [ ] Cashout before crash finalizes win.
- [ ] Cashout multiplier ahead of server time is rejected.
- [ ] Cashout after crash time finalizes loss.
- [ ] Crash loss writes one `game_sessions` row.

### Laser
- [ ] Start round debits bet.
- [ ] Selection calls server and returns server laser target.
- [ ] Invalid cell is rejected.
- [ ] Safe turn increments version and shrinks grid.
- [ ] Loss finalizes once.
- [ ] Cashout after one survived turn credits payout.

## Rewards And Rankings

- [ ] `/api/stats` reflects game counts.
- [ ] `/profile` reflects recent games.
- [ ] `/leaderboard` includes activity after settlement.
- [ ] Daily bonus claim works once.
- [ ] Daily bonus second claim is rejected.
- [ ] Quest progress updates after real game sessions.
- [ ] Completed quest claim credits points once.
- [ ] Milestone claim credits points once.

## Withdraw

- [ ] Open withdraw modal.
- [ ] Reserve withdrawal rejects amount above `server_balance`.
- [ ] Reserve withdrawal decreases `server_balance`.
- [ ] Contract withdrawal transaction submits.
- [ ] Confirm withdrawal keeps reserved balance removed.
- [ ] Failed/rejected contract withdrawal cancels reservation.
- [ ] Refresh page and balances remain consistent.

## Bridge

- [ ] Review the current Circle Bridge Kit docs before changing mechanics.
- [ ] Open bridge modal from deposit flow.
- [ ] Source chains render.
- [ ] Source balance loads for selected source chain.
- [ ] Invalid amount is rejected.
- [ ] User rejection displays a clear error.
- [ ] Successful bridge is verified only with a real test transfer.
- [ ] After bridge success, deposit/sync path updates ARCade balance.

## Database Verification Queries

Run these in Supabase SQL editor after test plays:

```sql
select wallet_address, server_balance, updated_at
from users
where wallet_address = lower('<tester_wallet>');
```

```sql
select id, wallet_address, game, bet_amount, status, version, state_json, result_json, finalized_at
from game_rounds
where wallet_address = lower('<tester_wallet>')
order by created_at desc
limit 20;
```

```sql
select wallet_address, game, bet_amount, payout, multiplier, outcome, created_at
from game_sessions
where wallet_address = lower('<tester_wallet>')
order by created_at desc
limit 20;
```

```sql
select wallet_address, quest_date, quest_id, progress, completed, reward_claimed
from daily_quests
where wallet_address = lower('<tester_wallet>')
order by quest_date desc, quest_id;
```

## Pass Criteria

- [ ] No wallet spoofing path found.
- [ ] No duplicate settlement found.
- [ ] No game can settle without an ARCade session.
- [ ] No client-side real-money outcome path remains.
- [ ] Balance is correct after deposit, each game, and withdraw.
- [ ] Supabase rows match UI state.
- [ ] All issues are recorded with exact URL, wallet, timestamp, console output, API response, and relevant DB rows.
```

- [ ] **Step 2: Review checklist for missing high-risk flows**

Confirm the checklist includes:

- Auth/session.
- Deposit/sync.
- All five games.
- Rewards/leaderboard/stats.
- Withdraw reserve/confirm/cancel.
- Bridge path.
- Supabase verification queries.

- [ ] **Step 3: Commit the checklist**

Run:

```bash
git add docs/2026-05-02-production-money-path-qa-checklist.md
git commit -m "docs: add production money path QA checklist"
```

Expected: commit succeeds after review.

---

## Task 2: Add Balance Sync Route Tests

**Files:**
- Create: `arcade/src/__tests__/balance-sync-route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `arcade/src/__tests__/balance-sync-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSessionWallet: vi.fn(),
    checkRateLimit: vi.fn(),
    getClientIp: vi.fn(),
    readContract: vi.fn(),
    formatUnits: vi.fn(),
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
    createServerClient: vi.fn(() => ({
        from: vi.fn(() => ({
            update: mocks.update,
        })),
    })),
}));

vi.mock('viem', async () => {
    const actual = await vi.importActual<typeof import('viem')>('viem');
    return {
        ...actual,
        createPublicClient: vi.fn(() => ({
            readContract: mocks.readContract,
        })),
        http: vi.fn(),
        formatUnits: mocks.formatUnits,
    };
});

function createRequest() {
    return new Request('http://localhost/api/balance/sync', {
        method: 'POST',
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
        process.env.NEXT_PUBLIC_ARCADE_VAULT_ADDRESS = '0x1111111111111111111111111111111111111111';
        process.env.NEXT_PUBLIC_ARC_RPC_URL = 'https://rpc.example';
        mocks.getClientIp.mockReturnValue('127.0.0.1');
        mocks.checkRateLimit.mockResolvedValue({ success: true });
        mocks.getSessionWallet.mockResolvedValue('0x2222222222222222222222222222222222222222');
        mocks.readContract.mockResolvedValue(12_500_000n);
        mocks.formatUnits.mockReturnValue('12.5');
        mocks.eq.mockResolvedValue({ error: null });
        mocks.update.mockReturnValue({ eq: mocks.eq });
    });

    it('rejects unauthenticated sync requests', async () => {
        mocks.getSessionWallet.mockResolvedValue(null);
        const POST = await loadPostHandler();

        const response = await POST(createRequest() as never);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
        expect(mocks.readContract).not.toHaveBeenCalled();
    });

    it('reads vault balance and writes server balance for the session wallet', async () => {
        const POST = await loadPostHandler();

        const response = await POST(createRequest() as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            balance: 12.5,
        });
        expect(mocks.readContract).toHaveBeenCalledWith(expect.objectContaining({
            functionName: 'balances',
            args: ['0x2222222222222222222222222222222222222222'],
        }));
        expect(mocks.update).toHaveBeenCalledWith({ server_balance: 12.5 });
        expect(mocks.eq).toHaveBeenCalledWith('wallet_address', '0x2222222222222222222222222222222222222222');
    });

    it('returns 500 when Supabase update fails', async () => {
        mocks.eq.mockResolvedValue({ error: new Error('db failed') });
        const POST = await loadPostHandler();

        const response = await POST(createRequest() as never);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe('Failed to sync balance');
    });
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run:

```bash
cd arcade
npm test -- --run src/__tests__/balance-sync-route.test.ts
```

Expected: pass if current route already matches the desired contract; otherwise fail with the exact contract mismatch.

- [ ] **Step 3: Patch only if the test reveals a real route bug**

If the test fails, inspect `arcade/src/app/api/balance/sync/route.ts`. Only change behavior to satisfy:

- unauthenticated requests return `401`.
- the session wallet is the only wallet used.
- vault `balances(wallet)` result is converted from USDC 6 decimals.
- `users.server_balance` is updated for the lowercased session wallet.

- [ ] **Step 4: Verify**

Run:

```bash
cd arcade
npm test -- --run src/__tests__/balance-sync-route.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/__tests__/balance-sync-route.test.ts src/app/api/balance/sync/route.ts
git commit -m "test: cover balance sync route"
```

Expected: commit succeeds after review.

---

## Task 3: Add Withdraw Reserve/Confirm/Cancel Route Tests

**Files:**
- Create: `arcade/src/__tests__/balance-withdraw-route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `arcade/src/__tests__/balance-withdraw-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSessionWallet: vi.fn(),
    checkRateLimit: vi.fn(),
    getClientIp: vi.fn(),
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
    createServerClient: vi.fn(() => ({
        rpc: mocks.rpc,
    })),
}));

function createJsonRequest(method: 'POST' | 'PUT', body: unknown) {
    return new Request('http://localhost/api/balance/withdraw', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function loadHandlers() {
    vi.resetModules();
    const route = await import('@/app/api/balance/withdraw/route');
    return { POST: route.POST, PUT: route.PUT };
}

describe('/api/balance/withdraw', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getClientIp.mockReturnValue('127.0.0.1');
        mocks.checkRateLimit.mockResolvedValue({ success: true });
        mocks.getSessionWallet.mockResolvedValue('0x2222222222222222222222222222222222222222');
        mocks.rpc.mockResolvedValue({ data: { success: true, new_balance: 7 }, error: null });
    });

    it('rejects unauthenticated reserve requests', async () => {
        mocks.getSessionWallet.mockResolvedValue(null);
        const { POST } = await loadHandlers();

        const response = await POST(createJsonRequest('POST', { amount: 5 }) as never);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('reserves withdrawal against the authenticated wallet only', async () => {
        const { POST } = await loadHandlers();

        const response = await POST(createJsonRequest('POST', { amount: 5 }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mocks.rpc).toHaveBeenCalledWith('reserve_withdrawal', {
            p_wallet: '0x2222222222222222222222222222222222222222',
            p_amount: 5,
        });
    });

    it('rejects invalid reserve amounts before RPC', async () => {
        const { POST } = await loadHandlers();

        const response = await POST(createJsonRequest('POST', { amount: 0 }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Invalid amount');
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('confirms withdrawal after contract success', async () => {
        const { PUT } = await loadHandlers();

        const response = await PUT(createJsonRequest('PUT', { amount: 5, action: 'confirm' }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mocks.rpc).toHaveBeenCalledWith('confirm_withdrawal', {
            p_wallet: '0x2222222222222222222222222222222222222222',
            p_amount: 5,
        });
    });

    it('cancels withdrawal reservation after contract failure', async () => {
        const { PUT } = await loadHandlers();

        const response = await PUT(createJsonRequest('PUT', { amount: 5, action: 'cancel' }) as never);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mocks.rpc).toHaveBeenCalledWith('cancel_withdrawal', {
            p_wallet: '0x2222222222222222222222222222222222222222',
            p_amount: 5,
        });
    });

    it('rejects unknown withdrawal actions', async () => {
        const { PUT } = await loadHandlers();

        const response = await PUT(createJsonRequest('PUT', { amount: 5, action: 'release' }) as never);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Invalid action');
    });
});
```

- [ ] **Step 2: Run test to verify route contract**

Run:

```bash
cd arcade
npm test -- --run src/__tests__/balance-withdraw-route.test.ts
```

Expected: pass if current route matches the desired contract; otherwise fail with the exact route mismatch.

- [ ] **Step 3: Patch only if needed**

If the test fails, inspect `arcade/src/app/api/balance/withdraw/route.ts` and enforce:

- session wallet only.
- `POST` reserves.
- `PUT action=confirm` confirms.
- `PUT action=cancel` cancels.
- invalid action returns `400`.
- invalid amount returns `400`.

- [ ] **Step 4: Verify**

Run:

```bash
cd arcade
npm test -- --run src/__tests__/balance-withdraw-route.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/__tests__/balance-withdraw-route.test.ts src/app/api/balance/withdraw/route.ts
git commit -m "test: cover withdrawal reservation flow"
```

Expected: commit succeeds after review.

---

## Task 4: Add Money Path Invariant Tests

**Files:**
- Create: `arcade/src/__tests__/money-path-invariants.test.ts`

- [ ] **Step 1: Write invariant tests**

Create `arcade/src/__tests__/money-path-invariants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateCrashPayout, calculateDicePayout, calculateLaserPayout, calculateTowerPayout, calculateWheelPayout } from '@/lib/game-logic';
import { canTransitionRound, isActiveRound } from '@/lib/game-rounds';

describe('money path invariants', () => {
    it('never pays negative payouts from game calculators', () => {
        const results = [
            calculateDicePayout(10, 50, true, 20),
            calculateDicePayout(10, 50, true, 80),
            calculateWheelPayout(10, 0),
            calculateWheelPayout(10, 14),
            calculateTowerPayout(10, 0),
            calculateCrashPayout(10, 15000, 20000),
            calculateCrashPayout(10, 25000, 20000),
            calculateLaserPayout(10, 1),
        ];

        for (const result of results) {
            expect(result.payout).toBeGreaterThanOrEqual(0);
            expect(result.multiplier).toBeGreaterThanOrEqual(0);
        }
    });

    it('allows terminal transitions only from active rounds', () => {
        expect(canTransitionRound('active', 'won')).toBe(true);
        expect(canTransitionRound('active', 'lost')).toBe(true);
        expect(canTransitionRound('won', 'lost')).toBe(false);
        expect(canTransitionRound('lost', 'won')).toBe(false);
        expect(canTransitionRound('cancelled', 'won')).toBe(false);
    });

    it('treats expired active rounds as inactive', () => {
        expect(isActiveRound({
            status: 'active',
            expires_at: new Date(Date.now() + 60_000).toISOString(),
        })).toBe(true);

        expect(isActiveRound({
            status: 'active',
            expires_at: new Date(Date.now() - 60_000).toISOString(),
        })).toBe(false);
    });

    it('treats terminal rounds as inactive even before expiry', () => {
        expect(isActiveRound({
            status: 'won',
            expires_at: new Date(Date.now() + 60_000).toISOString(),
        })).toBe(false);
    });
});
```

- [ ] **Step 2: Run invariant tests**

Run:

```bash
cd arcade
npm test -- --run src/__tests__/money-path-invariants.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/__tests__/money-path-invariants.test.ts
git commit -m "test: document money path invariants"
```

Expected: commit succeeds after review.

---

## Task 5: Run The Pre-Deploy QA Gate

**Files:**
- Modify: `docs/2026-05-01-arcade-rebuild-audit.md`

- [ ] **Step 1: Run full tests**

Run:

```bash
cd arcade
npm test -- --run
```

Expected: all test files pass.

- [ ] **Step 2: Run lint**

Run:

```bash
cd arcade
npm run lint
```

Expected: command exits `0`. Warnings are acceptable only if documented and non-blocking.

- [ ] **Step 3: Run TypeScript**

Run:

```bash
cd arcade
npx tsc --noEmit
```

Expected: exits `0`.

- [ ] **Step 4: Run production build**

Run:

```bash
cd arcade
npm run build
```

Expected: exits `0` and does not emit the `metadataBase` warning.

- [ ] **Step 5: Update audit**

In `docs/2026-05-01-arcade-rebuild-audit.md`, update the quality section with exact results:

```markdown
- Pre-deploy money-path test suite passes.
- Balance sync route tests pass.
- Withdrawal reserve/confirm/cancel tests pass.
- Money path invariant tests pass.
```

- [ ] **Step 6: Commit**

Run:

```bash
git add docs/2026-05-01-arcade-rebuild-audit.md
git commit -m "docs: update predeploy QA status"
```

Expected: commit succeeds after review.

---

## Task 6: Run Live Vercel QA After Deployment

**Files:**
- Modify: `docs/2026-05-02-production-money-path-qa-checklist.md`
- Modify: `docs/2026-05-01-arcade-rebuild-audit.md`

- [ ] **Step 1: Deploy to Vercel preview**

Run:

```bash
cd arcade
vercel
```

Expected: Vercel returns a preview URL.

- [ ] **Step 2: Verify Vercel env vars**

Run:

```bash
cd arcade
vercel env ls
```

Expected: required Supabase, session, signer, vault, RPC, Dynamic, and site URL env vars exist for the target environment.

- [ ] **Step 3: Open the preview URL**

Run:

```bash
agent-browser open <vercel_preview_url>
```

Expected: homepage loads without runtime overlay.

- [ ] **Step 4: Execute checklist**

Open `docs/2026-05-02-production-money-path-qa-checklist.md` and fill every checkbox with pass/fail notes.

For each failure, record:

```markdown
### Issue: <short title>

- URL:
- Wallet:
- Time:
- Expected:
- Actual:
- Console:
- API response:
- Supabase rows:
- Screenshot:
```

- [ ] **Step 5: Update audit readiness**

After live QA, update `docs/2026-05-01-arcade-rebuild-audit.md`:

```markdown
## Live Vercel QA

- Vercel URL: <url>
- Date: <date>
- Wallet session: pass/fail
- Deposit/sync: pass/fail
- Games: pass/fail
- Rewards/rankings: pass/fail
- Withdraw: pass/fail
- Bridge: pass/fail
- Blocking issues:
```

- [ ] **Step 6: Decide readiness**

If all checklist sections pass, mark existing gameplay ready for UI refresh planning.

If any money-path section fails, fix that before UI redesign or new games.

---

## Self-Review

- Spec coverage: This plan covers pre-deploy automated QA, Vercel live QA, money path flows, bridge caution, and production readiness recording.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: Test file paths, route names, and helper names match the current codebase.
