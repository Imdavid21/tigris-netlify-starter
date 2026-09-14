// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BondingCurveMath} from "./libraries/BondingCurveMath.sol";
import {ArcFeeEscrow} from "./ArcFeeEscrow.sol";

contract ArcBondingCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    IERC20 public immutable quoteAsset;
    ArcFeeEscrow public immutable feeEscrow;
    address public immutable protocolTreasury;
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
    event FeesSwept(uint256 protocolAmount, uint256 creatorAmount);
    event GraduationStarted(uint256 quoteAmount, uint256 tokenAmount);

    constructor(
        IERC20 quoteAsset_,
        ArcFeeEscrow feeEscrow_,
        address protocolTreasury_,
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
            address(feeEscrow_) == address(0) ||
            protocolTreasury_ == address(0) ||
            creator_ == address(0) ||
            factory_ == address(0) ||
            phantomQuote_ == 0 ||
            graduationThreshold_ == 0 ||
            feeBps_ >= BPS ||
            protocolShareBps_ > BPS
        ) revert InvalidConfig();

        quoteAsset = quoteAsset_;
        feeEscrow = feeEscrow_;
        protocolTreasury = protocolTreasury_;
        creator = creator_;
        factory = factory_;
        phantomQuote = phantomQuote_;
        graduationThreshold = graduationThreshold_;
        feeBps = feeBps_;
        protocolShareBps = protocolShareBps_;
        reservedTokens = reservedTokens_;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    function initialize(address token_, uint256 totalSupply) external onlyFactory {
        if (initialized) revert AlreadyInitialized();
        if (token_ == address(0) || reservedTokens >= totalSupply) revert InvalidConfig();

        token = token_;
        trackedTokens = totalSupply;
        initialized = true;
    }

    function virtualQuoteReserve() public view returns (uint256) {
        return phantomQuote + trackedQuote;
    }

    function sellableTokens() public view returns (uint256) {
        if (trackedTokens <= reservedTokens) return 0;
        return trackedTokens - reservedTokens;
    }

    function quoteBuy(uint256 quoteIn) public view returns (uint256 tokensOut) {
        if (!initialized) revert NotInitialized();

        tokensOut = BondingCurveMath.amountOut(
            quoteIn,
            virtualQuoteReserve(),
            trackedTokens,
            feeBps
        );

        uint256 sellable = sellableTokens();
        if (tokensOut > sellable) tokensOut = sellable;
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

    function buy(uint256 quoteIn, uint256 minTokensOut)
        external
        nonReentrant
        returns (uint256 tokensOut)
    {
        if (graduated) revert CurveClosed();
        if (quoteIn == 0) revert ZeroAmount();

        uint256 remainingQuoteCapacity =
            graduationThreshold > trackedQuote ? graduationThreshold - trackedQuote : 0;
        if (remainingQuoteCapacity == 0) revert CurveClosed();

        uint256 maxGrossInput =
            remainingQuoteCapacity * BPS / (BPS - feeBps);

        if (quoteIn > maxGrossInput) quoteIn = maxGrossInput;

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

    function sell(uint256 tokenIn, uint256 minQuoteOut)
        external
        nonReentrant
        returns (uint256 quoteOut)
    {
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

    function sweepFees() public nonReentrant {
        uint256 protocolAmount = pendingProtocolFees;
        uint256 creatorAmount = pendingCreatorFees;
        uint256 total = protocolAmount + creatorAmount;

        if (total == 0) revert ZeroAmount();

        pendingProtocolFees = 0;
        pendingCreatorFees = 0;

        quoteAsset.safeTransfer(address(feeEscrow), total);

        if (protocolAmount > 0) feeEscrow.credit(protocolTreasury, protocolAmount);
        if (creatorAmount > 0) feeEscrow.credit(creator, creatorAmount);

        emit FeesSwept(protocolAmount, creatorAmount);
    }

    function readyToGraduate() public view returns (bool) {
        return trackedQuote >= graduationThreshold || trackedTokens <= reservedTokens;
    }

    function releaseForGraduation(address recipient)
        external
        onlyFactory
        nonReentrant
        returns (uint256 quoteAmount, uint256 tokenAmount)
    {
        if (!readyToGraduate()) revert NotReady();
        if (graduated) revert CurveClosed();
        if (recipient == address(0)) revert InvalidConfig();

        graduated = true;
        quoteAmount = trackedQuote;
        tokenAmount = trackedTokens;

        trackedQuote = 0;
        trackedTokens = 0;

        quoteAsset.safeTransfer(recipient, quoteAmount);
        IERC20(token).safeTransfer(recipient, tokenAmount);

        emit GraduationStarted(quoteAmount, tokenAmount);
    }

    function _accrueFee(uint256 fee) internal {
        uint256 protocolFee = fee * protocolShareBps / BPS;
        pendingProtocolFees += protocolFee;
        pendingCreatorFees += fee - protocolFee;
    }
}
