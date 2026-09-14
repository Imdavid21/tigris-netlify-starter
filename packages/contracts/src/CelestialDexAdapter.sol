// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IGraduationAdapter} from "./interfaces/IGraduationAdapter.sol";
import {ICelestialDexConnector} from "./interfaces/ICelestialDexConnector.sol";

contract CelestialDexAdapter is IGraduationAdapter, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable factory;
    ICelestialDexConnector public immutable connector;

    error NotFactory();
    error ZeroAddress();

    event PoolCreated(address indexed token, address indexed quoteAsset, address indexed pool, uint256 positionId);
    event Swap(
        address indexed trader,
        address indexed pool,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );

    constructor(address factory_, ICelestialDexConnector connector_) {
        if (factory_ == address(0) || address(connector_) == address(0)) revert ZeroAddress();
        factory = factory_;
        connector = connector_;
    }

    function createPoolAndLock(
        address token,
        address quoteAsset,
        uint256 tokenAmount,
        uint256 quoteAmount,
        address locker
    ) external nonReentrant returns (address pool, uint256 positionId) {
        if (msg.sender != factory) revert NotFactory();

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(quoteAsset).safeTransferFrom(msg.sender, address(this), quoteAmount);

        IERC20(token).forceApprove(address(connector), tokenAmount);
        IERC20(quoteAsset).forceApprove(address(connector), quoteAmount);

        (pool, positionId) = connector.createPoolAndLock(
            token,
            quoteAsset,
            tokenAmount,
            quoteAmount,
            locker
        );

        IERC20(token).forceApprove(address(connector), 0);
        IERC20(quoteAsset).forceApprove(address(connector), 0);

        emit PoolCreated(token, quoteAsset, pool, positionId);
    }

    function quoteExactInput(address pool, address tokenIn, uint256 amountIn)
        external
        view
        returns (uint256 amountOut)
    {
        return connector.quoteExactInput(pool, tokenIn, amountIn);
    }

    function swapExactInput(
        address pool,
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external nonReentrant returns (uint256 amountOut) {
        if (recipient == address(0)) revert ZeroAddress();

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(address(connector), amountIn);

        amountOut = connector.swapExactInput(
            pool,
            tokenIn,
            amountIn,
            minAmountOut,
            recipient
        );

        IERC20(tokenIn).forceApprove(address(connector), 0);
        emit Swap(msg.sender, pool, tokenIn, amountIn, amountOut, recipient);
    }
}
