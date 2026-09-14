// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ArcLaunchFactory} from "../src/ArcLaunchFactory.sol";
import {ArcBondingCurve} from "../src/ArcBondingCurve.sol";
import {ArcFeeEscrow} from "../src/ArcFeeEscrow.sol";
import {ArcToken} from "../src/ArcToken.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract ArcLaunchLifecycleTest is Test {
    MockUSDC usdc;
    ArcLaunchFactory factory;

    address creator = address(0xCAFE);
    address trader = address(0xBEEF);
    address treasury = address(0xFEE);

    function setUp() public {
        usdc = new MockUSDC();
        factory = new ArcLaunchFactory(
            usdc,
            treasury,
            2_500e6,
            10_000e6,
            100,
            7_500
        );
        usdc.mint(trader, 100_000e6);
    }

    function testCreateBuySellLifecycle() public {
        vm.prank(creator);
        (address tokenAddr, address curveAddr) =
            factory.createToken("Arc Test", "ARCX");

        ArcToken token = ArcToken(tokenAddr);
        ArcBondingCurve curve = ArcBondingCurve(curveAddr);

        vm.startPrank(trader);
        usdc.approve(curveAddr, type(uint256).max);

        uint256 quoteIn = 1_000e6;
        uint256 quoted = curve.quoteBuy(quoteIn);
        curve.buy(quoteIn, quoted * 99 / 100);

        assertGt(token.balanceOf(trader), 0);
        assertGt(curve.trackedQuote(), 0);

        uint256 sellAmount = token.balanceOf(trader) / 4;
        token.approve(curveAddr, sellAmount);

        uint256 sellQuote = curve.quoteSell(sellAmount);
        curve.sell(sellAmount, sellQuote * 99 / 100);

        assertGt(usdc.balanceOf(trader), 0);
        vm.stopPrank();
    }

    function testFeesSweepAndClaim() public {
        vm.prank(creator);
        (, address curveAddr) = factory.createToken("Arc Test", "ARCX");

        ArcBondingCurve curve = ArcBondingCurve(curveAddr);
        ArcFeeEscrow escrow = factory.feeEscrow();

        vm.startPrank(trader);
        usdc.approve(curveAddr, type(uint256).max);
        curve.buy(1_000e6, 1);
        vm.stopPrank();

        curve.sweepFees();

        assertGt(escrow.claimable(creator), 0);
        assertGt(escrow.claimable(treasury), 0);

        uint256 creatorBefore = usdc.balanceOf(creator);
        vm.prank(creator);
        escrow.claim();
        assertGt(usdc.balanceOf(creator), creatorBefore);
    }

    function testBuyCapsRealReserveAtGraduationThreshold() public {
        vm.prank(creator);
        (, address curveAddr) = factory.createToken("Arc Test", "ARCX");

        ArcBondingCurve curve = ArcBondingCurve(curveAddr);

        vm.startPrank(trader);
        usdc.approve(curveAddr, type(uint256).max);
        curve.buy(100_000e6, 1);
        vm.stopPrank();

        assertEq(curve.trackedQuote(), 10_000e6);
        assertTrue(curve.readyToGraduate());
    }

    function testCannotTradeWithZeroInput() public {
        vm.prank(creator);
        (, address curveAddr) = factory.createToken("Arc Test", "ARCX");

        vm.expectRevert(ArcBondingCurve.ZeroAmount.selector);
        ArcBondingCurve(curveAddr).buy(0, 0);
    }

    function testFuzzBuyNeverCrossesReservedInventory(uint96 amount) public {
        vm.assume(amount > 1e6 && amount < 100_000e6);

        vm.prank(creator);
        (address tokenAddr, address curveAddr) =
            factory.createToken("Arc Test", "ARCX");

        ArcBondingCurve curve = ArcBondingCurve(curveAddr);
        ArcToken token = ArcToken(tokenAddr);

        usdc.mint(trader, amount);

        vm.startPrank(trader);
        usdc.approve(curveAddr, amount);
        try curve.buy(amount, 1) {} catch {}
        vm.stopPrank();

        assertGe(token.balanceOf(curveAddr), factory.RESERVED_TOKENS());
        assertLe(curve.trackedQuote(), factory.graduationThreshold());
    }
}
