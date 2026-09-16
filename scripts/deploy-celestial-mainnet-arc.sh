#!/usr/bin/env bash
set -euo pipefail

: "${PRIVATE_KEY:?PRIVATE_KEY is required in the caller environment}"
: "${PROTOCOL_TREASURY:?PROTOCOL_TREASURY is required}"

ARC_RPC_URL="${ARC_RPC_URL:-https://rpc.mainnet.arc.io}"
EXPECTED_CHAIN_ID="5042"
USDC="0x3600000000000000000000000000000000000000"
POOL_MANAGER="0x8366a39CC670B4001A1121B8F6A443A643e40951"
POSITION_MANAGER="0x6049c9a0e26405C0985f9E3685C87d0aE917f82B"
QUOTER="0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94"
UNIVERSAL_ROUTER="0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1"
PERMIT2="0x000000000022D473030F116dDEE9F6B43aC78BA3"

for binary in arc-forge arc-cast; do
  command -v "$binary" >/dev/null 2>&1 || {
    echo "$binary is required. Install Circle Arc Foundry first." >&2
    exit 1
  }
done

export FOUNDRY_PROFILE=arc

NETWORK=$(arc-forge config --json | jq -r '.network')
test "$NETWORK" = "arc" || {
  echo "Arc Foundry profile did not resolve network=arc" >&2
  exit 1
}

CHAIN_ID=$(arc-cast chain-id --rpc-url "$ARC_RPC_URL")
test "$CHAIN_ID" = "$EXPECTED_CHAIN_ID" || {
  echo "Wrong chain: expected $EXPECTED_CHAIN_ID, got $CHAIN_ID" >&2
  exit 1
}

for target in "$USDC" "$POOL_MANAGER" "$POSITION_MANAGER" "$QUOTER" "$UNIVERSAL_ROUTER" "$PERMIT2"; do
  code=$(arc-cast code "$target" --rpc-url "$ARC_RPC_URL")
  test "$code" != "0x" || {
    echo "Missing production bytecode at $target" >&2
    exit 1
  }
done

DECIMALS=$(arc-cast call "$USDC" 'decimals()(uint8)' --rpc-url "$ARC_RPC_URL")
test "$DECIMALS" = "6" || {
  echo "Unexpected Arc USDC ERC-20 decimals: $DECIMALS" >&2
  exit 1
}

DEPLOYER=$(arc-cast wallet address --private-key "$PRIVATE_KEY")
BALANCE=$(arc-cast balance "$DEPLOYER" --rpc-url "$ARC_RPC_URL")
echo "Deployer: $DEPLOYER"
echo "Native Arc USDC balance: $BALANCE"
test "$BALANCE" != "0" || {
  echo "Deployer has no native Arc USDC for gas" >&2
  exit 1
}

arc-forge test -vv

# Arc-native preflight simulation. This does not broadcast.
arc-forge script \
  packages/contracts/script/DeployCelestialMainnet.s.sol:DeployCelestialMainnet \
  --rpc-url "$ARC_RPC_URL" \
  --non-interactive \
  -vvv | tee /tmp/celestial-mainnet-preflight.log

if [[ "${BROADCAST_ARC_MAINNET:-}" != "DEPLOY ARC MAINNET" ]]; then
  echo "Preflight passed. Set BROADCAST_ARC_MAINNET='DEPLOY ARC MAINNET' to broadcast."
  exit 0
fi

arc-forge script \
  packages/contracts/script/DeployCelestialMainnet.s.sol:DeployCelestialMainnet \
  --rpc-url "$ARC_RPC_URL" \
  --broadcast \
  --non-interactive \
  -vvv | tee /tmp/celestial-mainnet-deployment.log

echo "Arc Mainnet deployment broadcast completed."
