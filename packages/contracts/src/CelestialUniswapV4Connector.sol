// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICelestialDexConnector} from "./interfaces/ICelestialDexConnector.sol";
import {
    CelestialV4Actions,
    CelestialV4PoolKey,
    CelestialV4ExactInputSingleParams,
    CelestialV4QuoteExactSingleParams,
    ICelestialV4PoolManager,
    ICelestialV4PositionManager,
    ICelestialV4Quoter,
    ICelestialUniversalRouter,
    ICelestialPermit2
} from "./interfaces/UniswapV4Minimal.sol";
import {CelestialV4PoolHandle} from "./CelestialV4PoolHandle.sol";

contract CelestialUniswapV4Connector is ICelestialDexConnector, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant Q96 = 1 << 96;
    uint256 internal constant Q192 = 1 << 192;

    // Official v4 TickMath boundary prices for MIN_TICK/MAX_TICK.
    uint160 internal constant MIN_SQRT_PRICE = 4_295_128_739;
    uint160 internal constant MAX_SQRT_PRICE = 1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_342;
    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = 887272;

    ICelestialV4PoolManager public immutable poolManager;
    ICelestialV4PositionManager public immutable positionManager;
    ICelestialV4Quoter public immutable quoter;
    ICelestialUniversalRouter public immutable universalRouter;
    ICelestialPermit2 public immutable permit2;
    uint24 public immutable lpFee;
    int24 public immutable tickSpacing;

    struct PoolConfig {
        CelestialV4PoolKey key;
        bytes32 poolId;
        address token;
        address quoteAsset;
        bool exists;
    }

    mapping(address => PoolConfig) private pools;

    error ZeroAddress();
    error InvalidConfig();
    error UnknownPool();
    error InvalidTokenIn();
    error InvalidLiquidity();
    error AmountTooLarge();
    error SlippageExceeded();

    event V4PoolCreated(
        address indexed handle,
        bytes32 indexed poolId,
        address indexed token,
        address quoteAsset,
        uint160 sqrtPriceX96,
        uint128 liquidity,
        uint256 positionId
    );

    event V4Swap(
        address indexed handle,
        address indexed tokenIn,
        address indexed recipient,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(
        ICelestialV4PoolManager poolManager_,
        ICelestialV4PositionManager positionManager_,
        ICelestialV4Quoter quoter_,
        ICelestialUniversalRouter universalRouter_,
        ICelestialPermit2 permit2_,
        uint24 lpFee_,
        int24 tickSpacing_
    ) {
        if (
            address(poolManager_) == address(0) ||
            address(positionManager_) == address(0) ||
            address(quoter_) == address(0) ||
            address(universalRouter_) == address(0) ||
            address(permit2_) == address(0)
        ) revert ZeroAddress();
        if (lpFee_ >= 1_000_000 || tickSpacing_ != 1) revert InvalidConfig();

        poolManager = poolManager_;
        positionManager = positionManager_;
        quoter = quoter_;
        universalRouter = universalRouter_;
        permit2 = permit2_;
        lpFee = lpFee_;
        tickSpacing = tickSpacing_;
    }

    function poolConfig(address handle)
        external
        view
        returns (CelestialV4PoolKey memory key, bytes32 poolId, address token, address quoteAsset)
    {
        PoolConfig storage cfg = pools[handle];
        if (!cfg.exists) revert UnknownPool();
        return (cfg.key, cfg.poolId, cfg.token, cfg.quoteAsset);
    }

    function createPoolAndLock(
        address token,
        address quoteAsset,
        uint256 tokenAmount,
        uint256 quoteAmount,
        address locker
    ) external nonReentrant returns (address pool, uint256 positionId) {
        if (token == address(0) || quoteAsset == address(0) || locker == address(0)) revert ZeroAddress();
        if (token == quoteAsset || tokenAmount == 0 || quoteAmount == 0) revert InvalidLiquidity();

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(quoteAsset).safeTransferFrom(msg.sender, address(this), quoteAmount);

        (address currency0, address currency1, uint256 amount0, uint256 amount1) =
            token < quoteAsset
                ? (token, quoteAsset, tokenAmount, quoteAmount)
                : (quoteAsset, token, quoteAmount, tokenAmount);

        CelestialV4PoolKey memory key = CelestialV4PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: lpFee,
            tickSpacing: tickSpacing,
            hooks: address(0)
        });

        uint160 sqrtPriceX96 = _sqrtPriceX96(amount0, amount1);
        poolManager.initialize(key, sqrtPriceX96);

        uint128 liquidity = _fullRangeLiquidity(amount0, amount1, sqrtPriceX96);
        if (liquidity == 0) revert InvalidLiquidity();

        _authorize(currency0, address(positionManager), amount0);
        _authorize(currency1, address(positionManager), amount1);

        positionId = positionManager.nextTokenId();

        bytes memory actions = abi.encodePacked(
            CelestialV4Actions.MINT_POSITION,
            CelestialV4Actions.SETTLE_PAIR,
            CelestialV4Actions.SWEEP,
            CelestialV4Actions.SWEEP
        );
        bytes[] memory params = new bytes[](4);
        params[0] = abi.encode(
            key,
            MIN_TICK,
            MAX_TICK,
            uint256(liquidity),
            amount0,
            amount1,
            locker,
            bytes("")
        );
        params[1] = abi.encode(currency0, currency1);
        params[2] = abi.encode(currency0, address(this));
        params[3] = abi.encode(currency1, address(this));

        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp + 120);

        _revoke(currency0, address(positionManager));
        _revoke(currency1, address(positionManager));

        bytes32 poolId = keccak256(abi.encode(key));
        CelestialV4PoolHandle handle = new CelestialV4PoolHandle(poolId, token, quoteAsset);
        pool = address(handle);

        pools[pool] = PoolConfig({
            key: key,
            poolId: poolId,
            token: token,
            quoteAsset: quoteAsset,
            exists: true
        });

        _permanentlyLockDust(token, locker);
        _permanentlyLockDust(quoteAsset, locker);

        emit V4PoolCreated(pool, poolId, token, quoteAsset, sqrtPriceX96, liquidity, positionId);
    }

    function quoteExactInput(address pool, address tokenIn, uint256 amountIn)
        external
        returns (uint256 amountOut)
    {
        PoolConfig storage cfg = pools[pool];
        if (!cfg.exists) revert UnknownPool();
        if (tokenIn != cfg.key.currency0 && tokenIn != cfg.key.currency1) revert InvalidTokenIn();
        if (amountIn > type(uint128).max) revert AmountTooLarge();

        CelestialV4QuoteExactSingleParams memory params = CelestialV4QuoteExactSingleParams({
            poolKey: cfg.key,
            zeroForOne: tokenIn == cfg.key.currency0,
            exactAmount: uint128(amountIn),
            hookData: bytes("")
        });
        (amountOut,) = quoter.quoteExactInputSingle(params);
    }

    function swapExactInput(
        address pool,
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external nonReentrant returns (uint256 amountOut) {
        PoolConfig storage cfg = pools[pool];
        if (!cfg.exists) revert UnknownPool();
        if (recipient == address(0)) revert ZeroAddress();
        if (tokenIn != cfg.key.currency0 && tokenIn != cfg.key.currency1) revert InvalidTokenIn();
        if (amountIn > type(uint128).max || minAmountOut > type(uint128).max) revert AmountTooLarge();

        address tokenOut = tokenIn == cfg.key.currency0 ? cfg.key.currency1 : cfg.key.currency0;
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        _authorize(tokenIn, address(universalRouter), amountIn);

        uint256 beforeOut = IERC20(tokenOut).balanceOf(address(this));

        CelestialV4ExactInputSingleParams memory swapParams = CelestialV4ExactInputSingleParams({
            poolKey: cfg.key,
            zeroForOne: tokenIn == cfg.key.currency0,
            amountIn: uint128(amountIn),
            amountOutMinimum: uint128(minAmountOut),
            minHopPriceX36: 0,
            hookData: bytes("")
        });

        bytes memory actions = abi.encodePacked(
            CelestialV4Actions.SWAP_EXACT_IN_SINGLE,
            CelestialV4Actions.SETTLE_ALL,
            CelestialV4Actions.TAKE_ALL
        );
        bytes[] memory actionParams = new bytes[](3);
        actionParams[0] = abi.encode(swapParams);
        actionParams[1] = abi.encode(tokenIn, amountIn);
        actionParams[2] = abi.encode(tokenOut, minAmountOut);

        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, actionParams);

        universalRouter.execute(
            abi.encodePacked(CelestialV4Actions.UNIVERSAL_ROUTER_V4_SWAP),
            inputs,
            block.timestamp + 120
        );

        _revoke(tokenIn, address(universalRouter));

        amountOut = IERC20(tokenOut).balanceOf(address(this)) - beforeOut;
        if (amountOut < minAmountOut) revert SlippageExceeded();

        IERC20(tokenOut).safeTransfer(recipient, amountOut);
        emit V4Swap(pool, tokenIn, recipient, amountIn, amountOut);
    }

    function previewInitialPrice(address token, address quoteAsset, uint256 tokenAmount, uint256 quoteAmount)
        external
        pure
        returns (uint160 sqrtPriceX96, bool tokenIsCurrency0)
    {
        if (token == address(0) || quoteAsset == address(0) || token == quoteAsset) revert InvalidConfig();
        tokenIsCurrency0 = token < quoteAsset;
        (uint256 amount0, uint256 amount1) =
            tokenIsCurrency0 ? (tokenAmount, quoteAmount) : (quoteAmount, tokenAmount);
        sqrtPriceX96 = _sqrtPriceX96(amount0, amount1);
    }

    function _sqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160 sqrtPriceX96) {
        if (amount0 == 0 || amount1 == 0) revert InvalidLiquidity();

        uint256 ratioX192 = Math.mulDiv(amount1, Q192, amount0);
        uint256 root = Math.sqrt(ratioX192);
        if (root <= MIN_SQRT_PRICE || root >= MAX_SQRT_PRICE || root > type(uint160).max) {
            revert InvalidLiquidity();
        }
        sqrtPriceX96 = uint160(root);
    }

    function _fullRangeLiquidity(uint256 amount0, uint256 amount1, uint160 sqrtPriceX96)
        internal
        pure
        returns (uint128 liquidity)
    {
        uint256 intermediate = Math.mulDiv(uint256(sqrtPriceX96), uint256(MAX_SQRT_PRICE), Q96);
        uint256 liquidity0 =
            Math.mulDiv(amount0, intermediate, uint256(MAX_SQRT_PRICE) - uint256(sqrtPriceX96));
        uint256 liquidity1 =
            Math.mulDiv(amount1, Q96, uint256(sqrtPriceX96) - uint256(MIN_SQRT_PRICE));
        uint256 value = Math.min(liquidity0, liquidity1);
        if (value == 0 || value > type(uint128).max) revert InvalidLiquidity();
        liquidity = uint128(value);
    }

    function _authorize(address token, address spender, uint256 amount) internal {
        if (amount > type(uint160).max) revert AmountTooLarge();
        IERC20(token).forceApprove(address(permit2), amount);
        permit2.approve(token, spender, uint160(amount), uint48(block.timestamp + 180));
    }

    function _revoke(address token, address spender) internal {
        permit2.approve(token, spender, 0, 0);
        IERC20(token).forceApprove(address(permit2), 0);
    }

    function _permanentlyLockDust(address asset, address locker) internal {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        if (balance > 0) IERC20(asset).safeTransfer(locker, balance);
    }
}
