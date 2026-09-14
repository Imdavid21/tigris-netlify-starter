// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

library CelestialV4PriceMath {
    uint256 internal constant Q192 = 1 << 192;
    uint160 internal constant MIN_SQRT_PRICE = 4_295_128_739;
    uint160 internal constant MAX_SQRT_PRICE =
        1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_342;

    error InvalidPrice();

    function sqrtPriceX96(
        address token,
        address quoteAsset,
        uint256 tokenReserve,
        uint256 quoteReserve
    ) internal pure returns (uint160 value) {
        if (
            token == address(0) ||
            quoteAsset == address(0) ||
            token == quoteAsset ||
            tokenReserve == 0 ||
            quoteReserve == 0
        ) revert InvalidPrice();

        (uint256 amount0, uint256 amount1) =
            token < quoteAsset
                ? (tokenReserve, quoteReserve)
                : (quoteReserve, tokenReserve);

        uint256 ratioX192 = Math.mulDiv(amount1, Q192, amount0);
        uint256 root = Math.sqrt(ratioX192);
        if (
            root <= MIN_SQRT_PRICE ||
            root >= MAX_SQRT_PRICE ||
            root > type(uint160).max
        ) revert InvalidPrice();

        value = uint160(root);
    }
}
