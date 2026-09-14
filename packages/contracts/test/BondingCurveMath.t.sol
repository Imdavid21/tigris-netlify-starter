// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {BondingCurveMath} from "../src/libraries/BondingCurveMath.sol";

contract BondingCurveMathTest is Test {
    function testAmountOutIncreasesWithInput() public pure {
        uint256 a =
            BondingCurveMath.amountOut(100e6, 2_500e6, 1_000_000_000 ether, 100);
        uint256 b =
            BondingCurveMath.amountOut(200e6, 2_500e6, 1_000_000_000 ether, 100);
        assertGt(b, a);
    }

    function testFuzzOutputNeverExceedsReserve(uint128 amountIn) public {
        vm.assume(amountIn > 0);
        uint256 reserveIn = 2_500e6;
        uint256 reserveOut = 1_000_000_000 ether;
        uint256 out =
            BondingCurveMath.amountOut(amountIn, reserveIn, reserveOut, 100);
        assertLt(out, reserveOut);
    }
}
