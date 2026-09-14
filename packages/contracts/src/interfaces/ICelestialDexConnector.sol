// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ICelestialDexConnector {
    function createPoolAndLock(
        address token,
        address quoteAsset,
        uint256 tokenAmount,
        uint256 quoteAmount,
        uint160 sqrtPriceX96,
        address locker
    ) external returns (address pool, uint256 positionId);

    function quoteExactInput(
        address pool,
        address tokenIn,
        uint256 amountIn
    ) external returns (uint256 amountOut);

    function swapExactInput(
        address pool,
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}
