# ARCade Rebuild Audit

Date: 2026-05-01
Updated: 2026-05-02

## Goal

Rebuild ARCade so the existing games are reliable before adding new games. The target is a mainnet-ready architecture for Arc, even while Arc is still testnet.

## Non-Negotiables

- External wallet users must always be able to connect and play without embedded-wallet provider limits.
- Embedded wallets are an onboarding layer, not a hard dependency for the game.
- Game APIs must not trust provider-specific JWTs.
- Redis may improve latency, but Redis must not be the only source of truth for login, balances, or recoverable game state.
- Game outcomes, balances, quests, and leaderboard records must come from one canonical settlement flow.
- Client-side randomness is not acceptable for real-money or mainnet-ready gameplay.

## Current Architecture Findings

## Rebuild Progress

- ARCade-owned wallet session auth is now the protected API path for balance, user, game recording, quests, milestones, and daily bonus routes.
- Auth challenges are stored durably in Supabase instead of Redis.
- `game_rounds` has been added as the durable source of truth for recoverable round state.
- `start_game_round_atomic` debits a bet and starts a durable round in one database transaction.
- `finalize_game_round_atomic` finalizes a round once, credits payout, and writes `game_sessions` in one database transaction.
- Wheel has been moved off client-side randomness for real users: the frontend calls `/api/wheel`, the server chooses the segment, starts/finalizes the round, and returns the result for animation.
- Dice has been moved onto the same server-owned settlement path: the frontend calls `/api/dice/roll`, the server chooses the result, starts/finalizes the round, and returns the authoritative payout.
- Tower now uses durable server state for real users: the server starts the round, enforces row progression, records revealed death tiles, and finalizes loss/cashout through the round settlement flow.
- Crash now starts durable rounds, stores the server crash point in `game_rounds`, polls without revealing the crash point early, and finalizes cashout/loss through the round settlement flow.
- Crash cashout now validates against server elapsed time, rejects client multipliers ahead of the server clock, and finalizes late cashout attempts as losses after crash time.
- Laser now starts durable rounds, stores shrinking-grid state in `game_rounds`, validates each selection server-side, generates laser targets server-side, and finalizes loss/cashout through the round settlement flow.
- Production money-path QA now has a tracked Vercel checklist covering wallet session, profile, deposit/sync, every current game, rewards, withdrawal, bridge, and Supabase verification queries.
- `/api/balance/sync` has route tests for rate limiting, auth, vault reads, Supabase updates, and error handling.
- `/api/balance/withdraw` has route tests for reserve, confirm, cancel, unauthorized, insufficient-balance, RPC failure, and malformed action handling.
- Withdrawal actions now validate `amount` and `action` before any Supabase mutation.

### Wallet And Auth

- The app is tightly coupled to Dynamic through `DynamicProvider`, `useDynamicContext`, `getAuthToken`, and Dynamic JWT verification.
- Most protected APIs use Dynamic JWTs through `getVerifiedWallet`.
- A separate ARCade session cookie flow already exists through `/api/auth/challenge`, `/api/auth/verify`, and `getSessionWallet`.
- `/api/game/settle` uses the ARCade session cookie, while balance, quest, milestone, daily bonus, and game recording APIs use Dynamic JWTs.
- User registration and username updates accept a wallet address in the request body and do not currently prove ownership in the route itself.

Target direction:

- Replace provider-specific auth in APIs with ARCade-owned wallet-signature sessions.
- Put Dynamic, Circle, WalletConnect, injected wallets, and future providers behind a wallet adapter.
- Keep external wallets as the permanent free path.

### Redis

Redis currently handles:

- Rate limiting.
- Legacy fallback paths only where still wired.

Risk:

- Rate limiting fails open safely.
- Any remaining Redis-only path should be treated as non-critical or migrated before mainnet.

Target direction:

- Store auth challenges durably with expiry in Postgres.
- Store game rounds durably in Postgres.
- Use Redis only as hot cache for active game reads and rate limiting.
- Existing active game rounds must be recoverable or finalizable without Redis.

