# Arc Mainnet build constraints

supershot.fun mainnet contracts use Solidity 0.8.26 with via-IR enabled and `optimizer_runs = 200`.

`CelestialLaunchFactory` was reduced below the EIP-170 24,576-byte runtime limit by removing duplicate metadata storage while keeping the launch metadata input and `MetadataSet` event used by the indexer.

The complete Arc mainnet fork simulation must pass before any production broadcast. The simulation deploys the factory, limit order book, v4 guard hook, Uniswap v4 connector, and DEX adapter, then verifies the adapter registration, sealed hook initializer, hook permission bits, and official Arc Uniswap v4 dependencies.
