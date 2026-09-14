// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {
    CelestialPoolGuardHook,
    CelestialPoolGuardHookDeployer
} from "../src/CelestialPoolGuardHook.sol";
import {CelestialV4PoolKey} from "../src/interfaces/UniswapV4Minimal.sol";

contract CelestialPoolGuardHookTest is Test {
    address poolManager = address(0x1111);
    address initializer = address(0x2222);
    address attacker = address(0x3333);

    function testOnlySealedConnectorCanInitializeCelestialPool() public {
        CelestialPoolGuardHookDeployer deployer = new CelestialPoolGuardHookDeployer();
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(CelestialPoolGuardHook).creationCode,
                abi.encode(poolManager, address(this))
            )
        );
        bytes32 salt = _findSalt(address(deployer), initCodeHash);
        CelestialPoolGuardHook hook = deployer.deploy(salt, poolManager, address(this));

        assertEq(uint160(address(hook)) & ((1 << 14) - 1), 1 << 13);
        hook.sealInitializer(initializer);

        CelestialV4PoolKey memory key = CelestialV4PoolKey({
            currency0: address(0x1000),
            currency1: address(0x2000),
            fee: 3_000,
            tickSpacing: 1,
            hooks: address(hook)
        });

        vm.prank(poolManager);
        vm.expectRevert(CelestialPoolGuardHook.UnauthorizedInitializer.selector);
        hook.beforeInitialize(attacker, key, uint160(1 << 96));

        vm.prank(poolManager);
        bytes4 response = hook.beforeInitialize(initializer, key, uint160(1 << 96));
        assertEq(response, hook.beforeInitialize.selector);

        vm.expectRevert(CelestialPoolGuardHook.AlreadySealed.selector);
        hook.sealInitializer(attacker);
    }

    function testRejectsDirectHookCalls() public {
        CelestialPoolGuardHookDeployer deployer = new CelestialPoolGuardHookDeployer();
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(CelestialPoolGuardHook).creationCode,
                abi.encode(poolManager, address(this))
            )
        );
        bytes32 salt = _findSalt(address(deployer), initCodeHash);
        CelestialPoolGuardHook hook = deployer.deploy(salt, poolManager, address(this));
        hook.sealInitializer(initializer);

        CelestialV4PoolKey memory key = CelestialV4PoolKey({
            currency0: address(0x1000),
            currency1: address(0x2000),
            fee: 3_000,
            tickSpacing: 1,
            hooks: address(hook)
        });

        vm.expectRevert(CelestialPoolGuardHook.NotPoolManager.selector);
        hook.beforeInitialize(initializer, key, uint160(1 << 96));
    }

    function _findSalt(address deployer, bytes32 initCodeHash)
        internal
        pure
        returns (bytes32 salt)
    {
        for (uint256 i; i < 200_000; ++i) {
            salt = bytes32(i);
            address predicted = address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                deployer,
                                salt,
                                initCodeHash
                            )
                        )
                    )
                )
            );
            if ((uint160(predicted) & ((1 << 14) - 1)) == (1 << 13)) return salt;
        }
        revert("salt not found");
    }
}
