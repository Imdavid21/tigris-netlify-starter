// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ArcToken is ERC20 {
    address public immutable curve;

    error ZeroAddress();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply_,
        address curve_
    ) ERC20(name_, symbol_) {
        if (curve_ == address(0)) revert ZeroAddress();
        curve = curve_;
        _mint(curve_, supply_);
    }
}
