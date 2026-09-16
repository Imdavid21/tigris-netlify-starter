// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialLimitOrderBook} from "../src/CelestialLimitOrderBook.sol";
import {CelestialPoolGuardHook, CelestialPoolGuardHookDeployer} from "../src/CelestialPoolGuardHook.sol";
import {CelestialUniswapV4Connector} from "../src/CelestialUniswapV4Connector.sol";
import {CelestialDexAdapter} from "../src/CelestialDexAdapter.sol";
import {
    ICelestialV4PoolManager,
    ICelestialV4PositionManager,
    ICelestialV4Quoter,
    ICelestialUniversalRouter,
    ICelestialPermit2
} from "../src/interfaces/UniswapV4Minimal.sol";

contract DeployCelestialMainnet is Script {
    uint256 internal constant ARC_MAINNET_CHAIN_ID = 5042;
    address internal constant USDC = 0x3600000000000000000000000000000000000000;

    address internal constant V4_POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address internal constant V4_POSITION_MANAGER = 0x6049c9a0e26405C0985f9E3685C87d0aE917f82B;
    address internal constant V4_QUOTER = 0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94;
    address internal constant V4_UNIVERSAL_ROUTER = 0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    uint160 internal constant BEFORE_INITIALIZE_FLAG = 1 << 13;
    uint160 internal constant ALL_HOOK_MASK = (1 << 14) - 1;
    uint24 internal constant LP_FEE = 3_000;
    int24 internal constant TICK_SPACING = 1;

    error WrongChain(uint256 actual);
    error MissingCode(address target);
    error WrongDecimals(uint8 actual);
    error HookSaltNotFound();

    function run()
        external
        returns (
            CelestialLaunchFactory factory,
            CelestialLimitOrderBook orderBook,
            CelestialPoolGuardHook hook,
            CelestialUniswapV4Connector connector,
            CelestialDexAdapter adapter
        )
    {
        if (block.chainid != ARC_MAINNET_CHAIN_ID) revert WrongChain(block.chainid);

        _requireCode(USDC);
        _requireCode(V4_POOL_MANAGER);
        _requireCode(V4_POSITION_MANAGER);
        _requireCode(V4_QUOTER);
        _requireCode(V4_UNIVERSAL_ROUTER);
        _requireCode(PERMIT2);

        uint8 usdcDecimals = IERC20Metadata(USDC).decimals();
        if (usdcDecimals != 6) revert WrongDecimals(usdcDecimals);

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address treasury = vm.envAddress("PROTOCOL_TREASURY");

        vm.startBroadcast(deployerKey);

        factory = new CelestialLaunchFactory(treasury);
        orderBook = new CelestialLimitOrderBook();

        CelestialLaunchFactory.QuoteConfig memory usd;
        usd.enabled = true;
        usd.phantomQuote = 2_500e6;
        usd.graduationThreshold = 10_000e6;
        usd.feeBps = 100;
        usd.protocolShareBps = 7_500;
        usd.buybackShareBps = 2_000;
        usd.maxSnipeBps = 9_000;
        usd.snipeDuration = 5;
        factory.configureQuoteAsset(USDC, usd);

        CelestialPoolGuardHookDeployer hookDeployer = new CelestialPoolGuardHookDeployer();
        bytes32 hookSalt = _findHookSalt(address(hookDeployer), V4_POOL_MANAGER, deployer);
        hook = hookDeployer.deploy(hookSalt, V4_POOL_MANAGER, deployer);

        connector = new CelestialUniswapV4Connector(
            ICelestialV4PoolManager(V4_POOL_MANAGER),
            ICelestialV4PositionManager(V4_POSITION_MANAGER),
            ICelestialV4Quoter(V4_QUOTER),
            ICelestialUniversalRouter(V4_UNIVERSAL_ROUTER),
            ICelestialPermit2(PERMIT2),
            address(hook),
            LP_FEE,
            TICK_SPACING
        );

        adapter = new CelestialDexAdapter(address(factory), connector);
        hook.sealInitializer(address(connector));
        factory.setGraduationAdapter(adapter);

        vm.stopBroadcast();

        console2.log("CELESTIAL_FACTORY", address(factory));
        console2.log("CELESTIAL_FEE_ESCROW", address(factory.feeEscrow()));
        console2.log("CELESTIAL_BUYBACK_VAULT", address(factory.buybackVault()));
        console2.log("CELESTIAL_LIQUIDITY_LOCKER", address(factory.liquidityLocker()));
        console2.log("CELESTIAL_LIMIT_ORDER_BOOK", address(orderBook));
        console2.log("CELESTIAL_V4_HOOK", address(hook));
        console2.log("CELESTIAL_V4_CONNECTOR", address(connector));
        console2.log("CELESTIAL_DEX_ADAPTER", address(adapter));
        console2.log("CELESTIAL_USDC", USDC);
    }

    function _requireCode(address target) internal view {
        if (target.code.length == 0) revert MissingCode(target);
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

        revert HookSaltNotFound();
    }
}
