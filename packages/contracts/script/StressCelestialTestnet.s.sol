// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialBondingCurve} from "../src/CelestialBondingCurve.sol";
import {CelestialToken} from "../src/CelestialToken.sol";
import {CelestialFeeEscrow} from "../src/CelestialFeeEscrow.sol";
import {CelestialBuybackVault} from "../src/CelestialBuybackVault.sol";

/// @notice Signed, onchain stress runner for Arc testnet only.
/// Deploys an isolated current-code Celestial factory, configures native USDC,
/// launches 26 randomized meme markets, then executes 10-15 randomized market
/// actions per launch plus cleanup, fee, reward, and buyback paths.
contract StressCelestialTestnet is Script {
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5_042_002;
    address internal constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    uint256 internal constant LAUNCHES = 26;

    function run() external {
        require(block.chainid == ARC_TESTNET_CHAIN_ID, "ARC TESTNET ONLY");

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address signer = vm.addr(privateKey);
        IERC20 quote = IERC20(ARC_USDC);

        uint256 startQuote = quote.balanceOf(signer);
        require(startQuote >= 2e6, "Need >= 2 USDC testnet balance");

        bytes32 runSeed = keccak256(
            abi.encodePacked(block.timestamp, block.number, signer, startQuote)
        );

        console2.log("STRESS_SIGNER", signer);
        console2.log("STRESS_START_USDC", startQuote);
        console2.logBytes32(runSeed);

        vm.startBroadcast(privateKey);

        CelestialLaunchFactory factory = new CelestialLaunchFactory(signer);
        factory.configureQuoteAsset(
            ARC_USDC,
            CelestialLaunchFactory.QuoteConfig({
                enabled: true,
                phantomQuote: 2_500e6,
                graduationThreshold: 10_000e6,
                feeBps: 100,
                protocolShareBps: 7_500,
                buybackShareBps: 2_000,
                maxSnipeBps: 2_000,
                snipeDuration: 5
            })
        );

        // Used only by the atomic developer-buy launch variants.
        quote.approve(address(factory), type(uint256).max);

        uint256 totalMarketActions;
        uint256 totalBuys;
        uint256 totalSells;
        uint256 totalAtomicLaunches;
        uint256 totalClaims;
        uint256 totalBuybacks;

        for (uint256 i; i < LAUNCHES; ++i) {
            uint256 seed = uint256(keccak256(abi.encodePacked(runSeed, i)));
            CelestialLaunchFactory.LaunchParams memory p = _params(seed, i, signer);

            address token;
            address curve;
            bool atomicLaunch = (seed % 3 == 0);

            if (atomicLaunch) {
                uint256 devBuy = 2_000 + ((seed >> 16) % 18_001); // 0.002-0.020 USDC
                (uint256 preview,) = factory.previewInitialBuy(
                    ARC_USDC,
                    p.creatorTaxBps,
                    p.holderFeeBps,
                    devBuy
                );
                (token, curve,) = factory.createTokenAndBuy(
                    p,
                    devBuy,
                    preview * 95 / 100
                );
                totalAtomicLaunches++;
            } else {
                (token, curve) = factory.createToken(p);
            }

            CelestialBondingCurve market = CelestialBondingCurve(curve);
            CelestialToken launchedToken = CelestialToken(token);

            quote.approve(curve, type(uint256).max);
            launchedToken.approve(curve, type(uint256).max);

            uint256 actionCount = 10 + ((seed >> 24) % 6); // 10-15

            for (uint256 j; j < actionCount; ++j) {
                uint256 r = uint256(keccak256(abi.encodePacked(seed, j, market.trackedQuote())));
                uint256 tokenBalance = launchedToken.balanceOf(signer);
                bool shouldBuy = tokenBalance == 0 || (r % 100 < 58);

                if (shouldBuy) {
                    uint256 quoteIn = 1_000 + ((r >> 32) % 20_001); // 0.001-0.021 USDC
                    uint256 quoted = market.quoteBuyFor(signer, quoteIn);
                    if (quoted > 0) {
                        uint256 slippageBps = 50 + ((r >> 64) % 451); // 0.50%-5.00%
                        market.buy(quoteIn, quoted * (10_000 - slippageBps) / 10_000);
                        totalBuys++;
                    }
                } else {
                    uint256 divisor = 5 + ((r >> 40) % 16); // sell 5%-20% of balance
                    uint256 tokenIn = tokenBalance / divisor;
                    if (tokenIn == 0) tokenIn = tokenBalance;
                    uint256 quoted = market.quoteSell(tokenIn);
                    if (quoted > 0) {
                        uint256 slippageBps = 50 + ((r >> 72) % 451);
                        market.sell(tokenIn, quoted * (10_000 - slippageBps) / 10_000);
                        totalSells++;
                    }
                }

                totalMarketActions++;

                // Exercise allowance-reset and re-approval behavior periodically.
                if (j == 4 && i % 4 == 0) {
                    quote.approve(curve, 0);
                    quote.approve(curve, type(uint256).max);
                }
            }

            // Explicit sell-all cleanup on roughly half the launches.
            if (i % 2 == 0) {
                uint256 remaining = launchedToken.balanceOf(signer);
                uint256 sellAllQuote = market.quoteSell(remaining);
                if (remaining > 0 && sellAllQuote > 0) {
                    market.sell(remaining, sellAllQuote * 95 / 100);
                    totalSells++;
                }
            }

            // Fee sweep and creator claim path.
            if (i % 4 == 0 && market.pendingProtocolFees() + market.pendingCreatorFees() + market.pendingBuybackFees() > 0) {
                market.sweepFees();
                CelestialFeeEscrow escrow = factory.feeEscrow();
                if (escrow.claimable(ARC_USDC, signer) > 0) {
                    escrow.claim(ARC_USDC);
                    totalClaims++;
                }
            }

            // Holder-reward claim path when randomized holder fees produced rewards.
            if (i % 5 == 0 && launchedToken.withdrawableRewardOf(signer) > 0) {
                launchedToken.claimHolderRewards();
                totalClaims++;
            }

            // Buyback-and-burn path against an open curve when funds are available.
            if (i % 6 == 0) {
                if (market.pendingProtocolFees() + market.pendingCreatorFees() + market.pendingBuybackFees() > 0) {
                    market.sweepFees();
                }
                CelestialBuybackVault vault = factory.buybackVault();
                uint256 available = quote.balanceOf(address(vault));
                if (available > 0 && !market.readyToGraduate()) {
                    uint256 spend = available > 1_000 ? available / 2 : available;
                    if (spend > 0) {
                        vault.executeCurveBuyback(curve, spend, 1);
                        totalBuybacks++;
                    }
                }
            }

            console2.log("STRESS_LAUNCH", i + 1);
            console2.log("TOKEN", token);
            console2.log("CURVE", curve);
            console2.log("ACTIONS", actionCount);
            console2.log("ATOMIC", atomicLaunch ? uint256(1) : uint256(0));
        }

        vm.stopBroadcast();

        require(factory.tokenCount() == LAUNCHES, "launch count mismatch");
        require(totalMarketActions >= LAUNCHES * 10, "insufficient market actions");
        require(totalBuys > 0 && totalSells > 0, "missing trade direction");

        console2.log("STRESS_FACTORY", address(factory));
        console2.log("STRESS_LAUNCHES", LAUNCHES);
        console2.log("STRESS_MARKET_ACTIONS", totalMarketActions);
        console2.log("STRESS_BUYS", totalBuys);
        console2.log("STRESS_SELLS", totalSells);
        console2.log("STRESS_ATOMIC_LAUNCHES", totalAtomicLaunches);
        console2.log("STRESS_CLAIMS", totalClaims);
        console2.log("STRESS_BUYBACKS", totalBuybacks);
        console2.log("STRESS_END_USDC", quote.balanceOf(signer));
        console2.log("STRESS_OK", uint256(1));
    }

    function _params(uint256 seed, uint256 i, address signer)
        internal
        pure
        returns (CelestialLaunchFactory.LaunchParams memory p)
    {
        string memory noun = _noun(seed >> 8);
        string memory adjective = _adjective(seed);
        string memory ticker = string.concat(_ticker(seed >> 16), _smallNumber(i));
        string memory tokenName = string.concat(adjective, " ", noun, " ", _smallNumber(i));

        p.name = tokenName;
        p.symbol = ticker;
        p.quoteAsset = ARC_USDC;
        p.creatorFeeRecipient = seed % 5 == 0 ? signer : address(0);
        p.creatorTaxBps = (seed >> 32) % 501;
        p.holderFeeBps = (seed >> 48) % 301;
        p.metadata = CelestialLaunchFactory.Metadata({
            description: string.concat("Arc test meme: ", adjective, " ", noun, ". Stress run #", _smallNumber(i)),
            image: string.concat(
                "https://api.dicebear.com/10.x/",
                _avatarStyle(seed >> 80),
                "/svg?seed=",
                ticker
            ),
            website: i % 4 == 0 ? "" : string.concat("https://example.com/celestial-stress/", _smallNumber(i)),
            twitter: i % 3 == 0 ? "" : string.concat("@arcstress", _smallNumber(i)),
            telegram: i % 5 == 0 ? "" : string.concat("t.me/arcstress", _smallNumber(i))
        });

        uint256 exemptions = (seed >> 96) % 3;
        p.snipeExemptions = new address[](exemptions);
        for (uint256 j; j < exemptions; ++j) {
            p.snipeExemptions[j] = address(uint160(uint256(keccak256(abi.encodePacked(seed, i, j, "exempt")))));
            if (p.snipeExemptions[j] == address(0)) p.snipeExemptions[j] = address(1);
        }
    }

    function _adjective(uint256 r) internal pure returns (string memory) {
        uint256 x = r % 10;
        if (x == 0) return "Cash";
        if (x == 1) return "Neon";
        if (x == 2) return "Diamond";
        if (x == 3) return "Crude";
        if (x == 4) return "Turbo";
        if (x == 5) return "Artificial";
        if (x == 6) return "Green";
        if (x == 7) return "Pixel";
        if (x == 8) return "Moon";
        return "Based";
    }

    function _noun(uint256 r) internal pure returns (string memory) {
        uint256 x = r % 10;
        if (x == 0) return "Cat";
        if (x == 1) return "Inu";
        if (x == 2) return "Bull";
        if (x == 3) return "Blob";
        if (x == 4) return "Tendies";
        if (x == 5) return "Pigeon";
        if (x == 6) return "Hood";
        if (x == 7) return "Frog";
        if (x == 8) return "Mutt";
        return "Coco";
    }

    function _ticker(uint256 r) internal pure returns (string memory) {
        uint256 x = r % 8;
        if (x == 0) return "CAT";
        if (x == 1) return "INU";
        if (x == 2) return "BULL";
        if (x == 3) return "BLOB";
        if (x == 4) return "TEND";
        if (x == 5) return "HOOD";
        if (x == 6) return "FROG";
        return "COCO";
    }

    function _avatarStyle(uint256 r) internal pure returns (string memory) {
        uint256 x = r % 4;
        if (x == 0) return "pixel-art";
        if (x == 1) return "bottts";
        if (x == 2) return "shapes";
        return "identicon";
    }

    function _smallNumber(uint256 value) internal pure returns (string memory) {
        // LAUNCHES is only 26, so a compact local uint-to-string keeps token metadata short.
        if (value < 10) return string(abi.encodePacked(bytes1(uint8(48 + value))));
        uint256 tens = (value / 10) % 10;
        uint256 ones = value % 10;
        return string(abi.encodePacked(bytes1(uint8(48 + tens)), bytes1(uint8(48 + ones))));
    }
}
