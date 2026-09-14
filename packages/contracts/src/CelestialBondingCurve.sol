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

    struct BuyFees {
        uint256 baseFee;
        uint256 creatorTax;
        uint256 holderFee;
        uint256 snipeFee;
        uint256 net;
    }

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

    struct Config {
        IERC20 quoteAsset;
        CelestialFeeEscrow feeEscrow;
        address buybackVault;
        address protocolTreasury;
        address creator;
        address creatorFeeRecipient;
        address factory;
        uint256 phantomQuote;
        uint256 graduationThreshold;
        uint256 feeBps;
        uint256 protocolShareBps;
        uint256 buybackShareBps;
        uint256 creatorTaxBps;
        uint256 holderFeeBps;
        uint256 maxSnipeBps;
        uint256 snipeDuration;
        uint256 reservedTokens;
    }

    constructor(Config memory cfg, address[] memory snipeExemptions_) {
        if (
            address(cfg.quoteAsset) == address(0) ||
            address(cfg.feeEscrow) == address(0) ||
            cfg.buybackVault == address(0) ||
            cfg.protocolTreasury == address(0) ||
            cfg.creator == address(0) ||
            cfg.creatorFeeRecipient == address(0) ||
            cfg.factory == address(0) ||
            cfg.phantomQuote == 0 ||
            cfg.graduationThreshold == 0 ||
            cfg.feeBps + cfg.creatorTaxBps + cfg.holderFeeBps + cfg.maxSnipeBps >= BPS ||
            cfg.protocolShareBps > BPS ||
            cfg.buybackShareBps > BPS
        ) revert InvalidConfig();

        quoteAsset = cfg.quoteAsset;
        feeEscrow = cfg.feeEscrow;
        buybackVault = cfg.buybackVault;
        protocolTreasury = cfg.protocolTreasury;
        creator = cfg.creator;
        creatorFeeRecipient = cfg.creatorFeeRecipient;
        factory = cfg.factory;
        phantomQuote = cfg.phantomQuote;
        graduationThreshold = cfg.graduationThreshold;
        feeBps = cfg.feeBps;
        protocolShareBps = cfg.protocolShareBps;
        buybackShareBps = cfg.buybackShareBps;
        creatorTaxBps = cfg.creatorTaxBps;
        holderFeeBps = cfg.holderFeeBps;
        maxSnipeBps = cfg.maxSnipeBps;
        snipeDuration = cfg.snipeDuration;
        reservedTokens = cfg.reservedTokens;
        launchTimestamp = block.timestamp;

        snipeExempt[cfg.creator] = true;
        snipeExempt[cfg.creatorFeeRecipient] = true;
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
        if (graduated || readyToGraduate() || tokenIn == 0) return 0;
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

        uint256 netBps = BPS - totalBuyFeeBps(recipient);
        uint256 maxGrossInput = remaining * BPS / netBps;
        if (quoteIn > maxGrossInput) quoteIn = maxGrossInput;

        tokensOut = quoteBuyFor(recipient, quoteIn);
        if (tokensOut < minTokensOut || tokensOut == 0) revert SlippageExceeded();

        BuyFees memory fees = _calculateBuyFees(recipient, quoteIn);
        quoteAsset.safeTransferFrom(msg.sender, address(this), quoteIn);

        trackedQuote += fees.net;
        trackedTokens -= tokensOut;
        _accrueBaseFee(fees.baseFee, fees.creatorTax, fees.snipeFee);

        IERC20(token).safeTransfer(recipient, tokensOut);
        _distributeHolderFee(fees.holderFee);

        emit Buy(
            msg.sender,
            recipient,
            quoteIn,
            tokensOut,
            fees.baseFee + fees.creatorTax + fees.holderFee + fees.snipeFee
        );
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

    function _calculateBuyFees(address recipient, uint256 quoteIn)
        internal
        view
        returns (BuyFees memory fees)
    {
        fees.baseFee = quoteIn * feeBps / BPS;
        fees.creatorTax = quoteIn * creatorTaxBps / BPS;
        fees.holderFee = quoteIn * holderFeeBps / BPS;
        fees.snipeFee = quoteIn * currentSnipeBps(recipient) / BPS;
        fees.net = quoteIn - fees.baseFee - fees.creatorTax - fees.holderFee - fees.snipeFee;
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
