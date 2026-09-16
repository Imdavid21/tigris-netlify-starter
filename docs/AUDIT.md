# supershot.fun Functionality and Security Audit

Date: 2026-09-14

## Scope

Internal engineering review of the current supershot.fun implementation across Solidity contracts, launch and trading flows, wallet/network handling, API, PostgreSQL, indexer, Render deployment, RPC failure behavior, and CI.

This is not an independent third-party smart-contract audit.

## Verified automated status

Current main branch verification:

- contracts workflow: passing
- apps workflow: passing
- Foundry build and tests: passing
- stateful invariants: passing
- Next.js production build: passing
- API and indexer TypeScript builds: passing
- API and indexer Docker builds: passing
- PostgreSQL schema/runtime smoke tests: passing
- frontend route smoke tests: passing
- Render web/API/indexer: live on the same tested commit at the time of this review

Foundry coverage includes:

- metadata and configurable quote pairs
- atomic launch plus developer buy
- buy and sell execution
- slippage
- fixed supply
- creator tax accrual, sweep, and claim
- holder fee accrual and claim
- anti-snipe decay and explicit exemptions
- limit buy execution
- limit sell execution
- order cancellation and escrow refund
- buyback funding, curve buyback, and burn
- graduation state and reserve safety
- malicious/reentrant adapter regression tests
- randomized curve fuzzing
- stateful invariants

Core invariants include:

- fixed token supply does not change
- curve does not sell reserved graduation inventory
- tracked quote reserve does not exceed graduation threshold
- physical quote balance covers tracked reserve and pending fees

## Contract review

### Fee settlement

Creator, protocol, and buyback fees accrue on the curve and are settled by sweepFees.

Creator and protocol amounts move to CelestialFeeEscrow; buyback amounts move to CelestialBuybackVault.

Tests now cover the complete accrue -> sweep -> claim/fund lifecycle rather than assuming fees are instantly escrowed.

### Holder rewards

Holder fees use magnified per-share accounting in CelestialToken.

Curve inventory and the burn address are excluded from eligible reward supply. Claims are paid in the market quote asset.

### Limit orders

CelestialLimitOrderBook escrows the input side, supports permissionless execution when conditions are satisfied, and refunds active orders on owner cancellation.

Automated tests cover buy execution, sell execution, and cancellation/refund.

### Buyback and burn

CelestialBuybackVault supports pre-graduation curve buybacks and a post-graduation adapter path.

The curve path is tested end to end, including fee sweep, vault funding, purchase, burn-address transfer, and allowance cleanup.

### Graduation

Factory graduation uses explicit state transitions, reentrancy protection, reserve-consumption checks, and locked liquidity accounting.

The production DEX connector is intentionally not configured until an official Arc DEX deployment can be verified.

## Frontend

Implemented and production-built:

- complete marketing homepage
- dense market discovery at /explore
- separate graduated-market discovery
- metadata/social display
- launch form with approved quote assets
- atomic developer buy
- creator/holder economics
- snipe exemptions
- market buy/sell
- Sell 25/50/75/100%
- limit orders and cancellation
- creator claims
- holder reward claims
- wallet/profile/activity/order management
- charts, recent trades, and holder data through the API/indexer
- protocol analytics and buyback history
- dark/light mode
- shared wallet session
- degraded-service banner

Critical market state remains contract-native.

## RPC resilience

The public Arc RPC produced real -32005 rate-limit failures during both user transaction submission and indexer backfill.

Changes applied:

- browser public-client fallback support
- optional dedicated wallet RPC
- backend/indexer fallback RPC support
- optional WebSocket transport
- adaptive log ranges
- small backfill chunks
- exponential/cooldown retry behavior
- indexer health server starts before backfill
- indexer remains alive while ingestion is degraded
- user-facing RPC rate-limit errors
- protocol status endpoint/banner

A managed/private Arc RPC is still strongly recommended for production. No provider credential is committed to the repository.

## API and data

Runtime CI covers:

- /health
- /tokens
- /tokens/:address
- wallet activity
- invalid-address rejection
- PostgreSQL schema/runtime startup

Current API also provides:

- protocol stats
- daily analytics
- holders
- launches
- positions
- orders
- buybacks

User-controlled SQL inputs remain parameterized.

## Render

Primary deployment target is Render.

Services:

- web: arc-launchpad-web
- API: arc-launchpad-api
- indexer: arc-launchpad-indexer
- PostgreSQL: arc-launchpad-db

The earlier indexer crash loop was traced to Arc public-RPC throttling and has been changed to degraded/backoff behavior instead of process termination.

Historical Render error logs from earlier failed builds remain visible, but the final reviewed deployment is live.

## Static analysis

Slither runs in CI. It currently remains non-blocking because it reports a mix of actionable, conservative, dependency, interface-inheritance, and mock-only findings.

Previously actionable reentrancy findings were addressed with guards, state locks, reserve-consumption validation, and regression tests.

Slither output must be reviewed again for the final production DEX connector.

## Uniswap v4 graduation review

supershot.fun now contains a price-aware Uniswap v4 connector and adapter path. It is not enabled on the deployed Arc Testnet factory.

Implemented protections:

- terminal bonding-curve price is locked before reserve sweep
- graduation adapter is factory-controlled
- v4 dependencies are immutable connector addresses
- deployment script rejects dependency addresses with no bytecode
- LP NFT recipient is the permanent liquidity locker
- no LP withdrawal method exists
- ERC20 and Permit2 approvals are bounded and revoked
- exact-input swaps require full input consumption
- output slippage is enforced
- unexpected surplus launch-token inventory is burned
- unexpected quote surplus is permanently locked
- post-graduation trades remain routed through the same supershot.fun market page

Known v4-specific risks that remain mainnet gates:

- the initialization-only guard hook mitigates PoolKey pre-initialization griefing, but its CREATE2-mined permission bits and sealed initializer must be independently verified on the actual deployment
- the local minimal ABI layer must be checked against the exact Uniswap release deployed on Arc
- Universal Router and Permit2 behavior must be fork-tested against Arc's actual deployment
- full-range liquidity calculations and decimal combinations require fork tests for USDC, EURC, and cirBTC
- the connector has not received an independent external audit
- no custom fee/buyback hook should be enabled until the vanilla path has been audited and proven in staging

## Remaining external gates

These are not code TODOs that should be filled with guessed values:

1. A reliable managed/private Arc RPC credential should be configured for production.
2. Official Arc DEX deployment addresses and integration details must be verified before enabling real graduation/post-graduation swaps.
3. Privileged mainnet ownership should move to a multisig.
4. An independent external smart-contract audit is still required before real-fund mainnet use.
5. The database credential previously exposed outside the repository should be rotated in Render.
6. A real multi-wallet staging run should be performed with funded test wallets after the managed RPC is configured.

## Mainnet gate

Do not use real funds until the external gates above are complete and one full staging lifecycle succeeds:

create -> optional developer buy -> discover -> market buy/sell -> Sell all -> limit place/execute/cancel -> creator claim -> holder claim -> fee sweep -> buyback/burn -> graduation -> locked DEX liquidity -> post-graduation trade.
