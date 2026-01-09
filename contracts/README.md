# ARCade Smart Contracts

Solidity smart contracts for ARCade on Arc - a decentralized gaming platform on the Arc L1 testnet.

## Contracts Overview

### Core Contracts

- **ARCadeVault.sol** - Central vault managing deposits, withdrawals, and bet settlements
- **DiceGame.sol** - Dice game (1-100 number prediction)
- **CannonCrash.sol** - Crash multiplier game
- **TowerGame.sol** - Tower tile reveal game
- **WheelGame.sol** - Wheel spin game
- **GridyLaser.sol** - Grid laser game

### Libraries

- **SignatureVerifier.sol** - ECDSA signature verification for provably fair outcomes

## Tech Stack

- **Language:** Solidity 0.8.20
- **Framework:** Foundry (Forge, Cast, Anvil)
- **Dependencies:** OpenZeppelin contracts
- **EVM Version:** Paris
- **Optimizer:** Enabled (200 runs)
- **Token:** USDC (6 decimals)
- **Chain:** Arc Testnet (Chain ID: 5042002)

## Security Features

✓ **ReentrancyGuard** - All external state-changing functions protected
✓ **Pausable** - Emergency pause capability
✓ **Ownable** - Access control for admin functions
✓ **Server Signature Verification** - Provably fair game outcomes
✓ **Input Validation** - Comprehensive parameter checks
✓ **Pull-over-Push** - Safe withdrawal pattern
✓ **Custom Errors** - Gas-efficient error handling

## Deployed Contracts (Arc Testnet)

```solidity
USDC:         0x3600000000000000000000000000000000000000
ARCadeVault:  0x11Bc0BCE4455021D10F6c75A34f902Cf27B2AB95
TowerGame:    0x7d1F094C8B48cBb7E9a017059eeC5a33eD4c243f
DiceGame:     0xB91ddfe1567c38B259f417604755Dc58cdf73f0C
CannonCrash:  0x09e1bC3c33aa0A7e0a68cec3c00C44FD4E2dd5Db
WheelGame:    0x5907775345715b9F0ac1b00027Cd96B8fEE1e850
GridyLaser:   0xcBdff4f22bb291067EF9E36E2202c4d736739579
```

Deployment Date: December 30, 2025

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Git

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Arcadeonarc.git
cd Arcadeonarc/contracts

# Install dependencies
forge install
```

## Building

```bash
forge build
```

## Testing

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test testDeposit

# Generate gas report
forge test --gas-report

# Test coverage
forge coverage
```

**Current Test Status:** 53/53 tests passing ✓

## Deployment

### Deploy to Arc Testnet

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export RPC_URL=https://rpc.testnet.arc.network

# Deploy vault
forge script script/Deploy.s.sol:DeployVault --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast

# Deploy game contracts
forge script script/Deploy.s.sol:DeployGames --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

### Verify Contracts

```bash
forge verify-contract \
  --chain-id 5042002 \
  --compiler-version v0.8.20 \
  0x11Bc0BCE4455021D10F6c75A34f902Cf27B2AB95 \
  src/ARCadeVault.sol:ARCadeVault
```

## Contract Architecture

### Flow

1. **Deposit:** User deposits USDC into `ARCadeVault`
2. **Play Game:** User calls game contract (e.g., `DiceGame.roll()`)
3. **Place Bet:** Game contract calls `vault.placeBet()` to lock funds
4. **Server Signs Outcome:** Backend generates provably fair result and signs it
5. **Verify Signature:** Contract verifies server signature
6. **Settle:** Game contract calls `vault.settleBet()` with payout
7. **Withdraw:** User withdraws winnings from vault

### Security Model

- **Authorized Games Only:** Vault only accepts bet settlements from whitelisted game contracts
- **Reentrancy Protection:** All external calls protected
- **Pausable:** Owner can pause all operations in emergency
- **Signature Verification:** All game outcomes cryptographically signed by trusted server
- **Nonce System:** Prevents replay attacks

## Gas Optimization

- Custom errors instead of require strings
- Immutable variables where possible
- Efficient storage packing
- Optimizer enabled (200 runs)

## Foundry Commands

```bash
# Build contracts
forge build

# Run tests
forge test

# Format code
forge fmt

# Generate gas snapshots
forge snapshot

# Start local node
anvil

# Deploy script
forge script script/Counter.s.sol --rpc-url <RPC_URL> --private-key <PRIVATE_KEY>

# Cast commands
cast call <CONTRACT_ADDRESS> "balances(address)" <USER_ADDRESS> --rpc-url <RPC_URL>
cast send <CONTRACT_ADDRESS> "deposit(uint256)" <AMOUNT> --rpc-url <RPC_URL> --private-key <PRIVATE_KEY>
```

## Security Considerations

⚠️ **Current Limitations:**

1. **Randomness:** Uses blockhash + timestamp (miner-manipulable)
   - **TODO:** Integrate Chainlink VRF for production
   - See `ARCadeVault.sol:214` comment

2. **Centralization:** Server signer is a single point of failure
   - **Mitigation:** Multi-sig for signer key rotation planned

3. **Testnet Only:** These contracts are NOT audited for mainnet

## Audit Status

🔴 **NOT AUDITED** - Do not use on mainnet with real funds

For production deployment:
1. Get professional security audit
2. Integrate Chainlink VRF for randomness
3. Implement multi-sig for admin functions
4. Add circuit breakers and withdrawal limits
5. Bug bounty program

## Testing Best Practices

Our test suite covers:
- ✓ Access control
- ✓ Reentrancy protection
- ✓ Input validation
- ✓ Edge cases (zero amounts, overflow, etc.)
- ✓ Signature verification
- ✓ State transitions
- ✓ Event emissions

## Contributing

1. Create a feature branch
2. Write tests for new functionality
3. Ensure all tests pass: `forge test`
4. Format code: `forge fmt`
5. Submit pull request

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Solidity Documentation](https://docs.soliditylang.org/)
- [Arc Network](https://arc.network/)

## License

MIT License - See [LICENSE](../LICENSE) for details