## Game Findings

### Dice

Current behavior:

- Frontend calls `/api/dice/roll` for real users.
- Server generates the result and signature.
- Server starts and finalizes a durable Dice round.
- Demo mode remains local-only and does not write real balances or leaderboards.

Issues:

- The visible game does not call the Dice contract.
- Returned signature is still not used by the visible on-chain settlement path.

Target:

- Keep Dice on the canonical durable round flow.
- Add contract alignment only after the DB-backed game loop is stable.
- For on-chain settlement, align the nonce/signature with the Dice contract or replace the current split flow.

### Wheel

Current behavior:

- `/api/wheel` now requires the ARCade session cookie.
- Server chooses the segment with secure randomness.
- Server starts and finalizes a durable Wheel round.
- Frontend calls `/api/wheel` for real users and only uses local randomness in demo mode.

Issues:

- Contract settlement is still not the visible Wheel path.
- Contract tests appear stale: they expect older multiplier values that no longer match `WheelGame.sol`.

Target:

- Keep Wheel on the canonical durable round flow.
- Add route-level tests around successful spin, insufficient balance, and duplicate active-round handling.
- Tests must be updated to the actual multiplier table.

### Tower

Current behavior:

- Frontend calls `/api/tower/reveal` with `start`, `reveal`, and `cashout` actions for real users.
- Server stores active Tower state in `game_rounds`.
- Server enforces current row progression and tile bounds.
- Server finalizes loss and cashout through `finalize_game_round_atomic`.
- Demo mode remains local-only and does not write real balances or leaderboards.
- The Tower contract has its own active game state, but the frontend path does not use it.

Issues:

- The Tower contract is still not the visible settlement path.
- Full live verification still depends on applying the tracked Supabase migration.

Target:

- Keep Tower on the canonical durable round flow.
- Add live DB verification after the migration is applied.
- Decide later whether mainnet Tower remains DB-first with reconciliation or moves to one contract settlement path.

### Crash

Current behavior:

- `/api/crash` requires the ARCade session cookie for real users.
- Server starts a durable Crash round with `crashPoint`, `startTime`, and `crashTime`.
- Frontend polls `/api/crash` with the current displayed multiplier; the server only reveals the crash point once the multiplier reaches it.
- Frontend cashout now calls `/api/crash` and the server validates the cashout against the stored crash point.
- Demo mode remains local-only and does not write real balances or leaderboards.

Issues:

- Contract settlement is still not the visible Crash path.
- The client still computes the displayed multiplier locally for animation, but the server no longer trusts that value for cashout.

Target:

- Keep Crash on the canonical durable round flow.
- Align contract or vault settlement before mainnet so Crash has one final settlement path.

### Laser

Current behavior:

- `/api/laser` requires the ARCade session cookie for real users.
- Server starts a durable Laser round with current turn, remaining grid size, and destroyed row/column history.
- Frontend calls `/api/laser` for each real-user selection.
- Server validates the selected cell against the current grid, generates the laser target, updates durable state, and finalizes loss or cashout.
- Demo mode remains local-only and does not write real balances or leaderboards.
- The Laser contract has active-game state but is not used by the frontend path.

Issues:

- Contract settlement is still not the visible Laser path.
- The visible multiplier ladder should be checked against `calculateLaserPayout` and contract math before mainnet.

Target:

- Keep Laser on the canonical durable round flow.
- Decide later whether mainnet Laser remains DB-first with reconciliation or moves to one contract settlement path.

## Balance And Settlement Findings

Current behavior:

- Users deposit and withdraw on-chain through `ARCadeVault`.
- `server_balance` in Supabase mirrors vault balance after deposit sync.
- Games update `server_balance` through `start_game_round_atomic` and `finalize_game_round_atomic`.
- `/api/game/settle` separately calls vault `placeBet` and `settleBet`, but the visible game pages do not use it.
- Game-specific contracts exist and are deployed, but the current frontend does not consistently use them.

