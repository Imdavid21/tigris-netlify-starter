// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICelestialDexConnector} from "../interfaces/ICelestialDexConnector.sol";

contract MockCelestialDexConnector is ICelestialDexConnector {
    using SafeERC20 for IERC20;

    address public immutable pool = address(0xD3A);
    uint256 public immutable positionId = 42;

    mapping(address => uint256) public priceNumerator;
    mapping(address => uint256) public priceDenominator;
    mapping(address => address) public outputToken;

    function setRate(
        address tokenIn,
        address tokenOut,
        uint256 numerator,
        uint256 denominator
    ) external {
        outputToken[tokenIn] = tokenOut;
        priceNumerator[tokenIn] = numerator;
        priceDenominator[tokenIn] = denominator;
    }

    function createPoolAndLock(
        address token,
        address quoteAsset,
        uint256 tokenAmount,
        uint256 quoteAmount,
        address
    ) external returns (address, uint256) {
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(quoteAsset).safeTransferFrom(msg.sender, address(this), quoteAmount);
        return (pool, positionId);
    }

    function quoteExactInput(
        address,
        address tokenIn,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        uint256 denominator = priceDenominator[tokenIn];
        require(denominator != 0, "rate");
        amountOut = amountIn * priceNumerator[tokenIn] / denominator;
    }

    function swapExactInput(
        address,
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        amountOut = quoteExactInput(address(0), tokenIn, amountIn);
        require(amountOut >= minAmountOut, "slippage");
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(outputToken[tokenIn]).safeTransfer(recipient, amountOut);
    }
}
