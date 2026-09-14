# PONS Reverse Engineering and Arc Launchpad Product Blueprint

Date: 2026-09-14

## Objective

Study ponsfamily.com and its current protocol end to end, identify every meaningful user and system workflow, then define an Arc-native launchpad that preserves the strongest protocol ideas while improving clarity, speed, trust, and trading UX.

This is a benchmark, not a pixel clone.

Sources reviewed:

- https://www.ponsfamily.com/launchpad
- https://www.ponsfamily.com/launchpad/create
- live PONS token pages
- https://www.ponsfamily.com/analytics
- https://docs.ponsfamily.com/
- https://docs.ponsfamily.com/v2
- public pons smart-contract repository

## 1. What PONS actually is

PONS is not one launchpad architecture. Its interface supports two generations.

### V1

V1 launches directly into a Uniswap V3 pool.

The creation transaction deploys the token, creates and initializes the pool, deposits one-sided liquidity, permanently locks the LP position, records the launch, and can include the creator's initial purchase atomically.

There is no later liquidity migration. "Graduation" is a milestone measured against paired liquidity in the same pool.

### V2

V2 starts each token on a constant-product bonding curve.

The full token supply begins in the curve. Public buys progressively move tokens out of the curve and quote asset into it. Once the tradable allocation is exhausted, the curve closes and the launch transitions through a two-step graduation into a permanently locked Uniswap V4 pool.

The interface therefore has to route a token based on protocol phase:

- Curve
- Swept / graduating
- Pool created
- Rescue state, if applicable

This phase-aware routing is one of the most important product ideas in PONS.

## 2. PONS information architecture

Primary navigation:

- Explore
- Search
- Stocks
- Create
- Analytics
- Profile
- Docs

The launchpad root is discovery-first. It is not a marketing homepage.

That is correct for a trading product. Returning users are sent immediately into inventory and activity instead of a hero section.

### Explore

The visible controls include:

- Recent buys
- Newest
- Oldest
- Market cap
- Volume
- All
- 24h
- 7d
- generation filtering where relevant

Core intent:

- find something active
- find something new
- identify momentum
- compare launches
- jump directly into a token market

The page deliberately makes activity the primary discovery primitive.

### Search

Search is globally accessible and advertises a keyboard shortcut.

Search should resolve:

- token name
- symbol
- address

Address must always remain the canonical identity because names and symbols are not unique.

### Create

PONS creation currently exposes:

Base fields:

- token name
- ticker
- description
- token image
- X handle
- Telegram
- paired asset
- developer buy

Advanced fields:

- holder fee sharing
- creator fee wallet
- creator tax
- snipe-tax exemptions

A live summary card shows:

- ticker
- launch fee
- pair
- trade fee
- graduation condition
- locked liquidity

The important UX principle is that economic consequences are previewed before the wallet signature.

### Token detail / trading page

PONS combines project identity, token economics, market execution, charting, and transaction history on one route.

Observed surfaces include:

- Back to Explore
- About
- description
- pair asset
- creator
- creator tax
- fixed supply
- contract address
- explorer
- social links
- external chart links
- token identity
- Market / Limit / Orders modes
- Buy / Sell
- wallet balances
- percentage shortcuts
- slippage
- USD estimates
- price
- market cap
- quote-denominated price
- current market venue
- chart range controls
- recent trades
- holders

Pre-graduation pages identify the market as the bonding curve. Graduated pages identify the venue as Uniswap V4.

That continuity is important: the user stays on the same token URL while the underlying execution venue changes.

### Analytics

PONS exposes protocol-level reporting separately from token trading.

Observed categories:

- buyback and burn
- trading volume
- token launches
- 24h / all-time range
- Dune attribution

The analytics product is intentionally secondary to Explore.

### Profile

The profile route is wallet-oriented. From protocol documentation and surrounding product behavior, its responsibilities include creator payouts and wallet-specific state such as holdings and claimable creator fees.

## 3. PONS creator workflow

### Step 1: Open Create

The UI reads current protocol configuration instead of assuming static terms.

This matters because launch configs can be enabled, disabled, or edited for future launches.

### Step 2: Enter identity

Creator supplies:

- name
- symbol
- image
- description
- socials

### Step 3: Choose economic configuration

Creator selects or accepts:

- approved quote asset
- launch configuration
- creator fee recipient
- optional creator tax
- optional buyback behavior
- opening-buy exemptions

Terms are pinned into expected economics so a protocol config change between preview and transaction causes a revert instead of silently changing the deal.

### Step 4: Optional developer buy

PONS V2 supports an optional launch-and-buy router.

This is a strong system design.

Without it:

1. launch transaction confirms
2. mempool/searchers see new curve
3. another wallet trades before creator's intended opening buy

With atomic launch-and-buy:

