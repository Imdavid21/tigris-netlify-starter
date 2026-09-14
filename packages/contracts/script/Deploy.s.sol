// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ArcLaunchFactory} from "../src/ArcLaunchFactory.sol";

contract Deploy is Script {
    function run() external returns (ArcLaunchFactory factory) {
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");
        address treasury = vm.envAddress("PROTOCOL_TREASURY");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        factory = new ArcLaunchFactory(
            IERC20(usdc),
            treasury,
            2_500e6,
            10_000e6,
            100,
            7_500
        );
        vm.stopBroadcast();

        console2.log("ARC_LAUNCH_FACTORY", address(factory));
        console2.log("ARC_FEE_ESCROW", address(factory.feeEscrow()));
        console2.log("ARC_LIQUIDITY_LOCKER", address(factory.liquidityLocker()));
        console2.log("PROTOCOL_TREASURY", factory.protocolTreasury());
        console2.log("ARC_USDC", address(factory.quoteAsset()));
    }
}
