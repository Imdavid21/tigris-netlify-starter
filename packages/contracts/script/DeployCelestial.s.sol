// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialLimitOrderBook} from "../src/CelestialLimitOrderBook.sol";

contract DeployCelestial is Script {
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    address constant CIRBTC = 0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF;

    function run()
        external
        returns (CelestialLaunchFactory factory, CelestialLimitOrderBook orderBook)
    {
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

        CelestialLaunchFactory.QuoteConfig memory eur = usd;
        factory.configureQuoteAsset(EURC, eur);

        CelestialLaunchFactory.QuoteConfig memory btc;
        btc.enabled = true;
        btc.phantomQuote = 2_500_000;
        btc.graduationThreshold = 10_000_000;
        btc.feeBps = 100;
        btc.protocolShareBps = 7_500;
        btc.buybackShareBps = 2_000;
        btc.maxSnipeBps = 9_000;
        btc.snipeDuration = 5;
        factory.configureQuoteAsset(CIRBTC, btc);

        vm.stopBroadcast();

        console2.log("CELESTIAL_FACTORY", address(factory));
        console2.log("CELESTIAL_FEE_ESCROW", address(factory.feeEscrow()));
        console2.log("CELESTIAL_BUYBACK_VAULT", address(factory.buybackVault()));
        console2.log("CELESTIAL_LIQUIDITY_LOCKER", address(factory.liquidityLocker()));
        console2.log("CELESTIAL_LIMIT_ORDER_BOOK", address(orderBook));
        console2.log("CELESTIAL_USDC", USDC);
        console2.log("CELESTIAL_EURC", EURC);
        console2.log("CELESTIAL_CIRBTC", CIRBTC);
    }
}
