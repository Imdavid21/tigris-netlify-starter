// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IGraduationAdapter} from "../interfaces/IGraduationAdapter.sol";

contract MockBadGraduationAdapter is IGraduationAdapter {
    function createPoolAndLock(
        address,
        address,
        uint256,
        uint256,
        address
    ) external pure returns (address pool, uint256 positionId) {
        return (address(0x1234), 1);
    }
}
