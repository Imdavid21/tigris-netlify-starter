// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialBondingCurve} from "../src/CelestialBondingCurve.sol";
import {ICelestialGraduationAdapter} from "../src/interfaces/ICelestialGraduationAdapter.sol";
import {CelestialV4PriceMath} from "../src/libraries/CelestialV4PriceMath.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract RecordingCelestialGraduationAdapter is ICelestialGraduationAdapter {
    using SafeERC20 for IERC20;

    uint160 public lastSqrtPriceX96;
    address public lastToken;
    address public lastQuote;
    uint256 public lastTokenAmount;
    uint256 public lastQuoteAmount;
    address public lastLocker;

    address public constant POOL = address(0xB0A1);
    uint256 public constant POSITION_ID = 77;

    function createPoolAndLock(
        address token,
        address quoteAsset,
        uint256 tokenAmount,
        uint256 quoteAmount,
        uint160 sqrtPriceX96,
        address locker
    ) external returns (address pool, uint256 positionId) {
        lastToken = token;
        lastQuote = quoteAsset;
        lastTokenAmount = tokenAmount;
        lastQuoteAmount = quoteAmount;
        lastSqrtPriceX96 = sqrtPriceX96;
        lastLocker = locker;

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(quoteAsset).safeTransferFrom(msg.sender, address(this), quoteAmount);
        return (POOL, POSITION_ID);
    }
}

contract CelestialGraduationPriceTest is Test {
    MockUSDC quote;
    CelestialLaunchFactory factory;
    RecordingCelestialGraduationAdapter adapter;

    address creator = address(0xCAFE);
    address trader = address(0xBEEF);
    address treasury = address(0xFEE);

    function setUp() public {
        quote = new MockUSDC();
        factory = new CelestialLaunchFactory(treasury);
        adapter = new RecordingCelestialGraduationAdapter();

        factory.configureQuoteAsset(
            address(quote),
            CelestialLaunchFactory.QuoteConfig({
                enabled: true,
                phantomQuote: 250e6,
                graduationThreshold: 1_000e6,
                feeBps: 100,
                protocolShareBps: 7_500,
                buybackShareBps: 2_000,
                maxSnipeBps: 0,
                snipeDuration: 0
            })
        );
        factory.setGraduationAdapter(adapter);
        quote.mint(trader, 10_000e6);
    }

    function _params() internal view returns (CelestialLaunchFactory.LaunchParams memory p) {
        p.name = "Graduate";
        p.symbol = "GRAD";
        p.quoteAsset = address(quote);
        p.creatorFeeRecipient = creator;
        p.creatorTaxBps = 0;
        p.holderFeeBps = 0;
        p.metadata = CelestialLaunchFactory.Metadata({
            description: "",
            image: "",
            website: "",
            twitter: "",
            telegram: ""
        });
        p.snipeExemptions = new address[](0);
    }

    function testGraduationLocksTerminalCurvePriceBeforeSweep() public {
        vm.prank(creator);
        (address token, address curveAddress) = factory.createToken(_params());
        CelestialBondingCurve curve = CelestialBondingCurve(curveAddress);

        vm.startPrank(trader);
        quote.approve(curveAddress, type(uint256).max);
        curve.buy(2_000e6, 1);
        vm.stopPrank();

        assertTrue(curve.readyToGraduate());

        uint160 expected = CelestialV4PriceMath.sqrtPriceX96(
            token,
            address(quote),
            curve.trackedTokens(),
            curve.virtualQuoteReserve()
        );

        factory.beginGraduation(token);
        factory.createGraduatedPool(token);

        assertEq(adapter.lastSqrtPriceX96(), expected);
        assertEq(adapter.lastToken(), token);
        assertEq(adapter.lastQuote(), address(quote));
        assertEq(adapter.lastLocker(), address(factory.liquidityLocker()));

        (
            uint256 quoteAmount,
            uint256 tokenAmount,
            uint160 sqrtPriceX96,
            address pool,
            uint256 positionId,
            bool swept,
            bool seeded
        ) = factory.graduations(token);

        assertEq(sqrtPriceX96, expected);
        assertEq(pool, adapter.POOL());
        assertEq(positionId, adapter.POSITION_ID());
        assertTrue(swept);
        assertTrue(seeded);
        assertEq(adapter.lastTokenAmount(), tokenAmount);
        assertEq(adapter.lastQuoteAmount(), quoteAmount);

        (address lockedAdapter, address lockedPool, uint256 lockedPositionId,) =
            factory.liquidityLocker().locked(token);
        assertEq(lockedAdapter, address(adapter));
        assertEq(lockedPool, adapter.POOL());
        assertEq(lockedPositionId, adapter.POSITION_ID());
    }

    function testGraduationPriceIncludesPhantomReserve() public {
        vm.prank(creator);
        (address token, address curveAddress) = factory.createToken(_params());
        CelestialBondingCurve curve = CelestialBondingCurve(curveAddress);

        vm.startPrank(trader);
        quote.approve(curveAddress, type(uint256).max);
        curve.buy(2_000e6, 1);
        vm.stopPrank();

        uint160 terminalPrice = CelestialV4PriceMath.sqrtPriceX96(
            token,
            address(quote),
            curve.trackedTokens(),
            curve.virtualQuoteReserve()
        );
        uint160 naiveSeedRatio = CelestialV4PriceMath.sqrtPriceX96(
            token,
            address(quote),
            curve.trackedTokens(),
            curve.trackedQuote()
        );

        assertTrue(terminalPrice != naiveSeedRatio);
    }
}
