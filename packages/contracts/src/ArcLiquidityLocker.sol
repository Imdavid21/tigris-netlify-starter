// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract ArcLiquidityLocker {
    address public immutable factory;

    error NotFactory();
    error ZeroAddress();

    struct LockedPosition {
        address adapter;
        address pool;
        uint256 positionId;
        address token;
        uint256 lockedAt;
    }

    mapping(address => LockedPosition) public locked;

    event PositionLocked(
        address indexed token,
        address indexed adapter,
        address indexed pool,
        uint256 positionId
    );

    constructor(address factory_) {
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
    }

    function record(
        address token,
        address adapter,
        address pool,
        uint256 positionId
    ) external {
        if (msg.sender != factory) revert NotFactory();
        if (token == address(0) || adapter == address(0) || pool == address(0)) revert ZeroAddress();
        locked[token] = LockedPosition({
            adapter: adapter,
            pool: pool,
            positionId: positionId,
            token: token,
            lockedAt: block.timestamp
        });
        emit PositionLocked(token, adapter, pool, positionId);
    }
}
