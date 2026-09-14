// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BondingCurveMath} from "./libraries/BondingCurveMath.sol";

contract ArcBondingCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    IERC20 public immutable quoteAsset;
    address public immutable factory;
    address public immutable creator;
    address public token;

    uint256 public immutable phantomQuote;
    uint256 public immutable graduationThreshold;
    uint256 public immutable feeBps;
    uint256 public immutable protocolShareBps;
    uint256 public immutable reservedTokens;

    uint256 public trackedQuote;
    uint256 public trackedTokens;
    uint256 public pendingProtocolFees;
    uint256 public pendingCreatorFees;

    bool public initialized;
    bool public graduated;

    error NotFactory();
    error AlreadyInitialized();
    error NotInitialized();
    error InvalidConfig();
    error ZeroAmount();
    error SlippageExceeded();
    error CurveClosed();
    error NotReady();

    event Buy(address indexed trader, uint256 quoteIn, uint256 tokensOut, uint256 fee);
    event Sell(address indexed trader, uint256 tokensIn, uint256 quoteOut, uint256 fee);
    event GraduationStarted(uint256 quoteAmount, uint256 tokenAmount);

    constructor(
        IERC20 quoteAsset_,
        address creator_,
        address factory_,
        uint256 phantomQuote_,
        uint256 graduationThreshold_,
        uint256 feeBps_,
        uint256 protocolShareBps_,
        uint256 reservedTokens_
    ) {
        if (
            address(quoteAsset_) == address(0) ||
            creator_ == address(0) ||
            factory_ == address(0) ||
            phantomQuote_ == 0 ||
            graduationThreshold_ == 0 ||
            feeBps_ >= BPS ||
            protocolShareBps_ > BPS
        ) revert InvalidConfig();

        quoteAsset = quoteAsset_;
        creator = creator_;
        factory = factory_;
        phantomQuote = phantomQuote_;
        graduationThreshold = graduationThreshold_;
        feeBps = feeBps_;
        protocolShareBps = protocolShareBps_;
        reservedTokens = reservedTokens_;
    }

    function initialize(address token_, uint256 totalSupply) external {
        if (msg.sender != factory) revert NotFactory();
        if (initialized) revert AlreadyInitialized();
        if (token_ == address(0) || reservedTokens >= totalSupply) revert InvalidConfig();

        token = token_;
        trackedTokens = totalSupply;
        initialized = true;
    }

    function virtualQuoteReserve() public view returns (uint256) {
        return phantomQuote + trackedQuote;
    }

    function quoteBuy(uint256 quoteIn) public view returns (uint256) {
        if (!initialized) revert NotInitialized();
        uint256 out = BondingCurveMath.amountOut(
            quoteIn,
            virtualQuoteReserve(),
            trackedTokens,
            feeBps
        );
        uint256 sellable = trackedTokens - reservedTokens;
        return out > sellable ? sellable : out;
    }

    function quoteSell(uint256 tokenIn) public view returns (uint256 netQuoteOut) {
        if (!initialized) revert NotInitialized();
        uint256 gross = BondingCurveMath.amountOut(
            tokenIn,
            trackedTokens,
            virtualQuoteReserve(),
            0
        );
        if (gross > trackedQuote) gross = trackedQuote;
        uint256 fee = gross * feeBps / BPS;
        netQuoteOut = gross - fee;
    }

    function buy(uint256 quoteIn, uint256 minTokensOut) external nonReentrant returns (uint256 tokensOut) {
        if (graduated) revert CurveClosed();
        if (quoteIn == 0) revert ZeroAmount();

        tokensOut = quoteBuy(quoteIn);
        if (tokensOut < minTokensOut || tokensOut == 0) revert SlippageExceeded();

        uint256 fee = quoteIn * feeBps / BPS;
        uint256 net = quoteIn - fee;

        quoteAsset.safeTransferFrom(msg.sender, address(this), quoteIn);
        trackedQuote += net;
        trackedTokens -= tokensOut;
        _accrueFee(fee);
        IERC20(token).safeTransfer(msg.sender, tokensOut);

        emit Buy(msg.sender, quoteIn, tokensOut, fee);
    }

    function sell(uint256 tokenIn, uint256 minQuoteOut) external nonReentrant returns (uint256 quoteOut) {
        if (graduated) revert CurveClosed();
        if (tokenIn == 0) revert ZeroAmount();

        quoteOut = quoteSell(tokenIn);
        if (quoteOut < minQuoteOut || quoteOut == 0) revert SlippageExceeded();

        uint256 gross = BondingCurveMath.amountOut(
            tokenIn,
            trackedTokens,
            virtualQuoteReserve(),
            0
        );
        if (gross > trackedQuote) gross = trackedQuote;
        uint256 fee = gross - quoteOut;

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenIn);
        trackedTokens += tokenIn;
        trackedQuote -= gross;
        _accrueFee(fee);
        quoteAsset.safeTransfer(msg.sender, quoteOut);

        emit Sell(msg.sender, tokenIn, quoteOut, fee);
    }

    function readyToGraduate() public view returns (bool) {
        return trackedQuote >= graduationThreshold || trackedTokens <= reservedTokens;
    }

    function beginGraduation() external returns (uint256 quoteAmount, uint256 tokenAmount) {
        if (!readyToGraduate()) revert NotReady();
        if (graduated) revert CurveClosed();

        graduated = true;
        quoteAmount = trackedQuote;
        tokenAmount = trackedTokens;
        emit GraduationStarted(quoteAmount, tokenAmount);
    }

    function _accrueFee(uint256 fee) internal {
        uint256 protocolFee = fee * protocolShareBps / BPS;
        pendingProtocolFees += protocolFee;
        pendingCreatorFees += fee - protocolFee;
    }
}
