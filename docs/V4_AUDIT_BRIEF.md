# Celestial v4 External Review Brief

Date: 2026-09-14

## Review scope

Primary files:

- packages/contracts/src/CelestialLaunchFactory.sol
- packages/contracts/src/CelestialBondingCurve.sol
- packages/contracts/src/CelestialDexAdapter.sol
- packages/contracts/src/CelestialUniswapV4Connector.sol
- packages/contracts/src/CelestialPoolGuardHook.sol
- packages/contracts/src/CelestialV4PoolHandle.sol
- packages/contracts/src/ArcLiquidityLocker.sol
- packages/contracts/src/CelestialBuybackVault.sol
- packages/contracts/src/libraries/CelestialV4PriceMath.sol
- packages/contracts/src/interfaces/ICelestialGraduationAdapter.sol
- packages/contracts/src/interfaces/UniswapV4Minimal.sol

## Intended invariants

1. A Celestial market cannot graduate before the bonding curve reaches its graduation condition.
2. The terminal price is locked before physical curve reserves are released.
3. Pending protocol, creator, holder, and buyback accounting cannot be mixed into graduation liquidity.
4. Graduation cannot be marked seeded unless the adapter consumes the exact factory-held graduation assets.
5. Only the Celestial connector can initialize the PoolKey used for a Celestial graduated pool.
6. The guard hook has BEFORE_INITIALIZE permission only and cannot affect swaps, liquidity modification, or fees.
7. The v4 LP NFT is minted directly to the permanent locker.
8. No Celestial contract exposes a path to withdraw the locked LP NFT.
9. Surplus Celestial token inventory created by virtual-reserve price continuity is permanently burned.
10. Quote-asset surplus is not recoverable by the connector operator.
11. Connector and adapter approvals are bounded and revoked after successful execution.
12. Post-graduation exact-input swaps cannot leave user input stranded in the connector.
13. Minimum output applies at the Universal Router/v4 level and is rechecked before recipient transfer.
14. Pool handles cannot be confused across token/quote pairs.
15. Buyback execution cannot substitute arbitrary token/quote assets for the recorded graduated market.
16. Old V1 launch/graduation behavior remains ABI-isolated from the price-aware Celestial generation.

## High-priority review questions

- Does the terminal sqrtPriceX96 preserve the final bonding-curve marginal price for both token-address orderings?
- Is full-range v4 liquidity calculated correctly at extreme but supported USDC, EURC, and cirBTC ratios?
- Can a third party bypass CelestialPoolGuardHook and pre-initialize the exact PoolKey?
- Does the CREATE2 hook mining/deployment script guarantee only BEFORE_INITIALIZE is enabled?
- Are PositionManager action encodings exactly compatible with the Arc-deployed v4-periphery version?
- Are Universal Router V4_SWAP action encodings exactly compatible with the Arc deployment?
- Does Permit2 allowance revocation behave as expected after PositionManager and Universal Router pulls?
- Can fee-on-transfer, rebasing, ERC777-style callbacks, or non-standard approved quote assets violate balance assumptions?
- Can malicious callback behavior reenter adapter, connector, factory, buyback vault, or locker?
- Is surplus-token burn economically correct under every valid curve state?
- Can an attacker manipulate the curve immediately before graduation to force an unsafe initial v4 price?
- Are there practical MEV attacks around the final bonding-curve buy and first v4 swap?
- Can a pool be initialized correctly but liquidity minting fail, leaving the market recoverable without unsafe admin powers?
- Is the factory two-phase graduation state safe if external infrastructure is unavailable for a long period?

## Required fork tests once Arc addresses exist

- PoolManager initialization
- PositionManager full-range mint
- LP NFT ownership by locker
- Universal Router buy
- Universal Router sell
- Quoter exact-input simulation
- Permit2 approve/revoke
- USDC pair
- EURC pair
- cirBTC pair
- token lower-address ordering
- token higher-address ordering
- front-run initialization attempt
- final curve buy followed by immediate v4 buy/sell
- post-graduation buyback
- indexer reconciliation against emitted events

## Out of scope for first review

- future Celestial fee hook
- future dynamic fees
- future protocol-owned liquidity rebalancing
- arbitrary external token listings

The first production version intentionally avoids these features.
