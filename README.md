# supershot.fun

Non-custodial token launchpad and market terminal built on Arc.

supershot.fun lets users create tokens, discover markets, trade through bonding curves, place limit orders, inspect holders and activity, track a wallet portfolio, and graduate successful markets into permanently locked DEX liquidity.

## Arc Mainnet status

**supershot.fun is deployed on Arc Mainnet.**

The production contract stack was deployed on **September 16, 2026** on Arc chain ID `5042`, across blocks `21158188` through `21158206`.

Live application:

- Web: https://arc-launchpad-web.onrender.com
- API: https://arc-launchpad-api.onrender.com
- Indexer: https://arc-launchpad-indexer.onrender.com
- Repository: https://github.com/Imdavid21/tigris-netlify-starter

Arc Mainnet configuration:

- Chain ID: `5042`
- RPC: `https://rpc.mainnet.arc.io`
- Explorer: `https://arc-scan.org`
- USDC: `0x3600000000000000000000000000000000000000`
- Production database schema: `mainnet`

The active mainnet contract deployment is:

| Component | Arc Mainnet address |
| --- | --- |
| Launch factory | `0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423` |
| Fee escrow | `0x6D1597932B93b9939f21E9A8D8C2908457F7925d` |
| Buyback vault | `0xf58489A0B285F3b0046FF53a055b80E69a6e15eB` |
| Liquidity locker | `0xE7fFCe43E0eCA4C27e3bB1985C231DBB97145896` |
| Limit order book | `0xED7b5904e272d3DF891179D916D2E3A939ed1471` |
| Uniswap v4 guard hook | `0x3aC85a7cB39981c95c005E5d72a5Df24d0bb2000` |
| Uniswap v4 connector | `0x0A30D71fB42b7cD92596e9a200d7a101E34DA956` |
| DEX / graduation adapter | `0x4c40f0C8DfC518f436A9a5244179a0Dac145eE43` |

See [`docs/MAINNET_DEPLOYMENT.md`](docs/MAINNET_DEPLOYMENT.md) for the full deployment record, architecture, verification details, operational caveats, and production checklist.

## What the product does

### Launch

Creators can configure and launch a token through the supershot.fun factory. The launch flow supports:

- token metadata and social links
- explicit creator economics
- optional atomic developer buy
- holder fee sharing
- launch-protection configuration
- approved quote assets
- onchain launch state

### Trade

Before graduation, markets execute through the supershot.fun bonding curve. The market terminal supports:

- live buy and sell quotes
- allowance handling
- slippage protection
- balance-aware selling
- transaction progress states
- market orders
- limit orders

Execution-critical state is read from chain. The API and indexer are used for discovery, history, holder data, analytics, and performance rather than as the source of truth for trades.

### Graduate

The production architecture supports a complete Arc-native market lifecycle:

1. create a token
2. trade on the supershot.fun bonding curve
3. reach the graduation threshold
4. sweep graduation assets
5. initialize the Arc Uniswap v4 pool
6. mint the graduation liquidity position
7. permanently lock the LP position
8. keep the same token page and route post-graduation execution through the DEX adapter

The mainnet deployment uses Arc's official Uniswap v4 deployment and a dedicated connector, adapter, liquidity locker, and guard hook.

### Discover and inspect

The application includes:

- market discovery and filtering
- token pages
- price and activity surfaces
- holder inspection
- contract and transaction scanner links
- wallet portfolio
- protocol analytics
- creator and holder reward surfaces
- buyback and burn tracking

## Why Arc

The application is Arc-native rather than a generic frontend pointed at Arc.

The protocol uses Arc for:

- contract deployment and settlement
- native USDC gas semantics
- token creation
- bonding-curve execution
- fee and reward accounting
- limit-order settlement
- graduation state
- Uniswap v4 liquidity creation and post-graduation execution
- indexed market, wallet, and analytics data derived from Arc events

Arc Mainnet uses USDC as its native gas asset. The contracts and deployment tooling account for Arc-specific execution behavior, including the distinction between native USDC gas units and the 6-decimal ERC-20 USDC interface.

## Architecture

The repository is a monorepo containing:

- `packages/contracts` - Solidity protocol and deployment scripts
- `apps/web` - Next.js frontend
- `apps/api` - Fastify API
- `apps/indexer` - Arc event indexer
- `docs` - product, architecture, audit, deployment, and integration documentation

The system separates execution from indexing deliberately:

**Onchain contracts are authoritative for**

- execution
- balances
- quotes and price state
- allowances
- launch economics
- market phase
- graduation state

**API and indexer provide**

- discovery
- search
- transaction history
- holder data
- wallet views
- rankings
- analytics
- faster read paths

An indexer outage should degrade discovery and analytics, not change the underlying market state or make a contract-native market cease to exist.

## Mainnet deployment and verification

The production deployment was broadcast from:

`0x8c377ed06931c379e7C1f31a1753Fe5e03ffBe01`

The factory deployment is visible on Arc Mainnet and was created in block `21158204`.

The deployment script is:

`packages/contracts/script/DeployCelestialMainnet.s.sol`

Before deployment, the script verifies bytecode for the Arc Uniswap v4 dependencies it relies on. The Arc-specific fork lifecycle covers token creation, curve trading, graduation, v4 pool initialization, LP locking, quoting, and post-graduation swaps.

## Testing and security posture

The repository contains internal contract, application, integration, fuzz, invariant, and Arc-specific lifecycle testing. Internal testing is not presented as a substitute for an independent external security audit.

The project should still be treated as early-stage software. Production-hardening work includes:

- moving sustained traffic away from reliance on the public Arc RPC
- maintaining a durable production database
- transferring privileged ownership to the intended production controller or multisig where applicable
- completing an independent external smart-contract review before unrestricted real-fund usage

These are production-hardening items, not indications that the deployment is testnet-only. The current production contract stack is on Arc Mainnet.

## Documentation

Start with:

- [`docs/MAINNET_DEPLOYMENT.md`](docs/MAINNET_DEPLOYMENT.md) - canonical Arc Mainnet deployment record and current production status
- [`docs/PROJECT_SOURCE_OF_TRUTH.md`](docs/PROJECT_SOURCE_OF_TRUTH.md) - product architecture, routes, design system, protocol model, and engineering context
- [`docs/AUDIT.md`](docs/AUDIT.md) - internal functionality and security review
- [`docs/QA_REPORT.md`](docs/QA_REPORT.md) - QA and staging coverage
- [`docs/UNISWAP_V4_INTEGRATION.md`](docs/UNISWAP_V4_INTEGRATION.md) - post-graduation DEX architecture
- [`docs/MATERIAL_3_FRONTEND.md`](docs/MATERIAL_3_FRONTEND.md) - frontend foundations and interaction system
- [`AGENTS.md`](AGENTS.md) - engineering handoff and protocol configuration

## Historical testnet material

Arc Testnet was used during development and validation before the September 16, 2026 mainnet deployment. Testnet addresses, experiments, and staging notes may remain in historical engineering documents or git history for reproducibility, but they are **not the current production deployment**.

For current deployment status and addresses, use this README and [`docs/MAINNET_DEPLOYMENT.md`](docs/MAINNET_DEPLOYMENT.md) as the canonical references.
