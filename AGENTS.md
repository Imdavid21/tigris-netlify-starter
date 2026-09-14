# Celestial Agent Handoff

Last updated: 2026-09-14

This file is the source-of-truth handoff for agents continuing work on Celestial. Read it before modifying contracts, deployment configuration, backend services, or the frontend.

## Product

Celestial is a non-custodial token launchpad and market terminal built on Arc.

The product direction is informed by PONS, but Celestial is not intended to be a pixel clone. The target feature set includes:

- token launch metadata and socials
- atomic launch plus developer buy
- creator tax
- holder fee sharing
- short-lived anti-snipe protection
- approved configurable quote assets
- bonding curve trading
- limit orders
- permissionless graduation
- permanently locked DEX liquidity
- same-page post-graduation trading
- protocol buyback and burn
- creator fee claims
- holder reward claims
- discovery, search, charts, holders, profile, and analytics

Critical design principle:

- contracts are authoritative for execution, balances, pricing, phase, and economic terms
- API/indexer are for discovery, history, search, analytics, and performance
- backend failure must not make an otherwise-live onchain market untradeable

## Repository

GitHub:
Imdavid21/tigris-netlify-starter

Branch:
main

Main directories:

- packages/contracts: Solidity protocol
- apps/web: Next.js frontend
- apps/api: Fastify API
- apps/indexer: Arc event indexer
- docs: product/security research and audits

Important docs:

- docs/PONS_REVERSE_ENGINEERING.md
- docs/AUDIT.md
- AGENTS.md

## Arc Testnet

Chain ID:
5042002

RPC:
https://rpc.testnet.arc.network

Explorer:
https://testnet.arcscan.app

Known quote assets:

USDC
0x3600000000000000000000000000000000000000
decimals: 6

EURC
0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
decimals: 6

cirBTC
0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF
decimals: 8

Protocol treasury / current test deployer:
0x8c377ed06931c379e7C1f31a1753Fe5e03ffBe01

Never commit or expose private keys.

## Legacy V1 deployment

The legacy factory remains live and must remain supported during migration.

Factory:
0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423

Fee escrow:
0x6D1597932B93b9939f21E9A8D8C2908457F7925d

Liquidity locker:
0xf58489A0B285F3b0046FF53a055b80E69a6e15eB

Legacy contracts:

- ArcLaunchFactory.sol
- ArcBondingCurve.sol
- ArcToken.sol
- ArcFeeEscrow.sol
- ArcLiquidityLocker.sol

Do not delete or silently repurpose these contracts. The indexer supports both V1 and Celestial generations.

## Celestial protocol generation

New contracts:

### CelestialLaunchFactory.sol

Responsibilities:

- approved quote-asset registry
- token metadata/social storage
- creator fee recipient
- creator tax
- holder fee sharing
- anti-snipe configuration
- createToken
- atomic createTokenAndBuy
- initial-buy preview
- graduation state
- DEX adapter configuration

Launch metadata:

- description
- image URL / IPFS URL
- website
- X / Twitter
- Telegram

Current caps:

- creator tax: 5%
- holder fee: 3%
- max configured snipe protection: bounded below 100% total fees
- deployed test config is intended to use a 5-second decaying opening protection

### CelestialBondingCurve.sol

Supports:

- quoteBuyFor
- quoteSell
- buy / buyFor
- sell / sellFor
- creator tax
- holder fee sharing
- decaying snipe protection
- creator / fee recipient exemption
- protocol fee split
- buyback funding
- graduation accounting

### CelestialToken.sol

Fixed-supply ERC20.

Also implements holder fee sharing through magnified per-share reward accounting.

Important functions:

- withdrawableRewardOf
- claimHolderRewards

Holder rewards are paid in the market quote asset.

Curve inventory and DEAD-address balances are excluded from eligible reward supply.

### CelestialFeeEscrow.sol

Multi-asset creator/protocol escrow.

Mapping:
asset => recipient => claimable amount

Claim:
claim(asset)

### CelestialBuybackVault.sol

Supports:

- pre-graduation curve buybacks
- post-graduation adapter buybacks
- economic burn by transferring purchased tokens to DEAD
- owner/keeper execution model

Buybacks are indexed by the backend.

### CelestialLimitOrderBook.sol

Escrowed conditional orders.

Supports:

- placeBuyOrder
- placeSellOrder
- canExecute
- permissionless execute
- owner cancel

Orders execute against CelestialBondingCurve before graduation.

### CelestialDexAdapter.sol

Production-safe adapter boundary for:

- graduation pool creation
- post-graduation exact-input quote
- post-graduation exact-input swap

