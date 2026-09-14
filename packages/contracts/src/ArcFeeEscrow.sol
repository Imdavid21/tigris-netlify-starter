// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ArcFeeEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable quoteAsset;
    address public immutable factory;

    mapping(address => bool) public approvedCurves;
    mapping(address => uint256) public claimable;

    error NotFactory();
    error NotApprovedCurve();
    error NothingToClaim();
    error ZeroAddress();

    event CurveRegistered(address indexed curve);
    event Credited(address indexed recipient, uint256 amount);
    event Claimed(address indexed recipient, uint256 amount);

    constructor(IERC20 quoteAsset_, address factory_) {
        if (address(quoteAsset_) == address(0) || factory_ == address(0)) revert ZeroAddress();
        quoteAsset = quoteAsset_;
        factory = factory_;
    }

    function registerCurve(address curve) external {
        if (msg.sender != factory) revert NotFactory();
        if (curve == address(0)) revert ZeroAddress();
        approvedCurves[curve] = true;
        emit CurveRegistered(curve);
    }

    function credit(address recipient, uint256 amount) external {
        if (!approvedCurves[msg.sender]) revert NotApprovedCurve();
        if (recipient == address(0)) revert ZeroAddress();
        claimable[recipient] += amount;
        emit Credited(recipient, amount);
    }

    function claim() external nonReentrant returns (uint256 amount) {
        amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();

        claimable[msg.sender] = 0;
        quoteAsset.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }
}
