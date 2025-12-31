<div align="center">

# ARCADE ON ARC

### The Future of Onchain Gaming

[![Built on Arc](https://img.shields.io/badge/Built%20on-Arc-00D4FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+)](https://arc.network)
[![USDC Payments](https://img.shields.io/badge/Payments-USDC-2775CA?style=for-the-badge&logo=circle&logoColor=white)](https://circle.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-000000?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Solidity](https://img.shields.io/badge/Contracts-Solidity-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org)

<br />

**Experience instant-settlement gaming with sub-cent fees.** 

*Dice • Crash • Tower — All powered by USDC on the world's fastest stablecoin blockchain.*

<br />

[📖 Documentation](./docs) · [🐛 Report Bug](https://github.com/cassxbt/arcade-on-arc/issues) · [💡 Request Feature](https://github.com/cassxbt/arcade-on-arc/issues)

---

<img src="./arcade/public/preview.png" alt="Arcade on Arc Preview" width="100%" />

</div>

<br />

## What is Arcade on Arc?

**Arcade on Arc** is a next-generation onchain gaming platform that delivers the speed, fairness, and transparency that traditional gaming platforms simply cannot offer.

Built exclusively on **Arc blockchain** — Circle's purpose-built Layer-1 for stablecoin finance — we bring you:

- ⚡ **Instant settlements** — Sub-second transaction finality means your wins are yours immediately
- 💵 **USDC-native** — No volatile tokens, no bridging, just stable dollar-value gameplay  
- 🔒 **Provably fair** — Every bet and outcome is verifiable onchain
- 💰 **Sub-cent fees** — ~$0.01 per transaction, making microbets viable

<br />

## The Games

<table>
<tr>
<td width="33%" align="center">

### 🎲 Dice

**Roll the odds in your favor**

Set your target, choose under or over, and let the dice decide. Adjust your risk for multipliers up to **99×**.

</td>
<td width="33%" align="center">

### 🚀 Cannon Crash

**Ride the rocket**

Watch the multiplier climb exponentially. Cash out before the crash — or risk it all for legendary wins.

</td>
<td width="33%" align="center">

### 🗼 Tower

**Climb to glory**

Navigate through layers of risk. Each level increases your multiplier, but one wrong step ends it all.

</td>
</tr>
</table>

<br />

## Why Arc is Perfect for Gaming

We didn't just choose Arc — we chose the **only blockchain** capable of delivering the experience gamers deserve.

<table>
<tr>
<td width="60">⚡</td>
<td>

### Sub-Second Finality

Arc's **deterministic finality in <350ms** means no waiting for confirmations. Your win is instant, your payout is immediate. Traditional chains require 12+ confirmations (minutes or hours). Arc? **One block. Done.**

</td>
</tr>
<tr>
<td width="60">💵</td>
<td>

### USDC as Native Gas

No ETH. No bridging. No price volatility eating your winnings. Arc uses **USDC as the native gas token** — what you win is exactly what you get, denominated in real dollars.

</td>
</tr>
<tr>
<td width="60">💰</td>
<td>

### ~$0.01 Transactions

At approximately **1 cent per transaction**, micro-bets become viable. Bet $0.50, win $5, and actually keep your profit. On Ethereum, fees alone would exceed your bet.

</td>
</tr>
<tr>
<td width="60">🔐</td>
<td>

### Enterprise-Grade Security

Arc validators are **regulated financial institutions** with SOC 2 compliance and geographic distribution. This isn't a startup chain — it's infrastructure built for real money.

</td>
</tr>
<tr>
<td width="60">🏗️</td>
<td>

### Full EVM Compatibility

Built on **Reth** (Rust Ethereum execution), Arc gives us all the tooling of Ethereum with none of the compromises. Same Solidity, same patterns, 1000× better UX.

</td>
</tr>
</table>

<br />

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        ARCADE ON ARC                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│   │   🎲 Dice   │    │ 🚀 Crash   │    │  🗼 Tower   │          │
│   │   Game UI   │    │   Game UI   │    │   Game UI   │          │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘          │
│          │                  │                  │                  │
│          └──────────────────┼──────────────────┘                  │
│                             │                                     │
│                    ┌────────▼────────┐                            │
│                    │   Next.js App   │                            │
│                    │   (Frontend)    │                            │
│                    └────────┬────────┘                            │
│                             │                                     │
├─────────────────────────────┼─────────────────────────────────────┤
│                    Arc Blockchain                                 │
│                             │                                     │
│          ┌──────────────────┼──────────────────┐                  │
│          │                  │                  │                  │
│   ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐          │
│   │  DiceGame   │    │CannonCrash │    │ TowerGame  │          │
│   │  Contract   │    │  Contract  │    │  Contract  │          │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘          │
│          │                  │                  │                  │
│          └──────────────────┼──────────────────┘                  │
│                             │                                     │
│                    ┌────────▼────────┐                            │
│                    │  ARCade Vault   │                            │
│                    │  (USDC Escrow)  │                            │
│                    └────────┬────────┘                            │
│                             │                                     │
│                    ┌────────▼────────┐                            │
│                    │      USDC       │                            │
│                    │    (Native)     │                            │
│                    └─────────────────┘                            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

<br />

## Project Structure

```
arcade-on-arc/
├── arcade/                 # Next.js Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── games/      # Game pages (Dice, Crash, Tower)
│   │   │   ├── leaderboard/# Global leaderboard
│   │   │   └── api/        # API routes
│   │   ├── components/     # Reusable UI components
│   │   └── lib/            # Game logic, contexts, utilities
│   └── public/             # Static assets
│
├── contracts/              # Foundry Smart Contracts
│   ├── src/
│   │   ├── ARCadeVault.sol # Central vault for deposits/payouts
│   │   ├── DiceGame.sol    # Dice game contract
│   │   ├── CannonCrash.sol # Crash game contract
│   │   └── TowerGame.sol   # Tower game contract
│   ├── test/               # Contract tests
│   └── script/             # Deployment scripts
│
└── docs/                   # Documentation
    ├── arc_ecosystem_deep_dive.md
    ├── circle_integration_guide.md
    └── arc_quick_reference.md
```

<br />

## Quick Start

### Prerequisites

- Node.js 18+
- [Foundry](https://getfoundry.sh/) for smart contracts
- [Arc Testnet USDC](https://faucet.circle.com) for testing

### 1. Clone the Repository

```bash
git clone https://github.com/cassxbt/arcade-on-arc.git
cd arcade-on-arc
```

### 2. Deploy Smart Contracts

```bash
cd contracts

# Install dependencies
forge install

# Setup environment
cp .env.example .env
# Add your private key and RPC URL

# Deploy to Arc Testnet
forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.network --broadcast
```

### 3. Run the Frontend

```bash
cd arcade

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Add contract addresses

# Start development server
npm run dev
```

### 4. Get Testnet USDC

Visit [Circle Faucet](https://faucet.circle.com) to get testnet USDC on Arc.

<br />

## Smart Contracts

### ARCade Vault

The central treasury managing all user funds with institutional-grade security:

| Feature | Description |
|---------|-------------|
| **Deposits** | Users deposit USDC to play |
| **Withdrawals** | Instant USDC withdrawals anytime |
| **Game Authorization** | Only authorized game contracts can debit/credit |
| **Emergency Mode** | Pausable with user emergency withdrawals |
| **House Edge** | 10% built into game multipliers |

### Contract Addresses (Testnet)

| Contract | Address |
|----------|---------|
| ARCadeVault | `TBD` |
| DiceGame | `TBD` |
| CannonCrash | `TBD` |
| TowerGame | `TBD` |

<br />

## Security Features

- ✅ **ReentrancyGuard** on all state-changing functions
- ✅ **Pausable** for emergency stops
- ✅ **Access Control** — only authorized games can settle bets
- ✅ **CEI Pattern** — Checks-Effects-Interactions for all transfers
- ✅ **SafeERC20** for all token operations
- ✅ **Conservative balance checks** before payouts

## Roadmap

- [x] Core game mechanics (Dice, Crash, Tower)
- [x] ARCade Vault smart contract
- [x] Next.js frontend with premium UI
- [x] Leaderboard system
- [ ] Wallet integration (Dynamic/Privy)
- [ ] Chainlink VRF integration for provably fair randomness
- [ ] Mainnet deployment
- [ ] Additional games (Plinko, Limbo, Mines)
- [ ] Tournament mode
- [ ] Referral system
- [ ] Circle Paymaster integration (gasless UX)

<br />

## Arc Network Details

| Parameter | Value |
|-----------|-------|
| **RPC URL** | `https://rpc.testnet.arc.network` |
| **Explorer** | [testnet.arcscan.app](https://testnet.arcscan.app) |
| **Faucet** | [faucet.circle.com](https://faucet.circle.com) |
| **Native Token** | USDC |
| **USDC Contract** | `0x3600000000000000000000000000000000000000` |
| **Finality** | <350ms (deterministic) |
| **Throughput** | 3,000+ TPS |

<br />

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

<br />

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

<br />

---

<div align="center">

**Built with 💚 by cassxbt**

[Twitter](https://twitter.com/cassxbt) · [GitHub](https://github.com/cassxbt)

</div>
