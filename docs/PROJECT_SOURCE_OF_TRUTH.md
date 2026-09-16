# Celestial / Arc Launchpad Source of Truth

Last verified: 2026-09-16

Current live frontend commit at verification: `54f61596820e98592a34b12494db2167bb05ee53`

Repository: `Imdavid21/tigris-netlify-starter`

This document consolidates the current product, design system, architecture, deployed contracts, user flows, work completed, superseded design experiments, known debt, and remaining external gates for the Arc launchpad now branded as Celestial.

It is intended to stop future agents from reconstructing context from old chats, stale screenshots, individual commits, or superseded design directions.

## 1. Product definition

Celestial is a non-custodial token launchpad and market terminal built for Arc.

The core product model is:

1. Create a token with explicit launch economics.
2. Start trading on a Celestial bonding curve.
3. Let users discover, buy, sell, place limit orders, inspect holders, and track market activity from the same product.
4. Graduate the market into permanently locked DEX liquidity once the curve reaches its graduation threshold.
5. Keep the same token page after graduation and switch the execution venue underneath it.

PONS was used as a benchmark for product structure, not as a pixel-copy target.

The strongest ideas carried forward are:

- discovery-first product architecture
- one token URL across the full market lifecycle
- onchain state as execution truth
- indexed backend for discovery, history, analytics, and speed
- explicit creator economics
- atomic launch plus optional developer buy
- phase-aware execution
- permanent liquidity policy
- clear transaction and graduation states

The intended product should feel like a market terminal, not a token generator.

## 2. Current live deployment

Primary frontend:

- `https://arc-launchpad-web.onrender.com`
- Render service: `arc-launchpad-web`
- Service ID: `srv-dak1g5uk1f9s73al7jhg`
- Region: Singapore
- Branch: `main`
- Auto deploy: enabled

API:

- `https://arc-launchpad-api.onrender.com`
- Render service: `arc-launchpad-api`
- Service ID: `srv-dak10tp5efls73am5scg`
- Region: Singapore

Indexer:

- `https://arc-launchpad-indexer.onrender.com`
- Render service: `arc-launchpad-indexer`
- Service ID: `srv-dak10vu7bikc73dqsjtg`
- Region: Singapore

Database:

- Render PostgreSQL
- Name: `arc-launchpad-db`
- Region: Singapore

At the time this document was written, the frontend was live on commit `54f6159`, whose final design-related change was matching the header brand lockup proportions.

## 3. Current information architecture

The product is Explore-first.

Current route intent:

- `/` -> redirects to `/explore`
- `/explore` -> market discovery
- `/create` -> launch flow
- `/token/[address]` -> token identity, market data, charting, holder data, trading, orders, and rewards
- `/scanner/[address]` -> contract, holder, activity, and explorer inspection
- `/portfolio` -> wallet-specific launches, positions, activity, claims, and orders
- `/analytics` -> protocol and market analytics
- `/profile` -> legacy redirect to `/portfolio`
- `/trade` -> legacy redirect to `/explore`

The earlier standalone Stocks surface was removed from navigation and then removed as a remaining product reference.

The earlier marketing homepage was also removed. The current root opens directly into Explore.

## 4. Current design direction

### 4.1 Design intent

The current frontend is product-first, dense, restrained, and market-oriented.

The direction deliberately moved away from:

- giant marketing hero sections
- cyberpunk styling
- excessive gradients
- novelty-first motion
- decorative Utopia-style layouts
- large amounts of promotional copy
- a separate marketing homepage before the actual market product

The current target is a compact trading interface with strong hierarchy, small radii, restrained shadows, clear state changes, and minimal explanatory copy.

### 4.2 Current palette

The current canonical token system lives in:

- `apps/web/styles/tokens.css`
- `apps/web/styles/base.css`

Light mode:

- canvas: `#E9E7DF`
- surface: `#F3F1EA`
- soft surface: `#EEECE5`
- active surface: `#E6F4B7`
- primary text: `#11120F`
- secondary text: `#626159`
- tertiary text: `#96948A`
- border: `#D8D4C9`
- strong border: `#C7C2B6`
- primary brand/action: `#11120F`
- brand-on: `#F3F1EA`
- positive / acid-lime accent: `#9FCA26`
- negative: `#CF5258`
- warning: `#A66C2C`

