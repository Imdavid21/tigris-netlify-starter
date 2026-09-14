// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CelestialFeeEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable factory;
    mapping(address => bool) public approvedCurves;
    mapping(address => mapping(address => uint256)) public claimable;

    error NotFactory();
    error NotApprovedCurve();
    error NothingToClaim();
    error ZeroAddress();

    event CurveRegistered(address indexed curve);
    event Credited(address indexed asset, address indexed recipient, uint256 amount);
    event Claimed(address indexed asset, address indexed recipient, uint256 amount);

    constructor(address factory_) {
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
    }

    function registerCurve(address curve) external {
        if (msg.sender != factory) revert NotFactory();
        if (curve == address(0)) revert ZeroAddress();
        approvedCurves[curve] = true;
        emit CurveRegistered(curve);
    }

    function credit(address asset, address recipient, uint256 amount) external {
        if (!approvedCurves[msg.sender]) revert NotApprovedCurve();
        if (asset == address(0) || recipient == address(0)) revert ZeroAddress();
        claimable[asset][recipient] += amount;
        emit Credited(asset, recipient, amount);
    }

    function claim(address asset) external nonReentrant returns (uint256 amount) {
        amount = claimable[asset][msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimable[asset][msg.sender] = 0;
        IERC20(asset).safeTransfer(msg.sender, amount);
        emit Claimed(asset, msg.sender, amount);
    }
}
