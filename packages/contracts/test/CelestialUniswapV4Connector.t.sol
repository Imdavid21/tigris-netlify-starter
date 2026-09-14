// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CelestialUniswapV4Connector} from "../src/CelestialUniswapV4Connector.sol";
import {CelestialDexAdapter} from "../src/CelestialDexAdapter.sol";
import {CelestialV4PriceMath} from "../src/libraries/CelestialV4PriceMath.sol";
import {
    CelestialV4PoolKey,
    CelestialV4ExactInputSingleParams,
    CelestialV4QuoteExactSingleParams,
    ICelestialV4PoolManager,
    ICelestialV4PositionManager,
    ICelestialV4Quoter,
    ICelestialUniversalRouter,
    ICelestialPermit2
} from "../src/interfaces/UniswapV4Minimal.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

interface IMockPermit2Transfer {
    function transferFrom(address from, address to, uint160 amount, address token) external;
}

contract MockGuardHook {}

contract MockPermit2 is ICelestialPermit2 {
    struct Allowance {
        uint160 amount;
        uint48 expiration;
    }

    mapping(address => mapping(address => mapping(address => Allowance))) public allowance;

    function approve(address token, address spender, uint160 amount, uint48 expiration) external {
        allowance[msg.sender][token][spender] = Allowance(amount, expiration);
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        Allowance storage a = allowance[from][token][msg.sender];
        require(a.expiration >= block.timestamp && a.amount >= amount, "permit");
        a.amount -= amount;
        require(IERC20(token).transferFrom(from, to, amount), "pull");
    }
}

contract MockPoolManager is ICelestialV4PoolManager {
    uint160 public initializedPrice;
    bytes32 public initializedPoolId;

    function initialize(CelestialV4PoolKey memory key, uint160 sqrtPriceX96)
        external
        returns (int24 tick)
    {
        initializedPrice = sqrtPriceX96;
        initializedPoolId = keccak256(abi.encode(key));
        return 0;
    }
}

contract MockPositionManager is ICelestialV4PositionManager {
    IMockPermit2Transfer public immutable permit2;
    uint256 public nextId = 1;
    address public lastRecipient;
    uint256 public lastAmount0;
    uint256 public lastAmount1;
    uint256 public consumeBps = 10_000;

    constructor(IMockPermit2Transfer permit2_) {
        permit2 = permit2_;
    }

    function setConsumeBps(uint256 next) external {
        consumeBps = next;
    }

    function nextTokenId() external view returns (uint256) {
        return nextId;
    }

    function modifyLiquidities(bytes calldata unlockData, uint256) external payable {
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        actions;
        (
            CelestialV4PoolKey memory key,
            int24 tickLower,
            int24 tickUpper,
            uint256 liquidity,
            uint256 amount0,
            uint256 amount1,
            address recipient,
            bytes memory hookData
        ) = abi.decode(
            params[0],
            (CelestialV4PoolKey, int24, int24, uint256, uint256, uint256, address, bytes)
        );

        tickLower;
        tickUpper;
        liquidity;
        hookData;
        uint256 consumed0 = amount0 * consumeBps / 10_000;
        uint256 consumed1 = amount1 * consumeBps / 10_000;
        permit2.transferFrom(msg.sender, address(this), uint160(consumed0), key.currency0);
        permit2.transferFrom(msg.sender, address(this), uint160(consumed1), key.currency1);

        lastRecipient = recipient;
        lastAmount0 = consumed0;
        lastAmount1 = consumed1;
        nextId++;
    }
}

contract MockV4Quoter is ICelestialV4Quoter {
    uint256 public numerator = 2;
    uint256 public denominator = 1;

    function setRate(uint256 n, uint256 d) external {
        numerator = n;
        denominator = d;
    }

    function quoteExactInputSingle(CelestialV4QuoteExactSingleParams memory params)
        external
        returns (uint256 amountOut, uint256 gasEstimate)
    {
        amountOut = uint256(params.exactAmount) * numerator / denominator;
        gasEstimate = 100_000;
    }
}

