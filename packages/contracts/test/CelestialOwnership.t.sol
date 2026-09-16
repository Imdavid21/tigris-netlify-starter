// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialBuybackVault} from "../src/CelestialBuybackVault.sol";

contract CelestialOwnershipTest is Test {
    address internal constant NEXT_OWNER = address(0xBEEF);
    address internal constant KEEPER = address(0xCAFE);

    function testBuybackControlFollowsFactoryOwnership() public {
        CelestialLaunchFactory factory = new CelestialLaunchFactory(address(this));
        CelestialBuybackVault vault = factory.buybackVault();

        assertEq(vault.owner(), address(factory));
        assertEq(vault.controller(), address(this));
        assertEq(vault.keeper(), address(0));

        factory.transferOwnership(NEXT_OWNER);
        assertEq(vault.controller(), NEXT_OWNER);

        vm.expectRevert(CelestialBuybackVault.NotAuthorized.selector);
        vault.setKeeper(KEEPER);

        vm.prank(NEXT_OWNER);
        vault.setKeeper(KEEPER);
        assertEq(vault.keeper(), KEEPER);
    }
}
