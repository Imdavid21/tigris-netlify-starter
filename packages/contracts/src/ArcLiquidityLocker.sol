// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract ArcLiquidityLocker is IERC721Receiver {
    address public immutable factory;

    error NotFactory();
    error ZeroAddress();
    error AlreadyRecorded();

    struct LockedPosition {
        address adapter;
        address pool;
        uint256 positionId;
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
        if (locked[token].pool != address(0)) revert AlreadyRecorded();

        locked[token] = LockedPosition({
            adapter: adapter,
            pool: pool,
            positionId: positionId,
            lockedAt: block.timestamp
        });

        emit PositionLocked(token, adapter, pool, positionId);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // Intentionally no ERC721/ERC20 withdrawal methods.
}
