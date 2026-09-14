// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CelestialToken is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant MAGNITUDE = 2 ** 128;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address public immutable curve;
    IERC20 public immutable rewardAsset;

    uint256 public magnifiedRewardPerShare;
    uint256 public totalRewardsDistributed;
    mapping(address => int256) private rewardCorrections;
    mapping(address => uint256) public withdrawnRewards;

    error NotCurve();
    error ZeroRewardSupply();
    error NothingToClaim();

    event HolderRewardsDistributed(uint256 amount);
    event HolderRewardsClaimed(address indexed holder, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply_,
        address curve_,
        IERC20 rewardAsset_
    ) ERC20(name_, symbol_) {
        if (curve_ == address(0) || address(rewardAsset_) == address(0)) revert NotCurve();
        curve = curve_;
        rewardAsset = rewardAsset_;
        _mint(curve_, supply_);
    }

    function rewardSupply() public view returns (uint256) {
        return totalSupply() - balanceOf(curve) - balanceOf(DEAD);
    }

    function notifyReward(uint256 amount) external {
        if (msg.sender != curve) revert NotCurve();
        uint256 supply = rewardSupply();
        if (supply == 0 || amount == 0) revert ZeroRewardSupply();
        magnifiedRewardPerShare += amount * MAGNITUDE / supply;
        totalRewardsDistributed += amount;
        emit HolderRewardsDistributed(amount);
    }

    function accumulativeRewardOf(address holder) public view returns (uint256) {
        int256 corrected =
            int256(magnifiedRewardPerShare * balanceOf(holder)) + rewardCorrections[holder];
        if (corrected <= 0) return 0;
        return uint256(corrected) / MAGNITUDE;
    }

    function withdrawableRewardOf(address holder) public view returns (uint256) {
        uint256 total = accumulativeRewardOf(holder);
        uint256 withdrawn = withdrawnRewards[holder];
        return total > withdrawn ? total - withdrawn : 0;
    }

    function claimHolderRewards() external nonReentrant returns (uint256 amount) {
        amount = withdrawableRewardOf(msg.sender);
        if (amount == 0) revert NothingToClaim();
        withdrawnRewards[msg.sender] += amount;
        rewardAsset.safeTransfer(msg.sender, amount);
        emit HolderRewardsClaimed(msg.sender, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);

        int256 correction = int256(magnifiedRewardPerShare * value);
        if (from == address(0)) {
            rewardCorrections[to] -= correction;
        } else if (to == address(0)) {
            rewardCorrections[from] += correction;
        } else {
            rewardCorrections[from] += correction;
            rewardCorrections[to] -= correction;
        }
    }
}