1. launch created
2. creator buy executed in the same transaction
3. no public trade can exist between them

### Step 5: Sign once

The ideal launch transaction should be one wallet decision, not a chain of opaque approvals.

### Step 6: Redirect to market

After confirmation the creator should land on the token detail route, not remain on the form.

## 4. PONS trader workflow

### Discovery

Trader enters through Explore or Search.

Discovery ranks on meaningful trading behavior rather than editorial promotion.

### Token evaluation

Before touching the trade form, the user can inspect:

- creator
- contract
- quote asset
- creator tax
- supply
- market venue
- price
- market cap
- chart
- trades
- holders
- socials

### Quote

On V2, buy and sell math are deliberately asymmetric.

Buy:
- quote enters
- fees/taxes are deducted
- remaining quote moves the curve
- token output is determined

Sell:
- token input is priced against the curve
- quote output is calculated
- fees/taxes are deducted from quote output

A frontend must never mirror buy math to estimate sells.

### Approval

ERC-20 quote pairs need allowance before the curve can spend the quote token.

The UX should present this as one state machine:

- Review
- Approval required
- Approve USDC
- Approval confirmed
- Confirm trade
- Submitted
- Confirmed

not as disconnected wallet popups.

### Final curve buy

PONS handles over-sized final buys well.

If the user requests more than remains:

- fill only the remaining curve inventory
- charge only the quote required
- return the unused quote
- preserve the user's minimum-price protection

This eliminates a frustrating race where a small preceding buy can make a graduation-closing transaction revert.

Our current Arc V1 caps input before transfer but does not yet implement explicit user-visible refund semantics because it transfers only the capped amount. UX should make that clear.

### Graduation transition

The user should not need to know contract internals.

The token page should change from:

Market: Bonding curve

to:

Market: Arc DEX

without changing token URL, wallet holding, or identity.

## 5. PONS launch protection

PONS V2 uses an aggressive opening snipe tax.

It begins at 99% and decays exponentially to zero over about five seconds.

The system makes the launch creator and creator fee recipient exempt automatically, and can accept additional fixed exemptions for bundled opening wallets.

Product rationale:

- prevent the first visible transaction from being economically dominated by a bot
- avoid long transfer locks or permanent anti-bot behavior
- make protection self-expiring
- prevent admin modification after launch

We should not blindly copy the exact tax curve, but Arc needs an explicit launch-protection decision before public launch.

Options:

1. Decaying buy tax
2. Per-wallet opening cap
3. First-block creator-only buy
4. Atomic creator launch + buy
5. Combination of atomic buy and a very short cap window

Recommended Arc approach:

- atomic launch + optional creator buy
- first-block public buy protection
- short per-wallet cap for the next few blocks
- no transfer restrictions
- no permanent blacklist logic
- immutable protection terms per launch

This is easier to explain than a 99% temporary tax and produces a cleaner wallet preview.

## 6. PONS fee architecture

PONS separates:

- base trading fee
- optional creator tax

This is excellent UX because "trade fee" and "creator monetization" are not conflated.

The creator tax:

- is visible before trading
- is capped
- is immutable after launch
- goes to the creator

The standard fee is split between protocol, creator, and optionally buyback behavior.

For Arc V1 we currently have:

- 1% trade fee
- 75% protocol share
- 25% creator share

Recommended product presentation:

Trade fee
1.00%

Creator receives
0.25%

Protocol receives
0.75%

Never show only "1% fee" when the user can benefit from knowing where it goes.

Future Arc V2 should make creator economics configurable within a narrow protocol cap only if there is evidence creators value it.

## 7. PONS system architecture

### Source of truth

PONS explicitly states that its API is not in the trust path.

That is the correct model.

Critical reads:

- phase
- price
- reserves
- quote
- allowance
- balances
- execution

must be recoverable from chain.

Indexer/API responsibilities:

- fast discovery
- historical trades
- candles
- holder snapshots
- aggregate analytics
- search
- ranking

If the backend is down, the app should still be able to trade by address.

### Contract decomposition

PONS V2 separates responsibilities into:

- factory
- launch deployer
- token
- per-launch curve
- graduation guard
- graduation executor
- locker
- fee escrow
- buyback vault
- V4 hook
- optional launch-and-buy router

This is more complex than our current Arc architecture, but the decomposition is disciplined: each component has a narrow role.

Our current Arc architecture already has:

- factory
- token
- curve
- fee escrow
- liquidity locker
- graduation adapter boundary

The next protocol additions should be isolated components rather than expanding the factory indefinitely.

## 8. Current Arc stack

### Chain

Arc Public Testnet

Chain ID:
5042002

USDC:
0x3600000000000000000000000000000000000000

### Live contracts

Factory:
0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423

Fee escrow:
0x6D1597932B93b9939f21E9A8D8C2908457F7925d

