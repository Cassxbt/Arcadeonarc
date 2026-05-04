# ARCade Foundation Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace provider-coupled auth and Redis-only critical state with ARCade-owned wallet sessions and durable round infrastructure.

**Architecture:** The app will authenticate API writes with an ARCade session cookie created from wallet signature verification. Supabase/Postgres becomes the durable source for auth challenges and game rounds; Redis remains optional cache/rate limiting only. This phase does not rewrite each game UI yet, but it creates the foundation required to fix Dice, Wheel, Tower, Crash, and Laser correctly.

**Tech Stack:** Next.js App Router route handlers, React 19, TypeScript, Supabase service-role API, Viem signature verification, Vitest.

## Current Progress

- Durable auth challenge storage is implemented and covered by focused tests.
- Protected write APIs now use ARCade session cookies instead of Dynamic JWTs.
- Durable round schema and lifecycle helpers are implemented.
- Atomic SQL RPCs now exist for starting and finalizing game rounds.
- Wheel is the first game on the new server-owned outcome path for real users.
- Dice is also on the server-owned outcome and durable settlement path for real users.
- Tower now uses durable server state and server-enforced reveal/cashout progression for real users.
- Crash now uses durable server state for crash point storage, polling, cashout, and loss finalization for real users. Cashout is server-time validated, so clients cannot claim a multiplier ahead of elapsed server time.
- Laser now uses durable server state and server-enforced selection/cashout progression for real users.
- Remaining game work is hardening, live QA, contract-alignment decisions, and cleanup of stale tests/lint across the wider app.

---

## File Structure

- Modify: `arcade/supabase-migration.sql`
  Adds durable auth challenge and game round tables.
- Create: `arcade/src/lib/auth-challenges.ts`
  Owns challenge persistence, expiry, consume-once behavior.
- Modify: `arcade/src/app/api/auth/challenge/route.ts`
  Stores challenges in Supabase instead of Redis.
- Modify: `arcade/src/app/api/auth/verify/route.ts`
  Consumes Supabase challenges and issues the existing ARCade session cookie.
- Modify: `arcade/src/lib/auth-fetch.ts`
  Stops sending Dynamic JWTs and uses same-origin session cookies.
- Modify: `arcade/src/lib/auth-context.tsx`
  Keeps wallet-signature session flow, removes Dynamic-specific assumptions where possible.
- Modify protected API routes:
  - `arcade/src/app/api/games/route.ts`
  - `arcade/src/app/api/balance/sync/route.ts`
  - `arcade/src/app/api/balance/withdraw/route.ts`
  - `arcade/src/app/api/daily-bonus/route.ts`
  - `arcade/src/app/api/quests/route.ts`
  - `arcade/src/app/api/milestones/route.ts`
  - `arcade/src/app/api/users/route.ts`
- Create tests:
  - `arcade/src/__tests__/auth-challenges.test.ts`
  - `arcade/src/__tests__/auth-routes.test.ts`
  - `arcade/src/__tests__/protected-api-auth.test.ts`

## Task 1: Add Durable Auth And Round Tables

**Files:**
- Modify: `arcade/supabase-migration.sql`

- [ ] **Step 1: Add migration SQL**

Append this SQL after the existing functions:

```sql
-- Durable wallet auth challenges.
CREATE TABLE IF NOT EXISTS auth_challenges (
    wallet_address TEXT PRIMARY KEY,
    challenge_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires_at
ON auth_challenges (expires_at);

-- Durable game round state. Redis may cache this, but this table is source of truth.
CREATE TABLE IF NOT EXISTS game_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    game TEXT NOT NULL CHECK (game IN ('dice', 'wheel', 'tower', 'crash', 'laser')),
    bet_amount NUMERIC NOT NULL CHECK (bet_amount > 0),
    nonce TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'won', 'lost', 'cashed_out', 'expired', 'cancelled')),
    state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_rounds_wallet_game_nonce
ON game_rounds (wallet_address, game, nonce);

CREATE INDEX IF NOT EXISTS idx_game_rounds_active_wallet
ON game_rounds (wallet_address, game, status)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_game_rounds_expires_at
ON game_rounds (expires_at)
WHERE status = 'active';
```

- [ ] **Step 2: Review SQL for portability**

Check that `gen_random_uuid()` is available in the Supabase project. If not, add:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

above the `game_rounds` table.

- [ ] **Step 3: No test command yet**

