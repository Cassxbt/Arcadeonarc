# ARCade

A provably fair crypto gaming platform built on Arc L1 blockchain with native USDC support and cross-chain bridging via Circle CCTP.

## Overview

ARCade is a decentralized gaming platform featuring multiple casino-style games with on-chain settlement. Players deposit USDC into a smart contract vault and play games with instant payouts. The platform supports cross-chain USDC transfers from Ethereum and Base via Circle's Cross-Chain Transfer Protocol (CCTP).

**Live:** [arcadeonarc.fun](https://arcadeonarc.fun)

## Features

### Games
- **Tower** - Navigate through a grid avoiding hidden traps, with multipliers increasing per row
- **Dice** - Classic over/under prediction game with configurable risk
- **Crash** - Multiplier rises until random crash point; cash out before it busts
- **Wheel** - Spin-to-win with weighted prize distribution
- **Laser** - Grid-based game with laser beam mechanics

### Platform
- **USDC Native** - Arc L1 uses USDC as the native gas token
- **Cross-Chain Bridge** - Bridge USDC from Ethereum Sepolia and Base Sepolia via CCTP v2
- **Vault System** - Deposit/withdraw USDC to play; balances stored on-chain
- **Wallet Support** - Dynamic SDK integration supporting MetaMask, Rabby, WalletConnect, and embedded wallets
- **Provably Fair** - On-chain randomness and transparent game logic

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | CSS Modules, Framer Motion |
| Blockchain | Viem, Arc L1 Testnet |
| Wallet | Dynamic SDK |
| Bridge | Circle CCTP v2, Bridge Kit |
| Backend | Next.js API Routes, Supabase |
| Rate Limiting | Upstash Redis |

## Architecture

```
src/
├── app/                 # Next.js App Router pages and API routes
│   ├── api/            # Backend endpoints (games, auth, balance)
│   └── games/          # Game page components
├── components/         # Reusable UI components
├── lib/                # Core logic and hooks
│   ├── useBridge.ts    # CCTP bridge integration
│   ├── useVault.ts     # Vault deposit/withdraw
│   ├── cctp-config.ts  # Cross-chain configuration
│   └── constants.ts    # Contract addresses and config
└── styles/             # Global styles and design system
```

## Smart Contracts

Deployed on Arc Testnet (Chain ID: 5042002):

| Contract | Address |
|----------|---------|
| USDC | `0x3600000000000000000000000000000000000000` |
| ARCade Vault | `0x11Bc0BCE4455021D10F6c75A34f902Cf27B2AB95` |
| Tower Game | `0x7d1F094C8B48cBb7E9a017059eeC5a33eD4c243f` |
| Dice Game | `0xB91ddfe1567c38B259f417604755Dc58cdf73f0C` |
| Crash Game | `0x09e1bC3c33aa0A7e0a68cec3c00C44FD4E2dd5Db` |
| Wheel Game | `0x104Ac6DADbd5751C79bb76d99d1F2CA501FaDE3D` |
| Laser Game | `0xcBdff4f22bb291067EF9E36E2202c4d736739579` |

## Cross-Chain Bridge

ARCade integrates Circle's CCTP v2 for trustless USDC transfers:

### Supported Source Chains
- Ethereum Sepolia (Domain 0)
- Base Sepolia (Domain 6)

### Destination
- Arc Testnet (Domain 26)

The bridge uses Circle's Bridge Kit with `createAdapterFromProvider` for wallet integration, supporting any EIP-1193 compatible wallet.

## Development

### Prerequisites
- Node.js 20+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests
```

## Game Configuration

| Parameter | Value |
|-----------|-------|
| Minimum Bet | $0.50 USDC |
| Maximum Bet | $100 USDC |
| House Edge | 10% |

## Resources

- [Arc Network](https://arc.network)
- [Arc Testnet Explorer](https://testnet.arcscan.app)
- [Circle CCTP Documentation](https://developers.circle.com/cctp)
- [Circle Bridge Kit](https://developers.circle.com/bridge-kit)
- [Dynamic SDK](https://dynamic.xyz/docs)

## License

MIT
