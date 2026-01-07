# Key Rotation Guide

This document explains how to rotate the server signer key without downtime.

## Overview

The `SIGNER_PRIVATE_KEY` is used to sign game outcomes and settle bets. If this key is compromised, an attacker could:
- Credit themselves arbitrary winnings
- Drain user balances from the vault

Regular key rotation and proper key management minimize this risk.

## Rotation Process

### Step 1: Generate New Key

```bash
# Generate a new private key
cast wallet new

# Output example:
# Address: 0xNewSignerAddress...
# Private key: 0xNewPrivateKey...
```

### Step 2: Authorize New Signer on Vault

Call `setGameAuthorization` on the vault contract to authorize the new signer:

```bash
# Using the contract owner's wallet
cast send $ARCADE_VAULT \
  "setGameAuthorization(address,bool)" \
  0xNewSignerAddress \
  true \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key $OWNER_PRIVATE_KEY
```

### Step 3: Update Environment Variables

Update `.env.local` (or your production secrets manager):

```bash
SIGNER_PRIVATE_KEY=0xNewPrivateKey
```

### Step 4: Deploy/Restart Application

Restart your Next.js server to pick up the new environment variable.

### Step 5: Revoke Old Signer (Optional but Recommended)

```bash
cast send $ARCADE_VAULT \
  "setGameAuthorization(address,bool)" \
  0xOldSignerAddress \
  false \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key $OWNER_PRIVATE_KEY
```

## Recommended Rotation Schedule

| Environment | Rotation Frequency |
|-------------|-------------------|
| Development | N/A |
| Testnet | Monthly |
| Mainnet | Weekly or after any security event |

## Monitoring

Watch for these warning signs that may indicate key compromise:
- Unexpected settlements (check vault events)
- Settlements at unusual times
- Settlements from unknown IP addresses (check logs)

## Production Best Practices

1. **Never store keys in code or git**
2. **Use a secrets manager** (AWS Secrets Manager, Vault, Doppler)
3. **Consider HSM** for mainnet (Hardware Security Module)
4. **Enable alerts** for vault authorization changes
5. **Keep owner wallet extra secure** (hardware wallet, multi-sig)

## Contract Addresses

| Contract | Address |
|----------|---------|
| ARCadeVault | `0x11Bc0BCE4455021D10F6c75A34f902Cf27B2AB95` |

## Current Signer

Address: `0x66d71a8612Fbf6ab69340Bf82aB431e1Ad30b5c3`
