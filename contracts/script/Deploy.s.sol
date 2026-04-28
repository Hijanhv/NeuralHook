// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey}      from "v4-core/src/types/PoolKey.sol";
import {Currency}     from "v4-core/src/types/Currency.sol";
import {IHooks}       from "v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {NeuralHook}   from "../src/NeuralHook.sol";
import {ILInsuranceFund} from "../src/ILInsuranceFund.sol";
import {HookMiner}    from "../src/HookMiner.sol";

address constant POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;

uint160 constant FLAGS =
    (1 << 7) |   // BEFORE_SWAP
    (1 << 6) |   // AFTER_SWAP
    (1 << 11)|   // BEFORE_ADD_LIQUIDITY
    (1 << 8);    // AFTER_REMOVE_LIQUIDITY

contract DeployScript is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address oracle   = vm.envAddress("ORACLE_ADDRESS");
        uint256 pk       = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);

        // 1. Deploy insurance fund owned by deployer (hook not known yet)
        ILInsuranceFund fund = new ILInsuranceFund(deployer);
        console.log("ILInsuranceFund:", address(fund));

        // 2. Mine CREATE2 salt — args must include real fund address
        bytes memory args = abi.encode(POOL_MANAGER, oracle, address(fund));
        (address hookAddr, bytes32 salt) = HookMiner.find(deployer, FLAGS, type(NeuralHook).creationCode, args);
        console.log("Hook address (mined):", hookAddr);

        // 3. Deploy hook via CREATE2
        bytes memory initCode = abi.encodePacked(type(NeuralHook).creationCode, args);
        address deployed;
        assembly { deployed := create2(0, add(initCode, 0x20), mload(initCode), salt) }
        require(deployed == hookAddr, "CREATE2: address mismatch");
        console.log("NeuralHook deployed:", deployed);

        // 4. Wire the fund to the hook (one-time, locked after this call)
        fund.setHook(deployed);
        console.log("Fund wired to hook");

        // 5. Seed insurance fund with 0.01 ETH
        (bool ok,) = address(fund).call{value: 0.01 ether}("");
        require(ok, "fund seed failed");
        console.log("Fund seeded: 0.01 ETH");

        // 6. Initialize pool — ETH/USDC on Unichain Sepolia with dynamic fee
        PoolKey memory key = PoolKey({
            currency0:   Currency.wrap(address(0)),
            currency1:   Currency.wrap(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238),
            fee:         LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks:       IHooks(deployed)
        });
        uint160 sqrtPriceX96 = 1771595571142957166519155961327389600; // ≈ 1800 USDC/ETH
        IPoolManager(POOL_MANAGER).initialize(key, sqrtPriceX96);
        console.log("Pool initialized");

        vm.stopBroadcast();

        // Print addresses for .env
        console.log("\n=== Copy these to .env ===");
        console.log("HOOK_ADDRESS=%s", deployed);
        console.log("FUND_ADDRESS=%s", address(fund));
    }
}
