// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICelestialLimitCurve {
    function quoteAsset() external view returns (IERC20);
    function token() external view returns (address);
    function quoteBuyFor(address buyer, uint256 quoteIn) external view returns (uint256);
    function quoteSell(uint256 tokenIn) external view returns (uint256);
    function buyFor(address recipient, uint256 quoteIn, uint256 minTokensOut) external returns (uint256);
    function sellFor(address recipient, uint256 tokenIn, uint256 minQuoteOut) external returns (uint256);
    function graduated() external view returns (bool);
}

contract CelestialLimitOrderBook is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Side { BUY, SELL }

    struct Order {
        address owner;
        address curve;
        Side side;
        uint256 amountIn;
        uint256 minAmountOut;
        bool active;
    }

    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) public orders;

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed owner,
        address indexed curve,
        Side side,
        uint256 amountIn,
        uint256 minAmountOut
    );
    event OrderCancelled(uint256 indexed orderId);
    event OrderFilled(uint256 indexed orderId, uint256 amountOut);

    error InvalidOrder();
    error NotOrderOwner();
    error OrderNotReady();
    error CurveClosed();

    function placeBuyOrder(address curve, uint256 quoteAmount, uint256 minTokensOut)
        external
        nonReentrant
        returns (uint256 orderId)
    {
        if (quoteAmount == 0 || minTokensOut == 0) revert InvalidOrder();
        ICelestialLimitCurve c = ICelestialLimitCurve(curve);
        if (c.graduated()) revert CurveClosed();

        IERC20 quote = c.quoteAsset();
        quote.safeTransferFrom(msg.sender, address(this), quoteAmount);

        orderId = _store(msg.sender, curve, Side.BUY, quoteAmount, minTokensOut);
    }

    function placeSellOrder(address curve, uint256 tokenAmount, uint256 minQuoteOut)
        external
        nonReentrant
        returns (uint256 orderId)
    {
        if (tokenAmount == 0 || minQuoteOut == 0) revert InvalidOrder();
        ICelestialLimitCurve c = ICelestialLimitCurve(curve);
        if (c.graduated()) revert CurveClosed();

        IERC20(c.token()).safeTransferFrom(msg.sender, address(this), tokenAmount);
        orderId = _store(msg.sender, curve, Side.SELL, tokenAmount, minQuoteOut);
    }

    function cancel(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (!order.active) revert InvalidOrder();
        if (msg.sender != order.owner) revert NotOrderOwner();

        order.active = false;
        ICelestialLimitCurve c = ICelestialLimitCurve(order.curve);

        if (order.side == Side.BUY) {
            c.quoteAsset().safeTransfer(order.owner, order.amountIn);
        } else {
            IERC20(c.token()).safeTransfer(order.owner, order.amountIn);
        }
        emit OrderCancelled(orderId);
    }

    function canExecute(uint256 orderId) public view returns (bool) {
        Order memory order = orders[orderId];
        if (!order.active) return false;

        ICelestialLimitCurve c = ICelestialLimitCurve(order.curve);
        if (c.graduated()) return false;

        if (order.side == Side.BUY) {
            return c.quoteBuyFor(order.owner, order.amountIn) >= order.minAmountOut;
        }
        return c.quoteSell(order.amountIn) >= order.minAmountOut;
    }

    function execute(uint256 orderId) external nonReentrant returns (uint256 amountOut) {
        Order storage order = orders[orderId];
        if (!order.active) revert InvalidOrder();
        if (!canExecute(orderId)) revert OrderNotReady();

        order.active = false;
        ICelestialLimitCurve c = ICelestialLimitCurve(order.curve);

        if (order.side == Side.BUY) {
            IERC20 quote = c.quoteAsset();
            quote.forceApprove(order.curve, order.amountIn);
            amountOut = c.buyFor(order.owner, order.amountIn, order.minAmountOut);
            quote.forceApprove(order.curve, 0);
        } else {
            IERC20 token = IERC20(c.token());
            token.forceApprove(order.curve, order.amountIn);
            amountOut = c.sellFor(order.owner, order.amountIn, order.minAmountOut);
            token.forceApprove(order.curve, 0);
        }

        emit OrderFilled(orderId, amountOut);
    }

    function _store(
        address owner,
        address curve,
        Side side,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 orderId) {
        orderId = nextOrderId++;
        orders[orderId] = Order({
            owner: owner,
            curve: curve,
            side: side,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            active: true
        });
        emit OrderPlaced(orderId, owner, curve, side, amountIn, minAmountOut);
    }
}
