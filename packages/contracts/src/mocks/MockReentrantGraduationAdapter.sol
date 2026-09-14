// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGraduationAdapter} from "../interfaces/IGraduationAdapter.sol";

interface IReentryFactory {
    function createGraduatedPool(address token)
        external
        returns (address pool, uint256 positionId);
}

contract MockReentrantGraduationAdapter is IGraduationAdapter {
    using SafeERC20 for IERC20;

    IReentryFactory public immutable factory;
    address public targetToken;
    bool public reentryBlocked;

    constructor(address factory_) {
        factory = IReentryFactory(factory_);
    }

    function setTargetToken(address token) external {
        targetToken = token;
    }

    function createPoolAndLock(
        address token,
        address quoteAsset,
        uint256 tokenAmount,
        uint256 quoteAmount,
        address
    ) external returns (address pool, uint256 positionId) {
        try factory.createGraduatedPool(targetToken) {
            reentryBlocked = false;
        } catch {
            reentryBlocked = true;
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(quoteAsset).safeTransferFrom(msg.sender, address(this), quoteAmount);

        return (address(0x5678), 1);
    }
}
