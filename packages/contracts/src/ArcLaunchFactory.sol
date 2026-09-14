// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ArcToken} from "./ArcToken.sol";
import {ArcBondingCurve} from "./ArcBondingCurve.sol";

contract ArcLaunchFactory {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant RESERVED_TOKENS = 200_000_000 ether;

    IERC20 public immutable quoteAsset;
    uint256 public immutable phantomQuote;
    uint256 public immutable graduationThreshold;
    uint256 public immutable feeBps;
    uint256 public immutable protocolShareBps;

    mapping(address => address) public curveOf;
    mapping(address => address) public creatorOf;
    address[] public allTokens;

    event TokenCreated(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol
    );

    constructor(
        IERC20 quoteAsset_,
        uint256 phantomQuote_,
        uint256 graduationThreshold_,
        uint256 feeBps_,
        uint256 protocolShareBps_
    ) {
        quoteAsset = quoteAsset_;
        phantomQuote = phantomQuote_;
        graduationThreshold = graduationThreshold_;
        feeBps = feeBps_;
        protocolShareBps = protocolShareBps_;
    }

    function createToken(
        string calldata name,
        string calldata symbol
    ) external returns (address token, address curve) {
        ArcBondingCurve c = new ArcBondingCurve(
            quoteAsset,
            msg.sender,
            address(this),
            phantomQuote,
            graduationThreshold,
            feeBps,
            protocolShareBps,
            RESERVED_TOKENS
        );

        ArcToken t = new ArcToken(name, symbol, TOTAL_SUPPLY, address(c));
        c.initialize(address(t), TOTAL_SUPPLY);

        token = address(t);
        curve = address(c);
        curveOf[token] = curve;
        creatorOf[token] = msg.sender;
        allTokens.push(token);

        emit TokenCreated(token, curve, msg.sender, name, symbol);
    }

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }
}