Accent scale:

- `--brand-50: #F8FFDC`
- `--brand-100: #EFFFC2`
- `--brand-200: #E2FF91`
- `--brand-300: #D2FF5D`
- `--brand-400: #C5F63D`
- `--brand-500: #B8E832`
- `--brand-600: #9FCA26`
- `--brand-700: #7CA01C`
- `--brand-800: #607B19`
- `--brand-900: #4D6218`

Dark mode:

- canvas: `#11120F`
- surface: `#191A16`
- soft surface: `#20211C`
- active surface: `#2B301F`
- primary text: `#F1F0E8`
- secondary text: `#B7B4AA`
- tertiary text: `#77756D`
- border: `#2C2D27`
- strong border: `#3A3B33`
- primary brand/action: `#B8E832`
- brand-on: `#11120F`

This warm-stone plus acid-lime system supersedes the earlier blue design-token proposal and the purple/red experimental systems.

### 4.3 Typography

Base font stack:

`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

Base body size:

- 13px
- line-height 1.45

Market data should use tabular numerals where useful.

### 4.4 Radii

- XS: 8px
- SM: 12px
- MD: 16px
- LG: 22px
- XL: 26px
- pill: 999px

### 4.5 Shadows

The current system uses restrained depth:

- `--shadow-1`: small 1 to 2px surface lift
- `--shadow-2`: moderate card lift
- `--shadow-3`: modal / floating surface lift

The design should not depend on glow effects.

### 4.6 Motion

- fast: 120ms
- normal: 180ms
- slow: 260ms
- easing: `cubic-bezier(.2, .8, .2, 1)`

Reduced-motion media rules disable long animation and transition behavior.

### 4.7 Layout

Canonical content max width:

- `1240px`

The layout is responsive from a minimum supported width of 320px.

Key desktop patterns:

- Explore: dense market discovery surface
- Token market: primary market content plus approximately 360px sticky trading rail
- Create: main form plus approximately 280px sticky preview rail
- Analytics: KPI and panel-based reporting
- Portfolio: wallet-oriented panels and tables
- Scanner: contract inspection, top holders, and recent activity

## 5. Current Celestial brand mark

The approved mark is a rounded lime tile containing a black four-point celestial spark.

Implementation:

- `apps/web/components/celestial-logo.tsx`
- `apps/web/public/icon.svg`

Current icon construction:

- 32 x 32 viewBox
- rounded rectangle with 9px corner radius
- background `#E6F4B7`
- spark fill `#11120F`

The same mark is used in the header, footer, favicon, shortcut icon, and Apple metadata icon.

Do not reintroduce older temporary logos unless explicitly requested.

## 6. Current header and shell

Primary component:

- `apps/web/components/app-header.tsx`
- `apps/web/components/AppHeader.module.css`

Current header hierarchy:

1. Protocol status strip when needed
2. Celestial mark + wordmark
3. Primary nav
   - Explore
   - Analytics
   - Portfolio
4. Global search
5. Create action
6. Arc Testnet network chip
7. Light/dark toggle
8. Wallet control

The header is sticky, lightly blurred, compact, and intentionally avoids oversized navigation.

The search surface is globally accessible and is intended to resolve token name, ticker, and contract address.

## 7. Current page design

### 7.1 Explore

Files:

- `apps/web/app/explore/page.tsx`
- `apps/web/app/explore/explore.module.css`
- `apps/web/components/launches.tsx`
- `apps/web/components/Launches.module.css`
- `apps/web/components/token-card.tsx`
- `apps/web/components/TokenCard.module.css`

Current Explore features:

- page title plus Arc markets context
- Create shortcut
- graduated-market section when applicable
- token search by name, symbol, or address
- sorting by:
  - Recent buys / activity
  - Newest
  - Oldest
  - Graduation
  - Volume
- time filters:
  - All
  - 24h
  - 7d
- paginated live-launch grid
- token cards with volume, trade count, recent age, generation/status, contract shortcut, and graduation progress
- skeleton loading state
- degraded market-index notice

Indexed discovery is allowed to degrade without making contract-native trading unavailable.

### 7.2 Token market

Primary file:

- `apps/web/components/token-market.tsx`

The token market supports both legacy V1 and Celestial generations.

Current surfaces:

