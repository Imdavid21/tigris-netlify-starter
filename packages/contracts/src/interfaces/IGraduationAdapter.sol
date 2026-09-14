// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IGraduationAdapter {
    function createPoolAndLock(
        address token,
        address quoteAsset,
        uint256 tokenAmount,
        uint256 quoteAmount,
        address locker
    ) external returns (address pool, uint256 positionId);
}
