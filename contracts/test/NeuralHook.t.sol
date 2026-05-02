// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {PoolManager}   from "v4-core/src/PoolManager.sol";
import {IPoolManager}  from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks}        from "v4-core/src/interfaces/IHooks.sol";
import {SwapParams}    from "v4-core/src/types/PoolOperation.sol";
import {PoolKey}       from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency}      from "v4-core/src/types/Currency.sol";
import {LPFeeLibrary}  from "v4-core/src/libraries/LPFeeLibrary.sol";
import {NeuralHook}    from "../src/NeuralHook.sol";
import {BaseHook}      from "../src/BaseHook.sol";
import {ILInsuranceFund} from "../src/ILInsuranceFund.sol";
import {HookMiner}     from "../src/HookMiner.sol";

contract NeuralHookTest is Test {
    using PoolIdLibrary for PoolKey;

    PoolManager     poolManager;
    NeuralHook      hook;
    ILInsuranceFund fund;

    uint256 constant ORACLE_PK = 0xDEADBEEF1234567890ABCDEF;
    address         oracleAddr;

    uint160 constant FLAGS =
        (1 << 7) |  // BEFORE_SWAP
        (1 << 6) |  // AFTER_SWAP
        (1 << 11)|  // BEFORE_ADD_LIQUIDITY
        (1 << 8);   // AFTER_REMOVE_LIQUIDITY

    function setUp() public {
        vm.warp(1000);
        oracleAddr = vm.addr(ORACLE_PK);
        poolManager = new PoolManager(address(this));

        // Deploy fund owned by test contract; setHook called after hook is deployed
        fund = new ILInsuranceFund(address(this));

        // Mine CREATE2 salt with the real constructor args
        bytes memory args = abi.encode(address(poolManager), oracleAddr, address(fund));
        (, bytes32 salt) = HookMiner.find(address(this), FLAGS, type(NeuralHook).creationCode, args);

        bytes memory initCode = abi.encodePacked(
            type(NeuralHook).creationCode,
            abi.encode(address(poolManager), oracleAddr, address(fund))
        );
        address hookAddr;
        assembly {
            hookAddr := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        hook = NeuralHook(payable(hookAddr));
        fund.setHook(hookAddr);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    function _sign(
        bytes32 resultHash, uint8 ilRisk, uint256 ilBps, uint24 fee,
        bool rebalance, uint8 yieldScore, uint256 ts
    ) internal view returns (bytes memory) {
        bytes32 message = keccak256(abi.encodePacked(
            resultHash, ilRisk, ilBps, fee,
            rebalance, yieldScore, ts, block.chainid, address(hook)
        ));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ORACLE_PK, ethSigned);
        return abi.encodePacked(r, s, v);
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    function test_HookAddressHasCorrectFlags() public view {
        uint160 addr = uint160(address(hook));
        assertEq(addr & HookMiner.FLAG_MASK, FLAGS & HookMiner.FLAG_MASK);
    }

    function test_DefaultFeeIsLow() public view {
        assertEq(hook.currentFee(), hook.FEE_LOW());
    }

    function test_ValidOracleUpdatesFee() public {
        uint256 ts = block.timestamp;
        bytes32 rh = keccak256("test");
        uint24 fee = hook.FEE_HIGH();
        bytes memory sig = _sign(rh, 2, 1500, fee, false, 75, ts);

        hook.submitConsensusResult(rh, 2, 1500, fee, false, 75, ts, sig);

        assertEq(hook.currentFee(), fee);
        assertEq(hook.currentRisk(), 2);
    }

    function test_InvalidSignatureRejected() public {
        uint256 ts = block.timestamp;
        bytes32 rh = keccak256("bad");
        uint24 fee = hook.FEE_MEDIUM();
        bytes memory badSig = new bytes(65); // all zeros

        vm.expectRevert(NeuralHook.InvalidSignature.selector);
        hook.submitConsensusResult(rh, 1, 800, fee, false, 60, ts, badSig);
    }

    function test_OnlyOracleCanSubmitInference() public {
        uint256 ts = block.timestamp;
        bytes32 rh = keccak256("wrong");
        uint24 fee = hook.FEE_MEDIUM();

        // Sign with wrong key
        bytes32 message = keccak256(abi.encodePacked(rh, uint8(1), uint256(800), fee, false, uint8(60), ts, block.chainid, address(hook)));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, ethSigned);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert(NeuralHook.InvalidSignature.selector);
        hook.submitConsensusResult(rh, 1, 800, fee, false, 60, ts, sig);
    }

    function test_StaleInferenceRejected() public {
        bytes32 rh = keccak256("stale");
        uint256 staleTs = block.timestamp - 601; // > MAX_STALENESS (600)
        uint24 fee = hook.FEE_LOW();
        bytes memory sig = _sign(rh, 0, 0, fee, false, 50, staleTs);

        vm.expectRevert(NeuralHook.StaleInference.selector);
        hook.submitConsensusResult(rh, 0, 0, fee, false, 50, staleTs, sig);
    }

    function test_InvalidFeeRejected() public {
        uint256 ts = block.timestamp;
        bytes32 rh = keccak256("bigrisk");
        uint24 badFee = LPFeeLibrary.MAX_LP_FEE + 1;
        bytes memory sig = _sign(rh, 3, 5000, badFee, true, 90, ts);

        vm.expectRevert(NeuralHook.InvalidFee.selector);
        hook.submitConsensusResult(rh, 3, 5000, badFee, true, 90, ts, sig);
    }

    function test_ComputeIL_ZeroWhenNoPriceChange() public view {
        uint256 il = hook.computeIL(1e18, 1e18);
        assertEq(il, 0);
    }

    function test_ComputeIL_PositiveOnPriceChange() public view {
        // sqrtPrice ratio of 2 → price ratio of 4 → IL = 1 - 2*2/(1+4) = 20% = 2000 bps
        uint256 il = hook.computeIL(1e18, 2e18);
        assertGt(il, 1900);
        assertLt(il, 2100);
    }

    function test_ComputeIL_Symmetric() public view {
        uint256 il1 = hook.computeIL(1e18, 2e18);
        uint256 il2 = hook.computeIL(2e18, 1e18);
        assertEq(il1, il2);
    }

    function test_ComputeIL_ZeroInputsReturnZero() public view {
        assertEq(hook.computeIL(0, 1e18), 0);
        assertEq(hook.computeIL(1e18, 0), 0);
    }

    function test_FeeConstants() public view {
        assertEq(hook.FEE_LOW(),      500);
        assertEq(hook.FEE_MEDIUM(),   3000);
        assertEq(hook.FEE_HIGH(),     7500);
        assertEq(hook.FEE_CRITICAL(), 10000);
    }

    function test_ILThresholdIs20Bps() public view {
        assertEq(hook.IL_THRESHOLD_BPS(), 20);
    }

    function test_OnlyPoolManagerCanCallBeforeSwap() public {
        PoolKey memory key;
        key.hooks = IHooks(address(hook));
        key.fee   = LPFeeLibrary.DYNAMIC_FEE_FLAG;

        vm.prank(address(0x1234));
        vm.expectRevert(BaseHook.OnlyPoolManager.selector);
        hook.beforeSwap(address(this), key, SwapParams({zeroForOne: true, amountSpecified: -1e18, sqrtPriceLimitX96: 0}), "");
    }

    function test_OwnerCanUpdateOracle() public {
        address newOracle = address(0xABCD);
        // hook owner is tx.origin which in tests is address(this)
        hook.setOracle(newOracle);
        assertEq(hook.trustedOracle(), newOracle);
    }

    function test_NonOwnerCannotUpdateOracle() public {
        vm.prank(address(0x9999));
        vm.expectRevert(NeuralHook.OnlyOwner.selector);
        hook.setOracle(address(0xABCD));
    }

    function test_PausedHookRejectsSubmission() public {
        hook.setPaused(true);
        uint256 ts = block.timestamp;
        bytes32 rh = keccak256("paused");
        uint24 fee = hook.FEE_LOW();
        bytes memory sig = _sign(rh, 0, 0, fee, false, 50, ts);

        vm.expectRevert(NeuralHook.ContractPaused.selector);
        hook.submitConsensusResult(rh, 0, 0, fee, false, 50, ts, sig);
    }
}
