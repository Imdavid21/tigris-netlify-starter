// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CelestialToken} from "./CelestialToken.sol";
import {CelestialBondingCurve} from "./CelestialBondingCurve.sol";
import {CelestialFeeEscrow} from "./CelestialFeeEscrow.sol";
import {CelestialBuybackVault} from "./CelestialBuybackVault.sol";
import {ArcLiquidityLocker} from "./ArcLiquidityLocker.sol";
import {IGraduationAdapter} from "./interfaces/IGraduationAdapter.sol";
import {BondingCurveMath} from "./libraries/BondingCurveMath.sol";

contract CelestialLaunchFactory is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant RESERVED_TOKENS = 200_000_000 ether;
    uint256 public constant MAX_CREATOR_TAX_BPS = 500;
    uint256 public constant MAX_HOLDER_FEE_BPS = 300;
    uint256 public constant MAX_SNIPE_BPS = 9_900;

    address public owner;
    address public protocolTreasury;
    CelestialFeeEscrow public immutable feeEscrow;
    CelestialBuybackVault public immutable buybackVault;
    ArcLiquidityLocker public immutable liquidityLocker;
    IGraduationAdapter public graduationAdapter;

    struct QuoteConfig {
        bool enabled;
        uint256 phantomQuote;
        uint256 graduationThreshold;
        uint256 feeBps;
        uint256 protocolShareBps;
        uint256 buybackShareBps;
        uint256 maxSnipeBps;
        uint256 snipeDuration;
    }

    struct Metadata {
        string description;
        string image;
        string website;
        string twitter;
        string telegram;
    }

    struct LaunchParams {
        string name;
        string symbol;
        address quoteAsset;
        address creatorFeeRecipient;
        uint256 creatorTaxBps;
        uint256 holderFeeBps;
        Metadata metadata;
        address[] snipeExemptions;
    }

    struct Graduation {
        uint256 quoteAmount;
        uint256 tokenAmount;
        address pool;
        uint256 positionId;
        bool swept;
        bool seeded;
    }

    mapping(address => QuoteConfig) public quoteConfigs;
    mapping(address => address) public curveOf;
    mapping(address => address) public creatorOf;
    mapping(address => address) public quoteAssetOf;
    mapping(address => Metadata) private metadataOf;
    mapping(address => Graduation) public graduations;
    address[] public allTokens;

    event QuoteAssetConfigured(address indexed asset, bool enabled, uint256 graduationThreshold);
    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        address quoteAsset,
        string name,
        string symbol,
        address creatorFeeRecipient,
        uint256 creatorTaxBps,
        uint256 holderFeeBps
    );
    event MetadataSet(address indexed token, string description, string image, string website, string twitter, string telegram);
    event DeveloperBuy(address indexed token, address indexed creator, uint256 quoteIn, uint256 tokensOut);
    event GraduationSwept(address indexed token, uint256 quoteAmount, uint256 tokenAmount);
    event TokenGraduated(address indexed token, address indexed pool, uint256 positionId);
    event GraduationAdapterUpdated(address indexed adapter);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProtocolTreasuryUpdated(address indexed treasury);

    error ZeroAddress();
    error InvalidEconomics();
    error InvalidMetadata();
    error NotOwner();
    error QuoteAssetDisabled();
    error UnknownToken();
    error WrongGraduationState();
    error AdapterNotSet();
    error GraduationAssetsNotConsumed();

    constructor(address protocolTreasury_) {
        if (protocolTreasury_ == address(0)) revert ZeroAddress();
        owner = msg.sender;
        protocolTreasury = protocolTreasury_;
        feeEscrow = new CelestialFeeEscrow(address(this));
        buybackVault = new CelestialBuybackVault(msg.sender);
        liquidityLocker = new ArcLiquidityLocker(address(this));
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, next);
        owner = next;
    }

    function setProtocolTreasury(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        protocolTreasury = next;
        emit ProtocolTreasuryUpdated(next);
    }

    function configureQuoteAsset(address asset, QuoteConfig calldata config) external onlyOwner {
        if (
            asset == address(0) ||
            config.phantomQuote == 0 ||
            config.graduationThreshold == 0 ||
            config.feeBps >= 10_000 ||
            config.protocolShareBps > 10_000 ||
            config.buybackShareBps > 10_000 ||
            config.maxSnipeBps > MAX_SNIPE_BPS
        ) revert InvalidEconomics();
        quoteConfigs[asset] = config;
        emit QuoteAssetConfigured(asset, config.enabled, config.graduationThreshold);
    }

    function setGraduationAdapter(IGraduationAdapter adapter) external onlyOwner {
        if (address(adapter) == address(0)) revert ZeroAddress();
        graduationAdapter = adapter;
        emit GraduationAdapterUpdated(address(adapter));
    }

    function getMetadata(address token) external view returns (Metadata memory) {
        return metadataOf[token];
    }

    function previewInitialBuy(
        address quoteAsset,
        uint256 creatorTaxBps,
        uint256 holderFeeBps,
        uint256 quoteIn
    ) external view returns (uint256 tokensOut, uint256 effectiveQuoteIn) {
        QuoteConfig memory q = quoteConfigs[quoteAsset];
        if (!q.enabled || quoteIn == 0) return (0, 0);
        if (
            creatorTaxBps > MAX_CREATOR_TAX_BPS ||
            holderFeeBps > MAX_HOLDER_FEE_BPS
        ) revert InvalidEconomics();

        uint256 feeTotalBps = q.feeBps + creatorTaxBps + holderFeeBps;
        uint256 netBps = 10_000 - feeTotalBps;
        uint256 maxGross = q.graduationThreshold * 10_000 / netBps;
        effectiveQuoteIn = quoteIn > maxGross ? maxGross : quoteIn;

        uint256 net = effectiveQuoteIn * netBps / 10_000;
        tokensOut = BondingCurveMath.amountOut(
            net,
            q.phantomQuote,
            TOTAL_SUPPLY,
            0
        );

        uint256 maxSellable = TOTAL_SUPPLY - RESERVED_TOKENS;
        if (tokensOut > maxSellable) tokensOut = maxSellable;
    }

    function createToken(LaunchParams calldata params)
        external
        nonReentrant
        returns (address token, address curve)
    {
        return _create(params, msg.sender);
    }

    function createTokenAndBuy(
        LaunchParams calldata params,
        uint256 developerBuyQuote,
        uint256 minTokensOut
    ) external nonReentrant returns (address token, address curve, uint256 tokensOut) {
        (token, curve) = _create(params, msg.sender);
        if (developerBuyQuote == 0) return (token, curve, 0);

        IERC20 quote = IERC20(params.quoteAsset);
        quote.safeTransferFrom(msg.sender, address(this), developerBuyQuote);
        quote.forceApprove(curve, developerBuyQuote);
        tokensOut = CelestialBondingCurve(curve).buyFor(msg.sender, developerBuyQuote, minTokensOut);
        quote.forceApprove(curve, 0);

        emit DeveloperBuy(token, msg.sender, developerBuyQuote, tokensOut);
    }

    function _create(LaunchParams calldata params, address creator)
        internal
        returns (address token, address curve)
    {
        if (
            bytes(params.name).length == 0 ||
            bytes(params.name).length > 32 ||
            bytes(params.symbol).length == 0 ||
            bytes(params.symbol).length > 10 ||
            params.quoteAsset == address(0)
        ) revert InvalidMetadata();

        QuoteConfig memory q = quoteConfigs[params.quoteAsset];
        if (!q.enabled) revert QuoteAssetDisabled();
        if (
            params.creatorTaxBps > MAX_CREATOR_TAX_BPS ||
            params.holderFeeBps > MAX_HOLDER_FEE_BPS ||
            q.feeBps + params.creatorTaxBps + params.holderFeeBps + q.maxSnipeBps >= 10_000
        ) revert InvalidEconomics();

        address feeRecipient =
            params.creatorFeeRecipient == address(0) ? creator : params.creatorFeeRecipient;

        CelestialBondingCurve.Config memory curveConfig;
        curveConfig.quoteAsset = IERC20(params.quoteAsset);
        curveConfig.feeEscrow = feeEscrow;
        curveConfig.buybackVault = address(buybackVault);
        curveConfig.protocolTreasury = protocolTreasury;
        curveConfig.creator = creator;
        curveConfig.creatorFeeRecipient = feeRecipient;
        curveConfig.factory = address(this);
        curveConfig.phantomQuote = q.phantomQuote;
        curveConfig.graduationThreshold = q.graduationThreshold;
        curveConfig.feeBps = q.feeBps;
        curveConfig.protocolShareBps = q.protocolShareBps;
        curveConfig.buybackShareBps = q.buybackShareBps;
        curveConfig.creatorTaxBps = params.creatorTaxBps;
        curveConfig.holderFeeBps = params.holderFeeBps;
        curveConfig.maxSnipeBps = q.maxSnipeBps;
        curveConfig.snipeDuration = q.snipeDuration;
        curveConfig.reservedTokens = RESERVED_TOKENS;

        CelestialBondingCurve c =
            new CelestialBondingCurve(curveConfig, params.snipeExemptions);

        CelestialToken t =
            new CelestialToken(params.name, params.symbol, TOTAL_SUPPLY, address(c), IERC20(params.quoteAsset));

        token = address(t);
        curve = address(c);

        feeEscrow.registerCurve(curve);
        c.initialize(token, TOTAL_SUPPLY);

        curveOf[token] = curve;
        creatorOf[token] = creator;
        quoteAssetOf[token] = params.quoteAsset;
        metadataOf[token] = params.metadata;
        allTokens.push(token);

        _emitLaunch(token, curve, creator, feeRecipient, params);
    }

    function _emitLaunch(
        address token,
        address curve,
        address creator,
        address feeRecipient,
        LaunchParams calldata params
    ) internal {
        emit TokenCreated(
            token,
            curve,
            creator,
            params.quoteAsset,
            params.name,
            params.symbol,
            feeRecipient,
            params.creatorTaxBps,
            params.holderFeeBps
        );
        emit MetadataSet(
            token,
            params.metadata.description,
            params.metadata.image,
            params.metadata.website,
            params.metadata.twitter,
            params.metadata.telegram
        );
    }

    function beginGraduation(address token) external nonReentrant {
        address curveAddr = curveOf[token];
        if (curveAddr == address(0)) revert UnknownToken();

        Graduation storage g = graduations[token];
        if (g.swept) revert WrongGraduationState();
        g.swept = true;

        CelestialBondingCurve curve = CelestialBondingCurve(curveAddr);
        if (
            curve.pendingProtocolFees() +
            curve.pendingCreatorFees() +
            curve.pendingBuybackFees() > 0
        ) curve.sweepFees();

        (uint256 quoteAmount, uint256 tokenAmount) = curve.releaseForGraduation(address(this));
        g.quoteAmount = quoteAmount;
        g.tokenAmount = tokenAmount;

        emit GraduationSwept(token, quoteAmount, tokenAmount);
    }

    function createGraduatedPool(address token)
        external
        nonReentrant
        returns (address pool, uint256 positionId)
    {
        Graduation storage g = graduations[token];
        if (!g.swept || g.seeded) revert WrongGraduationState();
        g.seeded = true;

        IGraduationAdapter adapter = graduationAdapter;
        if (address(adapter) == address(0)) revert AdapterNotSet();

        address quoteAsset = quoteAssetOf[token];
        uint256 tokenBalanceBefore = IERC20(token).balanceOf(address(this));
        uint256 quoteBalanceBefore = IERC20(quoteAsset).balanceOf(address(this));

        IERC20(token).forceApprove(address(adapter), g.tokenAmount);
        IERC20(quoteAsset).forceApprove(address(adapter), g.quoteAmount);

        (pool, positionId) = adapter.createPoolAndLock(
            token,
            quoteAsset,
            g.tokenAmount,
            g.quoteAmount,
            address(liquidityLocker)
        );

        if (pool == address(0)) revert ZeroAddress();

        uint256 tokenBalanceAfter = IERC20(token).balanceOf(address(this));
        uint256 quoteBalanceAfter = IERC20(quoteAsset).balanceOf(address(this));
        if (
            tokenBalanceBefore - tokenBalanceAfter != g.tokenAmount ||
            quoteBalanceBefore - quoteBalanceAfter != g.quoteAmount
        ) revert GraduationAssetsNotConsumed();

        IERC20(token).forceApprove(address(adapter), 0);
        IERC20(quoteAsset).forceApprove(address(adapter), 0);

        g.pool = pool;
        g.positionId = positionId;
        liquidityLocker.record(token, address(adapter), pool, positionId);

        emit TokenGraduated(token, pool, positionId);
    }

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }
}