It delegates chain/DEX-specific logic to ICelestialDexConnector.

### ICelestialDexConnector.sol

Required connector interface:

- createPoolAndLock
- quoteExactInput
- swapExactInput

IMPORTANT EXTERNAL BLOCKER:

As of 2026-09-14, Uniswap's official deployment registry does not list Arc. Do not invent Uniswap PoolManager, PositionManager, Universal Router, or quoter addresses.

CelestialDexAdapter can be deployed only after a real Arc connector is implemented and tested against officially published Arc DEX deployment addresses.

Until then:

- bonding curve trading works
- graduation can reach swept/ready state
- do not configure a fake graduation adapter
- UI must state that post-graduation routing is unavailable if no adapter is configured

## Celestial Arc Testnet deployment

Celestial is deployed on Arc Testnet.

Factory:
0x418a062cEcB23d68a3e8dcEa19E89bAD98bBe826

Fee escrow:
0xab922E5F1Ff1071a00a339C8b5FcF7d2f6F2a4e0

Buyback vault:
0x9FbB1892885888e9a8c01d7A56652C4D76B23fC8

Liquidity locker:
0x3e535c6F3daE1594A1C9ebB55E49175abC03bf77

Limit order book:
0x93e6ada62d3E6a0153B00F9962c4B52eC7F45f62

Indexer backfill start used:
62084000

Deployment workflow run:
34870570480

The factory currently has NO production DEX graduation adapter configured because an official Arc DEX connector is not available yet.

Script:
packages/contracts/script/DeployCelestial.s.sol

Workflow:
.github/workflows/deploy-celestial-testnet.yml

The workflow uses the repository secret:
ARC_DEPLOYER_PRIVATE_KEY

The secret already exists. Do not request or expose it.

The deployment script creates:

- CelestialLaunchFactory
- CelestialFeeEscrow through factory
- CelestialBuybackVault through factory
- ArcLiquidityLocker through factory
- CelestialLimitOrderBook

It configures USDC, EURC, and cirBTC as quote assets.

The deployment addresses above are already wired into the Render indexer and frontend environment.

The one-time push trigger used for initial deployment was removed. Future contract deployments require an explicit manual run of the deployment workflow.

## Frontend

Stable test frontend:
https://arc-launchpad-web.onrender.com

The product is branded Celestial in the UI.

Current routes:

- / Explore
- /create
- /token/[address]
- /profile
- /analytics
- /stocks

### Wallet architecture

File:
apps/web/components/wallet-session.tsx

There must be one shared wallet session across the app.

Behavior:

- restores existing authorization with eth_accounts
- explicit connect uses eth_requestAccounts
- listens to accountsChanged
- listens to disconnect
- Header and Profile use the same context

Do not reintroduce component-local wallet connection state.

Previous bug:
Header and Profile each called eth_requestAccounts, causing two connection prompts. This was fixed.

Navigation should not disconnect a wallet. A real provider disconnect or empty accountsChanged event should clear shared wallet state.

### Dark / light mode

Theme key:
celestial-theme

The theme is bootstrapped before hydration in app/layout.tsx to avoid flashing.

Theme toggle:
apps/web/components/theme-toggle.tsx

The restored Celestial color palette is intentionally retained. Do not reintroduce the later rejected branding/palette redesign unless explicitly requested.

### Create flow

File:
apps/web/components/create-token-form.tsx

When NEXT_PUBLIC_CELESTIAL_FACTORY_ADDRESS is configured, the UI supports:

- metadata/socials
- USDC / EURC / cirBTC
- atomic developer buy
- creator fee wallet
- creator tax
- holder fee sharing
- snipe exemption addresses

Developer buy flow:

1. approve quote asset to factory if required
2. call previewInitialBuy
3. use 1% min-output buffer
4. call createTokenAndBuy
5. decode TokenCreated
6. redirect to token page

When Celestial factory is NOT configured:

- fallback to legacy createToken only
- advanced terms must not be silently discarded
- reject launch if user entered Celestial-only fields

### Token market

File:
apps/web/components/token-market.tsx

Supports:

- generation-aware V1 and Celestial resolution
- multi-asset quote decimals
- Market trading
- Limit orders for Celestial
- Open Orders + cancel
- Sell 25%, 50%, 75%, and Sell all
- holder reward claim
- metadata/social display
- live launch-protection fee read
- post-graduation adapter quote/swap if configured

Sell all must always use the connected wallet's current onchain ERC20 balance.

### Profile

File:
apps/web/components/profile-panel.tsx

Uses shared wallet state.

Supports:

- launches
- positions
- activity
- limit orders
- legacy creator fee claim
- Celestial multi-asset creator fee claims when fee escrow env is configured

