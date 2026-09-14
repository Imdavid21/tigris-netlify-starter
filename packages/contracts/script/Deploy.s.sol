// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ArcLaunchFactory} from "../src/ArcLaunchFactory.sol";

contract Deploy is Script {
    function run() external returns (ArcLaunchFactory factory) {
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        factory = new ArcLaunchFactory(
            IERC20(usdc),
            2_500e6,
            10_000e6,
            100,
            7_500
        );
        vm.stopBroadcast();
    }
}