- Explore breadcrumb
- token image / fallback avatar
- name and ticker
- generation / phase state
- token address
- creator
- website
- X
- Telegram
- quote asset
- raised amount
- graduation percentage
- current market venue
- graduation progress rail
- price chart
- recent trades
- holders
- contract / curve links
- supply and fee summary
- holder reward claim
- sticky trade terminal

Trading modes:

- Market
- Limit
- Orders

Market actions:

- Buy
- Sell
- quote balance and token balance
- buy quick amounts
- Sell 25%
- Sell 50%
- Sell 75%
- Sell all / 100%
- slippage protection
- minimum output
- fee estimation
- allowance handling
- wallet/network handling
- transaction progress states

Limit-order actions:

- place buy order
- place sell order
- view open orders
- cancel open orders

Graduated markets are designed to remain on the same token page and route execution through the configured DEX adapter.

If no real DEX adapter is configured, the frontend must state that post-graduation execution is unavailable rather than pretending a route exists.

### 7.3 Create

Primary files:

- `apps/web/app/create/page.tsx`
- `apps/web/app/create/CreatePage.module.css`
- `apps/web/components/create-token-form.tsx`

Current Celestial launch options include:

- name
- symbol
- description
- image / metadata URL
- website
- X
- Telegram
- approved quote asset
- optional developer buy
- creator fee recipient
- creator tax
- holder fee sharing
- snipe-exemption addresses

Approved quote assets in the current test deployment:

- USDC
- EURC
- cirBTC

The create page uses a dense multi-section form plus a side preview / economics summary.

Atomic developer buy flow:

1. approve quote asset if needed
2. preview initial buy
3. apply minimum-output buffer
4. call `createTokenAndBuy`
5. decode `TokenCreated`
6. redirect to the new token page

Legacy fallback remains supported when the Celestial factory is unavailable, but Celestial-only terms must not be silently discarded.

### 7.4 Portfolio

Current route:

- `/portfolio`

Primary files:

- `apps/web/app/portfolio/page.tsx`
- `apps/web/app/portfolio/PortfolioPage.module.css`
- `apps/web/components/profile-panel.tsx`

Current responsibilities:

- launches
- positions
- wallet activity
- open and historical limit orders
- legacy creator fee claims
- Celestial multi-asset creator fee claims

`/profile` is now a compatibility route and redirects to `/portfolio`.

### 7.5 Analytics

Primary files:

- `apps/web/app/analytics/page.tsx`
- `apps/web/app/analytics/AnalyticsPage.module.css`

Current analytics surfaces:

- degraded-indexer notice
- 24h trades
- 24h launches
- unique creators
- unique traders
- total launches
- graduated markets
- total trades
- open orders
- buyback execution count
- post-graduation trades
- post-graduation markets
- curve venue metrics
- Uniswap v4 venue metrics
- buyback / burn history
- recent daily trading activity
- recent daily launches

Important accounting rule:

Do not sum raw USDC, EURC, and cirBTC amounts into a fake USD figure without a valid conversion layer.

### 7.6 Scanner

Current route:

- `/scanner/[address]`

Primary file:

- `apps/web/app/scanner/[address]/page.tsx`

Current scanner surfaces:

- token identity
- token contract
- curve contract
- creator
- DEX pool when available
- status
- generation
- quote asset
- indexed holder count
- indexed trade count
- indexed held supply
- top holders
- recent activity
- Arc Explorer links
- direct Open Market action

The token, curve, creator, DEX pool, holder rows, and recent transactions link directly to Arcscan where applicable.

## 8. Design evolution and rejected directions

Several visual directions were implemented as experiments during the redesign. These are historical and should not be treated as current design guidance.

### Earlier directions

1. Purple cyberpunk redesign
   - implemented and deployed temporarily
   - later superseded

2. Launchpad visual-reference rebuild
   - header and page layout were rebuilt around a reference
   - later superseded

3. Avenue visual system
   - temporarily loaded
   - later superseded

4. Kinetic red-black Celestial landing page
   - temporarily built
   - later superseded

5. Utopia-inspired system
   - several iterations, including a functional market interface
   - later reset

6. Earlier blue PONS-like design-token direction
   - useful structural ideas remain
   - current palette no longer uses blue as the primary identity

### Current canonical sequence

