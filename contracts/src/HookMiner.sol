// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library HookMiner {
    uint160 internal constant FLAG_MASK = (1 << 14) - 1;

    function find(address deployer, uint160 flags, bytes memory creationCode, bytes memory constructorArgs)
        internal
        pure
        returns (address hookAddress, bytes32 salt)
    {
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        bytes32 initCodeHash = keccak256(initCode);
        uint256 nonce;
        while (true) {
            salt = bytes32(nonce);
            hookAddress = _computeAddress(deployer, salt, initCodeHash);
            if (uint160(hookAddress) & FLAG_MASK == flags & FLAG_MASK) break;
            unchecked { nonce++; }
        }
    }

    function _computeAddress(address deployer, bytes32 salt, bytes32 initCodeHash)
        internal
        pure
        returns (address addr)
    {
        assembly {
            let ptr := mload(0x40)
            mstore8(ptr,          0xff)
            mstore(add(ptr, 1),   shl(96, deployer))
            mstore(add(ptr, 21),  salt)
            mstore(add(ptr, 53),  initCodeHash)
            addr := and(keccak256(ptr, 85), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
        }
    }
}
