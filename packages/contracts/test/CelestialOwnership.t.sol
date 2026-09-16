// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialBuybackVault} from "../src/CelestialBuybackVault.sol";

contract CelestialOwnershipTest is Test {
    address internal constant NEXT_OWNER = address(0xBEEF);
    address internal constant KEEPER = address(0xCAFE);
    address internal constant NEXT_KEEPER = address(0xD00D);

    function testBuybackControlFollowsFactoryOwnershipAndInvalidatesOldKeeper() public {
        CelestialLaunchFactory factory = new CelestialLaunchFactory(address(this));
        CelestialBuybackVault vault = factory.buybackVault();

        assertEq(vault.owner(), address(factory));
        assertEq(vault.controller(), address(this));
        assertEq(vault.keeper(), address(0));
        assertEq(vault.keeperController(), address(0));

        vault.setKeeper(KEEPER);
        assertEq(vault.keeper(), KEEPER);
        assertEq(vault.keeperController(), address(this));

        factory.transferOwnership(NEXT_OWNER);
        assertEq(vault.controller(), NEXT_OWNER);

        vm.prank(KEEPER);
        vm.expectRevert(CelestialBuybackVault.NotAuthorized.selector);
        vault.executeCurveBuyback(address(0), 0, 0);

        vm.expectRevert(CelestialBuybackVault.NotAuthorized.selector);
        vault.setKeeper(NEXT_KEEPER);

        vm.prank(NEXT_OWNER);
        vault.setKeeper(NEXT_KEEPER);
        assertEq(vault.keeper(), NEXT_KEEPER);
        assertEq(vault.keeperController(), NEXT_OWNER);
    }
}