The final redesign sequence on 2026-09-16 was:

- reset frontend styling entrypoint
- add Celestial design tokens
- route root directly to Explore
- rebuild footer with product-first density
- add Explore market-grid styles
- remove obsolete cyberpunk style layer
- add token-market route design system
- rebuild recent-trades table
- apply canonical Create shell
- apply canonical Portfolio shell
- apply canonical Analytics shell
- collapse duplicate Trade route into Explore
- remove obsolete brand footer
- remove Stocks from header
- apply warm-stone and acid-lime palette globally
- remove final Stocks reference
- use approved Celestial brand mark
- use Celestial mark for metadata icons
- match header brand lockup proportions

Unless explicitly requested, future frontend work should extend this current system instead of restoring any older experiment.

## 9. Current styling debt

There is one important frontend debt item.

`apps/web/app/globals.css` is still a large legacy global stylesheet of roughly 48 KB. It contains a substantial amount of older dark-purple styling and global utility/selectors used by current functional surfaces.

The application currently imports styles in this order:

1. `styles/tokens.css`
2. `styles/base.css`
3. `app/globals.css`

This means the current token system and newer CSS Modules coexist with a large legacy global layer.

Do not delete `globals.css` blindly because Create, Token Market, Analytics, and other surfaces still reference many of its global class names.

Recommended cleanup strategy:

1. migrate page-specific global classes into page/component CSS Modules
2. replace hard-coded legacy colors with tokens
3. verify light and dark mode after each migration
4. remove dead selectors only after route-level QA
5. shrink `globals.css` into true shared primitives only

A small blue focus-ring value also remains in base/form focus styling and should eventually be tokenized to the current brand system.

## 10. Repository architecture

Main directories:

- `packages/contracts` -> Solidity protocol
- `apps/web` -> Next.js frontend
- `apps/api` -> Fastify API
- `apps/indexer` -> Arc event indexer
- `docs` -> architecture, audits, product research, deployment, and security notes

Frontend stack:

- Next.js
- React
- TypeScript
- viem
- CSS Modules plus shared CSS tokens/globals

Backend:

- Fastify
- PostgreSQL

Indexer:

- Arc event ingestion
- historical backfill
- live watchers
- V1 and Celestial coexistence

## 11. Source-of-truth architecture

Critical design principle:

Contracts are authoritative for:

- execution
- balances
- price / quote state
- market phase
- launch economics
- allowances

API/indexer are for:

- discovery
- search
- history
- holder data
- rankings
- analytics
- performance

Backend failure must not make an otherwise-live market untradeable.

The token-market resolver therefore attempts direct onchain Celestial resolution before falling back to legacy V1 resolution when indexed data is missing or delayed.

## 12. Wallet architecture

Primary shared session:

- `apps/web/components/wallet-session.tsx`

Required behavior:

- restore existing authorization with `eth_accounts`
- explicit connect via `eth_requestAccounts`
- react to `accountsChanged`
- react to provider disconnect
- keep Header and Portfolio/Profile on one shared session

A prior bug caused duplicate wallet prompts because Header and Profile each requested accounts independently. This was fixed by centralizing wallet state.

Navigation should not disconnect the wallet.

## 13. Theme architecture

Theme key:

- `celestial-theme`

Theme bootstrap runs before hydration in `app/layout.tsx`.

This avoids a light/dark flash during initial render.

The theme toggle lives in:

- `apps/web/components/theme-toggle.tsx`

## 14. Arc network configuration

