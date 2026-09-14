// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BondingCurveMath} from "./libraries/BondingCurveMath.sol";
import {CelestialFeeEscrow} from "./CelestialFeeEscrow.sol";
import {CelestialToken} from "./CelestialToken.sol";

contract CelestialBondingCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    IERC20 public immutable quoteAsset;
    CelestialFeeEscrow public immutable feeEscrow;
    address public immutable buybackVault;
    address public immutable protocolTreasury;
    address public immutable creator;
    address public immutable creatorFeeRecipient;
    address public immutable factory;

    address public token;
    uint256 public immutable phantomQuote;
    uint256 public immutable graduationThreshold;
    uint256 public immutable feeBps;
    uint256 public immutable protocolShareBps;
    uint256 public immutable buybackShareBps;
    uint256 public immutable creatorTaxBps;
    uint256 public immutable holderFeeBps;
    uint256 public immutable maxSnipeBps;
    uint256 public immutable snipeDuration;
    uint256 public immutable reservedTokens;
    uint256 public immutable launchTimestamp;

    uint256 public trackedQuote;
    uint256 public trackedTokens;
    uint256 public pendingProtocolFees;
    uint256 public pendingCreatorFees;
    uint256 public pendingBuybackFees;

    bool public initialized;
    bool public graduated;

    mapping(address => bool) public snipeExempt;

    error NotFactory();
    error AlreadyInitialized();
    error NotInitialized();
    error InvalidConfig();
    error ZeroAmount();
    error SlippageExceeded();
    error CurveClosed();
    error NotReady();

    event Initialized(address indexed token, uint256 totalSupply);
    event Buy(address indexed trader, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee);
    event Sell(address indexed trader, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee);
    event FeesSwept(uint256 protocolAmount, uint256 creatorAmount, uint256 buybackAmount);
    event HolderFeeDistributed(uint256 amount);
    event GraduationStarted(uint256 quoteAmount, uint256 tokenAmount);

    constructor(
        IERC20 quoteAsset_,
        CelestialFeeEscrow feeEscrow_,
        address buybackVault_,
        address protocolTreasury_,
        address creator_,
        address creatorFeeRecipient_,
        address factory_,
        uint256 phantomQuote_,
        uint256 graduationThreshold_,
        uint256 feeBps_,
        uint256 protocolShareBps_,
        uint256 buybackShareBps_,
        uint256 creatorTaxBps_,
        uint256 holderFeeBps_,
        uint256 maxSnipeBps_,
        uint256 snipeDuration_,
        uint256 reservedTokens_,
        address[] memory snipeExemptions_
    ) {
        if (
            address(quoteAsset_) == address(0) ||
            address(feeEscrow_) == address(0) ||
            buybackVault_ == address(0) ||
            protocolTreasury_ == address(0) ||
            creator_ == address(0) ||
            creatorFeeRecipient_ == address(0) ||
            factory_ == address(0) ||
            phantomQuote_ == 0 ||
            graduationThreshold_ == 0 ||
            feeBps_ + creatorTaxBps_ + holderFeeBps_ + maxSnipeBps_ >= BPS ||
            protocolShareBps_ > BPS ||
            buybackShareBps_ > BPS
        ) revert InvalidConfig();

        quoteAsset = quoteAsset_;
        feeEscrow = feeEscrow_;
        buybackVault = buybackVault_;
        protocolTreasury = protocolTreasury_;
        creator = creator_;
        creatorFeeRecipient = creatorFeeRecipient_;
        factory = factory_;
        phantomQuote = phantomQuote_;
        graduationThreshold = graduationThreshold_;
        feeBps = feeBps_;
        protocolShareBps = protocolShareBps_;
        buybackShareBps = buybackShareBps_;
        creatorTaxBps = creatorTaxBps_;
        holderFeeBps = holderFeeBps_;
        maxSnipeBps = maxSnipeBps_;
        snipeDuration = snipeDuration_;
        reservedTokens = reservedTokens_;
        launchTimestamp = block.timestamp;

        snipeExempt[creator_] = true;
        snipeExempt[creatorFeeRecipient_] = true;
        for (uint256 i; i < snipeExemptions_.length; ++i) {
            if (snipeExemptions_[i] != address(0)) snipeExempt[snipeExemptions_[i]] = true;
        }
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
        emit Initialized(token_, totalSupply);
    }

    function virtualQuoteReserve() public view returns (uint256) {
        return phantomQuote + trackedQuote;
    }

    function sellableTokens() public view returns (uint256) {
        if (trackedTokens <= reservedTokens) return 0;
        return trackedTokens - reservedTokens;
    }

    function currentSnipeBps(address buyer) public view returns (uint256) {
        if (snipeExempt[buyer] || maxSnipeBps == 0 || snipeDuration == 0) return 0;
        uint256 elapsed = block.timestamp > launchTimestamp ? block.timestamp - launchTimestamp : 0;
        if (elapsed >= snipeDuration) return 0;
        return maxSnipeBps * (snipeDuration - elapsed) / snipeDuration;
    }

    function totalBuyFeeBps(address buyer) public view returns (uint256) {
        return feeBps + creatorTaxBps + holderFeeBps + currentSnipeBps(buyer);
    }

    function quoteBuy(uint256 quoteIn) external view returns (uint256) {
        return quoteBuyFor(msg.sender, quoteIn);
    }

    function quoteBuyFor(address buyer, uint256 quoteIn) public view returns (uint256 tokensOut) {
        if (!initialized) revert NotInitialized();
        if (graduated || quoteIn == 0) return 0;

        uint256 remaining = graduationThreshold > trackedQuote ? graduationThreshold - trackedQuote : 0;
        if (remaining == 0) return 0;

        uint256 feeTotal = totalBuyFeeBps(buyer);
        uint256 netBps = BPS - feeTotal;
        uint256 maxGrossInput = remaining * BPS / netBps;
        if (quoteIn > maxGrossInput) quoteIn = maxGrossInput;

        uint256 net = quoteIn * netBps / BPS;
        tokensOut = BondingCurveMath.amountOut(net, virtualQuoteReserve(), trackedTokens, 0);

        uint256 sellable = sellableTokens();
        if (tokensOut > sellable) tokensOut = sellable;
    }

    function quoteSell(uint256 tokenIn) public view returns (uint256 netQuoteOut) {
        if (!initialized) revert NotInitialized();
        uint256 gross = BondingCurveMath.amountOut(tokenIn, trackedTokens, virtualQuoteReserve(), 0);
        if (gross > trackedQuote) gross = trackedQuote;

        uint256 totalFee = gross * (feeBps + creatorTaxBps + holderFeeBps) / BPS;
        netQuoteOut = gross - totalFee;
    }

    function buy(uint256 quoteIn, uint256 minTokensOut) external returns (uint256 tokensOut) {
        return buyFor(msg.sender, quoteIn, minTokensOut);
    }

    function buyFor(address recipient, uint256 quoteIn, uint256 minTokensOut)
        public
        nonReentrant
        returns (uint256 tokensOut)
    {
        if (graduated) revert CurveClosed();
        if (quoteIn == 0 || recipient == address(0)) revert ZeroAmount();

        uint256 remaining = graduationThreshold > trackedQuote ? graduationThreshold - trackedQuote : 0;
        if (remaining == 0) revert CurveClosed();

        uint256 snipeBps = currentSnipeBps(recipient);
        uint256 feeTotalBps = feeBps + creatorTaxBps + holderFeeBps + snipeBps;
        uint256 netBps = BPS - feeTotalBps;
        uint256 maxGrossInput = remaining * BPS / netBps;
        if (quoteIn > maxGrossInput) quoteIn = maxGrossInput;

        tokensOut = quoteBuyFor(recipient, quoteIn);
        if (tokensOut < minTokensOut || tokensOut == 0) revert SlippageExceeded();

        uint256 baseFee = quoteIn * feeBps / BPS;
        uint256 creatorTax = quoteIn * creatorTaxBps / BPS;
        uint256 holderFee = quoteIn * holderFeeBps / BPS;
        uint256 snipeFee = quoteIn * snipeBps / BPS;
        uint256 net = quoteIn - baseFee - creatorTax - holderFee - snipeFee;

        quoteAsset.safeTransferFrom(msg.sender, address(this), quoteIn);

        trackedQuote += net;
        trackedTokens -= tokensOut;
        _accrueBaseFee(baseFee, creatorTax, snipeFee);

        IERC20(token).safeTransfer(recipient, tokensOut);
        _distributeHolderFee(holderFee);

        emit Buy(msg.sender, recipient, quoteIn, tokensOut, baseFee + creatorTax + holderFee + snipeFee);
    }

    function sell(uint256 tokenIn, uint256 minQuoteOut) external returns (uint256 quoteOut) {
        return sellFor(msg.sender, tokenIn, minQuoteOut);
    }

    function sellFor(address recipient, uint256 tokenIn, uint256 minQuoteOut)
        public
        nonReentrant
        returns (uint256 quoteOut)
    {
        if (graduated || readyToGraduate()) revert CurveClosed();
        if (tokenIn == 0 || recipient == address(0)) revert ZeroAmount();

        quoteOut = quoteSell(tokenIn);
        if (quoteOut < minQuoteOut || quoteOut == 0) revert SlippageExceeded();

        uint256 gross = BondingCurveMath.amountOut(tokenIn, trackedTokens, virtualQuoteReserve(), 0);
        if (gross > trackedQuote) gross = trackedQuote;

        uint256 baseFee = gross * feeBps / BPS;
        uint256 creatorTax = gross * creatorTaxBps / BPS;
        uint256 holderFee = gross * holderFeeBps / BPS;

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenIn);
        trackedTokens += tokenIn;
        trackedQuote -= gross;

        _accrueBaseFee(baseFee, creatorTax, 0);
        _distributeHolderFee(holderFee);

        quoteAsset.safeTransfer(recipient, quoteOut);
        emit Sell(msg.sender, recipient, tokenIn, quoteOut, baseFee + creatorTax + holderFee);
    }

    function sweepFees() public nonReentrant {
        uint256 protocolAmount = pendingProtocolFees;
        uint256 creatorAmount = pendingCreatorFees;
        uint256 buybackAmount = pendingBuybackFees;
        uint256 totalEscrow = protocolAmount + creatorAmount;

        if (totalEscrow + buybackAmount == 0) revert ZeroAmount();

        pendingProtocolFees = 0;
        pendingCreatorFees = 0;
        pendingBuybackFees = 0;

        if (totalEscrow > 0) {
            quoteAsset.safeTransfer(address(feeEscrow), totalEscrow);
            if (protocolAmount > 0) feeEscrow.credit(address(quoteAsset), protocolTreasury, protocolAmount);
            if (creatorAmount > 0) feeEscrow.credit(address(quoteAsset), creatorFeeRecipient, creatorAmount);
        }

        if (buybackAmount > 0) quoteAsset.safeTransfer(buybackVault, buybackAmount);
        emit FeesSwept(protocolAmount, creatorAmount, buybackAmount);
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

    function _accrueBaseFee(uint256 baseFee, uint256 creatorTax, uint256 snipeFee) internal {
        uint256 protocolGross = baseFee * protocolShareBps / BPS;
        uint256 buybackFromProtocol = protocolGross * buybackShareBps / BPS;
        pendingBuybackFees += buybackFromProtocol + snipeFee;
        pendingProtocolFees += protocolGross - buybackFromProtocol;
        pendingCreatorFees += (baseFee - protocolGross) + creatorTax;
    }

    function _distributeHolderFee(uint256 amount) internal {
        if (amount == 0) return;
        CelestialToken t = CelestialToken(token);
        if (t.rewardSupply() == 0) {
            pendingBuybackFees += amount;
            return;
        }
        quoteAsset.safeTransfer(token, amount);
        t.notifyReward(amount);
        emit HolderFeeDistributed(amount);
    }
}
