// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialBondingCurve} from "../src/CelestialBondingCurve.sol";
import {CelestialToken} from "../src/CelestialToken.sol";
import {CelestialPoolGuardHook, CelestialPoolGuardHookDeployer} from "../src/CelestialPoolGuardHook.sol";
import {CelestialUniswapV4Connector} from "../src/CelestialUniswapV4Connector.sol";
import {CelestialDexAdapter} from "../src/CelestialDexAdapter.sol";
import {ArcLiquidityLocker} from "../src/ArcLiquidityLocker.sol";
import {
    ICelestialV4PoolManager,
    ICelestialV4PositionManager,
    ICelestialV4Quoter,
    ICelestialUniversalRouter,
    ICelestialPermit2
} from "../src/interfaces/UniswapV4Minimal.sol";

interface IERC721OwnerOf {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract ArcMainnetUniswapV4ForkTest is Test {
    uint256 internal constant ARC_MAINNET_CHAIN_ID = 5042;

    address internal constant USDC = 0x3600000000000000000000000000000000000000;
    address internal constant V4_POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address internal constant V4_POSITION_MANAGER = 0x6049c9a0e26405C0985f9E3685C87d0aE917f82B;
    address internal constant V4_QUOTER = 0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94;
    address internal constant V4_UNIVERSAL_ROUTER = 0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    uint160 internal constant BEFORE_INITIALIZE_FLAG = 1 << 13;
    uint160 internal constant ALL_HOOK_MASK = (1 << 14) - 1;

    address internal creator = address(0xCAFE);
    address internal trader = address(0xBEEF);
    address internal postGradTrader = address(0xA11CE);

    CelestialLaunchFactory internal factory;
    CelestialPoolGuardHook internal hook;
    CelestialUniswapV4Connector internal connector;
    CelestialDexAdapter internal adapter;

    function setUp() public {
        if (block.chainid != ARC_MAINNET_CHAIN_ID) return;

        assertGt(USDC.code.length, 0);
        assertGt(V4_POOL_MANAGER.code.length, 0);
        assertGt(V4_POSITION_MANAGER.code.length, 0);
        assertGt(V4_QUOTER.code.length, 0);
        assertGt(V4_UNIVERSAL_ROUTER.code.length, 0);
        assertGt(PERMIT2.code.length, 0);

        factory = new CelestialLaunchFactory(address(this));

        CelestialLaunchFactory.QuoteConfig memory config = CelestialLaunchFactory.QuoteConfig({
            enabled: true,
            phantomQuote: 250e6,
            graduationThreshold: 1_000e6,
            feeBps: 100,
            protocolShareBps: 7_500,
            buybackShareBps: 2_000,
            maxSnipeBps: 0,
            snipeDuration: 0
        });
        factory.configureQuoteAsset(USDC, config);

        CelestialPoolGuardHookDeployer hookDeployer = new CelestialPoolGuardHookDeployer();
        bytes32 salt = _findHookSalt(address(hookDeployer), V4_POOL_MANAGER, address(this));
        hook = hookDeployer.deploy(salt, V4_POOL_MANAGER, address(this));

        connector = new CelestialUniswapV4Connector(
            ICelestialV4PoolManager(V4_POOL_MANAGER),
            ICelestialV4PositionManager(V4_POSITION_MANAGER),
            ICelestialV4Quoter(V4_QUOTER),
            ICelestialUniversalRouter(V4_UNIVERSAL_ROUTER),
            ICelestialPermit2(PERMIT2),
            address(hook),
            3_000,
            1
        );
        adapter = new CelestialDexAdapter(address(factory), connector);

        hook.sealInitializer(address(connector));
        factory.setGraduationAdapter(adapter);

        deal(USDC, trader, 100_000e6);
        deal(USDC, postGradTrader, 100_000e6);
    }

