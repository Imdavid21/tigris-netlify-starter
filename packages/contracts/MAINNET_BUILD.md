# Arc Mainnet build constraints

Celestial mainnet contracts are compiled with Solidity 0.8.26, via IR, and size-oriented optimizer settings so every deployable runtime remains below the EIP-170 24,576-byte limit.

The Arc mainnet fork simulation must pass before broadcast.
