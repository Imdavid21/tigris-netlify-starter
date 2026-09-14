# Deployment

## Arc Testnet

- Chain ID: 5042002
- RPC: https://rpc.testnet.arc.network
- WebSocket: wss://rpc.testnet.arc.network
- Explorer: https://testnet.arcscan.app
- USDC ERC-20: 0x3600000000000000000000000000000000000000
- ERC-20 USDC decimals: 6

## Contracts

Required environment variables:

```
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
PROTOCOL_TREASURY=0x...
PRIVATE_KEY=...
```

Deploy:

```
forge script packages/contracts/script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.testnet.arc.network \
  --broadcast
```

Do not deploy the production graduation adapter until the Arc DEX deployment and addresses are confirmed.

## Database

Apply:

```
psql "$DATABASE_URL" -f apps/indexer/schema.sql
```

## Indexer

Required:

```
ARC_CHAIN_ID=5042002
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_WS_URL=wss://rpc.testnet.arc.network
DATABASE_URL=...
FACTORY_ADDRESS=0x...
```

## API

Required:

```
DATABASE_URL=...
PORT=3001
CORS_ORIGIN=https://...
```

## Web

Required:

```
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_API_URL=https://...
```