    function testFullArcMainnetLifecycleThroughUniswapV4() public {
        if (block.chainid != ARC_MAINNET_CHAIN_ID) return;

        assertEq(IERC20(USDC).balanceOf(trader), 100_000e6);

        CelestialLaunchFactory.LaunchParams memory params;
        params.name = "Arc Fork Token";
        params.symbol = "ARCF";
        params.quoteAsset = USDC;
        params.creatorFeeRecipient = creator;
        params.creatorTaxBps = 0;
        params.holderFeeBps = 0;
        params.metadata = CelestialLaunchFactory.Metadata({
            description: "Arc mainnet Uniswap v4 fork lifecycle",
            image: "ipfs://arc-fork",
            website: "https://example.com",
            twitter: "",
            telegram: ""
        });
        params.snipeExemptions = new address[](0);

        vm.prank(creator);
        (address token, address curveAddress) = factory.createToken(params);
        CelestialBondingCurve curve = CelestialBondingCurve(curveAddress);

        // Exercise normal bonding-curve buy and sell before graduation.
        vm.startPrank(trader);
        IERC20(USDC).approve(curveAddress, type(uint256).max);
        uint256 firstBuy = curve.buy(100e6, 1);
        CelestialToken(token).approve(curveAddress, firstBuy / 10);
        uint256 sellQuote = curve.quoteSell(firstBuy / 10);
        assertGt(sellQuote, 0);
        curve.sell(firstBuy / 10, sellQuote * 99 / 100);

        // A large buy is capped by the curve at the remaining graduation threshold.
        for (uint256 i; i < 3 && !curve.readyToGraduate(); ++i) {
            curve.buy(10_000e6, 1);
        }
        vm.stopPrank();

        assertTrue(curve.readyToGraduate());

        factory.beginGraduation(token);
        (address pool, uint256 positionId) = factory.createGraduatedPool(token);

        assertTrue(pool != address(0));
        assertGt(positionId, 0);

        (
            uint256 graduationQuote,
            uint256 graduationTokens,
            uint160 lockedPrice,
            address recordedPool,
            uint256 recordedPositionId,
            bool swept,
            bool seeded
        ) = factory.graduations(token);

        assertGt(graduationQuote, 0);
        assertGt(graduationTokens, 0);
        assertGt(lockedPrice, 0);
        assertEq(recordedPool, pool);
        assertEq(recordedPositionId, positionId);
        assertTrue(swept);
        assertTrue(seeded);

        ArcLiquidityLocker locker = factory.liquidityLocker();
        (address lockedAdapter, address lockedPool, uint256 lockedPositionId, uint256 lockedAt) = locker.locked(token);
        assertEq(lockedAdapter, address(adapter));
        assertEq(lockedPool, pool);
        assertEq(lockedPositionId, positionId);
        assertGt(lockedAt, 0);
        assertEq(IERC721OwnerOf(V4_POSITION_MANAGER).ownerOf(positionId), address(locker));

        // Post-graduation USDC -> token through Arc's real Universal Router.
        uint256 usdcIn = 10e6;
        uint256 quotedTokenOut = adapter.quoteExactInput(pool, USDC, usdcIn);
        assertGt(quotedTokenOut, 0);

        vm.startPrank(postGradTrader);
        IERC20(USDC).approve(address(adapter), type(uint256).max);
        uint256 tokenBefore = IERC20(token).balanceOf(postGradTrader);
        uint256 tokenOut = adapter.swapExactInput(
            pool,
            USDC,
            usdcIn,
            quotedTokenOut * 95 / 100,
            postGradTrader
        );
        assertGt(tokenOut, 0);
        assertEq(IERC20(token).balanceOf(postGradTrader), tokenBefore + tokenOut);

        // And token -> USDC back through the same real v4 pool.
        uint256 tokenIn = tokenOut / 2;
        uint256 quotedUsdcOut = adapter.quoteExactInput(pool, token, tokenIn);
        assertGt(quotedUsdcOut, 0);
        IERC20(token).approve(address(adapter), tokenIn);
        uint256 usdcBefore = IERC20(USDC).balanceOf(postGradTrader);
        uint256 usdcOut = adapter.swapExactInput(
            pool,
            token,
            tokenIn,
            quotedUsdcOut * 95 / 100,
            postGradTrader
        );
        vm.stopPrank();

        assertGt(usdcOut, 0);
        assertEq(IERC20(USDC).balanceOf(postGradTrader), usdcBefore + usdcOut);
    }

    function _findHookSalt(address deployerContract, address poolManager, address owner)
        internal
        pure
        returns (bytes32 salt)
    {
        bytes memory creationCode = abi.encodePacked(
            type(CelestialPoolGuardHook).creationCode,
            abi.encode(poolManager, owner)
        );
        bytes32 initCodeHash = keccak256(creationCode);

        for (uint256 i; i < 250_000; ++i) {
            bytes32 candidate = bytes32(i);
            address predicted = address(uint160(uint256(keccak256(abi.encodePacked(
                bytes1(0xff), deployerContract, candidate, initCodeHash
            )))));
            if ((uint160(predicted) & ALL_HOOK_MASK) == BEFORE_INITIALIZE_FLAG) {
                return candidate;
            }
        }

        revert("hook salt not found");
    }
}
