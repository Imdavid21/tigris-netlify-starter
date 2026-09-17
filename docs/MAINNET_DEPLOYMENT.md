# Arc Mainnet Deployment

Last verified: 2026-09-17

This document is the canonical production deployment record for supershot.fun on Arc Mainnet.

Arc Testnet was used during development, fork validation, staging, and QA. The production contract stack is now deployed on **Arc Mainnet** and the old pre-deployment notes have been retired from this document to avoid ambiguity about the current state of the project.

## 1. Current production status

supershot.fun has an Arc Mainnet contract deployment and a live application stack.

Production status:

- Arc Mainnet contracts: **deployed**
- Arc chain ID: **5042**
- Mainnet quote asset: **USDC**
- Mainnet database schema: **mainnet**
- Web application: **live on Render**
- API: **live on Render**
- Indexer: **live on Render**
- Repository: **public**
- Arc-native Uniswap v4 graduation path: **implemented in the production deployment**

Live services:

- Web: `https://arc-launchpad-web.onrender.com`
- API: `https://arc-launchpad-api.onrender.com`
- Indexer: `https://arc-launchpad-indexer.onrender.com`
- Repository: `https://github.com/Imdavid21/tigris-netlify-starter`

The application services deploy from the repository's `main` branch.

## 2. Arc Mainnet network configuration

Production network values:

- Chain ID: `5042`
- Public RPC: `https://rpc.mainnet.arc.io`
- Explorer: `https://arc-scan.org`
- Arc explorer alternative used by engineering tooling: `https://explorer.arc.io`
- Native gas asset: USDC
- USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`
- USDC ERC-20 decimals: 6

Arc's native USDC gas semantics and the ERC-20 USDC interface are not treated as interchangeable units. Production deployment and lifecycle tests account for the difference explicitly.

The mainnet deployment does not reuse Arc Testnet EURC or cirBTC addresses. USDC is the enabled quote asset for the production deployment unless additional mainnet assets are independently verified and deliberately enabled later.

## 3. Production contract deployment

The production contract stack was deployed on **2026-09-16**.

Deployment block range recorded by the deployment run:

- `21158188` to `21158206`

Production addresses:

| Component | Arc Mainnet address | Role |
| --- | --- | --- |
| `CelestialLaunchFactory` | `0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423` | Token creation, launch configuration, market lifecycle, graduation control |
| `CelestialFeeEscrow` | `0x6D1597932B93b9939f21E9A8D8C2908457F7925d` | Creator and protocol fee accounting |
| `CelestialBuybackVault` | `0xf58489A0B285F3b0046FF53a055b80E69a6e15eB` | Buyback funding and execution |
| `ArcLiquidityLocker` | `0xE7fFCe43E0eCA4C27e3bB1985C231DBB97145896` | Permanent custody of graduation liquidity positions |
| `CelestialLimitOrderBook` | `0xED7b5904e272d3DF891179D916D2E3A939ed1471` | Onchain limit-order placement, execution, cancellation, and escrow |
| `CelestialPoolGuardHook` | `0x3aC85a7cB39981c95c005E5d72a5Df24d0bb2000` | Guarded Uniswap v4 pool integration |
| `CelestialUniswapV4Connector` | `0x0A30D71fB42b7cD92596e9a200d7a101E34DA956` | Arc Uniswap v4 pool creation and swap integration |
| `CelestialDexAdapter` | `0x4c40f0C8DfC518f436A9a5244179a0Dac145eE43` | Graduation and post-graduation execution boundary |
| USDC | `0x3600000000000000000000000000000000000000` | Production quote asset and Arc gas asset |

Expected deployment controller / deployer used by the production workflow:

`0x8c377ed06931c379e7C1f31a1753Fe5e03ffBe01`

Independent chain inspection confirms that the production factory address exists as a contract on Arc Mainnet. Its creation transaction is recorded onchain and the factory was created in block `21158204`.

The fee escrow address also exists as a deployed Arc Mainnet contract and was created through the production factory deployment transaction.

## 4. Deployment script

Canonical production deployment script:

`packages/contracts/script/DeployCelestialMainnet.s.sol`

The deployment script creates and wires the production stack:

1. deploy `CelestialLaunchFactory`
2. create the factory-linked `CelestialFeeEscrow`
3. create the factory-linked `CelestialBuybackVault`
4. create the factory-linked `ArcLiquidityLocker`
5. deploy `CelestialLimitOrderBook`
6. deploy `CelestialPoolGuardHook` at the CREATE2 address required by the selected Uniswap v4 hook permission bits
7. deploy `CelestialUniswapV4Connector`
8. deploy `CelestialDexAdapter`
9. enable mainnet USDC as the approved production quote asset
10. seal the hook initializer to the intended connector
11. configure the DEX adapter as the factory's graduation adapter

The deployment script verifies the external Arc Uniswap v4 dependencies before relying on them.

## 5. Arc Foundry and Arc-specific execution

The project uses Circle's Arc Foundry distribution for Arc-specific fork and lifecycle testing.

Verified release used by the repository's Arc workflow:

`circlefin/arc-foundry v0.8.0-1`

Repository Arc profile:

```toml
[profile.arc]
network = "arc"
```

This is intentional. Arc execution includes behavior that is not completely reproduced by a generic upstream Anvil environment, especially around USDC and Arc-specific system behavior.

The Arc lifecycle workflow therefore uses the Arc-specific execution environment rather than treating a generic EVM fork as sufficient evidence that the production path works correctly.

## 6. Official Arc Uniswap v4 dependencies

The production graduation path is built against the Arc Mainnet Uniswap v4 deployment recorded during deployment verification.

External addresses:

- PoolManager: `0x8366a39CC670B4001A1121B8F6A443A643e40951`
- PositionManager: `0x6049c9a0e26405C0985f9E3685C87d0aE917f82B`
- Quoter: `0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94`
- Universal Router: `0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

