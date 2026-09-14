// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal ABI-compatible Uniswap v4 types/interfaces used by Celestial.
/// @dev Kept local so Celestial does not vendor the full Uniswap repos. Struct layouts
/// match the official v4-core/v4-periphery interfaces.
library CelestialV4Actions {
    uint8 internal constant MINT_POSITION = 0x02;
    uint8 internal constant SWAP_EXACT_IN_SINGLE = 0x06;
    uint8 internal constant SETTLE_ALL = 0x0c;
    uint8 internal constant SETTLE_PAIR = 0x0d;
    uint8 internal constant TAKE_ALL = 0x0f;
    uint8 internal constant SWEEP = 0x14;
    uint8 internal constant UNIVERSAL_ROUTER_V4_SWAP = 0x10;
}

struct CelestialV4PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct CelestialV4ExactInputSingleParams {
    CelestialV4PoolKey poolKey;
    bool zeroForOne;
    uint128 amountIn;
    uint128 amountOutMinimum;
    uint256 minHopPriceX36;
    bytes hookData;
}

struct CelestialV4QuoteExactSingleParams {
    CelestialV4PoolKey poolKey;
    bool zeroForOne;
    uint128 exactAmount;
    bytes hookData;
}

interface ICelestialV4PoolManager {
    function initialize(CelestialV4PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
}

interface ICelestialV4PositionManager {
    function nextTokenId() external view returns (uint256);
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
}

interface ICelestialV4Quoter {
    function quoteExactInputSingle(CelestialV4QuoteExactSingleParams memory params)
        external
        returns (uint256 amountOut, uint256 gasEstimate);
}

interface ICelestialUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

interface ICelestialPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}