This migration is applied manually in Supabase for now. Verification happens when route tests mock the table access and during staging deployment.

## Task 2: Implement Auth Challenge Store

**Files:**
- Create: `arcade/src/lib/auth-challenges.ts`
- Create: `arcade/src/__tests__/auth-challenges.test.ts`

- [ ] **Step 1: Write failing tests**

Create `arcade/src/__tests__/auth-challenges.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashChallenge, isExpired } from '@/lib/auth-challenges';

describe('auth challenge helpers', () => {
  it('hashes the same challenge deterministically', async () => {
    const first = await hashChallenge('arcade-auth-test');
    const second = await hashChallenge('arcade-auth-test');

    expect(first).toBe(second);
    expect(first).not.toBe('arcade-auth-test');
  });

  it('detects expired timestamps', () => {
    expect(isExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isExpired(new Date(Date.now() + 60_000).toISOString())).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
cd arcade
npm test -- --run src/__tests__/auth-challenges.test.ts
```

Expected: fail because `@/lib/auth-challenges` does not exist.

- [ ] **Step 3: Implement minimal helper and store module**

Create `arcade/src/lib/auth-challenges.ts`:

```ts
import { createHash } from 'crypto';
import { createServerClient } from './supabase-server';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function hashChallenge(challenge: string): Promise<string> {
    return createHash('sha256').update(challenge).digest('hex');
}

export function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt).getTime() <= Date.now();
}

export async function storeAuthChallenge(wallet: string, challenge: string): Promise<void> {
    const supabase = createServerClient();
    const walletLower = wallet.toLowerCase();
    const challengeHash = await hashChallenge(challenge);
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

    const { error } = await supabase.from('auth_challenges').upsert({
        wallet_address: walletLower,
        challenge_hash: challengeHash,
        expires_at: expiresAt,
    });

    if (error) {
        throw error;
    }
}

export async function consumeAuthChallenge(wallet: string, challenge: string): Promise<boolean> {
    const supabase = createServerClient();
    const walletLower = wallet.toLowerCase();
    const challengeHash = await hashChallenge(challenge);

    const { data, error } = await supabase
        .from('auth_challenges')
        .select('challenge_hash, expires_at')
        .eq('wallet_address', walletLower)
        .single();

    if (error || !data || isExpired(data.expires_at) || data.challenge_hash !== challengeHash) {
        return false;
    }

    await supabase
        .from('auth_challenges')
        .delete()
        .eq('wallet_address', walletLower);

    return true;
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
cd arcade
npm test -- --run src/__tests__/auth-challenges.test.ts
```

Expected: pass.

## Task 3: Move Auth Routes Off Redis

**Files:**
- Modify: `arcade/src/app/api/auth/challenge/route.ts`
- Modify: `arcade/src/app/api/auth/verify/route.ts`

- [ ] **Step 1: Update challenge route**

Replace Redis usage with `storeAuthChallenge`:

```ts
import { storeAuthChallenge } from '@/lib/auth-challenges';
```

and replace the `redis.set` block with:

```ts
await storeAuthChallenge(walletLower, challenge);
```

The route should return `500` if storage fails. Do not return a challenge that cannot be verified.

- [ ] **Step 2: Update verify route**

Replace Redis lookup/delete with `consumeAuthChallenge(walletLower, challenge)`. The request body must include `{ wallet, signature, challenge }`.

Validation shape:

```ts
const { wallet, signature, challenge } = await request.json();

if (!challenge || typeof challenge !== 'string') {
    return NextResponse.json({ error: 'Challenge required' }, { status: 400 });
}

const challengeOk = await consumeAuthChallenge(walletLower, challenge);
if (!challengeOk) {
    return NextResponse.json({ error: 'Challenge expired or not found' }, { status: 400 });
}
```

Then verify:

```ts
const message = createSignMessage(challenge);
```

- [ ] **Step 3: Update client auth context**

In `arcade/src/lib/auth-context.tsx`, keep the raw `challenge` from `/api/auth/challenge` and send it to `/api/auth/verify`:

```ts
const { challenge, message } = await challengeResponse.json();
```

and:

```ts
body: JSON.stringify({ wallet: walletLower, signature, challenge }),
```

- [ ] **Step 4: Run auth helper tests**

Run:

```bash
cd arcade
npm test -- --run src/__tests__/auth-challenges.test.ts
```

Expected: pass.