### Analytics

File:
apps/web/app/analytics/page.tsx

Supports:

- total volume
- 24h volume
- launches
- graduated markets
- trades
- active traders
- open orders
- buyback execution count
- 30-day volume
- 30-day launches
- indexed buyback/burn history

Because Celestial uses multiple quote assets, do not naively sum raw quote amounts across assets and display them as USD.

## Backend

Render API:
https://arc-launchpad-api.onrender.com

Render service ID:
srv-dak10tp5efls73am5scg

Render workspace:
tea-dak0us95efls73altjug

Backend:
Fastify + PostgreSQL

Important endpoints include:

- /
- /health
- /stats
- /analytics/daily
- /tokens
- /tokens/:address
- /tokens/:address/holders
- /buybacks
- /wallet/:address/launches
- /wallet/:address/positions
- /wallet/:address/orders
- /wallet/:address/activity

## Indexer

Render indexer:
https://arc-launchpad-indexer.onrender.com

Render service ID:
srv-dak10vu7bikc73dqsjtg

The indexer supports both generations.

Legacy env:

FACTORY_ADDRESS
FACTORY_START_BLOCK

Celestial env:

CELESTIAL_FACTORY_ADDRESS
CELESTIAL_FACTORY_START_BLOCK
ORDERBOOK_ADDRESS
BUYBACK_VAULT_ADDRESS

Common env:

ARC_CHAIN_ID=5042002
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_WS_URL
DATABASE_URL
LOG_CHUNK_SIZE

Indexed event families:

- V1 TokenCreated
- Celestial TokenCreated
- MetadataSet
- V1 Buy / Sell
- Celestial Buy / Sell
- ERC20 Transfer
- GraduationSwept
- TokenGraduated
- BuybackExecuted
- OrderPlaced
- OrderCancelled
- OrderFilled

Indexer behavior:

- historical backfill
- chunked log queries
- idempotent tx hash + log index inserts
- live watchers
- block timestamp cache
- V1 + Celestial coexistence

## Database

Render Postgres:
arc-launchpad-db

Postgres ID:
dpg-dak0vobl550s73bjt5jg-a

Region:
Singapore

Core tables:

tokens
trades
transfers
buybacks
limit_orders

tokens supports:

- generation
- quote asset
- creator fee recipient
- creator tax
- holder fee
- metadata/socials
- pool address
- status

## Render frontend

URL:
https://arc-launchpad-web.onrender.com

Service ID:
srv-dak1g5uk1f9s73al7jhg

Required current frontend env:

NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_FACTORY_ADDRESS=legacy V1 factory
NEXT_PUBLIC_FEE_ESCROW_ADDRESS=legacy V1 escrow
NEXT_PUBLIC_API_URL=https://arc-launchpad-api.onrender.com

Configured Celestial frontend env:

NEXT_PUBLIC_CELESTIAL_FACTORY_ADDRESS=0x418a062cEcB23d68a3e8dcEa19E89bAD98bBe826
NEXT_PUBLIC_CELESTIAL_ORDERBOOK_ADDRESS=0x93e6ada62d3E6a0153B00F9962c4B52eC7F45f62
NEXT_PUBLIC_CELESTIAL_FEE_ESCROW_ADDRESS=0xab922E5F1Ff1071a00a339C8b5FcF7d2f6F2a4e0
NEXT_PUBLIC_CELESTIAL_BUYBACK_VAULT_ADDRESS=0x9FbB1892885888e9a8c01d7A56652C4D76B23fC8

Only set:
NEXT_PUBLIC_CELESTIAL_DEX_ADAPTER_ADDRESS

after a real Arc DEX connector and adapter are deployed.

## Render indexer Celestial configuration

Configured:

CELESTIAL_FACTORY_ADDRESS=0x418a062cEcB23d68a3e8dcEa19E89bAD98bBe826
CELESTIAL_FACTORY_START_BLOCK=62084000
ORDERBOOK_ADDRESS=0x93e6ada62d3E6a0153B00F9962c4B52eC7F45f62
BUYBACK_VAULT_ADDRESS=0x9FbB1892885888e9a8c01d7A56652C4D76B23fC8

Legacy FACTORY_ADDRESS and FACTORY_START_BLOCK remain configured so V1 and Celestial coexist.

## Current feature status

metadata + socials
Implemented in contract, indexer, API, Create UI, token UI. Requires Celestial deployment to activate.

atomic launch + developer buy
Implemented in factory and Create UI. Requires Celestial deployment.

creator tax
Implemented and capped in factory/curve. Creator revenue goes to multi-asset fee escrow. Profile supports claims after env configuration.

