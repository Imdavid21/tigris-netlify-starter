// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ICelestialGraduationAdapter {
    function createPoolAndLock(
        address token,
        address quoteAsset,
        uint256 tokenAmount,
        uint256 quoteAmount,
        uint160 sqrtPriceX96,
        address locker
    ) external returns (address pool, uint256 positionId);
}
