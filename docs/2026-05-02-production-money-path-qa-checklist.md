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