Liquidity locker:
0xf58489A0B285F3b0046FF53a055b80E69a6e15eB

### Backend

API:
https://arc-launchpad-api.onrender.com

Indexer:
https://arc-launchpad-indexer.onrender.com

Postgres:
Render Singapore

### Frontend

Vercel

The frontend reads execution state directly from Arc and indexed history from Render.

## 9. Where Arc is currently behind PONS

Product:

- no token image/description/social metadata in deployed V1 contracts
- no search
- no creator profile
- no holder view
- no analytics route
- no candlestick aggregation
- no market-cap ranking
- no volume sorting UI
- no creator claims UI
- no atomic create + initial buy
- no limit/order functionality
- no automatic DEX routing after graduation

Protocol:

- production graduation adapter is not implemented
- launch protection not implemented
- metadata is not recorded in the current token contract
- no deterministic CREATE2 token addresses
- no pinned launch-economics hash
- no recovery state for failed graduation
- graduation must currently be explicitly advanced
- no post-graduation fee continuity

## 10. Where Arc can be better than PONS

### A. Cleaner Explore hierarchy

PONS has useful filters but the page is visually sparse when feeds fail.

Arc should use three layers:

1. Global activity strip
2. Ranked launch table/cards
3. Search / filters

Each token row should surface:

- image
- name / ticker
- address shortcut
- phase badge
- market cap
- 24h volume
- last trade
- graduation %
- 24h change
- creator
- holder concentration warning when available

Sorting:

- Trending
- Recent buys
- Newest
- Graduation %
- Volume
- Market cap

Time:

- 1h
- 24h
- 7d
- all

### B. Stronger token detail page

Desktop:

Left 70%
- identity header
- price + market cap
- chart
- graduation rail
- tabs: trades / holders / about

Right 30%
- sticky trade terminal

Mobile:
- identity
- compact metrics
- chart
- sticky bottom Buy / Sell
- expandable trading sheet

### C. Better transaction preview

Before wallet confirmation show:

You pay
USDC amount

You receive
estimated tokens

Minimum received
after slippage

Price impact

Trading fee

Creator share

Protocol share

Graduation impact
e.g. "This trade moves the launch from 61.2% to 66.8%"

This is materially better than showing a single quote.

### D. Better graduation UX

Use explicit phase labels:

Curve
89.4% funded

Graduating
Curve closed, pool creation pending

Graduated
Trading on Arc DEX

If graduation fails:

Action required
Pool creation can be retried by anyone

Provide the retry action in the interface.

### E. Trust surfaces

Every token page should expose:

- contract
- curve
- creator
- fixed supply
- quote asset
- liquidity policy
- fee split
- launch block
- explorer links

Use plain language first, addresses second.

### F. Creator command center

Profile should be useful, not decorative.

Sections:

My launches
- status
- market cap
- volume
- fees earned

Claimable fees
- aggregate USDC
- per-token breakdown
- one-click claim

Holdings
- token
- balance
- cost-independent current value estimate

Activity
- launches
- buys
- sells
- claims

### G. Progressive creation

Do not expose every advanced field at once.

Step 1: Token
- image
- name
- symbol
- description
- socials

Step 2: Economics
- fixed supply read-only
- USDC pair read-only in V1
- launch fee
- trade fee
- graduation target
- liquidity-lock policy

Step 3: Opening position
- optional initial buy
- wallet balance
- expected tokens

Step 4: Review
- full immutable terms
- token address preview in V2
- "these cannot change after launch"

Then one signature.

## 11. Superior Arc user flows

### Flow A: Discover and buy

Explore
→ filter/sort
→ token page
→ inspect identity + market
→ enter USDC
→ live quote
→ review transaction
→ approve if required
→ sign trade
→ confirmation
→ update chart/trades/balance without reload

Failure recovery:

- approval rejected: stay on form
- quote stale: requote automatically
- slippage: show fresh quote and explicit retry
- RPC error: retry against fallback
- backend error: continue onchain, show history unavailable

### Flow B: Sell

Token page
→ Sell
→ percentage shortcut or MAX
→ live USDC estimate
→ review
→ token approval if required
→ sign
→ confirm
→ refresh wallet + curve

### Flow C: Launch

Create
→ metadata
→ economics preview
→ optional initial buy
→ final immutable review
→ network check
→ one wallet signature
→ parse TokenCreated
→ redirect to token page
→ show "Live" state immediately

### Flow D: Graduation

Final buy lands
→ curve state becomes closed
→ UI immediately disables curve trade form
→ graduation phase shown
→ public retry button if needed
→ adapter creates Arc DEX pool
→ locker records LP
→ indexer records graduation
→ same token route changes venue
→ DEX trading enabled

### Flow E: Creator fee claim

