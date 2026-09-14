// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {CelestialLaunchFactory} from "../src/CelestialLaunchFactory.sol";
import {CelestialDexAdapter} from "../src/CelestialDexAdapter.sol";
import {CelestialUniswapV4Connector} from "../src/CelestialUniswapV4Connector.sol";
import {
    ICelestialV4PoolManager,
    ICelestialV4PositionManager,
    ICelestialV4Quoter,
    ICelestialUniversalRouter,
    ICelestialPermit2
} from "../src/interfaces/UniswapV4Minimal.sol";
import {ICelestialGraduationAdapter} from "../src/interfaces/ICelestialGraduationAdapter.sol";
import {
    CelestialPoolGuardHook,
    CelestialPoolGuardHookDeployer
} from "../src/CelestialPoolGuardHook.sol";

contract DeployCelestialV4Adapter is Script {
    error MissingCode(address target);
    error WrongFactoryOwner(address expected, address actual);

    function run() external returns (CelestialUniswapV4Connector connector, CelestialDexAdapter adapter) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        CelestialLaunchFactory factory = CelestialLaunchFactory(vm.envAddress("CELESTIAL_FACTORY"));

        address poolManager = vm.envAddress("UNISWAP_V4_POOL_MANAGER");
        address positionManager = vm.envAddress("UNISWAP_V4_POSITION_MANAGER");
        address quoter = vm.envAddress("UNISWAP_V4_QUOTER");
        address universalRouter = vm.envAddress("UNISWAP_UNIVERSAL_ROUTER");
        address permit2 = vm.envAddress("UNISWAP_PERMIT2");
        uint24 lpFee = uint24(vm.envOr("CELESTIAL_V4_LP_FEE", uint256(3_000)));

        _requireCode(address(factory));
        _requireCode(poolManager);
        _requireCode(positionManager);
        _requireCode(quoter);
        _requireCode(universalRouter);
        _requireCode(permit2);

        if (factory.owner() != deployer) revert WrongFactoryOwner(deployer, factory.owner());

        vm.startBroadcast(deployerKey);
        CelestialPoolGuardHookDeployer hookDeployer = new CelestialPoolGuardHookDeployer();
        vm.stopBroadcast();

        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(CelestialPoolGuardHook).creationCode,
                abi.encode(poolManager, deployer)
            )
        );
        bytes32 salt = _findHookSalt(address(hookDeployer), initCodeHash);
        address predictedHook = _computeCreate2(address(hookDeployer), salt, initCodeHash);

        vm.startBroadcast(deployerKey);
        CelestialPoolGuardHook hook = hookDeployer.deploy(salt, poolManager, deployer);

        connector = new CelestialUniswapV4Connector(
            ICelestialV4PoolManager(poolManager),
            ICelestialV4PositionManager(positionManager),
            ICelestialV4Quoter(quoter),
            ICelestialUniversalRouter(universalRouter),
            ICelestialPermit2(permit2),
            address(hook),
            lpFee,
            1
        );
        adapter = new CelestialDexAdapter(address(factory), connector);
        hook.sealInitializer(address(connector));
        factory.setGraduationAdapter(ICelestialGraduationAdapter(address(adapter)));

        require(address(hook) == predictedHook, "hook address mismatch");

        vm.stopBroadcast();

        console2.log("CELESTIAL_V4_GUARD_HOOK", address(hook));
        console2.log("CELESTIAL_V4_CONNECTOR", address(connector));
        console2.log("CELESTIAL_DEX_ADAPTER", address(adapter));
        console2.log("UNISWAP_V4_POOL_MANAGER", poolManager);
        console2.log("UNISWAP_V4_POSITION_MANAGER", positionManager);
        console2.log("UNISWAP_V4_QUOTER", quoter);
        console2.log("UNISWAP_UNIVERSAL_ROUTER", universalRouter);
        console2.log("UNISWAP_PERMIT2", permit2);
    }

    function _findHookSalt(address deployer, bytes32 initCodeHash) internal pure returns (bytes32 salt) {
        for (uint256 i; i < type(uint32).max; ++i) {
            salt = bytes32(i);
            address predicted = _computeCreate2(deployer, salt, initCodeHash);
            if ((uint160(predicted) & ((1 << 14) - 1)) == (1 << 13)) return salt;
        }
        revert("hook salt not found");
    }

    function _computeCreate2(address deployer, bytes32 salt, bytes32 initCodeHash)
        internal
        pure
        returns (address)
    {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function _requireCode(address target) internal view {
        if (target == address(0) || target.code.length == 0) revert MissingCode(target);
    }
}