holder fee sharing
Implemented in CelestialToken/CelestialBondingCurve. Token page supports holder reward claims.

snipe protection
Implemented as short-lived linearly decaying buy fee, with creator/fee recipient exemptions and configured exemption addresses.

configurable approved pair assets
Implemented via factory quote registry. Deployment script configures USDC, EURC, and cirBTC.

limit/order layer
Implemented in CelestialLimitOrderBook, API/indexer, token terminal, and Profile order management.

production DEX graduation adapter
CelestialDexAdapter is implemented.
Real Arc DEX connector is blocked on officially published Arc DEX deployment addresses. Do not fake this.

post-graduation trading
Frontend and adapter routing are implemented. Activates when a real connector/adapter is deployed and NEXT_PUBLIC_CELESTIAL_DEX_ADAPTER_ADDRESS is set.

buyback/burn vault and analytics
Implemented in CelestialBuybackVault, backend indexing/API, and Analytics UI. Actual executions require a funded vault and keeper action.

sell all
Implemented on token market using the connected wallet's onchain token balance.

shared wallet session
Implemented. Header/Profile/trading reuse one connection.

## Testing

Foundry config:
foundry.toml

via_ir=true is currently required because the expanded protocol is complex enough to hit Solidity stack-depth limits without IR.

Run:

forge build
forge test -vvv
forge fmt --check

App monorepo:

npm install
npm run build

GitHub workflows:

.github/workflows/contracts.yml
.github/workflows/apps.yml
.github/workflows/deploy-arc-testnet.yml
.github/workflows/deploy-celestial-testnet.yml

Do not deploy a commit whose current contracts/apps workflows are red.

## Security rules

- Never accept arbitrary DEX addresses from frontend users.
- Only owner-configured quote assets are launchable.
- Never silently drop advanced launch terms when falling back to V1.
- Keep slippage bounds on every market, order, developer buy, and DEX trade.
- Keep ReentrancyGuard and checks-effects-interactions on external-call flows.
- Do not add liquidity withdrawal methods to ArcLiquidityLocker.
- Do not expose private keys in code, logs, docs, or chat.
- Prefer multisig ownership before mainnet.
- Keep real DEX integration disabled until official Arc deployment addresses are verified.
- External smart-contract review remains a mainnet gate.

## Immediate continuation checklist

1. Confirm latest contracts workflow is green.
2. Confirm latest apps workflow is green.
3. Confirm Render indexer/API/web are live on the current main commit. Render is the deployment source of truth; Vercel is secondary.
4. Harden RPC infrastructure: private Arc RPC for indexer/backend, fallback provider support, smaller/adaptive log ranges, and user-facing rate-limit recovery.
5. Upgrade product UI/UX using the strongest structural lessons from the supplied PONS references without cloning PONS. Priorities: information hierarchy, discovery density, token-market layout, trade ergonomics, mobile behavior, loading states, transaction feedback, and graduation UX.
6. Maintain the complete marketing homepage at / and the market discovery product at /explore.
7. Launch one Celestial token with metadata and an atomic developer buy.
8. Test second-wallet buy/sell and Sell all.
9. Test creator tax claim.
10. Test holder reward accrual/claim.
11. Test limit order place/execute/cancel.
12. Test USDC and EURC launches.
13. Validate cirBTC decimals and launch math with small test amounts.
14. Fund buyback vault, execute curve buyback, verify burn and analytics.
15. When official Arc DEX addresses become available, implement/test connector, deploy adapter, configure factory, graduate a market, and test post-graduation trades.
16. After feature work is complete, run a full protocol QA pass across contracts, frontend, API, indexer, database, Render services, wallet/session behavior, all routes, every supported transaction flow, failure/retry states, mobile/desktop, and dark/light modes.
17. Validate every user journey end to end: connect/switch wallet, create, developer buy, discover/search, market buy, sell percentages/Sell all, limit place/execute/cancel, creator claims, holder claims, profile/activity, analytics, graduation readiness, buyback execution, and post-graduation routing when enabled.
18. Re-check all Render deploys and runtime logs after the final commit and resolve any build, startup, database, RPC, or indexing failures before calling the protocol complete.

## Mainnet gate

Do not use real funds until:

- Celestial contracts receive a dedicated security review
- DEX connector is tested against official Arc deployment
- all protocol workflows are fuzzed/invariant tested
- multisig owns privileged configuration
- quote-asset configuration has safe risk controls
- buyback keeper policy is finalized
- frontend routes cannot cross generation/quote decimals incorrectly
- indexer reorg strategy is production hardened
- monitoring/alerts exist
- complete end-to-end staging run succeeds