`DeployCelestialMainnet.s.sol` checks that the expected dependencies contain bytecode before proceeding with the production wiring.

The repository does not intentionally fall back to guessed DEX addresses.

## 7. Full market lifecycle

The production architecture is designed around one continuous token lifecycle rather than separate launch and DEX products.

### Phase 1: launch

A creator configures a token and launch through `CelestialLaunchFactory`.

The launch may include:

- metadata and social links
- creator fee recipient
- creator tax within protocol bounds
- holder fee sharing
- anti-snipe / launch-protection configuration
- optional atomic developer buy
- approved quote asset

### Phase 2: bonding-curve market

The token trades against the supershot.fun bonding curve.

The curve is responsible for:

- buy quotes
- sell quotes
- execution
- creator tax accounting
- holder fee accounting
- protocol fee accounting
- buyback funding
- graduation reserve accounting

### Phase 3: graduation

When the market reaches its configured graduation condition, the production path can:

1. stop normal curve execution at the terminal state
2. settle or sweep the required graduation accounting
3. release the graduation inventory
4. initialize the Arc Uniswap v4 pool
5. create the graduation liquidity position
6. lock the LP position through the production liquidity locker
7. expose the graduated venue to the same market page

### Phase 4: post-graduation trading

The token keeps the same supershot.fun market identity and route.

Execution changes underneath the product from the bonding curve to the production DEX adapter and Uniswap v4 connector.

This avoids forcing users into a second application or a disconnected token page after graduation.

## 8. Mainnet lifecycle validation

The Arc Mainnet fork lifecycle tests the production path against the live external Arc dependencies.

The lifecycle covers:

1. create a supershot.fun token
2. execute a curve buy
3. execute a curve sell
4. reach the graduation condition
5. sweep graduation assets
6. initialize the real Arc Uniswap v4 pool path
7. mint and lock the LP position
8. quote through the v4 quoter
9. execute USDC to token through the production router path
10. execute token to USDC through the production router path

The lifecycle also covers the decimal boundary between supershot.fun's 18-decimal launch tokens and Arc USDC's 6-decimal ERC-20 interface.

## 9. Application production configuration

The frontend, API, and indexer have explicit Arc Mainnet configuration paths.

Representative production values:

