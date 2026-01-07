#!/bin/bash
# Authorize the signer wallet on the ARCade Vault
# Run this script from the contracts directory with your deployer wallet

# Signer address (derived from SIGNER_PRIVATE_KEY)
SIGNER_ADDRESS="0x66d71a8612Fbf6ab69340Bf82aB431e1Ad30b5c3"

# Vault contract address
VAULT_ADDRESS="0x11Bc0BCE4455021D10F6c75A34f902Cf27B2AB95"

# Arc Testnet RPC
RPC_URL="https://rpc.testnet.arc.network"

echo "=== ARCade Vault Authorization ==="
echo "Signer to authorize: $SIGNER_ADDRESS"
echo "Vault address: $VAULT_ADDRESS"
echo ""

# Check if already authorized
echo "Checking current authorization status..."
RESULT=$(cast call $VAULT_ADDRESS "authorizedGames(address)(bool)" $SIGNER_ADDRESS --rpc-url $RPC_URL)
echo "Currently authorized: $RESULT"

if [ "$RESULT" == "true" ]; then
    echo "✅ Signer is already authorized! No action needed."
    exit 0
fi

echo ""
echo "The signer is NOT authorized. Running authorization..."
echo ""

# Your deployer private key (same as SIGNER_PRIVATE_KEY since they're the same wallet)
# This wallet owns the vault and can authorize games
# SECURITY: Use environment variable - never hardcode private keys!
if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    echo "❌ Error: DEPLOYER_PRIVATE_KEY environment variable is not set"
    echo "   Export it before running: export DEPLOYER_PRIVATE_KEY='0x...'"
    exit 1
fi
PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY"

# Authorize the signer
cast send $VAULT_ADDRESS \
    "setGameAuthorization(address,bool)" \
    $SIGNER_ADDRESS \
    true \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY

echo ""
echo "Verifying authorization..."
RESULT=$(cast call $VAULT_ADDRESS "authorizedGames(address)(bool)" $SIGNER_ADDRESS --rpc-url $RPC_URL)
echo "Now authorized: $RESULT"

if [ "$RESULT" == "true" ]; then
    echo "✅ Authorization successful!"
else
    echo "❌ Authorization failed. Please check the transaction."
    exit 1
fi