contract MockUniversalRouter is ICelestialUniversalRouter {
    IMockPermit2Transfer public immutable permit2;
    uint256 public numerator = 2;
    uint256 public denominator = 1;
    address public reentryTarget;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(IMockPermit2Transfer permit2_) {
        permit2 = permit2_;
    }

    function setRate(uint256 n, uint256 d) external {
        numerator = n;
        denominator = d;
    }

    function setReentryTarget(address target) external {
        reentryTarget = target;
    }

    function execute(bytes calldata, bytes[] calldata inputs, uint256 deadline) external payable {
        if (reentryTarget != address(0)) {
            reentryAttempted = true;
            (reentrySucceeded,) = reentryTarget.call(
                abi.encodeWithSignature(
                    "swapExactInput(address,address,uint256,uint256,address)",
                    address(1),
                    address(2),
                    uint256(1),
                    uint256(0),
                    address(this)
                )
            );
        }
        require(block.timestamp <= deadline, "deadline");
        (bytes memory actions, bytes[] memory params) = abi.decode(inputs[0], (bytes, bytes[]));
        actions;
        CelestialV4ExactInputSingleParams memory swapParams =
            abi.decode(params[0], (CelestialV4ExactInputSingleParams));

        address tokenIn = swapParams.zeroForOne
            ? swapParams.poolKey.currency0
            : swapParams.poolKey.currency1;
        address tokenOut = swapParams.zeroForOne
            ? swapParams.poolKey.currency1
            : swapParams.poolKey.currency0;

        uint256 amountOut = uint256(swapParams.amountIn) * numerator / denominator;
        require(amountOut >= swapParams.amountOutMinimum, "slippage");

        permit2.transferFrom(msg.sender, address(this), swapParams.amountIn, tokenIn);
        require(IERC20(tokenOut).transfer(msg.sender, amountOut), "out");
    }
}

