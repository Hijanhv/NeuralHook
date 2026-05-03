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

// Foundry's deterministic CREATE2 factory — same address on all EVM chains.
// new Contract{salt: s}() in a broadcast script deploys through this factory.
address constant CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

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

        // 2. Mine CREATE2 salt against the Foundry factory address.
        //    new NeuralHook{salt: s}(...) in a broadcast script routes through
        //    CREATE2_FACTORY, so that is the correct deployer to mine against.
        bytes memory args = abi.encode(POOL_MANAGER, oracle, address(fund));
        (address hookAddr, bytes32 salt) = HookMiner.find(CREATE2_FACTORY, FLAGS, type(NeuralHook).creationCode, args);
        console.log("Hook address (mined):", hookAddr);

        // 3. Deploy hook via CREATE2 using Foundry's factory
        NeuralHook hook = new NeuralHook{salt: salt}(POOL_MANAGER, oracle, payable(address(fund)));
        require(address(hook) == hookAddr, "CREATE2: address mismatch");
        console.log("NeuralHook deployed:", address(hook));

        // 4. Wire the fund to the hook (one-time, locked after this call)
        fund.setHook(address(hook));
        console.log("Fund wired to hook");

        // 5. Seed insurance fund with 0.01 ETH
        (bool ok,) = address(fund).call{value: 0.01 ether}("");
        require(ok, "fund seed failed");
        console.log("Fund seeded: 0.01 ETH");

        // 6. Initialize pool — ETH/USDC on Unichain Sepolia with dynamic fee
        PoolKey memory key = PoolKey({
            currency0:   Currency.wrap(address(0)),
            currency1:   Currency.wrap(0x31d0220469e10c4E71834a79b1f276d740d3768F), // USDC on Unichain Sepolia
            fee:         LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks:       IHooks(address(hook))
        });
        // token0=ETH(18dec), token1=USDC(6dec): sqrtPriceX96 = sqrt(price_raw) * 2^96
        // price_raw = USDC_raw/ETH_raw = 2000 * 1e6 / 1e18 = 2e-9  →  sqrt ≈ 4.47e-5
        uint160 sqrtPriceX96 = 3543191142285914205922034; // ≈ $2000 ETH, token0=ETH
        IPoolManager(POOL_MANAGER).initialize(key, sqrtPriceX96);
        console.log("Pool initialized");

        vm.stopBroadcast();

        console.log("\n=== Copy these to .env ===");
        console.log("HOOK_ADDRESS=%s", address(hook));
        console.log("FUND_ADDRESS=%s", address(fund));
    }
}
