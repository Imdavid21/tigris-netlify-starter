// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialBondingCurve} from "../src/CelestialBondingCurve.sol";
import {CelestialToken} from "../src/CelestialToken.sol";
import {CelestialLimitOrderBook} from "../src/CelestialLimitOrderBook.sol";
import {CelestialBuybackVault} from "../src/CelestialBuybackVault.sol";
import {CelestialFeeEscrow} from "../src/CelestialFeeEscrow.sol";

contract CelestialProtocolTest is Test {
    MockUSDC usdc;
    MockUSDC eurc;
    CelestialLaunchFactory factory;
    CelestialLimitOrderBook orderBook;

    address creator = address(0xCAFE);
    address trader = address(0xBEEF);
    address trader2 = address(0xB0B);
    address treasury = address(0xFEE);

    function setUp() public {
        usdc = new MockUSDC();
        eurc = new MockUSDC();
        factory = new CelestialLaunchFactory(treasury);
        orderBook = new CelestialLimitOrderBook();

        CelestialLaunchFactory.QuoteConfig memory config = CelestialLaunchFactory.QuoteConfig({
            enabled: true,
            phantomQuote: 2_500e6,
            graduationThreshold: 10_000e6,
            feeBps: 100,
            protocolShareBps: 7_500,
            buybackShareBps: 2_000,
            maxSnipeBps: 2_000,
            snipeDuration: 5
        });
        factory.configureQuoteAsset(address(usdc), config);
        factory.configureQuoteAsset(address(eurc), config);

        usdc.mint(creator, 100_000e6);
        usdc.mint(trader, 100_000e6);
        usdc.mint(trader2, 100_000e6);
    }

    function _params(address quote)
        internal
        pure
        returns (CelestialLaunchFactory.LaunchParams memory p)
    {
        p.name = "Celestial Test";
        p.symbol = "CELE";
        p.quoteAsset = quote;
        p.creatorFeeRecipient = address(0);
        p.creatorTaxBps = 50;
        p.holderFeeBps = 25;
        p.metadata = CelestialLaunchFactory.Metadata({
            description: "Onchain metadata",
            image: "ipfs://image",
            website: "https://celestial.example",
            twitter: "@celestial",
            telegram: "t.me/celestial"
        });
        p.snipeExemptions = new address[](0);
    }

    function testMetadataEventPathAndConfigurablePairs() public {
        vm.recordLogs();
        vm.prank(creator);
        (address token,) = factory.createToken(_params(address(eurc)));

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 metadataSig = keccak256("MetadataSet(address,string,string,string,string,string)");
        bool foundMetadata;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(factory) && logs[i].topics.length > 1 && logs[i].topics[0] == metadataSig) {
                assertEq(address(uint160(uint256(logs[i].topics[1]))), token);
                (string memory description, string memory image, string memory website, string memory twitter, string memory telegram) =
                    abi.decode(logs[i].data, (string, string, string, string, string));
                assertEq(description, "Onchain metadata");
                assertEq(image, "ipfs://image");
                assertEq(website, "https://celestial.example");
                assertEq(twitter, "@celestial");
                assertEq(telegram, "t.me/celestial");
                foundMetadata = true;
                break;
            }
        }
        assertTrue(foundMetadata);
        assertEq(factory.quoteAssetOf(token), address(eurc));
    }

    function testAtomicDeveloperBuy() public {
        CelestialLaunchFactory.LaunchParams memory p = _params(address(usdc));

        vm.startPrank(creator);
        usdc.approve(address(factory), 1_000e6);
        (address token, address curve, uint256 tokensOut) =
            factory.createTokenAndBuy(p, 1_000e6, 1);
        vm.stopPrank();

        assertGt(tokensOut, 0);
        assertEq(CelestialToken(token).balanceOf(creator), tokensOut);
        assertGt(CelestialBondingCurve(curve).trackedQuote(), 0);
    }

    function testSnipeTaxDecaysAndCreatorExempt() public {
        vm.prank(creator);
        (, address curve) = factory.createToken(_params(address(usdc)));

        CelestialBondingCurve c = CelestialBondingCurve(curve);
        assertEq(c.currentSnipeBps(creator), 0);
        assertEq(c.currentSnipeBps(trader), 2_000);

        vm.warp(block.timestamp + 6);
        assertEq(c.currentSnipeBps(trader), 0);
    }

    function testHolderFeesAccrueAndClaim() public {
        vm.prank(creator);
        (address token, address curve) = factory.createToken(_params(address(usdc)));

        vm.warp(block.timestamp + 6);

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        CelestialBondingCurve(curve).buy(1_000e6, 1);
        CelestialBondingCurve(curve).buy(500e6, 1);
        vm.stopPrank();

        assertGt(CelestialToken(token).withdrawableRewardOf(trader), 0);

        uint256 beforeBalance = usdc.balanceOf(trader);
        vm.prank(trader);
        CelestialToken(token).claimHolderRewards();
        assertGt(usdc.balanceOf(trader), beforeBalance);
    }

    function testLimitBuyOrderExecutesWhenQuoteMeetsMinimum() public {
        vm.prank(creator);
        (, address curve) = factory.createToken(_params(address(usdc)));

        vm.warp(block.timestamp + 6);
        uint256 amountIn = 100e6;
        uint256 expected = CelestialBondingCurve(curve).quoteBuyFor(trader, amountIn);

        vm.startPrank(trader);
        usdc.approve(address(orderBook), amountIn);
        uint256 id = orderBook.placeBuyOrder(curve, amountIn, expected);
        vm.stopPrank();

        assertTrue(orderBook.canExecute(id));
        orderBook.execute(id);
        (, , , , , bool active) = orderBook.orders(id);
        assertFalse(active);
    }

    function testCreatorTaxAccruesAndClaims() public {
        vm.prank(creator);
        (, address curve) = factory.createToken(_params(address(usdc)));

        vm.warp(block.timestamp + 6);
        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        CelestialBondingCurve(curve).buy(1_000e6, 1);
        vm.stopPrank();

        CelestialBondingCurve(curve).sweepFees();
        CelestialFeeEscrow escrow = factory.feeEscrow();
        uint256 claimable = escrow.claimable(address(usdc), creator);
        assertGt(claimable, 0);

        uint256 beforeBalance = usdc.balanceOf(creator);
        vm.prank(creator);
        escrow.claim(address(usdc));
        assertEq(usdc.balanceOf(creator), beforeBalance + claimable);
        assertEq(escrow.claimable(address(usdc), creator), 0);
    }

    function testLimitSellOrderExecutesAndBuyCancelRefunds() public {
        vm.prank(creator);
        (address token, address curve) = factory.createToken(_params(address(usdc)));
        vm.warp(block.timestamp + 6);

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        uint256 bought = CelestialBondingCurve(curve).buy(1_000e6, 1);

        uint256 sellAmount = bought / 4;
        uint256 expectedQuote = CelestialBondingCurve(curve).quoteSell(sellAmount);
        CelestialToken(token).approve(address(orderBook), sellAmount);
        uint256 sellId = orderBook.placeSellOrder(curve, sellAmount, expectedQuote);
        vm.stopPrank();

        assertTrue(orderBook.canExecute(sellId));
        orderBook.execute(sellId);
        (, , , , , bool sellActive) = orderBook.orders(sellId);
        assertFalse(sellActive);

        uint256 buyAmount = 250e6;
        uint256 before = usdc.balanceOf(trader);
        vm.startPrank(trader);
        usdc.approve(address(orderBook), buyAmount);
        uint256 buyId = orderBook.placeBuyOrder(curve, buyAmount, type(uint256).max);
        assertEq(usdc.balanceOf(trader), before - buyAmount);
        orderBook.cancel(buyId);
        vm.stopPrank();
        assertEq(usdc.balanceOf(trader), before);
    }

    function testBuybackVaultBuysAndBurnsOnCurve() public {
        vm.prank(creator);
        (address token, address curve) = factory.createToken(_params(address(usdc)));
        vm.warp(block.timestamp + 6);

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        CelestialBondingCurve(curve).buy(5_000e6, 1);
        vm.stopPrank();

        CelestialBondingCurve(curve).sweepFees();
        CelestialBuybackVault vault = factory.buybackVault();
        uint256 available = usdc.balanceOf(address(vault));
        assertGt(available, 0);

        uint256 deadBefore = CelestialToken(token).balanceOf(CelestialToken(token).DEAD());
        uint256 burned = vault.executeCurveBuyback(curve, available, 1);
        assertGt(burned, 0);
        assertEq(CelestialToken(token).balanceOf(CelestialToken(token).DEAD()), deadBefore + burned);
        assertEq(usdc.allowance(address(vault), curve), 0);
    }

    function testMarketBuySellNormalFlow() public {
        vm.prank(creator);
        (address token, address curve) = factory.createToken(_params(address(usdc)));
        vm.warp(block.timestamp + 6);

        CelestialBondingCurve c = CelestialBondingCurve(curve);
        CelestialToken t = CelestialToken(token);
        uint256 initialQuote = usdc.balanceOf(trader);

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);

        uint256 buyQuote = c.quoteBuyFor(trader, 1_000e6);
        uint256 bought = c.buy(1_000e6, buyQuote * 99 / 100);
        assertEq(t.balanceOf(trader), bought);

        uint256 sellAmount = bought / 4;
        t.approve(curve, sellAmount);
        uint256 sellQuote = c.quoteSell(sellAmount);
        uint256 received = c.sell(sellAmount, sellQuote * 99 / 100);
        vm.stopPrank();

        assertGt(received, 0);
        assertEq(t.balanceOf(trader), bought - sellAmount);
        assertLt(usdc.balanceOf(trader), initialQuote);
    }

    function testZeroSellQuoteReturnsZero() public {
        vm.prank(creator);
        (, address curve) = factory.createToken(_params(address(usdc)));
        assertEq(CelestialBondingCurve(curve).quoteSell(0), 0);
    }

    function testStaleBuyQuoteRespectsSlippage() public {
        vm.prank(creator);
        (, address curve) = factory.createToken(_params(address(usdc)));
        vm.warp(block.timestamp + 6);

        CelestialBondingCurve c = CelestialBondingCurve(curve);
        uint256 staleQuote = c.quoteBuyFor(trader, 1_000e6);

        vm.startPrank(trader2);
        usdc.approve(curve, type(uint256).max);
        c.buy(1_000e6, 1);
        vm.stopPrank();

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        vm.expectRevert(CelestialBondingCurve.SlippageExceeded.selector);
        c.buy(1_000e6, staleQuote);
        vm.stopPrank();
    }

    function testFinalBuyCapsAndClosesSellSide() public {
        vm.prank(creator);
        (address token, address curve) = factory.createToken(_params(address(usdc)));
        vm.warp(block.timestamp + 6);

        CelestialBondingCurve c = CelestialBondingCurve(curve);
        uint256 beforeQuote = usdc.balanceOf(trader);

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        c.buy(100_000e6, 1);
        vm.stopPrank();

        uint256 spent = beforeQuote - usdc.balanceOf(trader);
        assertLt(spent, 100_000e6);
        assertTrue(c.readyToGraduate());

        uint256 tokenBalance = CelestialToken(token).balanceOf(trader);
        assertEq(c.quoteSell(tokenBalance / 10), 0);

        vm.startPrank(trader);
        CelestialToken(token).approve(curve, type(uint256).max);
        vm.expectRevert(CelestialBondingCurve.CurveClosed.selector);
        c.sell(tokenBalance / 10, 1);
        vm.stopPrank();
    }

    function testLimitOrdersBlockedWhenGraduationReady() public {
        vm.prank(creator);
        (, address curve) = factory.createToken(_params(address(usdc)));
        vm.warp(block.timestamp + 6);

        vm.startPrank(trader);
        usdc.approve(curve, type(uint256).max);
        CelestialBondingCurve(curve).buy(100_000e6, 1);
        usdc.approve(address(orderBook), 100e6);
        vm.expectRevert(CelestialLimitOrderBook.CurveClosed.selector);
        orderBook.placeBuyOrder(curve, 100e6, 1);
        vm.stopPrank();
    }

    function testExplicitSnipeExemption() public {
        CelestialLaunchFactory.LaunchParams memory p = _params(address(usdc));
        p.snipeExemptions = new address[](1);
        p.snipeExemptions[0] = trader;

        vm.prank(creator);
        (, address curve) = factory.createToken(p);

        assertEq(CelestialBondingCurve(curve).currentSnipeBps(trader), 0);
    }
}