Issues:

- There are multiple settlement models:
  - Supabase-only game settlement.
  - Vault direct settlement through `/api/game/settle`.
  - Game-contract settlement with server signatures.
- Multiple models make balance drift and double-accounting likely.
- Mainnet readiness requires one canonical model.

Target:

- Choose one settlement source of truth before mainnet.
- Recommended for the rebuild phase:
  - Server-authoritative game rounds.
  - Atomic DB settlement for testnet UX.
  - Explicit reconciliation with vault balance.
  - Later mainnet mode can use game contracts or a single settlement contract path consistently.

## Leaderboard, Quests, And Rewards

Current behavior:

- Leaderboards, quests, milestones, badges, profile stats, and weekly distributions all read from `game_sessions`.
- Quest and milestone claim routes use Dynamic JWTs.
- Public profile/stats endpoints accept wallet query params.

Issues:

- If game sessions are wrong, all rankings and rewards are wrong.
- Reward claim routes need ARCade session auth.
- Some weekly/date calculations are duplicated across files.
- `useStreak` only supports `dice | tower | crash` in its type, while the app now has five games.

Target:

- `game_sessions` must only be written by authoritative settlement.
- Reward claims must use ARCade session auth.
- Shared week/date helpers should be centralized.
- Types must include all supported games.

## Test And Quality Findings

Current test results:

- `npm test -- --run` passes: 86 tests.
- `npm run lint` passes with warnings.
- `npx tsc --noEmit` passes.
- `npm run build` passes.
- Focused money-path QA tests pass: 22 tests across balance sync, withdrawal, and settlement invariants.
- `forge test` compiled, then Foundry crashed in this macOS environment before reporting test results.

Notable quality issues:

- Contract Wheel tests appear stale relative to current multipliers.
- Browser/test console output still has cleanup work: missing sound-file warnings in some browser sessions and bridge test debug logs.
- `metadataBase` is configured for production metadata.
- `BridgeModal` act warnings have been cleared from the focused test run.
- Contract and E2E coverage still need to be aligned with the DB-backed game flow.

## Rebuild Standard

Every game should have:

- A typed round state model.
- A start endpoint.
- One or more action endpoints.
- A finalize endpoint or finalizing action.
- Server-side validation for every transition.
- Idempotency protection.
- Durable DB state with expiry.
- Optional Redis cache for hot reads.
- Atomic balance and session recording.
- Tests for win, loss, cashout, invalid action, expired round, insufficient balance, duplicate finalization, and unauthorized wallet.

## Proposed Implementation Phases

### Phase 1: Foundation

- Introduce ARCade wallet/session auth as the API standard.
- Move auth challenges out of Redis-only storage.
- Protect user registration and username update with wallet ownership.
- Define shared game types and round status types.

### Phase 2: Canonical Game Round System

- Add durable game round storage.
- Add atomic round finalization and game-session writing.
- Make Redis optional hot cache.
- Add tests for round lifecycle and fallback behavior.

### Phase 3: Fix Existing Games

- Dice: server-authoritative single-roll settlement.
- Wheel: remove client-side outcome generation.
- Tower: server-enforced row progression and cashout.
- Crash: durable active round and server-validated cashout.
- Laser: remove client-side outcome generation and enforce turn state server-side.

### Phase 4: Balance And Rewards

- Ensure all game results update `server_balance`, `game_sessions`, quests, milestones, badges, and leaderboard inputs consistently.
- Add reconciliation checks against on-chain vault balances.
- Keep expanding withdrawal reservation/confirmation coverage around the canonical balance model.

### Phase 5: Mainnet Hardening

- Decide final on-chain settlement model.
- Add commit-reveal or VRF-grade randomness design.
- Add idempotency keys and audit logs.
- Add contract tests that match current game rules.
- Add end-to-end tests for deposit, play, cashout/loss, leaderboard update, and withdrawal.
