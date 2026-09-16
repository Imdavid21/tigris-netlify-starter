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

interface ICelestialFactoryOwner {
    function owner() external view returns (address);
}

contract CelestialBuybackVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Immutable controlling contract. When deployed by CelestialLaunchFactory this is the factory,
    /// so control follows the factory's transferable owner instead of being pinned to the deployer EOA.
    address public immutable owner;
    address public keeper;
    address public keeperController;

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

    constructor(address) {
        owner = msg.sender;
    }

    modifier onlyAuthorized() {
        address currentController = _controller();
        bool keeperIsCurrent =
            msg.sender == keeper && keeper != address(0) && keeperController == currentController;
        if (msg.sender != currentController && !keeperIsCurrent) revert NotAuthorized();
        _;
    }

    function controller() external view returns (address) {
        return _controller();
    }

    function setKeeper(address next) external {
        address currentController = _controller();
        if (msg.sender != currentController) revert NotAuthorized();
        keeper = next;
        keeperController = next == address(0) ? address(0) : currentController;
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

    function _controller() internal view returns (address currentController) {
        // Factory deployments resolve authority dynamically through factory.owner().
        // Standalone deployments safely fall back to the deploying contract/address.
        try ICelestialFactoryOwner(owner).owner() returns (address factoryOwner) {
            if (factoryOwner != address(0)) return factoryOwner;
        } catch {}
        return owner;
    }
}
