// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialBondingCurve} from "../src/CelestialBondingCurve.sol";
import {CelestialToken} from "../src/CelestialToken.sol";
import {CelestialFeeEscrow} from "../src/CelestialFeeEscrow.sol";
import {CelestialLimitOrderBook} from "../src/CelestialLimitOrderBook.sol";

contract RunMainnetE2E is Script {
    uint256 internal constant ARC_MAINNET_CHAIN_ID = 5042;
    uint256 internal constant MAX_NATIVE_LOSS = 5 ether;
    uint256 internal constant MAX_GROSS_NOTIONAL = 2_000_000;

    address internal constant FACTORY = 0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423;
    address internal constant ORDER_BOOK = 0xED7b5904e272d3DF891179D916D2E3A939ed1471;
    address internal constant USDC = 0x3600000000000000000000000000000000000000;
    address internal constant EXPECTED_WALLET = 0x8c377ed06931c379e7C1f31a1753Fe5e03ffBe01;

    CelestialLaunchFactory internal factory = CelestialLaunchFactory(FACTORY);
    CelestialLimitOrderBook internal orderBook = CelestialLimitOrderBook(ORDER_BOOK);
    IERC20 internal usdc = IERC20(USDC);

    uint256 internal startNative;
    uint256 internal grossNotional;

    error WrongChain(uint256 actual);
    error WrongWallet(address actual);
    error InsufficientBudget(uint256 actual);
    error SpendCapExceeded(uint256 actual);
    error AssertionFailed(string check);

    function run() external {
        if (block.chainid != ARC_MAINNET_CHAIN_ID) revert WrongChain(block.chainid);

        uint256 key = vm.envUint("PRIVATE_KEY");
        address actor = vm.addr(key);
        if (actor != EXPECTED_WALLET) revert WrongWallet(actor);

        startNative = actor.balance;
        if (startNative < MAX_NATIVE_LOSS) revert InsufficientBudget(startNative);
        if (usdc.balanceOf(actor) < MAX_GROSS_NOTIONAL) revert InsufficientBudget(usdc.balanceOf(actor));

        vm.startBroadcast(key);

        (address token1,) = factory.createToken(_params(
            "Supershot QA One", "SSQ1", 0, 0, actor, true
        ));
        _checkToken(token1, "SSQ1", actor);

        _spend(250_000);
        usdc.approve(FACTORY, 250_000);
        (address token2,, uint256 atomicOut) = factory.createTokenAndBuy(
            _params("Supershot QA Two", "SSQ2", 0, 0, actor, false),
            250_000,
            1
        );
        if (atomicOut == 0) revert AssertionFailed("atomic developer buy");
        usdc.approve(FACTORY, 0);
        _checkToken(token2, "SSQ2", actor);

        (address token3, address curve3Address) = factory.createToken(_params(
            "Supershot QA Three", "SSQ3", 0, 0, actor, false
        ));
        CelestialBondingCurve curve3 = CelestialBondingCurve(curve3Address);
        _marketBuy(curve3, actor, 300_000);
        CelestialToken t3 = CelestialToken(token3);
        uint256 firstPosition = t3.balanceOf(actor);
        uint256 quarter = firstPosition / 4;
        t3.approve(curve3Address, firstPosition);
        uint256 partialQuote = curve3.quoteSell(quarter);
        curve3.sell(quarter, partialQuote * 99 / 100);
        uint256 sellAll = t3.balanceOf(actor);
        uint256 allQuote = curve3.quoteSell(sellAll);
        curve3.sell(sellAll, allQuote * 99 / 100);
        if (t3.balanceOf(actor) != 0) revert AssertionFailed("sell all");

        (address token4, address curve4Address) = factory.createToken(_params(
            "Supershot QA Four", "SSQ4", 0, 100, actor, false
        ));
        CelestialBondingCurve curve4 = CelestialBondingCurve(curve4Address);
        _marketBuy(curve4, actor, 250_000);
        _marketBuy(curve4, actor, 250_000);
        CelestialToken t4 = CelestialToken(token4);
        uint256 holderClaim = t4.withdrawableRewardOf(actor);
        if (holderClaim == 0) revert AssertionFailed("holder reward accrual");
        t4.claimHolderRewards();

        (address token5, address curve5Address) = factory.createToken(_params(
            "Supershot QA Five", "SSQ5", 200, 0, actor, false
        ));
        CelestialBondingCurve curve5 = CelestialBondingCurve(curve5Address);
        _marketBuy(curve5, actor, 250_000);
        CelestialToken t5 = CelestialToken(token5);
        uint256 half5 = t5.balanceOf(actor) / 2;
        t5.approve(curve5Address, half5);
        uint256 quote5 = curve5.quoteSell(half5);
        curve5.sell(half5, quote5 * 99 / 100);
        curve5.sweepFees();
        CelestialFeeEscrow escrow = factory.feeEscrow();
        uint256 creatorClaim = escrow.claimable(USDC, actor);
        if (creatorClaim == 0) revert AssertionFailed("creator fee accrual");
        escrow.claim(USDC);

        (address token6, address curve6Address) = factory.createToken(_params(
            "Supershot QA Six", "SSQ6", 100, 100, actor, true
        ));
        CelestialBondingCurve curve6 = CelestialBondingCurve(curve6Address);
        _marketBuy(curve6, actor, 200_000);

        _spend(150_000);
        usdc.approve(ORDER_BOOK, 150_000);
        uint256 currentBuyQuote = curve6.quoteBuyFor(actor, 150_000);
        uint256 buyOrderId = orderBook.placeBuyOrder(
            curve6Address,
            150_000,
            currentBuyQuote + 1
        );
        if (orderBook.canExecute(buyOrderId)) revert AssertionFailed("non-executable buy limit");
        orderBook.cancel(buyOrderId);
        usdc.approve(ORDER_BOOK, 0);

        CelestialToken t6 = CelestialToken(token6);
        uint256 sellOrderAmount = t6.balanceOf(actor) / 5;
        uint256 currentSellQuote = curve6.quoteSell(sellOrderAmount);
        t6.approve(ORDER_BOOK, sellOrderAmount);
        uint256 sellOrderId = orderBook.placeSellOrder(
            curve6Address,
            sellOrderAmount,
            currentSellQuote + 1
        );
        if (orderBook.canExecute(sellOrderId)) revert AssertionFailed("non-executable sell limit");
        orderBook.cancel(sellOrderId);
        t6.approve(ORDER_BOOK, 0);

        vm.stopBroadcast();

        if (grossNotional > MAX_GROSS_NOTIONAL) revert SpendCapExceeded(grossNotional);
        _checkNativeCap(actor);

        console2.log("E2E_WALLET", actor);
        console2.log("E2E_GROSS_NOTIONAL_MICRO_USDC", grossNotional);
        console2.log("E2E_NATIVE_START", startNative);
        console2.log("E2E_NATIVE_END", actor.balance);
        console2.log("TOKEN_1", token1);
        console2.log("TOKEN_2", token2);
        console2.log("TOKEN_3", token3);
        console2.log("TOKEN_4", token4);
        console2.log("TOKEN_5", token5);
        console2.log("TOKEN_6", token6);
        console2.log("BUY_ORDER_CANCELLED", buyOrderId);
        console2.log("SELL_ORDER_CANCELLED", sellOrderId);
    }

    function _params(
        string memory name,
        string memory symbol,
        uint256 creatorTaxBps,
        uint256 holderFeeBps,
        address actor,
        bool includeSocials
    ) internal pure returns (CelestialLaunchFactory.LaunchParams memory p) {
        p.name = name;
        p.symbol = symbol;
        p.quoteAsset = USDC;
        p.creatorFeeRecipient = actor;
        p.creatorTaxBps = creatorTaxBps;
        p.holderFeeBps = holderFeeBps;
        p.metadata = CelestialLaunchFactory.Metadata({
            description: "Automated capped end-to-end launchpad validation",
            image: "",
            website: includeSocials ? "https://supershot.fun" : "",
            twitter: includeSocials ? "supershotfun" : "",
            telegram: includeSocials ? "t.me/supershotfun" : ""
        });
        p.snipeExemptions = new address[](1);
        p.snipeExemptions[0] = actor;
    }

    function _marketBuy(CelestialBondingCurve curve, address actor, uint256 amount) internal {
        _spend(amount);
        usdc.approve(address(curve), amount);
        uint256 quoted = curve.quoteBuyFor(actor, amount);
        if (quoted == 0) revert AssertionFailed("market buy quote");
        curve.buy(amount, quoted * 99 / 100);
        usdc.approve(address(curve), 0);
        _checkNativeCap(actor);
    }

    function _spend(uint256 amount) internal {
        grossNotional += amount;
        if (grossNotional > MAX_GROSS_NOTIONAL) revert SpendCapExceeded(grossNotional);
    }

    function _checkToken(address token, string memory expectedSymbol, address actor) internal view {
        if (token == address(0)) revert AssertionFailed("token address");
        if (keccak256(bytes(CelestialToken(token).symbol())) != keccak256(bytes(expectedSymbol))) {
            revert AssertionFailed("token symbol");
        }
        if (factory.creatorOf(token) != actor) revert AssertionFailed("creator");
        if (factory.quoteAssetOf(token) != USDC) revert AssertionFailed("quote asset");
    }

    function _checkNativeCap(address actor) internal view {
        uint256 current = actor.balance;
        if (startNative > current && startNative - current > MAX_NATIVE_LOSS) {
            revert SpendCapExceeded(startNative - current);
        }
    }
}
