// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ArcToken} from "./ArcToken.sol";
import {ArcBondingCurve} from "./ArcBondingCurve.sol";
import {ArcFeeEscrow} from "./ArcFeeEscrow.sol";
import {ArcLiquidityLocker} from "./ArcLiquidityLocker.sol";
import {IGraduationAdapter} from "./interfaces/IGraduationAdapter.sol";

contract ArcLaunchFactory is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant RESERVED_TOKENS = 200_000_000 ether;

    IERC20 public immutable quoteAsset;
    ArcFeeEscrow public immutable feeEscrow;
    ArcLiquidityLocker public immutable liquidityLocker;
    address public immutable protocolTreasury;

    address public owner;
    IGraduationAdapter public graduationAdapter;

    uint256 public immutable phantomQuote;
    uint256 public immutable graduationThreshold;
    uint256 public immutable feeBps;
    uint256 public immutable protocolShareBps;

    mapping(address => address) public curveOf;
    mapping(address => address) public creatorOf;
    address[] public allTokens;

    struct Graduation {
        uint256 quoteAmount;
        uint256 tokenAmount;
        address pool;
        uint256 positionId;
        bool swept;
        bool seeded;
    }

    mapping(address => Graduation) public graduations;

    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol
    );
    event GraduationSwept(address indexed token, uint256 quoteAmount, uint256 tokenAmount);
    event TokenGraduated(address indexed token, address indexed pool, uint256 positionId);
    event GraduationAdapterUpdated(address indexed adapter);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ZeroAddress();
    error InvalidEconomics();
    error InvalidMetadata();
    error NotOwner();
    error UnknownToken();
    error WrongGraduationState();
    error AdapterNotSet();
    error GraduationAssetsNotConsumed();

    constructor(
        IERC20 quoteAsset_,
        address protocolTreasury_,
        uint256 phantomQuote_,
        uint256 graduationThreshold_,
        uint256 feeBps_,
        uint256 protocolShareBps_
    ) {
        if (address(quoteAsset_) == address(0) || protocolTreasury_ == address(0)) {
            revert ZeroAddress();
        }
        if (
            phantomQuote_ == 0 ||
            graduationThreshold_ == 0 ||
            feeBps_ >= 10_000 ||
            protocolShareBps_ > 10_000
        ) revert InvalidEconomics();

        quoteAsset = quoteAsset_;
        protocolTreasury = protocolTreasury_;
        phantomQuote = phantomQuote_;
        graduationThreshold = graduationThreshold_;
        feeBps = feeBps_;
        protocolShareBps = protocolShareBps_;

        owner = msg.sender;
        feeEscrow = new ArcFeeEscrow(quoteAsset_, address(this));
        liquidityLocker = new ArcLiquidityLocker(address(this));
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setGraduationAdapter(IGraduationAdapter adapter) external onlyOwner {
        if (address(adapter) == address(0)) revert ZeroAddress();
        graduationAdapter = adapter;
        emit GraduationAdapterUpdated(address(adapter));
    }

    function createToken(string calldata name, string calldata symbol)
        external
        nonReentrant
        returns (address token, address curve)
    {
        if (
            bytes(name).length == 0 ||
            bytes(name).length > 32 ||
            bytes(symbol).length == 0 ||
            bytes(symbol).length > 10
        ) revert InvalidMetadata();

        ArcBondingCurve c = new ArcBondingCurve(
            quoteAsset,
            feeEscrow,
            protocolTreasury,
            msg.sender,
            address(this),
            phantomQuote,
            graduationThreshold,
            feeBps,
            protocolShareBps,
            RESERVED_TOKENS
        );

        ArcToken t = new ArcToken(name, symbol, TOTAL_SUPPLY, address(c));

        feeEscrow.registerCurve(address(c));
        c.initialize(address(t), TOTAL_SUPPLY);

        token = address(t);
        curve = address(c);

        curveOf[token] = curve;
        creatorOf[token] = msg.sender;
        allTokens.push(token);

        emit TokenCreated(token, curve, msg.sender, name, symbol);
    }

    function beginGraduation(address token) external nonReentrant {
        address curveAddr = curveOf[token];
        if (curveAddr == address(0)) revert UnknownToken();

        Graduation storage g = graduations[token];
        if (g.swept) revert WrongGraduationState();

        ArcBondingCurve curve = ArcBondingCurve(curveAddr);

        if (curve.pendingProtocolFees() + curve.pendingCreatorFees() > 0) {
            curve.sweepFees();
        }

        (uint256 quoteAmount, uint256 tokenAmount) =
            curve.releaseForGraduation(address(this));

        g.quoteAmount = quoteAmount;
        g.tokenAmount = tokenAmount;
        g.swept = true;

        emit GraduationSwept(token, quoteAmount, tokenAmount);
    }

    function createGraduatedPool(address token)
        external
        nonReentrant
        returns (address pool, uint256 positionId)
    {
        Graduation storage g = graduations[token];
        if (!g.swept || g.seeded) revert WrongGraduationState();

        IGraduationAdapter adapter = graduationAdapter;
        if (address(adapter) == address(0)) revert AdapterNotSet();

        uint256 tokenBalanceBefore = IERC20(token).balanceOf(address(this));
        uint256 quoteBalanceBefore = quoteAsset.balanceOf(address(this));

        IERC20(token).forceApprove(address(adapter), g.tokenAmount);
        quoteAsset.forceApprove(address(adapter), g.quoteAmount);

        (pool, positionId) = adapter.createPoolAndLock(
            token,
            address(quoteAsset),
            g.tokenAmount,
            g.quoteAmount,
            address(liquidityLocker)
        );

        if (pool == address(0)) revert ZeroAddress();

        uint256 tokenBalanceAfter = IERC20(token).balanceOf(address(this));
        uint256 quoteBalanceAfter = quoteAsset.balanceOf(address(this));

        if (
            tokenBalanceBefore < tokenBalanceAfter ||
            quoteBalanceBefore < quoteBalanceAfter ||
            tokenBalanceBefore - tokenBalanceAfter != g.tokenAmount ||
            quoteBalanceBefore - quoteBalanceAfter != g.quoteAmount
        ) revert GraduationAssetsNotConsumed();

        IERC20(token).forceApprove(address(adapter), 0);
        quoteAsset.forceApprove(address(adapter), 0);

        g.pool = pool;
        g.positionId = positionId;
        g.seeded = true;

        liquidityLocker.record(token, address(adapter), pool, positionId);

        emit TokenGraduated(token, pool, positionId);
    }

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }
}
