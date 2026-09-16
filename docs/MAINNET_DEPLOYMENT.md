# Arc Mainnet Deployment

Verified on 2026-09-16.

## Current status

supershot.fun's mainnet code path is ready through the pre-deployment gates.

Completed:

- Arc Mainnet chain and USDC checks
- official Arc Uniswap v4 dependency checks
- complete Uniswap v4 connector/graduation implementation
- Arc-native fork lifecycle using Circle's Arc Foundry
- launch, curve buy/sell, graduation, v4 pool creation, LP locking, quoting, and post-graduation swaps
- factory runtime-size remediation below EIP-170
- buyback-vault ownership hardening
- automatic invalidation of an old buyback keeper when factory ownership changes
- mainnet/testnet PostgreSQL schema isolation support
- mainnet-safe frontend chain and address configuration

Not yet completed because it requires an onchain deployment:

- Arc Mainnet broadcast
- final supershot.fun contract addresses and deployment start block
- Render mainnet environment cutover
- mainnet indexer backfill
- controlled real-money mainnet smoke lifecycle

Latest live readiness probe at 2026-09-16T10:19:28Z found the expected deployer native Arc USDC balance at `0x0`. No mainnet deployment has been broadcast.

Expected deployer:
`0x8c377ed06931c379e7C1f31a1753Fe5e03ffBe01`

## Network

- Chain ID: `5042`
- Public RPC: `https://rpc.mainnet.arc.io`
- Native gas asset: USDC, 18-decimal native units
- USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`, 6 decimals

Do not reuse Arc Testnet EURC or cirBTC addresses on mainnet. USDC is the only enabled quote asset in the mainnet deployment script until additional mainnet asset addresses are independently verified.

## Arc Foundry

Arc uses execution semantics that are not fully reproduced by upstream Foundry. Circle publishes Arc Foundry as a superset of Foundry.

Current verified release used in CI:
`circlefin/arc-foundry v0.8.0-1`

The repository includes an explicit Arc profile:

```toml
[profile.arc]
network = "arc"
```

The mainnet lifecycle workflow installs the release archive, verifies its published SHA-256 checksum, and runs the fork lifecycle with `arc-forge`.

Do not treat an upstream-Anvil Arc fork as sufficient validation for Arc USDC behavior. Arc USDC invokes Arc-specific system/precompile behavior that requires Arc execution semantics.

## Uniswap v4

Official Arc Mainnet deployment addresses:

- PoolManager: `0x8366a39CC670B4001A1121B8F6A443A643e40951`
- PositionManager: `0x6049c9a0e26405C0985f9E3685C87d0aE917f82B`
- Quoter: `0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94`
- Universal Router: `0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

`DeployCelestialMainnet.s.sol` verifies bytecode at all of these addresses before deployment.

The Arc Mainnet fork lifecycle now verifies the full production path against these live deployments:

1. create a supershot.fun token
2. buy and sell on the bonding curve
3. reach graduation
4. sweep graduation assets
5. initialize the real Uniswap v4 pool
6. mint and lock the LP position
7. quote through the v4 quoter
8. execute USDC to token through the production router path
9. execute token to USDC through the production router path

The lifecycle also validates the 18-decimal supershot.fun token against Arc USDC's 6-decimal ERC-20 interface.

## Mainnet deployment stack

Deployment script:
`packages/contracts/script/DeployCelestialMainnet.s.sol`

The script deploys and wires:

- `CelestialLaunchFactory`
- `CelestialFeeEscrow` through the factory
- `CelestialBuybackVault` through the factory
- `ArcLiquidityLocker` through the factory
- `CelestialLimitOrderBook`
- `CelestialPoolGuardHook` at a CREATE2 address with the required Uniswap v4 hook permission bits
- `CelestialUniswapV4Connector`
- `CelestialDexAdapter`

It then:

- enables USDC as the only mainnet quote asset
- seals the hook initializer to the connector
- sets the DEX adapter as the factory graduation adapter

## Ownership model

The buyback vault is no longer pinned to the deployment EOA.

For factory-created vaults:

- immutable vault `owner` is the factory contract
- `controller()` resolves the current `factory.owner()` dynamically
- only the current controller can set the operational keeper
- a keeper is bound to the controller that appointed it
- transferring factory ownership automatically invalidates a keeper appointed by the previous owner

This behavior is covered by `CelestialOwnership.t.sol` and the complete Arc Mainnet fork lifecycle.

A production multisig can therefore take control by receiving factory ownership without redeploying the buyback vault.

## Database isolation

The API and indexer support `DATABASE_SCHEMA`.

Current testnet services are explicitly pinned to:

```text
DATABASE_SCHEMA=public
```

Arc Mainnet must use:

```text
DATABASE_SCHEMA=mainnet
```

A hard guard prevents chain ID `5042` from starting against the `public` schema. This prevents testnet and mainnet rows from being mixed in the current database.

Current Render Postgres is a free instance and is scheduled to expire on 2026-10-14. It is acceptable for controlled cutover testing, but unrestricted production should use a durable database plan.

## Application cutover

Do not switch Render to Arc Mainnet until the actual deployment has succeeded and final addresses are available.

After deployment, configure API/indexer with:

- `ARC_CHAIN_ID=5042`
- `ARC_RPC_URL=https://rpc.mainnet.arc.io` or a managed production Arc RPC
- `DATABASE_SCHEMA=mainnet`
- `CELESTIAL_FACTORY_ADDRESS`
- `CELESTIAL_FACTORY_START_BLOCK`
- `ORDERBOOK_ADDRESS`
- `BUYBACK_VAULT_ADDRESS`
- `CELESTIAL_DEX_ADAPTER_ADDRESS`
- `CELESTIAL_DEX_CONNECTOR_ADDRESS`

Then configure the frontend with:

- `NEXT_PUBLIC_ARC_CHAIN_ID=5042`
- `NEXT_PUBLIC_ARC_RPC_URL`
- `NEXT_PUBLIC_ARC_EXPLORER_URL`
- `NEXT_PUBLIC_USDC_ADDRESS`
- `NEXT_PUBLIC_CELESTIAL_FACTORY_ADDRESS`
- `NEXT_PUBLIC_CELESTIAL_FEE_ESCROW_ADDRESS`
- `NEXT_PUBLIC_CELESTIAL_BUYBACK_VAULT_ADDRESS`
- `NEXT_PUBLIC_CELESTIAL_LIQUIDITY_LOCKER_ADDRESS`
- `NEXT_PUBLIC_CELESTIAL_ORDERBOOK_ADDRESS`
- `NEXT_PUBLIC_CELESTIAL_DEX_ADAPTER_ADDRESS`

The frontend does not silently fall back to testnet contract addresses when configured for chain `5042`.

## Final live checks

After broadcast and cutover, use small controlled amounts to verify:

1. token creation
2. USDC approval and curve buy
3. curve sell
4. graduation
5. Uniswap v4 pool and locked LP position
6. post-graduation buy
7. post-graduation sell
8. indexer ingestion and API visibility
9. scanner and holder links
10. portfolio and activity
11. limit orders
12. analytics

Do not open unrestricted real-fund usage until these live checks pass.

## Production gates

Before unrestricted public traffic:

- fund the deployer with enough native Arc USDC for deployment gas
- broadcast and verify the complete contract stack
- capture final addresses and deployment start block
- cut API/indexer/web to Arc Mainnet
- complete the small controlled live lifecycle
- use a durable production database
- prefer a managed/private Arc RPC over the public endpoint
- transfer factory ownership to the intended production controller/multisig when available
- complete independent external contract review before unrestricted real-fund use
