# Arc Mainnet Deployment

Verified on 2026-09-16.

## Network

- Chain ID: `5042`
- Native gas asset: USDC, 18-decimal native units
- USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`, 6 decimals
- Public mainnet RPC: do not hardcode an unverified third-party endpoint. Supply a verified Arc Mainnet RPC when running the workflow.

Arc's own contract-address documentation still states that its published addresses are Arc Testnet-only and that mainnet addresses are not yet available. Do not reuse testnet EURC or cirBTC addresses on mainnet.

## Celestial base deployment

Use `.github/workflows/deploy-celestial-mainnet.yml`.

The workflow:

1. requires explicit `DEPLOY ARC MAINNET` confirmation
2. verifies chain ID `5042`
3. verifies bytecode and 6-decimal ERC-20 behavior at the USDC system address
4. verifies the expected deployer and a non-zero native balance
5. runs the full Foundry test suite
6. deploys the Celestial factory and limit order book
7. configures USDC as the only quote asset
8. leaves the graduation adapter unset

Deployment script: `packages/contracts/script/DeployCelestialMainnet.s.sol`.

## Uniswap v4

Uniswap's official v4 deployment registry now lists Arc mainnet:

- PoolManager: `0x8366a39CC670B4001A1121B8F6A443A643e40951`
- PositionManager: `0x6049c9a0e26405C0985f9E3685C87d0aE917f82B`
- Quoter: `0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94`
- Universal Router: `0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

Do not enable Celestial's v4 graduation adapter solely because these addresses are published. The connector still needs Arc-mainnet fork testing and deployment-time bytecode/interface checks described in `docs/AUDIT.md` and `docs/UNISWAP_V4_INTEGRATION.md`.

## Application cutover

Do not point the existing testnet indexer at mainnet using the same database. The current schema does not namespace rows by chain ID, so testnet and mainnet records would mix.

Use a clean mainnet database or add chain-aware schema separation before switching the indexer. After the mainnet contracts are deployed, configure the mainnet indexer and web environment with the new contract addresses and chain ID `5042`.

## Production gates

Before accepting real user funds:

- use a managed/private RPC rather than relying on a public endpoint
- use clean mainnet data storage
- complete a full mainnet/staging lifecycle with small controlled funds
- resolve privileged ownership strategy, including the buyback vault's immutable owner
- complete independent external contract review before unrestricted real-fund use
