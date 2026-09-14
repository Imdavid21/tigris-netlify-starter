// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Address-shaped handle for a Uniswap v4 pool.
/// @dev v4 pools are PoolIds, not contracts. Celestial's existing database and adapter
/// use an address identifier, so each graduated v4 pool gets a permanent immutable handle.
contract CelestialV4PoolHandle {
    bytes32 public immutable poolId;
    address public immutable token;
    address public immutable quoteAsset;

    constructor(bytes32 poolId_, address token_, address quoteAsset_) {
        poolId = poolId_;
        token = token_;
        quoteAsset = quoteAsset_;
    }
}
