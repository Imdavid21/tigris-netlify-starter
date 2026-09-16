// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialBondingCurve} from "../src/CelestialBondingCurve.sol";

contract SellMainnetQA is Script {
    uint256 internal constant ARC_MAINNET_CHAIN_ID = 5042;
    address internal constant EXPECTED_WALLET = 0x8c377ed06931c379e7C1f31a1753Fe5e03ffBe01;
    address internal constant FACTORY = 0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423;

    address internal constant SSQ1 = 0x2C6052879c1E99f59Ea113068563864377A0912A;
    address internal constant SSQ2 = 0x38C6aC49EE141A34650DCc4ac85d390013cD6B9b;
    address internal constant SSQ3 = 0x669C59733dF953a6f48CDbFD3509031FaDb9d469;
    address internal constant SSQ4 = 0x05E75DA0B1efcFc2d8Bb130E469c844fDb7DE1A2;
    address internal constant SSQ5 = 0x09C86F65cD2A2DF456D70240193210dACe7A4e37;
    address internal constant SSQ6 = 0x4b0d0710C48cF098587709B5011a8Af40B3d8157;

    error WrongChain(uint256 actual);
    error WrongWallet(address actual);
    error MissingCurve(address token);
    error ZeroQuote(address token);
    error RemainingBalance(address token, uint256 balance);

    function run() external {
        if (block.chainid != ARC_MAINNET_CHAIN_ID) revert WrongChain(block.chainid);

        uint256 key = vm.envUint("PRIVATE_KEY");
        address actor = vm.addr(key);
        if (actor != EXPECTED_WALLET) revert WrongWallet(actor);

        address[6] memory tokens = [SSQ1, SSQ2, SSQ3, SSQ4, SSQ5, SSQ6];
        CelestialLaunchFactory factory = CelestialLaunchFactory(FACTORY);

        uint256 soldMarkets;
        uint256 totalExpectedQuote;

        vm.startBroadcast(key);

        for (uint256 i; i < tokens.length; ++i) {
            IERC20 token = IERC20(tokens[i]);
            uint256 balance = token.balanceOf(actor);
            console2.log("TOKEN_BALANCE_BEFORE", tokens[i], balance);
            if (balance == 0) continue;

            address curveAddress = factory.curveOf(tokens[i]);
            if (curveAddress == address(0)) revert MissingCurve(tokens[i]);

            CelestialBondingCurve curve = CelestialBondingCurve(curveAddress);
            uint256 quoted = curve.quoteSell(balance);
            if (quoted == 0) revert ZeroQuote(tokens[i]);

            token.approve(curveAddress, balance);
            uint256 received = curve.sell(balance, quoted * 98 / 100);
            token.approve(curveAddress, 0);

            uint256 remaining = token.balanceOf(actor);
            if (remaining != 0) revert RemainingBalance(tokens[i], remaining);

            soldMarkets++;
            totalExpectedQuote += received;
            console2.log("TOKEN_SOLD", tokens[i]);
            console2.log("QUOTE_RECEIVED", received);
        }

        vm.stopBroadcast();

        console2.log("SOLD_MARKETS", soldMarkets);
        console2.log("TOTAL_QUOTE_RECEIVED_MICRO_USDC", totalExpectedQuote);
        console2.log("RECIPIENT", actor);
    }
}
