// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CelestialToken} from "./CelestialToken.sol";

interface ICelestialPostGraduationSwap {
    function swapExactInput(
        address pool,
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}

interface ICelestialCurveBuyback {
    function quoteAsset() external view returns (IERC20);
    function token() external view returns (address);
    function buyFor(address recipient, uint256 quoteIn, uint256 minTokensOut)
        external returns (uint256 tokensOut);
}

contract CelestialBuybackVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable owner;
    address public keeper;

    error NotAuthorized();
    error InvalidCurve();

    event KeeperUpdated(address indexed keeper);
    event BuybackExecuted(
        address indexed venue,
        address indexed token,
        address indexed quoteAsset,
        uint256 quoteSpent,
        uint256 tokensBurned,
        bool postGraduation
    );

    constructor(address owner_) {
        owner = owner_;
        keeper = owner_;
    }

    modifier onlyAuthorized() {
        if (msg.sender != owner && msg.sender != keeper) revert NotAuthorized();
        _;
    }

    function setKeeper(address next) external {
        if (msg.sender != owner) revert NotAuthorized();
        keeper = next;
        emit KeeperUpdated(next);
    }

    function executeCurveBuyback(address curve, uint256 quoteAmount, uint256 minTokensOut)
        external
        onlyAuthorized
        nonReentrant
        returns (uint256 tokensBurned)
    {
        ICelestialCurveBuyback c = ICelestialCurveBuyback(curve);
        IERC20 quote = c.quoteAsset();
        address token = c.token();
        if (token == address(0) || address(quote) == address(0)) revert InvalidCurve();

        quote.forceApprove(curve, quoteAmount);
        tokensBurned = c.buyFor(address(this), quoteAmount, minTokensOut);
        quote.forceApprove(curve, 0);

        IERC20(token).safeTransfer(CelestialToken(token).DEAD(), tokensBurned);
        emit BuybackExecuted(curve, token, address(quote), quoteAmount, tokensBurned, false);
    }

    function executePostGraduationBuyback(
        address adapter,
        address pool,
        address quoteAsset,
        address token,
        uint256 quoteAmount,
        uint256 minTokensOut
    ) external onlyAuthorized nonReentrant returns (uint256 tokensBurned) {
        IERC20 quote = IERC20(quoteAsset);
        quote.forceApprove(adapter, quoteAmount);

        tokensBurned = ICelestialPostGraduationSwap(adapter).swapExactInput(
            pool,
            quoteAsset,
            quoteAmount,
            minTokensOut,
            address(this)
        );

        quote.forceApprove(adapter, 0);
        IERC20(token).safeTransfer(CelestialToken(token).DEAD(), tokensBurned);

        emit BuybackExecuted(adapter, token, quoteAsset, quoteAmount, tokensBurned, true);
    }
}
