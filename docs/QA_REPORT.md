# Celestial QA Matrix

Date: 2026-09-14

## Automated verification

| Area | Status | Verification |
| --- | --- | --- |
| Monorepo production build | Pass | GitHub apps workflow |
| Web route startup | Pass | /, /create, /explore, /profile, /analytics, token route |
| API startup and database schema | Pass | PostgreSQL container smoke test |
| API token/trade/activity reads | Pass | CI seeded-data checks |
| Arc chain ID and USDC decimals | Pass | CI against Arc Testnet RPC |
| Solidity build | Pass | Foundry |
| Contract unit/regression suite | Pass | Foundry |
| Curve stateful invariants | Pass | Existing invariant suite |
| Render web | Live | latest tested commit |
| Render API | Live | latest tested commit |
| Render indexer | Live | latest tested commit; health server survives RPC degradation |

## Flow coverage

| User flow | Code | Automated coverage | Live-wallet verification |
| --- | --- | --- | --- |
| Connect/reconnect/switch Arc | Implemented | Build/session regression coverage | Requires browser wallet |
| Create token | Implemented | Contract + route/build | Requires funded wallet |
| Metadata/socials | Implemented | Contract test | Requires funded wallet |
| Atomic developer buy | Implemented | Contract test | Requires funded wallet |
| USDC launch | Implemented | Contract test | Requires funded wallet |
| EURC launch | Implemented | Configurable-pair test | Requires funded wallet |
| cirBTC decimals | Implemented as 8 decimals | Build/config review | Requires small funded staging trade |
| Market buy | Implemented | Contract test | Requires funded wallet |
| Market sell | Implemented | Contract test | Requires funded wallet |
| Sell 25/50/75/100% | Implemented | Production build | Requires browser wallet |
| Creator tax claim | Implemented | Accrue/sweep/claim test | Requires funded wallet |
| Holder reward claim | Implemented | Accrue/claim test | Requires funded wallet |
| Snipe protection | Implemented | Decay/exemption tests | Requires timed staging launch |
| Limit buy | Implemented | Execution test | Requires funded wallet |
| Limit sell | Implemented | Execution test | Requires funded wallet |
| Limit cancel/refund | Implemented | Refund test | Requires funded wallet |
| Buyback funding/burn | Implemented | Curve buyback/burn test | Keeper staging execution required |
| Discovery/search | Implemented | Build/route | Live index depends on backfill |
| Profile/activity | Implemented | API/build | Wallet verification required |
| Analytics | Implemented | API/build | Accuracy depends on completed indexing |
| Graduation | State machine implemented | Contract regression tests | Real DEX connector unavailable |
| Post-graduation trading | Adapter/UI implemented | Mock connector tests | Blocked on official Arc DEX connector |

## Failure-mode coverage

- Public Arc RPC rate limiting no longer kills the indexer process.
- Backfill ranges shrink and retry with cooldown.
- Browser reads can use configured fallback RPCs.
- Wallet network configuration can use a dedicated RPC.
- Rate-limit, rejection, and insufficient-balance errors are converted into actionable transaction messages.
- UI exposes protocol/indexer degradation instead of presenting indexed data as fresh.
- Backend failure does not redefine contract-authoritative market state.

## Remaining staging checklist

Only items requiring external credentials/infrastructure remain:

1. Configure a managed/private Arc RPC and browser-safe fallback.
2. Rotate the exposed Render PostgreSQL credential.
3. Run the full flow with at least two funded test wallets.
4. Execute a real keeper buyback and compare chain events with Analytics.
5. Verify complete indexer catch-up against chain events after the managed RPC is configured.
6. Integrate and test the real graduation connector only after official Arc DEX addresses are published and verified.
7. Transfer privileged mainnet roles to a multisig and complete an independent contract audit before mainnet funds.
