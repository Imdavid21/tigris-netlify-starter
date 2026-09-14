// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ArcLaunchFactory} from "../src/ArcLaunchFactory.sol";
import {ArcBondingCurve} from "../src/ArcBondingCurve.sol";
import {ArcToken} from "../src/ArcToken.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockGraduationAdapter} from "../src/mocks/MockGraduationAdapter.sol";
import {MockBadGraduationAdapter} from "../src/mocks/MockBadGraduationAdapter.sol";
import {MockReentrantGraduationAdapter} from "../src/mocks/MockReentrantGraduationAdapter.sol";
import {IGraduationAdapter} from "../src/interfaces/IGraduationAdapter.sol";

contract ArcLaunchSecurityTest is Test {
    MockUSDC usdc;
    ArcLaunchFactory factory;

    address creator = address(0xCAFE);
    address trader = address(0xBEEF);
    address attacker = address(0xBAD);
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

    function _launch() internal returns (address token, address curve) {
        vm.prank(creator);
        return factory.createToken("Arc Test", "ARCX");
    }

    function testOnlyOwnerCanSetGraduationAdapter() public {
        MockGraduationAdapter adapter = new MockGraduationAdapter();

        vm.prank(attacker);
        vm.expectRevert(ArcLaunchFactory.NotOwner.selector);
        factory.setGraduationAdapter(IGraduationAdapter(address(adapter)));
    }

    function testCannotGraduateEarly() public {
        (address token,) = _launch();

        vm.expectRevert(ArcBondingCurve.NotReady.selector);
        factory.beginGraduation(token);
    }

    function testCannotGraduateTwice() public {
        MockGraduationAdapter adapter = new MockGraduationAdapter();
        factory.setGraduationAdapter(adapter);

        (address token, address curve) = _launch();

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        ArcBondingCurve(curve).buy(100_000e6, 1);
        vm.stopPrank();

        factory.beginGraduation(token);

        vm.expectRevert(ArcLaunchFactory.WrongGraduationState.selector);
        factory.beginGraduation(token);
    }

    function testCannotSeedGraduationTwice() public {
        MockGraduationAdapter adapter = new MockGraduationAdapter();
        factory.setGraduationAdapter(adapter);

        (address token, address curve) = _launch();

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        ArcBondingCurve(curve).buy(100_000e6, 1);
        vm.stopPrank();

        factory.beginGraduation(token);
        factory.createGraduatedPool(token);

        vm.expectRevert(ArcLaunchFactory.WrongGraduationState.selector);
        factory.createGraduatedPool(token);
    }

    function testRoundTripCannotIncreaseTraderUSDC() public {
        (address token, address curve) = _launch();

        uint256 initial = usdc.balanceOf(trader);

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);

        ArcBondingCurve c = ArcBondingCurve(curve);
        uint256 tokensOut = c.quoteBuy(1_000e6);
        c.buy(1_000e6, tokensOut);

        ArcToken(token).approve(curve, type(uint256).max);
        uint256 balance = ArcToken(token).balanceOf(trader);
        uint256 quoteOut = c.quoteSell(balance);
        c.sell(balance, quoteOut);
        vm.stopPrank();

        assertLt(usdc.balanceOf(trader), initial);
    }

    function testSellBlockedOnceGraduationReady() public {
        (address token, address curve) = _launch();

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        ArcBondingCurve(curve).buy(100_000e6, 1);

        uint256 tokenBalance = ArcToken(token).balanceOf(trader);
        ArcToken(token).approve(curve, tokenBalance);

        vm.expectRevert(ArcBondingCurve.CurveClosed.selector);
        ArcBondingCurve(curve).sell(tokenBalance / 10, 1);
        vm.stopPrank();
    }

    function testFinalBuyQuoteMatchesExecutionCap() public {
        (, address curve) = _launch();

        ArcBondingCurve c = ArcBondingCurve(curve);
        uint256 quoted = c.quoteBuy(100_000e6);

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        uint256 received = c.buy(100_000e6, quoted);
        vm.stopPrank();

        assertEq(received, quoted);
        assertTrue(c.readyToGraduate());
    }

    function testBadAdapterCannotFakeGraduation() public {
        MockBadGraduationAdapter adapter = new MockBadGraduationAdapter();
        factory.setGraduationAdapter(adapter);

        (address token, address curve) = _launch();

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        ArcBondingCurve(curve).buy(100_000e6, 1);
        vm.stopPrank();

        factory.beginGraduation(token);

        vm.expectRevert(ArcLaunchFactory.GraduationAssetsNotConsumed.selector);
        factory.createGraduatedPool(token);
    }

    function testGraduationAdapterCannotReenterFactory() public {
        MockReentrantGraduationAdapter adapter =
            new MockReentrantGraduationAdapter(address(factory));
        factory.setGraduationAdapter(adapter);

        (address token, address curve) = _launch();
        adapter.setTargetToken(token);

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        ArcBondingCurve(curve).buy(100_000e6, 1);
        vm.stopPrank();

        factory.beginGraduation(token);
        factory.createGraduatedPool(token);

        assertTrue(adapter.reentryBlocked());
    }

    function testFactoryRejectsEmptyMetadata() public {
        vm.prank(creator);
        vm.expectRevert(ArcLaunchFactory.InvalidMetadata.selector);
        factory.createToken("", "ARCX");
    }
}
