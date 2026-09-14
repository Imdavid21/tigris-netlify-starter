// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGraduationAdapter} from "../interfaces/IGraduationAdapter.sol";

contract MockGraduationAdapter is IGraduationAdapter {
    using SafeERC20 for IERC20;

    address public immutable mockPool;
    uint256 public nextPositionId = 1;

    constructor() {
        mockPool = address(uint160(uint256(keccak256("ARC_MOCK_POOL"))));
    }

    function createPoolAndLock(
        address token,
        address quoteAsset,
        uint256 tokenAmount,
        uint256 quoteAmount,
        uint160,
        address
    ) external returns (address pool, uint256 positionId) {
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(quoteAsset).safeTransferFrom(msg.sender, address(this), quoteAmount);

        pool = mockPool;
        positionId = nextPositionId++;
    }
}