```text
ARC_CHAIN_ID=5042
ARC_RPC_URL=https://rpc.mainnet.arc.io
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
ARC_ANALYTICS_CHAIN_ID=5042
DATABASE_SCHEMA=mainnet

NEXT_PUBLIC_ARC_CHAIN_ID=5042
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.mainnet.arc.io
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

The production application must use the deployed addresses listed in this document for the factory, fee escrow, buyback vault, liquidity locker, order book, DEX adapter, and connector.

The frontend does not intentionally fall back to Arc Testnet contract addresses when running with chain ID `5042`.

## 10. Database isolation

The backend supports explicit PostgreSQL schema selection through `DATABASE_SCHEMA`.

Production Arc Mainnet data uses:

```text
DATABASE_SCHEMA=mainnet
```

Historical testnet data uses a separate schema and is not intended to be mixed into production routes.

A runtime guard prevents an Arc Mainnet process from starting against the testnet/default `public` schema. This protects production indexing from accidentally mixing testnet and mainnet rows.

## 11. Indexer model

The Arc indexer is a performance and discovery layer, not the authority for execution.

Indexed data includes the event families required for:

- token discovery
- trades
- transfers
- holders
- graduation
- buybacks
- limit orders
- post-graduation activity
- wallet activity
- analytics

The production design uses a persisted block cursor and paced public-RPC ingestion so the indexer can recover from temporary Arc RPC throttling without losing its place.

If the indexer is degraded, contract-native state remains the execution source of truth.

## 12. Ownership and control model

The buyback vault is designed so operational control can follow factory ownership rather than remaining permanently tied to the deployment EOA.

For factory-created vaults:

- the vault owner is the factory contract
- the active controller resolves through current factory ownership
- only the active controller can appoint the operational keeper
- a keeper is associated with the controller that appointed it
- transferring factory ownership invalidates a keeper appointed by the previous controller

This allows the production factory to move to a multisig or other intended controller without requiring the buyback vault to be redeployed solely for that ownership transition.

Production governance hardening should still move privileged ownership to the intended long-term controller where applicable.

## 13. Internal testing status

The repository includes internal engineering validation across the contract and application stack.

Coverage includes:

- contract builds and tests
- fuzz testing
- stateful invariants
- launch metadata and quote-asset handling
- atomic launch plus developer buy
- curve buy and sell
- slippage handling
- fixed token supply
- creator-fee lifecycle
- holder-reward lifecycle
- launch-protection decay and exemptions
- limit buy
- limit sell
- order cancellation and refunds
- buyback funding and burn
- graduation reserve safety
- adapter and reentrancy regression coverage
- Next.js production build
- API and indexer TypeScript builds
- PostgreSQL runtime/schema checks
- frontend route smoke coverage
- Arc-specific fork lifecycle

Core economic and accounting invariants include:

- fixed supply remains fixed
- the curve does not sell inventory reserved for graduation
- tracked quote does not exceed its intended threshold
- physical quote accounting covers tracked reserves and pending fees under the tested model

This is **internal engineering validation**, not an independent third-party smart-contract audit.

## 14. Production hardening still recommended

Mainnet deployment does not mean the project should be described as fully hardened for unlimited real-money usage.

Remaining or continuing production-hardening work includes:

### RPC infrastructure

The public Arc RPC has produced rate-limit failures during development and indexing.

For sustained production traffic:

- use a managed/private Arc RPC
- retain fallback RPC support
- retain paced indexer ingestion
- keep user-facing degraded-service handling

### Database durability

Use a durable production database plan for long-running production workloads rather than relying indefinitely on temporary/free infrastructure.

### Governance

Move privileged ownership to the intended production multisig or controller where appropriate.

### Independent review

Complete an external smart-contract security review before treating the system as appropriate for unrestricted real-fund usage.

These items are deliberately documented as hardening work. They should not be confused with the old pre-mainnet deployment state.

## 15. Historical testnet status

Arc Testnet was used before the September 16, 2026 production deployment for:

- protocol iteration
- contract deployment testing
- UI integration
- wallet flows
- indexer development
- Arc RPC failure handling
- early graduation-adapter work
- QA

Those testnet deployments remain useful historical engineering artifacts.

They are **not** the current deployment referenced by grant applications, production documentation, or user-facing mainnet status.

For current addresses, use the production address table in this document.

## 16. Arc Microgrants reviewer checklist

For programs that require an already-working Arc Mainnet project, the repository exposes the following evidence:

- public source repository: yes
- Arc Mainnet contract deployment: yes
- Arc chain ID `5042`: yes
- live web deployment: yes
- live API deployment: yes
- live indexer deployment: yes
- Arc component is core to the product: yes
- USDC is used as the production Arc quote/gas asset: yes
- token creation is onchain: yes
- bonding-curve trading is onchain: yes
- limit-order system is onchain: yes
- graduation architecture is Arc-native: yes
- Arc Uniswap v4 production integration is deployed: yes
- public builder repository: yes

Grant reviewers should use the live application, this repository, and the production addresses above rather than historical testnet documentation when evaluating current eligibility.

## 17. Canonical references

Current deployment and product references:

- `README.md`
- `docs/PROJECT_SOURCE_OF_TRUTH.md`
- `docs/AUDIT.md`
- `docs/QA_REPORT.md`
- `docs/UNISWAP_V4_INTEGRATION.md`
- `docs/V4_AUDIT_BRIEF.md`
- `AGENTS.md`

Deployment script:

- `packages/contracts/script/DeployCelestialMainnet.s.sol`

Mainnet configuration template:

- `.env.example`

When another document conflicts with this file on whether supershot.fun has been deployed to Arc Mainnet, **this file and the current onchain deployment take precedence**.
