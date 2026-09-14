// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ArcLaunchFactory} from "../src/ArcLaunchFactory.sol";
import {ArcBondingCurve} from "../src/ArcBondingCurve.sol";
import {ArcFeeEscrow} from "../src/ArcFeeEscrow.sol";
import {ArcToken} from "../src/ArcToken.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockGraduationAdapter} from "../src/mocks/MockGraduationAdapter.sol";

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

    function _launch() internal returns (address tokenAddr, address curveAddr) {
        vm.prank(creator);
        return factory.createToken("Arc Test", "ARCX");
    }

    function _buyToGraduation(address curveAddr) internal {
        vm.startPrank(trader);
        usdc.approve(curveAddr, type(uint256).max);
        ArcBondingCurve(curveAddr).buy(100_000e6, 1);
        vm.stopPrank();
    }

    function testCreateBuySellLifecycle() public {
        (address tokenAddr, address curveAddr) = _launch();

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
        (, address curveAddr) = _launch();

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
        (, address curveAddr) = _launch();
        ArcBondingCurve curve = ArcBondingCurve(curveAddr);

        _buyToGraduation(curveAddr);

        assertLe(curve.trackedQuote(), 10_000e6);
        assertTrue(curve.readyToGraduate());
    }

    function testTwoPhaseGraduation() public {
        MockGraduationAdapter adapter = new MockGraduationAdapter();
        factory.setGraduationAdapter(adapter);

        (address tokenAddr, address curveAddr) = _launch();
        _buyToGraduation(curveAddr);

        factory.beginGraduation(tokenAddr);
        assertTrue(ArcBondingCurve(curveAddr).graduated());

        {
            (
                uint256 quoteAmount,
                uint256 tokenAmount,
                address poolBefore,
                uint256 positionBefore,
                bool swept,
                bool seededBefore
            ) = factory.graduations(tokenAddr);

            assertTrue(swept);
            assertFalse(seededBefore);
            assertEq(poolBefore, address(0));
            assertEq(positionBefore, 0);
            assertGt(quoteAmount, 0);
            assertGt(tokenAmount, 0);
        }

        (address pool, uint256 positionId) = factory.createGraduatedPool(tokenAddr);
        assertEq(pool, adapter.mockPool());
        assertEq(positionId, 1);

        {
            (
                uint256 quoteAmount,
                uint256 tokenAmount,
                address storedPool,
                uint256 storedPosition,
                ,
                bool seeded
            ) = factory.graduations(tokenAddr);

            assertTrue(seeded);
            assertEq(storedPool, pool);
            assertEq(storedPosition, positionId);
            assertEq(ArcToken(tokenAddr).balanceOf(address(adapter)), tokenAmount);
            assertEq(usdc.balanceOf(address(adapter)), quoteAmount);
        }
    }

    function testCannotTradeWithZeroInput() public {
        (, address curveAddr) = _launch();

        vm.expectRevert(ArcBondingCurve.ZeroAmount.selector);
        ArcBondingCurve(curveAddr).buy(0, 0);
    }

    function testFuzzBuyNeverCrossesReservedInventory(uint96 amount) public {
        vm.assume(amount > 1e6 && amount < 100_000e6);

        (address tokenAddr, address curveAddr) = _launch();

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
