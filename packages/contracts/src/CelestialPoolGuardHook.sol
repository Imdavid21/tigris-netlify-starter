// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {CelestialV4PoolKey} from "./interfaces/UniswapV4Minimal.sol";

/// @notice Minimal Uniswap v4 hook that only protects pool initialization.
/// @dev Must be deployed to an address whose low 14 bits equal 0x2000
/// (BEFORE_INITIALIZE_FLAG and no other hook permissions).
contract CelestialPoolGuardHook {
    uint160 public constant BEFORE_INITIALIZE_FLAG = 1 << 13;
    uint160 public constant ALL_HOOK_MASK = (1 << 14) - 1;

    address public immutable poolManager;
    address public immutable owner;
    address public initializer;
    bool public sealed;

    error NotPoolManager();
    error NotOwner();
    error UnauthorizedInitializer();
    error AlreadySealed();
    error InvalidHookAddress();
    error ZeroAddress();

    event InitializerSealed(address indexed initializer);

    constructor(address poolManager_, address owner_) {
        if (poolManager_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        if ((uint160(address(this)) & ALL_HOOK_MASK) != BEFORE_INITIALIZE_FLAG) {
            revert InvalidHookAddress();
        }
        poolManager = poolManager_;
        owner = owner_;
    }

    function sealInitializer(address initializer_) external {
        if (msg.sender != owner) revert NotOwner();
        if (sealed) revert AlreadySealed();
        if (initializer_ == address(0)) revert ZeroAddress();
        initializer = initializer_;
        sealed = true;
        emit InitializerSealed(initializer_);
    }

    function beforeInitialize(
        address sender,
        CelestialV4PoolKey calldata,
        uint160
    ) external view returns (bytes4) {
        if (msg.sender != poolManager) revert NotPoolManager();
        if (!sealed || sender != initializer) revert UnauthorizedInitializer();
        return this.beforeInitialize.selector;
    }
}

contract CelestialPoolGuardHookDeployer {
    function deploy(bytes32 salt, address poolManager, address owner)
        external
        returns (CelestialPoolGuardHook hook)
    {
        hook = new CelestialPoolGuardHook{salt: salt}(poolManager, owner);
    }
}