Profile
→ aggregate claimable USDC
→ token-level breakdown
→ Claim
→ wallet confirmation
→ escrow transfer
→ claim history indexed

## 12. Required system workflows

### Launch ingestion

Factory TokenCreated
→ index token + curve + creator
→ read token identity
→ record launch block
→ subscribe to curve
→ discovery feed updates

### Buy ingestion

Curve Buy
→ store transaction
→ update volume
→ update latest activity
→ aggregate candle
→ update trending score
→ push realtime UI event

### Sell ingestion

Same pipeline with sell direction.

### Graduation ingestion

Curve closes
→ factory sweep
→ status GRADUATING
→ adapter pool creation
→ status GRADUATED
→ record pool
→ switch routing source

### Reorg handling

Production indexer should not assume finality at first sight.

Recommended:
- store block hash
- process optimistic UI immediately
- finalize after confirmation depth
- rewind indexed rows if block hash changes

### Backend restart

Current implementation:
- backfills factory from configured start block
- registers curves
- backfills each curve
- uses idempotent transaction/log keys
- opens live watchers

This is correct.

## 13. Data model expansion

Current:

tokens
trades

Add:

candles
- token
- resolution
- bucket
- open
- high
- low
- close
- volume

holder_snapshots
- token
- holder
- balance
- block
- timestamp

token_metrics
- token
- market_cap
- price
- volume_1h
- volume_24h
- trades_24h
- holders
- top10_share
- updated_at

wallet_actions
- wallet
- token
- action
- tx_hash
- timestamp

graduations
- token
- swept_tx
- pool_tx
- pool
- swept_at
- graduated_at

## 14. Realtime architecture

Render indexer
→ Postgres
→ API

Near term:
frontend polls API every 3–5 seconds for history and discovery.

Next:
WebSocket or Server-Sent Events channel for:

- new launch
- trade
- graduation
- fee claim

Onchain quote and execution should never depend on this channel.

## 15. Search architecture

Query normalization:

- lowercase
- trim
- exact address detection
- exact ticker boost
- prefix name/ticker
- fuzzy name last

Ranking should never hide exact address matches.

## 16. Trending score

Do not rank on raw volume alone.

Suggested score:

- 35% logarithmic 1h volume
- 20% unique buyers
- 15% trade acceleration
- 10% graduation velocity
- 10% holder growth
- 10% recency

Apply anti-spam rules:

- unique-wallet weighting
- diminishing weight for repeated same-wallet trades
- minimum transaction-size threshold
- wash-trade heuristics later

## 17. UI system

Direction:

- dark, high-contrast trading surface
- Arc-native visual identity instead of PONS mimicry
- 8px spacing grid
- one primary accent
- tabular numerals for market data
- no eyebrow headings
- minimal explanatory copy
- addresses visually secondary
- status encoded with text and shape, not color alone
- subtle motion only on state change
- skeletons instead of layout jumps

Desktop max-width:
1280–1440px

Token detail grid:
minmax(0, 1fr) + 360–400px trading rail

Create:
content + sticky economic summary

## 18. Product principles

1. Trading should still work if the indexer is down.
2. Every irreversible economic term is visible before signature.
3. Token address is always available without opening a menu.
4. The same URL survives graduation.
5. Do not make users understand the adapter architecture.
6. Every transaction has an explicit recoverable state.
7. Never show a stale quote as executable.
8. Backend data should improve speed, not become a trust dependency.
9. Creator controls should be bounded and immutable where possible.
10. A launchpad should feel like a market terminal, not a token generator.

## 19. Build sequence

### Phase 1: complete current Arc V1

- live API
- live indexer
- frontend API integration
- indexed trade history
- creator claim UI
- discovery sorting
- search
- protocol analytics
- candle aggregation
- holder indexing
- profile
- responsive trading terminal

### Phase 2: Arc graduation

- production DEX adapter
- graduation guard
- retryable public graduation
- post-graduation route switching
- LP lock verification

### Phase 3: launch UX parity+

- metadata
- image storage
- social links
- create review screen
- atomic launch + initial buy
- launch protection
- deterministic addresses
- pinned economics

### Phase 4: market quality

- realtime events
- trending model
- holder concentration
- risk surfaces
- creator dashboard
- fee analytics
- advanced order systems only when Arc liquidity supports them

## 20. Product decision

Do not recreate PONS literally.

Copy the structural lessons:

- discovery-first launchpad
- single-page token market
- onchain truth
- bonding curve to locked DEX liquidity
- immutable launch terms
- atomic creator opening buy
- phase-aware execution
- explicit creator economics

Outperform it through:

- clearer transaction previews
- stronger graduation UX
- faster indexed discovery
- better creator tooling
- superior mobile trading
- explicit trust/risk context
- graceful backend failure
- cleaner information hierarchy
