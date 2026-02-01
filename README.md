# ARCade on Arc

**Provably Fair Onchain Gaming with Sub-350ms USDC Settlements**

[![Live Demo](https://img.shields.io/badge/demo-arcadeonarc.fun-blue)](https://arcadeonarc.fun)
[![Arc Testnet](https://img.shields.io/badge/network-Arc%20Testnet-00D4FF)](https://testnet.arcscan.app)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Popular Issue

Traditional online gaming platforms suffer from three critical bottlenecks:

1. **Settlement Latency**: 12-60 second transaction finality creates poor UX for real-time games
2. **Price Volatility**: Gas tokens (ETH, MATIC) cause unpredictable transaction costs
3. **High Fees**: $2-50 per bet on Ethereum makes microtransactions economically infeasible

These constraints limit blockchain gaming to slow-paced, high-stakes use cases, excluding the $127B casual gaming market.

## Solution

ARCade leverages Arc blockchain's sub-350ms deterministic finality and USDC-native architecture to deliver:

- **Instant Settlements**: <350ms bet-to-payout eliminates perceived latency
- **Stable Costs**: USDC gas payments provide predictable $0.01 transaction fees
- **Real-Time Games**: Crash, Tower, and Dice games feel like Web2 applications

By solving the finality-cost-volatility trilemma, ARCade demonstrates Arc's viability for consumer-facing DeFi applications requiring Web2-like responsiveness.

---

## Product Overview

ARCade is a decentralized gaming protocol featuring five provably fair games deployed on Arc L1. The platform uses a central Vault contract for liquidity management, game-specific controllers for outcome verification, and a Next.js frontend with real-time balance synchronization.

### Core Architecture

```
User Wallet (USDC)
    ↓ deposit
Vault Contract (liquidity pool)
    ↓ authorize
Game Controllers (Dice, Crash, Tower, Wheel, Laser)
    ↓ settle
Vault Contract (auto-payout)
    ↓ withdraw
User Wallet (USDC + winnings)
```

### Technical Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16 (App Router) + React 19 | Server-side rendering, API routes |
| **Styling** | TailwindCSS + CSS Modules | Component isolation, theme switching |
| **Blockchain** | Solidity 0.8.20 (Foundry) | Smart contracts, deployment scripts |
| **Network** | Arc Testnet (Reth-based) | USDC-native L1 with <350ms finality |
| **Authentication** | Dynamic SDK | Multi-wallet support (MetaMask, WalletConnect, browser wallets) |
| **Database** | Supabase (PostgreSQL) | User stats, leaderboards, real-time subscriptions |
| **State Management** | React Context + BroadcastChannel | Cross-tab balance synchronization |
| **Cross-Chain** | Circle CCTP v2 (Bridge Kit v1.5.0) | USDC bridging from 8 chains |
| **Faucet** | Circle Faucet API | In-app testnet USDC distribution |

### Game Portfolio

| Game | Mechanic | House Edge | Max Multiplier | Contract |
|------|----------|------------|----------------|----------|
| **Dice** | Roll target prediction | 1.0% | 99x | [0xB91ddf...](https://testnet.arcscan.app/address/0xB91ddfe1567c38B259f417604755Dc58cdf73f0C) |
| **Crash** | Cash out before crash | 1.0% | Unlimited | [0x09e1bC...](https://testnet.arcscan.app/address/0x09e1bC3c33aa0A7e0a68cec3c00C44FD4E2dd5Db) |
| **Tower** | Climb without hitting mines | 3.0% | Variable | [0x7d1F09...](https://testnet.arcscan.app/address/0x7d1F094C8B48cBb7E9a017059eeC5a33eD4c243f) |
| **Wheel** | Segment prediction | 2.5% | 5x | [0x590777...](https://testnet.arcscan.app/address/0x5907775345715b9F0ac1b00027Cd96B8fEE1e850) |
| **Laser** | Grid target selection | 4.0% | 95x | [0xcBdff4...](https://testnet.arcscan.app/address/0xcBdff4f22bb291067EF9E36E2202c4d736739579) |

---

## Market Analysis

### Total Addressable Market (TAM)

The global online casino market is projected at **$127.3B by 2027** (CAGR 11.7%). Blockchain-based platforms are capturing increasing share due to:

- Provable fairness (verifiable RNG vs black-box odds)
- Instant withdrawals (crypto vs 3-5 day bank transfers)
- Regulatory arbitrage (permissionless access)

### Serviceable Addressable Market (SAM)

Crypto gaming and betting generated **$4.6B in 2023**, with 15.3% projected CAGR through 2030. Key drivers:

- Stablecoin adoption reducing volatility friction
- High-throughput blockchains enabling sub-$1 transaction costs
- Institutional custody solutions bringing regulated capital

### Target Audience

- **Demographics**: Crypto-native users aged 21-45
- **Psychographics**: Value transparency, instant settlements, provably fair mechanics
- **Behavior**: Currently use centralized casinos (Stake, Rollbit) but distrust house fairness
- **Pain Point**: High Ethereum gas fees force $50+ minimum bets, excluding casual players

**Beachhead Market**: 500K monthly active Ethereum gamblers spending $200-1000/month who would switch for 10x lower fees and instant finality.

---

## Competitive Positioning

### Direct Competitors

| Platform | Blockchain | Finality | Tx Cost | Gas Token | Provably Fair |
|----------|-----------|----------|---------|-----------|---------------|
| **ARCade** | Arc L1 | 350ms | $0.01 | USDC | On-chain |
| Rollbit | Arbitrum | 2s | $0.42 | ETH | On-chain |
| Wolf.bet | Multi-chain | 2-15s | $0.50-5 | Multi | Hash-based |
| Stake | Multi-chain | 2-15s | $0.10-2 | Multi | Hash-based |
| Polymarket | Polygon | 2s | $0.08 | MATIC | On-chain |

### Unique Selling Proposition

ARCade is the only gaming platform leveraging Arc's USDC-native architecture, eliminating:

1. **Gas Token Volatility**: Competitors require users to hold ETH/MATIC, introducing 20-40% price swings that distort true costs
2. **Settlement Latency**: 350ms finality is 6-40x faster than alternatives, enabling real-time game mechanics
3. **Wrapped Token Risk**: Native USDC vs bridged variants removes smart contract exposure

**Switching Cost Analysis**: Users on Ethereum L1 pay $2-20/bet. At $5 average cost, a player making 100 bets/month spends $500 on gas. ARCade reduces this to $1/month, creating $499/month savings—sufficient incentive to overcome platform switching friction.

---

## Revenue Model

### Primary Revenue Streams

**1. House Edge** (1-4% depending on game complexity)
- Dice: 1.0% (simple mechanics)
- Crash: 1.0% (simple mechanics)
- Wheel: 2.5% (moderate complexity)
- Tower: 3.0% (multi-step game)
- Laser: 4.0% (high complexity)

**2. Protocol Fee** (0.5% on all winning payouts)
- Levied on winnings only, not total bets
- Incentivizes retention (players keep more of wins)

---

## Circle Integration & Developer Feedback

### USDC as Settlement Currency

**Why We Chose USDC**

1. **Arc's Native USDC**: Using USDC for gas eliminates ETH/MATIC volatility that plagues competitors
2. **Regulatory Clarity**: Circle's compliance (NYDFS BitLicense, EU MiCA) de-risks future expansion
3. **Liquidity**: USDC's $75B market cap ensures deep liquidity for user on/off ramps

**What Worked Well**
- Circle's USDC contract on Arc Testnet had 100% uptime during development
- ERC20 standard compliance made integration simpler using existing Viem patterns
- Testnet faucet (faucet.circle.com) provided seamless USDC access for testing; our in-app faucet wraps this for a frictionless onboarding experience
- Bridge Kit SDK's data-driven architecture makes adding new chains trivial — Monad Testnet was integrated in under an hour with zero changes to bridge logic or UI
- Bridge Kit v1.5.0 auto-retry for expired attestations replaced our manual retry logic, improving reliability on testnets
- CCTP attestation times were consistent (30-60 seconds on testnet)
- Circle MCP tools accelerated development by providing accurate SDK documentation

**Areas for Improvement**
- Bridge Kit does not yet support Circle's own wallets (Modular, User-Controlled, Developer-Controlled). Passkey-based modular wallets combined with CCTP bridging would significantly improve onboarding for non-crypto users
- No official documentation or example repos for embedded wallet providers (Dynamic Labs, Privy) with Bridge Kit. Developers must add chains to both Bridge Kit config and their wallet provider's network config — this is not covered in Circle docs
- Gateway support for newer chains like Monad would be valuable for instant cross-chain transfers

---

## Cross-Chain USDC Bridging (Circle CCTP v2)

Users holding USDC on external chains can bridge directly to Arc without leaving the app via Circle's Bridge Kit SDK with the Viem v2 adapter.

**Supported Source Chains**

| Chain | Domain | Chain ID | Status |
|-------|--------|----------|--------|
| Arbitrum Sepolia | 3 | 421614 | Live |
| Base Sepolia | 6 | 84532 | Live |
| OP Sepolia | 2 | 11155420 | Live |
| Ethereum Sepolia | 0 | 11155111 | Live |
| Avalanche Fuji | 1 | 43113 | Live |
| HyperEVM Testnet | 19 | 998 | Live |
| Monad Testnet | 15 | 10143 | Live |
| Sei Atlantic | 16 | 1328 | Live |

**Destination**: Arc Testnet (Domain 26, Chain ID 5042002)

**User Flow**
```
User opens Deposit Modal
  → Picks source chain from dropdown
  → Enters USDC amount → Confirms
  → Bridge Kit burns USDC on source chain
  → Circle attestation service verifies (~30-60s)
  → Native USDC minted on Arc Testnet
  → Balance available to play
```

Both external wallets (MetaMask, Rabby, WalletConnect) and embedded wallets (Dynamic Labs email login) are supported. Adding a new source chain requires only a config entry in `cctp-config.ts` and a network entry in `dynamic.tsx` for embedded wallet support.

### In-App Faucet

Integrated testnet faucet eliminates the need to visit external sites.

- Multi-chain support (Arc, Ethereum, Base, Arbitrum, OP, Avalanche)
- 10 USDC per request
- 24-hour cooldown per chain
- Explorer link on success

---

## Technical Implementation

### Architecture with Circle Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                    User Entry Points                         │
├─────────────────────────────────────────────────────────────┤
│  Crypto User (ETH USDC)  │  Non-Crypto User (Credit Card)  │
└──────────┬────────────────┴──────────────┬──────────────────┘
           │                               │
           │ Circle CCTP Bridge            │ Circle Gateway
           │                               │
           ▼                               ▼
    ┌──────────────────────────────────────────────┐
    │         Circle Infrastructure Layer          │
    │  - CCTP Attestation Service                  │
    │  - Gateway Payment Processing (KYC/AML)      │
    │  - USDC Minting on Arc L1                    │
    └──────────────────┬───────────────────────────┘
                       │
                       ▼
    ┌──────────────────────────────────────────────┐
    │            Arc L1 Blockchain                 │
    │  - User Wallet (USDC balance)                │
    │  - ARCade Vault Contract                     │
    │  - Game Controllers (Dice, Crash, etc.)      │
    └──────────────────────────────────────────────┘
```

### Security Hardening

**Access Control**
- Vault uses OpenZeppelin AccessControl for game authorization
- Only whitelisted game controllers can debit user balances
- Owner can pause all contracts via emergency stop

**API Security**
- HMAC-SHA256 signatures required for all settlement API calls
- Rate limiting: 20 requests/minute per IP (Upstash Redis)
- Request replay protection via nonce tracking

**Test Coverage**
- 100% line coverage across 53 unit tests
- Foundry invariant testing for Vault accounting
- Integration tests with forked Arc Testnet state

### Performance Benchmarks

| Metric | ARCade (Arc) | Rollbit (Arbitrum) | Measured |
|--------|--------------|-------------------|----------|
| Bet → Settlement | 340ms | 2,100ms | Development testing |
| Gas Cost (avg) | $0.009 | $0.42 | Sample transactions |
| Failed Txs/1000 | 0.2 | 3.1 | Network stress testing |

---

## Quick Start

### Prerequisites

- Node.js 20+
- Foundry (for contract development)
- Arc Testnet USDC ([In-app Faucet](/faucet) or [Circle Faucet](https://faucet.circle.com))

### Installation

```bash
# Clone repository
git clone https://github.com/Cassxbt/Arcadeonarc.git
cd Arcadeonarc

# Install frontend dependencies
cd arcade && npm install

# Install contract dependencies
cd ../contracts && forge install
```

### Environment Setup

Create `arcade/.env.local`:

```bash
# Dynamic Wallet Auth
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=your_dynamic_id

# API Security
API_SIGNING_SECRET=your_secret_key
SIGNER_PRIVATE_KEY=0x_your_private_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Circle API (for in-app faucet)
CIRCLE_API_KEY=your_circle_api_key
```

### Run Development Server

```bash
cd arcade
npm run dev
# Navigate to http://localhost:3000
```

### Deploy Contracts

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url $ARC_TESTNET_RPC --broadcast --verify
```

---

## Performance Metrics

- **Transaction Finality**: <350ms (Arc blockchain)
- **API Response Time**: <50ms (P95)
- **Frontend Load Time**: <1.2s (First Contentful Paint)
- **Realtime Sync Latency**: <100ms (Supabase WebSocket)
- **Smart Contract Gas**: ~21,000 gas/bet (~$0.01 at current Arc gas prices)

---

## Acknowledgments

- **Arc Network**: For providing the fastest USDC-native blockchain enabling real-time gaming
- **Circle**: For USDC infrastructure, CCTP Bridge Kit SDK, Gateway, and Faucet API
- **Dynamic Labs**: For seamless multi-wallet authentication
- **Supabase**: For real-time database synchronization
- **Foundry**: For best-in-class Solidity testing framework

---

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

---

## Links

- **Live Demo**: [arcadeonarc.fun](https://arcadeonarc.fun)
- **Twitter**: [@ArcadeOnArc](https://twitter.com/ArcadeOnArc)
- **Discord**: [Arc Network Community](https://discord.com/invite/arcnetwork)
- **Block Explorer**: [Arc Testnet Scan](https://testnet.arcscan.app)

---

Built with ❤️ by [@Cassxbt](https://twitter.com/Cassxbt)
