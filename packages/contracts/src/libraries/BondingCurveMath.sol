// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library BondingCurveMath {
    uint256 internal constant BPS = 10_000;

    error ZeroInput();
    error InsufficientLiquidity();
    error InvalidFee();

    function amountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 feeBps
    ) internal pure returns (uint256) {
        if (amountIn == 0) revert ZeroInput();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        if (feeBps >= BPS) revert InvalidFee();

        uint256 amountInWithFee = amountIn * (BPS - feeBps);
        return (amountInWithFee * reserveOut)
            / (reserveIn * BPS + amountInWithFee);
    }
}
