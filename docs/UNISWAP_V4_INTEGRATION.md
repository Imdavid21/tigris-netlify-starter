# Celestial Uniswap v4 Graduation

Date: 2026-09-14

## Decision

Celestial keeps its own bonding curve for primary-market trading and uses Uniswap v4 as the intended post-graduation liquidity engine.

Lifecycle:

1. launch on Celestial bonding curve
2. collect quote reserves while users trade
3. reach graduation threshold
4. lock the terminal bonding-curve price
5. sweep pending Celestial fees
6. release graduation quote and token inventory
7. initialize a vanilla Uniswap v4 pool at the locked terminal price
8. mint the v4 liquidity position directly to the permanent liquidity locker
9. burn surplus launch-token inventory that is not required at the terminal price
10. route later Celestial trades through the v4 adapter

No Celestial hook is used in the first version. Fee/buyback hooks are intentionally deferred until the base graduation path is externally reviewed.

## Official Uniswap surfaces used

Celestial's local minimal interfaces mirror the relevant official Uniswap v4 ABI surfaces:

- v4-core IPoolManager
- v4-core PoolKey / PoolId
- v4-periphery IPositionManager
- v4-periphery IV4Router
- v4-periphery IV4Quoter
- v4-periphery Actions
- Universal Router IUniversalRouter / V4_SWAP command
- Permit2

The local interface layer avoids pulling a large external dependency graph into the protocol while preserving the official ABI layouts.

Before deployment, compare these interfaces against the exact tagged Uniswap release used by Arc.

## Current Arc blocker

Do not configure guessed addresses.

At the time of implementation, Arc was not listed in Uniswap's official v4 deployment registry. The deployment script therefore requires explicit PoolManager, PositionManager, Quoter, Universal Router, and Permit2 addresses and verifies that each address has deployed bytecode.

The production adapter must remain unset until those addresses are published by an authoritative Arc/Uniswap source and independently cross-checked.

## Terminal price continuity

Celestial uses a virtual quote reserve in the bonding curve.

The terminal marginal curve price is therefore based on:

- token reserve: curve.trackedTokens()
- quote reserve: curve.virtualQuoteReserve()

It is not simply:

trackedQuote / token inventory

Using only physical raised quote would initialize the DEX below the final bonding-curve price and create predictable graduation arbitrage.

Celestial locks a sqrtPriceX96 value before the curve releases its assets:

sqrtPriceX96 = sqrt(currency1Reserve / currency0Reserve) * 2^96

Currency ordering follows Uniswap's address ordering.

The locked value is stored in the Graduation record and emitted in GraduationPriceLocked.

## Liquidity inventory

The terminal price can require less than the full remaining launch-token balance when the physical quote reserve is smaller than the virtual quote reserve.

The v4 PositionManager is given the available token and quote amounts as maximums. It consumes the amounts required for the full-range position at the locked terminal price.

After minting:

- surplus launch tokens are sent permanently to the DEAD address
- surplus quote is sent to the permanent liquidity locker
- the connector never leaves graduation dust withdrawable by an operator

Burning surplus token inventory is deliberate. Sending it to the locker would make those tokens eligible for Celestial holder-fee accounting while nobody can claim their rewards.

## Permanent liquidity

The v4 NFT position recipient is ArcLiquidityLocker.

ArcLiquidityLocker has no ERC20 or ERC721 withdrawal method.

The factory separately records:

- adapter
- pool handle
- position ID
- lock timestamp

The pool handle is a small immutable address-shaped contract that stores the real v4 PoolId. This preserves compatibility with Celestial's existing database and frontend, which use an address as the market venue identifier even though Uniswap v4 pools themselves are not contracts.

## Trading

After graduation:

Celestial token page -> CelestialDexAdapter -> CelestialUniswapV4Connector -> Universal Router -> Uniswap v4

The same token page remains active.

Quotes are obtained by simulating the adapter's call to the official v4 Quoter.

Exact-input swaps enforce:

- user minAmountOut
- bounded Permit2 approval
- bounded ERC20 approval
- approval revocation after the call
- exact input consumption
- output balance verification before transfer to recipient

## Indexing

When adapter and connector addresses are configured, the indexer watches:

- factory GraduationPriceLocked
- factory TokenGraduated
- connector V4PoolCreated
- adapter Swap

Post-graduation swaps are stored in the same trades table with:

venue = UNISWAP_V4

The API exposes venue-level analytics so Celestial can distinguish bonding-curve and graduated-market activity without splitting the user experience.

## Security boundary

Celestial does not implement:

- concentrated-liquidity math
- Uniswap swap math
- LP share accounting
- an AMM invariant
- custom v4 hook logic

Uniswap owns those surfaces.

Celestial owns:

- terminal price calculation
- graduation reserve transfer
- allowance lifecycle
- v4 position mint parameters
- permanent LP recipient
- routing into the verified Uniswap contracts

## Required review before real funds

- verify official Arc v4 addresses from at least two authoritative sources
- pin/review exact Uniswap contract release deployed on Arc
- external review of CelestialUniswapV4Connector
- fork test against the actual Arc deployment
- test token/quote ordering both directions
- test USDC, EURC, and cirBTC decimal combinations
- test malicious/reentrant token behavior
- test Permit2 expiration/revocation
- test partial liquidity consumption and surplus burn
- test front-run / pool-preinitialization behavior
- test terminal price continuity within explicit tolerance
- test complete curve -> graduation -> v4 buy/sell lifecycle with two wallets
