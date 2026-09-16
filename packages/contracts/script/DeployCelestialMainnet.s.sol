// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialLimitOrderBook} from "../src/CelestialLimitOrderBook.sol";

contract DeployCelestialMainnet is Script {
    uint256 internal constant ARC_MAINNET_CHAIN_ID = 5042;
    address internal constant USDC = 0x3600000000000000000000000000000000000000;

    error WrongChain(uint256 actual);
    error MissingCode(address target);
    error WrongDecimals(uint8 actual);

    function run()
        external
        returns (CelestialLaunchFactory factory, CelestialLimitOrderBook orderBook)
    {
        if (block.chainid != ARC_MAINNET_CHAIN_ID) revert WrongChain(block.chainid);
        if (USDC.code.length == 0) revert MissingCode(USDC);

        uint8 usdcDecimals = IERC20Metadata(USDC).decimals();
        if (usdcDecimals != 6) revert WrongDecimals(usdcDecimals);

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
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

        vm.stopBroadcast();

        console2.log("CELESTIAL_FACTORY", address(factory));
        console2.log("CELESTIAL_FEE_ESCROW", address(factory.feeEscrow()));
        console2.log("CELESTIAL_BUYBACK_VAULT", address(factory.buybackVault()));
        console2.log("CELESTIAL_LIQUIDITY_LOCKER", address(factory.liquidityLocker()));
        console2.log("CELESTIAL_LIMIT_ORDER_BOOK", address(orderBook));
        console2.log("CELESTIAL_USDC", USDC);
    }
}
