// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {ArcLaunchFactory} from "../src/ArcLaunchFactory.sol";
import {ArcBondingCurve} from "../src/ArcBondingCurve.sol";
import {ArcToken} from "../src/ArcToken.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract CurveHandler is Test {
    MockUSDC public immutable usdc;
    ArcToken public immutable token;
    ArcBondingCurve public immutable curve;

    constructor(MockUSDC usdc_, ArcToken token_, ArcBondingCurve curve_) {
        usdc = usdc_;
        token = token_;
        curve = curve_;
        usdc.approve(address(curve), type(uint256).max);
        token.approve(address(curve), type(uint256).max);
    }

    function buy(uint256 rawAmount) external {
        if (curve.readyToGraduate()) return;
        uint256 amount = bound(rawAmount, 1e6, 500e6);
        usdc.mint(address(this), amount);

        uint256 quote = curve.quoteBuy(amount);
        if (quote == 0) return;

        try curve.buy(amount, 1) {} catch {}
    }

    function sell(uint256 rawAmount) external {
        if (curve.readyToGraduate()) return;

        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) return;

        uint256 amount = bound(rawAmount, 1, balance);
        uint256 quote = curve.quoteSell(amount);
        if (quote == 0) return;

        try curve.sell(amount, 1) {} catch {}
    }
}

contract ArcLaunchInvariantTest is StdInvariant, Test {
    MockUSDC usdc;
    ArcLaunchFactory factory;
    ArcToken token;
    ArcBondingCurve curve;
    CurveHandler handler;

    function setUp() public {
        usdc = new MockUSDC();
        factory = new ArcLaunchFactory(
            usdc,
            address(0xFEE),
            2_500e6,
            10_000e6,
            100,
            7_500
        );

        (address tokenAddr, address curveAddr) =
            factory.createToken("Invariant", "INV");

        token = ArcToken(tokenAddr);
        curve = ArcBondingCurve(curveAddr);
        handler = new CurveHandler(usdc, token, curve);

        targetContract(address(handler));
    }

    function invariantCurveNeverSellsReservedInventory() public view {
        assertGe(token.balanceOf(address(curve)), factory.RESERVED_TOKENS());
    }

    function invariantQuoteReserveNeverExceedsGraduationThreshold() public view {
        assertLe(curve.trackedQuote(), factory.graduationThreshold());
    }

    function invariantPhysicalQuoteCoversAccounting() public view {
        uint256 accounted =
            curve.trackedQuote() +
            curve.pendingProtocolFees() +
            curve.pendingCreatorFees();

        assertGe(usdc.balanceOf(address(curve)), accounted);
    }

    function invariantTotalSupplyFixed() public view {
        assertEq(token.totalSupply(), factory.TOTAL_SUPPLY());
    }
}
