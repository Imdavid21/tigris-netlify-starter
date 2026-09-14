# Arc Launchpad Functionality and Security Audit

Date: 2026-09-14

## Scope

This audit covers the current repository implementation across:

- Solidity contracts
- bonding curve economics and accounting
- graduation state machine
- fee accounting and claiming
- frontend launch and trade flows
- Arc wallet/network handling
- API
- PostgreSQL schema
- event indexer
- backend Docker packaging
- Arc Testnet RPC configuration
- dependency security
- CI runtime smoke tests

It is an internal engineering audit, not an independent third-party smart contract audit.

## Current test status

### Contracts

Tested with Foundry:

- token creation
- buy
- sell
- slippage
- fixed supply
- fee accrual
- fee sweep
- creator claims
- protocol claims
- graduation threshold cap
- two-phase graduation
- duplicate-graduation rejection
- duplicate-pool-seeding rejection
- premature graduation rejection
- unauthorized adapter configuration rejection
- zero-input rejection
- metadata validation
- buy/sell round trip cannot increase trader USDC
- curve freezes when graduation becomes ready
- final-buy quote matches execution cap
- bad graduation adapter cannot report success without consuming reserves
- malicious graduation adapter cannot re-enter the factory
- randomized buy/sell fuzzing
- stateful invariants

Stateful invariants:

- fixed token supply never changes
- curve never sells reserved graduation inventory
- tracked USDC never exceeds graduation threshold
- physical USDC balance covers tracked reserves and pending fees

Static analysis:

- Slither is run in CI.
- Actionable factory reentrancy findings led to ReentrancyGuard, CEI state locks, adapter reserve-consumption checks, and regression tests.
- Remaining Slither warnings include conservative balance-snapshot reentrancy warnings despite the guard, trusted newly-created-contract calls during launch, dependency pragma differences, and mock-only findings.
- Remaining warnings must be reviewed again when the production DEX adapter is introduced.

## Contract issues found and fixed

### Graduation reserve race

Issue:

A sell remained possible after the curve reached its graduation threshold but before `beginGraduation` was called. A trader could reduce the reserve and delay graduation.

Fix:

Sell execution now closes immediately when the curve is graduation-ready.

### Final-buy quote mismatch

Issue:

`quoteBuy` originally quoted the caller's full input while execution capped the final purchase at remaining graduation capacity.

Fix:

`quoteBuy` and `buy` now apply the same final-input cap.

### Factory reentrancy boundary

Issue:

Graduation calls external contracts before all state was finalized.

Fix:

- factory-level ReentrancyGuard
- nonReentrant on launch/graduation entry points
- CEI graduation phase locks
- malicious-adapter regression test

### Adapter false-success condition

Issue:

A graduation adapter could return a non-zero pool without actually consuming the launch reserves.

Fix:

Factory records pre/post token and USDC balances and requires exact reserve consumption before marking graduation complete.

## Frontend

Implemented and build-tested:

- wallet connection
- Arc Testnet chain switching
- fallback `wallet_addEthereumChain`
- token creation transaction
- launch confirmation
- TokenCreated event decoding
- automatic redirect to new token page
- onchain launch discovery from factory
- token name/ticker
- raised USDC
- graduation progress
- buy quote
- sell quote
- USDC approval
- token approval
- buy execution
- sell execution
- 1% minimum-output slippage protection
- transaction confirmation
- state refresh
- invalid token addresses return 404

Current frontend limitations:

- metadata/image upload remains disabled
- chart/history UI is not yet connected to the indexer
- holder analytics are not implemented
- post-graduation DEX routing is not implemented until a production Arc DEX adapter exists

## API

Runtime-tested against a real PostgreSQL container:

- `GET /health`
- `GET /tokens`
- `GET /tokens/:address`
- `GET /wallet/:address/activity`
- token/trade retrieval from seeded data
- invalid address rejection
- pagination input hardening

All SQL user inputs are parameterized in the current API routes.

## Indexer

Implemented:

- TokenCreated ingestion
- Buy ingestion
- Sell ingestion
- graduation state updates
- idempotent trade insertion
- historical factory backfill before live subscription
- historical curve backfill
- chunked log replay to avoid large RPC range failures
- duplicate live-watcher prevention
- block timestamp caching

Indexer limitations:

- candles are not implemented
- holder snapshots are not implemented
- trending aggregates are not implemented
- a production deployment has not yet been load-tested against sustained Arc traffic

## Infrastructure and packaging

CI verifies:

- Node installation
- production dependency audit
- indexer TypeScript build
- API TypeScript build
- Next.js production build
- API Docker image build
- indexer Docker image build
- PostgreSQL schema application
- seeded backend data
- backend runtime routes
- frontend runtime routes
- Arc Testnet RPC chain ID
- Arc canonical USDC ERC20 decimals

Dependency audit:

- Next 15 inherited a high-severity PostCSS advisory.
- Web app upgraded to Next 16.3.5.
- Subsequent production dependency audit reports 0 vulnerabilities.

## Arc environment

Verified in CI against Arc Public Testnet:

- chain ID: 5042002
- RPC: https://rpc.testnet.arc.network
- USDC ERC20 interface: 0x3600000000000000000000000000000000000000
- USDC ERC20 decimals: 6

## External blockers

### Real testnet contract deployment

Contracts cannot be broadcast without a funded signing wallet/private key and treasury address.

Until a real factory is deployed, the frontend cannot execute live launch/trade transactions against Arc despite those paths being build- and contract-tested.

### Production DEX graduation

The repository currently uses an adapter interface plus test adapters.

A production arbitrary-token Uniswap/DEX graduation adapter is not yet wired.

Arc Public Testnet does not currently provide the final arbitrary-token Uniswap environment needed to prove the complete launched-token graduation lifecycle. Production Arc DEX addresses/configuration must be verified before mainnet deployment.

### Backend hosting

Backend/indexer deployment to Railway is blocked by the connected Railway account's free-plan resource provisioning limit.

The images are tested in CI but are not publicly hosted.

## Mainnet gate

Do not put real funds through the protocol until:

- Arc factory is deployed and verified
- real launch/buy/sell lifecycle is run with multiple wallets on Arc
- production Arc DEX addresses are confirmed
- production graduation adapter is implemented
- production adapter is fuzzed and reviewed
- LP custody/locking is verified against the actual DEX position representation
- multisig replaces deployer ownership
- external independent smart-contract review is completed
- backend/indexer is deployed and monitored
- frontend is configured with the verified factory address
- full end-to-end production smoke test passes