## Task 4: Make Session Cookie Auth The API Standard

**Files:**
- Modify: `arcade/src/lib/auth-fetch.ts`
- Modify: `arcade/src/app/api/games/route.ts`
- Modify: `arcade/src/app/api/balance/sync/route.ts`
- Modify: `arcade/src/app/api/balance/withdraw/route.ts`
- Modify: `arcade/src/app/api/daily-bonus/route.ts`
- Modify: `arcade/src/app/api/quests/route.ts`
- Modify: `arcade/src/app/api/milestones/route.ts`

- [ ] **Step 1: Update `authFetch`**

Replace Dynamic token logic with cookie-based same-origin fetch:

```ts
'use client';

export function getAuthHeaders(): HeadersInit {
    return {
        'Content-Type': 'application/json',
    };
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    return fetch(url, {
        ...options,
        credentials: 'same-origin',
        headers,
    });
}
```

- [ ] **Step 2: Replace Dynamic JWT imports in protected API routes**

In each protected route, replace:

```ts
import { getVerifiedWallet } from '@/lib/verify-dynamic-jwt';
```

with:

```ts
import { getSessionWallet } from '@/lib/session';
```

Then replace:

```ts
const wallet = await getVerifiedWallet(request);
```

with:

```ts
const wallet = await getSessionWallet(request);
```

- [ ] **Step 3: Remove client-supplied wallet trust from protected route bodies**

Where a body still contains `wallet`, ignore it for authorization. The server wallet from `getSessionWallet` is the only wallet allowed for mutation.

- [ ] **Step 4: Run lint to collect remaining issues**

Run:

```bash
cd arcade
npm run lint
```

Expected for this task: Dynamic JWT import errors should be gone from touched files. Existing unrelated lint failures may remain until the cleanup phase.

## Task 5: Protect User Registration And Username Updates

**Files:**
- Modify: `arcade/src/app/api/users/route.ts`
- Modify: `arcade/src/lib/useUser.ts`

- [ ] **Step 1: Require ARCade session for POST and PATCH**

Add:

```ts
import { getSessionWallet } from '@/lib/session';
```

In `POST`, replace body wallet usage with:

```ts
const wallet = await getSessionWallet(request);
if (!wallet) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const { username } = await request.json();
const walletLower = wallet.toLowerCase();
```

In `PATCH`, use the same pattern.

- [ ] **Step 2: Update client registration calls**

In `arcade/src/lib/useUser.ts`, change POST body:

```ts
body: JSON.stringify({ username }),
```

and PATCH body:

```ts
body: JSON.stringify({ username }),
```

Use `authFetch` instead of raw `fetch` for POST and PATCH.

- [ ] **Step 3: Keep public GET for now**

Leave `GET /api/users?wallet=...` public because it powers public display and registration detection. Revisit privacy later if needed.

## Task 6: Verification Checkpoint

**Files:**
- No code changes unless tests reveal a direct issue from Tasks 1-5.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
cd arcade
npm test -- --run src/__tests__/auth-challenges.test.ts
```

Expected: pass.

- [ ] **Step 2: Run full frontend tests**

Run:

```bash
cd arcade
npm test -- --run
```

Expected: existing bridge tests may still fail until the bridge test cleanup task. Record failures exactly.

- [ ] **Step 3: Run lint**

Run:

```bash
cd arcade
npm run lint
```

Expected: existing lint failures may remain. No new lint failures should be introduced in touched files.

## Task 7: Write The Next Plan

**Files:**
- Create: `docs/superpowers/plans/2026-05-01-arcade-game-rounds.md`

- [ ] **Step 1: Create the game-round implementation plan**

The next plan must cover:

- `game_rounds` data access module.
- Typed round state for Dice, Wheel, Tower, Crash, and Laser.
- Atomic finalization helper.
- Redis cache wrapper with DB fallback.
- Tests for active, expired, finalized, duplicate-finalized, and unauthorized rounds.

- [ ] **Step 2: Stop before game UI rewrites**

Do not edit game pages until the game-round plan is reviewed. The pages currently contain client-side outcome logic; replacing it without the shared round layer will create another partial architecture.

---

## Self-Review

- Spec coverage: This plan covers the foundation requirements from the audit: session auth, challenge durability, protected route ownership, and durable round schema.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: The plan consistently uses lowercase wallet addresses, existing `getSessionWallet`, and existing `authFetch` call sites.
