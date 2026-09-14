// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {CelestialV4PriceMath} from "../src/libraries/CelestialV4PriceMath.sol";

contract CelestialV4PriceMathTest is Test {
    function testAddressOrderingChangesCurrencyOrientation() public pure {
        address low = address(0x1000);
        address high = address(0x2000);

        uint160 lowAsToken = CelestialV4PriceMath.sqrtPriceX96(
            low,
            high,
            200e18,
            1_000e6
        );
        uint160 highAsToken = CelestialV4PriceMath.sqrtPriceX96(
            high,
            low,
            200e18,
            1_000e6
        );

        assertTrue(lowAsToken != highAsToken);
        assertGt(uint256(lowAsToken), 0);
        assertGt(uint256(highAsToken), 0);
    }

    function testUsdcLikeAndCirbtcLikeQuoteDecimalsProduceValidPrices() public pure {
        address token = address(0x1000);
        address quoteAsset = address(0x2000);

        uint160 usdcPrice = CelestialV4PriceMath.sqrtPriceX96(
            token,
            quoteAsset,
            200_000_000e18,
            10_000e6
        );
        uint160 btcPrice = CelestialV4PriceMath.sqrtPriceX96(
            token,
            quoteAsset,
            200_000_000e18,
            10_000_000
        );

        assertGt(uint256(usdcPrice), 0);
        assertGt(uint256(btcPrice), 0);
        assertTrue(usdcPrice != btcPrice);
    }

    function testRejectsZeroReserve() public {
        vm.expectRevert(CelestialV4PriceMath.InvalidPrice.selector);
        CelestialV4PriceMath.sqrtPriceX96(address(1), address(2), 0, 1);
    }
}
