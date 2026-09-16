# Celestial Arc Mainnet Cutover Runbook

Updated: 2026-09-16

## Do not use upstream Foundry for the production broadcast

Arc requires Circle's Arc Foundry execution semantics. The repository's older secret-bearing GitHub deployment workflow still invokes upstream `forge`/`cast` and must not be used for the production broadcast until it is migrated.

Use `scripts/deploy-celestial-mainnet-arc.sh` with Circle Arc Foundry instead. The script does not contain a private key. It reads `PRIVATE_KEY` from the caller environment, verifies Arc Mainnet chain ID `5042`, checks USDC and all Uniswap v4 dependencies, verifies a non-zero native Arc USDC balance, runs the contract suite, performs an Arc-native preflight, and only broadcasts when `BROADCAST_ARC_MAINNET='DEPLOY ARC MAINNET'` is explicitly set.

Never commit, print, or paste the deployer private key.

## Current blocker

Expected deployer:

`0x8c377ed06931c379e7C1f31a1753Fe5e03ffBe01`

Latest live probe on 2026-09-16 found its native Arc USDC balance at `0x0`.

Fund this address with a small amount of native Arc USDC before deployment. Initial recommendation for deployment gas is 5 USDC. This is gas funding, not protocol liquidity.

## Pre-broadcast checks

All must be green immediately before broadcast:

- Arc Mainnet chain ID is `5042`
- RPC is responding
- deployer has native Arc USDC
- Arc USDC system contract has code and ERC-20 `decimals()` returns 6
- Uniswap v4 PoolManager, PositionManager, Quoter, Universal Router, and Permit2 have code at the official Arc addresses
- contract CI is green
- Arc Foundry mainnet lifecycle is green
- Arc Mainnet frontend build is green
- Arc Mainnet backend database-isolation gate is green

Official v4 addresses:

- PoolManager `0x8366a39CC670B4001A1121B8F6A443A643e40951`
- PositionManager `0x6049c9a0e26405C0985f9E3685C87d0aE917f82B`
- Quoter `0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94`
- Universal Router `0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1`
- Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`

## Broadcast

From an environment with Circle Arc Foundry installed and the existing deployer key available only as an environment secret:

```bash
export ARC_RPC_URL=https://rpc.mainnet.arc.io
export PROTOCOL_TREASURY=<production-controller-address>
export PRIVATE_KEY=<secret-from-secure-environment>
export BROADCAST_ARC_MAINNET='DEPLOY ARC MAINNET'
bash scripts/deploy-celestial-mainnet-arc.sh
```

The deployment script prints:

- Celestial factory
- fee escrow
- buyback vault
- liquidity locker
- limit order book
- v4 pool guard hook
- v4 connector
- DEX adapter
- USDC

Capture the first deployment receipt block as `CELESTIAL_FACTORY_START_BLOCK`.

## Render cutover

Do not change the current testnet services before successful broadcast.

After deployment, update API/indexer:

```text
ARC_CHAIN_ID=5042
ARC_RPC_URL=https://rpc.mainnet.arc.io
DATABASE_SCHEMA=mainnet
FACTORY_ADDRESS=
FACTORY_START_BLOCK=
CELESTIAL_FACTORY_ADDRESS=<factory>
CELESTIAL_FACTORY_START_BLOCK=<deployment-start-block>
ORDERBOOK_ADDRESS=<orderbook>
BUYBACK_VAULT_ADDRESS=<buyback-vault>
CELESTIAL_DEX_ADAPTER_ADDRESS=<adapter>
CELESTIAL_DEX_CONNECTOR_ADDRESS=<connector>
```

Update web:

```text
NEXT_PUBLIC_ARC_CHAIN_ID=5042
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.mainnet.arc.io
NEXT_PUBLIC_ARC_EXPLORER_URL=https://arc-scan.org
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_FACTORY_ADDRESS=
NEXT_PUBLIC_FEE_ESCROW_ADDRESS=
NEXT_PUBLIC_CELESTIAL_FACTORY_ADDRESS=<factory>
NEXT_PUBLIC_CELESTIAL_FEE_ESCROW_ADDRESS=<fee-escrow>
NEXT_PUBLIC_CELESTIAL_BUYBACK_VAULT_ADDRESS=<buyback-vault>
NEXT_PUBLIC_CELESTIAL_LIQUIDITY_LOCKER_ADDRESS=<liquidity-locker>
NEXT_PUBLIC_CELESTIAL_ORDERBOOK_ADDRESS=<orderbook>
NEXT_PUBLIC_CELESTIAL_DEX_ADAPTER_ADDRESS=<adapter>
```

Testnet remains isolated in PostgreSQL schema `public`; mainnet uses schema `mainnet`.

## Live smoke lifecycle

Use controlled small amounts and verify in order:

1. create token
2. approve USDC
3. bonding-curve buy
4. bonding-curve sell
5. reach graduation
6. verify Uniswap v4 pool creation
7. verify LP position is locked
8. post-graduation USDC to token swap
9. post-graduation token to USDC swap
10. verify indexer/API records
11. verify scanner and holders
12. verify portfolio and activity
13. verify limit-order surfaces
14. verify analytics

Only after this passes should public real-fund usage be opened.

## Infrastructure follow-up

The current Render Postgres instance is free and is scheduled to expire on 2026-10-14. A durable paid database requires an explicit spending decision before unrestricted production traffic.

Prefer a managed/private Arc RPC for production rather than relying only on the public endpoint.