Arc Testnet:

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`

Known quote assets:

USDC:

- `0x3600000000000000000000000000000000000000`
- 6 decimals

EURC:

- `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`
- 6 decimals

cirBTC:

- `0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF`
- 8 decimals

## 15. Legacy V1 deployment

The legacy generation remains supported during migration.

Factory:

- `0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423`

Fee escrow:

- `0x6D1597932B93b9939f21E9A8D8C2908457F7925d`

Liquidity locker:

- `0xf58489A0B285F3b0046FF53a055b80E69a6e15eB`

Legacy contracts include:

- `ArcLaunchFactory.sol`
- `ArcBondingCurve.sol`
- `ArcToken.sol`
- `ArcFeeEscrow.sol`
- `ArcLiquidityLocker.sol`

Do not delete or silently repurpose the V1 contracts while old markets remain live.

## 16. Celestial testnet deployment

Current Celestial Arc Testnet addresses:

Factory:

- `0x418a062cEcB23d68a3e8dcEa19E89bAD98bBe826`

Fee escrow:

- `0xab922E5F1Ff1071a00a339C8b5FcF7d2f6F2a4e0`

Buyback vault:

- `0x9FbB1892885888e9a8c01d7A56652C4D76B23fC8`

Liquidity locker:

- `0x3e535c6F3daE1594A1C9ebB55E49175abC03bf77`

Limit order book:

- `0x93e6ada62d3E6a0153B00F9962c4B52eC7F45f62`

Indexer backfill start used:

- `62084000`

The current factory intentionally has no production DEX graduation adapter configured until official Arc DEX deployment details are verified.

## 17. Celestial protocol components

### CelestialLaunchFactory

Responsibilities:

- approved quote-asset registry
- metadata and socials
- creator fee recipient
- creator tax
- holder fee sharing
- anti-snipe configuration
- token creation
- atomic token creation plus developer buy
- initial-buy preview
- graduation state
- DEX adapter configuration

### CelestialBondingCurve

Responsibilities:

- buy quotes
- sell quotes
- market execution
- creator tax
- holder fee sharing
- short-lived decaying snipe protection
- protocol fee split
- buyback funding
- graduation accounting

### CelestialToken

- fixed supply ERC-20
- holder fee accounting
- `withdrawableRewardOf`
- `claimHolderRewards`

Curve inventory and the DEAD address are excluded from eligible holder-reward supply.

### CelestialFeeEscrow

Multi-asset claim model:

`asset -> recipient -> claimable amount`

### CelestialBuybackVault

Supports:

- pre-graduation curve buybacks
- post-graduation adapter buybacks
- economic burn by sending purchased tokens to DEAD
- keeper / owner execution model

### CelestialLimitOrderBook

Supports:

- buy orders
- sell orders
- permissionless execution when order conditions are satisfied
- owner cancellation
- escrow refunds

Limit orders close at the graduation boundary.

### CelestialDexAdapter

Provides the boundary for:

- graduation pool creation
- post-graduation quote
- post-graduation exact-input swaps

### Celestial Uniswap v4 connector path

A price-aware Uniswap v4 connector and adapter architecture has been implemented and tested locally, but it is not enabled on the deployed Arc Testnet factory.

The intended lifecycle is:

1. trade on Celestial curve
2. reach threshold
3. lock terminal curve price
4. sweep pending fees
5. release graduation inventory
6. initialize a vanilla v4 pool at the terminal price
7. mint liquidity directly to permanent locker
8. burn surplus launch-token inventory
9. permanently lock surplus quote
10. route future trades through the same Celestial token page

Do not configure guessed v4 deployment addresses.

## 18. Economics currently documented

Initial V1 curve design inputs are still documented as provisional:

- total supply: 1,000,000,000
- curve allocation: 800,000,000
- graduation allocation: 200,000,000
- initial graduation target: 10,000 USDC
- initial phantom / virtual quote reserve: 2,500 USDC
- initial trading fee: 1%
- initial protocol share of trading fee: 75%
- initial creator share of trading fee: 25%

These are design inputs, not immutable promises for future production deployments.

Celestial adds configurable bounded economics, including creator tax, holder sharing, and launch protection.

Current documented caps include:

- creator tax up to 5%
- holder fee up to 3%
- snipe protection bounded so total fees cannot reach or exceed 100%

The current test configuration was designed around a very short decaying opening-protection window.

## 19. Implemented user flows

### Discover and buy

Explore -> search/filter -> token page -> inspect market -> enter quote amount -> receive live quote -> approve if required -> sign -> confirm -> refresh balances and market state.

### Sell

Token page -> Sell -> choose percentage or Sell all -> receive quote estimate -> approve token if required -> sign -> confirm -> refresh balances and market state.

Sell all must use the connected wallet's current onchain ERC-20 balance.

### Launch

Create -> metadata -> economics -> optional developer buy -> review -> chain check -> approval when required -> create transaction -> decode token event -> redirect to token page.

### Limit order

Token page -> Limit -> choose side -> set input and minimum receive -> approve asset -> place order -> view in Orders -> cancel if still open.

### Holder reward claim

Token page -> read withdrawable holder rewards -> Claim -> confirmation -> refresh.

### Creator fee claim

Portfolio -> read legacy or Celestial claimable fees -> claim through corresponding escrow -> refresh activity.

### Scanner

Scanner -> inspect token/curve/creator/pool -> inspect top holders -> inspect recent transactions -> jump to Arcscan or market page.

### Graduation

Curve reaches terminal state -> curve closes -> graduation readiness exposed -> adapter creates locked DEX liquidity when a verified connector exists -> same token route switches execution venue.

## 20. Backend and indexer

Important API surfaces include:

- `/health`
- `/stats`
- `/analytics/daily`
- `/analytics/venues`
- `/tokens`
- `/tokens/:address`
- `/tokens/:address/holders`
- `/buybacks`
- `/wallet/:address/launches`
- `/wallet/:address/positions`
- `/wallet/:address/orders`
- `/wallet/:address/activity`

Core indexed event families include:

- V1 `TokenCreated`
- Celestial `TokenCreated`
- `MetadataSet`
- V1 Buy / Sell
- Celestial Buy / Sell
- ERC-20 `Transfer`
- `GraduationSwept`
- `TokenGraduated`
- `BuybackExecuted`
- `OrderPlaced`
- `OrderCancelled`
- `OrderFilled`
- v4 graduation / swap events when the connector path is configured

Core database tables include:

- `tokens`
- `trades`
- `transfers`
- `buybacks`
- `limit_orders`

The token schema supports generation, quote asset, creator economics, metadata/socials, pool address, and status.

## 21. RPC resilience work completed

Real Arc public-RPC throttling produced `-32005` failures in both transaction and indexer workflows.

Work completed:

- browser public-client fallbacks
- optional dedicated wallet RPC
- backend/indexer fallback RPCs
- optional WebSocket transport
- adaptive backfill ranges
- smaller log chunks
- retry and cooldown behavior
- indexer health server starts before backfill
- indexer stays alive in degraded ingestion state
- user-facing rate-limit errors
- protocol status endpoint and banner

A managed/private Arc RPC is still recommended before production traffic.

## 22. Testing and audit work completed

Current internal audit status recorded in the repo includes:

- contracts workflow passing
- apps workflow passing
- Foundry build and tests passing
- stateful invariants passing
- Next.js production build passing
- API and indexer TypeScript builds passing
- API and indexer Docker builds passing
- PostgreSQL schema/runtime smoke tests passing
- frontend route smoke tests passing

Foundry coverage includes:

- metadata and quote pairs
- atomic launch plus developer buy
- buy and sell
- slippage
- fixed supply
- creator fee lifecycle
- holder reward lifecycle
- anti-snipe decay and exemptions
- limit buy
- limit sell
- cancel/refund
- buyback funding and burn
- graduation reserve safety
- adapter/reentrancy regression tests
- fuzzing
- stateful invariants

Core invariants include:

- fixed supply remains fixed
- curve does not sell reserved graduation inventory
- tracked quote does not exceed threshold
- physical quote covers tracked reserve plus pending fees

This is an internal engineering audit, not a third-party security audit.

## 23. Work completed chronologically

### 2026-09-14: protocol and product foundation

- reverse-engineered PONS product and protocol structure
- defined Arc-native launchpad blueprint
- established Explore-first product direction
- preserved legacy V1 compatibility
- implemented Celestial generation
- added metadata and socials
- added configurable quote assets
- added atomic create plus developer buy
- added creator tax
- added holder fee sharing
- added short-lived launch protection
- added limit-order system
- added buyback/burn vault
- added graduation adapter boundary
- deployed Celestial contracts to Arc Testnet
- wired frontend and indexer environment to Celestial addresses
- added generation-aware market resolution
- fixed token market resolution by checking Celestial onchain state before V1 fallback
- made recent-trade wallets clickable on Arcscan
- made entire holder rows clickable on Arcscan
- removed the marketing homepage and opened Explore at root
- exposed graduation readiness to the frontend
- closed limit orders at the graduation boundary
- added buy/sell edge-case regression tests
- implemented and documented the guarded Uniswap v4 graduation architecture
- added v4 surplus handling, terminal price locking, analytics, and security tests

### 2026-09-15: product-surface cleanup

- aligned navigation to current Celestial product surfaces
- redirected legacy Profile to Portfolio

### 2026-09-16: frontend redesign consolidation

Experimental sequence:

- purple cyberpunk system
- visual-reference launchpad layout
- Avenue system
- red-black kinetic landing page
- Utopia-inspired systems

Those were superseded.

Canonical sequence:

- reset style entrypoint
- introduced shared design tokens
- made Explore the root product surface
- rebuilt product footer
- rebuilt Explore grid
- removed obsolete cyberpunk layer
- rebuilt token market styling
- rebuilt recent-trades table
- applied current Create shell
- applied current Portfolio shell
- applied current Analytics shell
- collapsed Trade into Explore
- removed obsolete brand footer
- removed Stocks from navigation and final references
- applied current warm-stone and acid-lime palette
- added approved Celestial brand mark across product and metadata
- finalized header brand proportions

## 24. Current known gaps and external gates

These should not be replaced with guessed values or fake integrations.

### Infrastructure

1. Configure a reliable managed/private Arc RPC for production.
2. Rotate the database credential that was previously exposed outside the repository.
3. Complete a real multi-wallet funded staging lifecycle.
4. Verify full indexer catch-up against chain events under the managed RPC.

### DEX graduation

1. Verify official Arc DEX / Uniswap v4 deployment addresses from authoritative sources.
2. Verify the exact Uniswap release deployed on Arc.
3. Fork-test the connector against the real Arc deployment.
4. Verify token/quote ordering and decimal combinations for USDC, EURC, and cirBTC.
5. Verify Permit2 and router behavior.
6. Independently review the initialization guard hook.
7. Do not enable custom fee/buyback hooks until the vanilla path is proven.

### Security / governance

1. Move privileged production ownership to a multisig.
2. Complete an independent external smart-contract audit before real-fund mainnet use.

### Frontend design debt

1. Migrate remaining legacy global styles into the canonical token/module system.
2. Remove stale hard-coded colors after route-by-route QA.
3. Keep current light/dark readability intact during migration.
4. Do not restore superseded visual systems by accident.

## 25. Product enhancements not yet represented as canonical current functionality

These remain useful future improvements from the original product blueprint, but should not be described as already complete unless verified in code at the time of implementation:

- explicit market-cap ranking in Explore
- 1h discovery window
- holder concentration warnings in discovery cards
- wash-trade-aware trending score
- unique-buyer-weighted trending
- creator fee earned directly on discovery cards
- richer risk / trust surfaces
- stronger real-time push architecture beyond polling
- deeper candle aggregation and charting where not already available
- improved mobile bottom-sheet trading flow
- deterministic token addresses if not added in a later protocol revision
- pinned launch-economics hash if not added in a later protocol revision

## 26. Rules for future agents

1. Read this file before changing the frontend design or product structure.
2. Treat the current warm-stone and acid-lime token system as canonical unless the user explicitly asks for a new direction.
3. Do not restore cyberpunk, Avenue, red-black, or Utopia experiments by default.
4. Do not restore Stocks or a separate marketing homepage unless explicitly requested.
5. Keep `/` and `/trade` discovery-first unless product direction changes explicitly.
6. Preserve V1 and Celestial coexistence.
7. Keep execution-critical state recoverable from chain.
8. Never make API/indexer availability a prerequisite for contract-native trading.
9. Never invent Arc DEX addresses.
10. Do not configure a fake graduation adapter.
11. Keep one shared wallet session.
12. Preserve Sell all as current onchain balance, not cached indexed balance.
13. Never combine multi-asset quote values into fake USD totals without a conversion source.
14. Keep irreversible economic terms visible before signatures.
15. Test both light and dark mode after design changes.
16. Treat `globals.css` as migration debt, not as permission to add another large global style layer.

## 27. Existing supporting documents

Use these for deeper detail:

- `AGENTS.md`
- `docs/PONS_REVERSE_ENGINEERING.md`
- `docs/AUDIT.md`
- `docs/QA_REPORT.md`
- `docs/UNISWAP_V4_INTEGRATION.md`
- `docs/V4_AUDIT_BRIEF.md`
- `docs/DEPLOYMENT.md`
- `docs/ECONOMICS.md`

This document should remain the first-stop summary, while the files above contain deeper protocol, security, and design research.