contract CelestialUniswapV4ConnectorTest is Test {
    MockUSDC token;
    MockUSDC quote;
    MockPermit2 permit2;
    MockPoolManager poolManager;
    MockPositionManager positionManager;
    MockV4Quoter quoter;
    MockUniversalRouter router;
    CelestialUniswapV4Connector connector;
    CelestialDexAdapter adapter;

    address locker = address(0xBEEF);
    address recipient = address(0xCAFE);

    function setUp() public {
        token = new MockUSDC();
        quote = new MockUSDC();
        permit2 = new MockPermit2();
        poolManager = new MockPoolManager();
        positionManager = new MockPositionManager(IMockPermit2Transfer(address(permit2)));
        quoter = new MockV4Quoter();
        router = new MockUniversalRouter(IMockPermit2Transfer(address(permit2)));

        MockGuardHook mockGuard = new MockGuardHook();
        vm.etch(address(0x2000), address(mockGuard).code);

        connector = new CelestialUniswapV4Connector(
            poolManager,
            positionManager,
            quoter,
            router,
            permit2,
            address(0x2000),
            3_000,
            1
        );
        adapter = new CelestialDexAdapter(address(this), connector);

        token.mint(address(this), 10_000_000e6);
        quote.mint(address(this), 10_000_000e6);
        token.mint(address(router), 10_000_000e6);
        quote.mint(address(router), 10_000_000e6);
    }

    function testCreatesPoolAtLockedPriceAndMintsPositionToPermanentLocker() public {
        uint256 tokenAmount = 1_000_000e6;
        uint256 quoteAmount = 250_000e6;
        uint160 sqrtPrice = CelestialV4PriceMath.sqrtPriceX96(
            address(token),
            address(quote),
            4_000_000e6,
            1_000_000e6
        );

        token.approve(address(adapter), tokenAmount);
        quote.approve(address(adapter), quoteAmount);

        (address handle, uint256 positionId) = adapter.createPoolAndLock(
            address(token),
            address(quote),
            tokenAmount,
            quoteAmount,
            sqrtPrice,
            locker
        );

        assertTrue(handle != address(0));
        assertEq(positionId, 1);
        assertEq(poolManager.initializedPrice(), sqrtPrice);
        assertEq(positionManager.lastRecipient(), locker);
        assertEq(token.allowance(address(adapter), address(connector)), 0);
        assertEq(quote.allowance(address(adapter), address(connector)), 0);

        (, bytes32 poolId,,) = connector.poolConfig(handle);
        assertEq(poolId, poolManager.initializedPoolId());
    }

    function testQuotesAndSwapsThroughV4Router() public {
        uint160 sqrtPrice = CelestialV4PriceMath.sqrtPriceX96(
            address(token),
            address(quote),
            1_000_000e6,
            1_000_000e6
        );

        token.approve(address(adapter), 1_000_000e6);
        quote.approve(address(adapter), 1_000_000e6);
        (address handle,) = adapter.createPoolAndLock(
            address(token),
            address(quote),
            1_000_000e6,
            1_000_000e6,
            sqrtPrice,
            locker
        );

        uint256 amountIn = 100e6;
        uint256 quoted = adapter.quoteExactInput(handle, address(quote), amountIn);
        assertEq(quoted, 200e6);

        quote.approve(address(adapter), amountIn);
        uint256 beforeBalance = token.balanceOf(recipient);
        uint256 amountOut = adapter.swapExactInput(
            handle,
            address(quote),
            amountIn,
            190e6,
            recipient
        );

        assertEq(amountOut, 200e6);
        assertEq(token.balanceOf(recipient), beforeBalance + 200e6);
        assertEq(quote.allowance(address(adapter), address(connector)), 0);
        assertEq(quote.allowance(address(connector), address(permit2)), 0);
    }

    function testSwapRevertsOnSlippage() public {
        uint160 sqrtPrice = CelestialV4PriceMath.sqrtPriceX96(
            address(token),
            address(quote),
            1_000_000e6,
            1_000_000e6
        );

        token.approve(address(adapter), 1_000_000e6);
        quote.approve(address(adapter), 1_000_000e6);
        (address handle,) = adapter.createPoolAndLock(
            address(token),
            address(quote),
            1_000_000e6,
            1_000_000e6,
            sqrtPrice,
            locker
        );

        quote.approve(address(adapter), 100e6);
        vm.expectRevert();
        adapter.swapExactInput(handle, address(quote), 100e6, 201e6, recipient);
    }

    function testRejectsInvalidPoolAndToken() public {
        vm.expectRevert(CelestialUniswapV4Connector.UnknownPool.selector);
        connector.quoteExactInput(address(0x1234), address(token), 1e6);
    }

    function testBurnsUnusedTokenAndLocksUnusedQuote() public {
        positionManager.setConsumeBps(8_000);

        uint256 tokenAmount = 1_000_000e6;
        uint256 quoteAmount = 500_000e6;
        uint160 sqrtPrice = CelestialV4PriceMath.sqrtPriceX96(
            address(token),
            address(quote),
            2_000_000e6,
            1_000_000e6
        );

        token.approve(address(adapter), tokenAmount);
        quote.approve(address(adapter), quoteAmount);

        uint256 deadBefore = token.balanceOf(address(0x000000000000000000000000000000000000dEaD));
        uint256 lockerQuoteBefore = quote.balanceOf(locker);

        adapter.createPoolAndLock(
            address(token),
            address(quote),
            tokenAmount,
            quoteAmount,
            sqrtPrice,
            locker
        );

        assertEq(
            token.balanceOf(address(0x000000000000000000000000000000000000dEaD)) - deadBefore,
            tokenAmount / 5
        );
        assertEq(quote.balanceOf(locker) - lockerQuoteBefore, quoteAmount / 5);
        assertEq(token.balanceOf(address(connector)), 0);
        assertEq(quote.balanceOf(address(connector)), 0);
    }


    function testUniversalRouterCannotReenterConnector() public {
        uint160 sqrtPrice = CelestialV4PriceMath.sqrtPriceX96(
            address(token),
            address(quote),
            1_000_000e6,
            1_000_000e6
        );

        token.approve(address(adapter), 1_000_000e6);
        quote.approve(address(adapter), 1_000_000e6);
        (address handle,) = adapter.createPoolAndLock(
            address(token),
            address(quote),
            1_000_000e6,
            1_000_000e6,
            sqrtPrice,
            locker
        );

        router.setReentryTarget(address(connector));

        quote.approve(address(adapter), 100e6);
        uint256 amountOut = adapter.swapExactInput(
            handle,
            address(quote),
            100e6,
            190e6,
            recipient
        );

        assertEq(amountOut, 200e6);
        assertTrue(router.reentryAttempted());
        assertFalse(router.reentrySucceeded());
    }

}
