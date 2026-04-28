// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks}              from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager}        from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey}             from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta}        from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {LPFeeLibrary}        from "v4-core/src/libraries/LPFeeLibrary.sol";
import {StateLibrary}        from "v4-core/src/libraries/StateLibrary.sol";
import {ECDSA}               from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ILInsuranceFund}     from "./ILInsuranceFund.sol";

contract NeuralHook is IHooks {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // ── Fee tiers (bps) ──────────────────────────────────────────────────────
    uint24 public constant FEE_LOW      = 500;
    uint24 public constant FEE_MEDIUM   = 3000;
    uint24 public constant FEE_HIGH     = 7500;
    uint24 public constant FEE_CRITICAL = 10000;

    // ── Risk enum (must match agents/src/types.ts ILRisk index) ─────────────
    uint8 public constant RISK_LOW      = 0;
    uint8 public constant RISK_MEDIUM   = 1;
    uint8 public constant RISK_HIGH     = 2;
    uint8 public constant RISK_CRITICAL = 3;

    IPoolManager     public immutable poolManager;
    ILInsuranceFund  public immutable insuranceFund;
    address          public immutable trustedOracle;
    uint256          public immutable deployedChainId;

    uint24  public currentFee  = FEE_LOW;
    uint8   public currentRisk = RISK_LOW;
    uint256 public lastUpdateTimestamp;

    uint256 public constant MAX_STALENESS = 60; // seconds

    // Entry prices for IL tracking (poolId => sqrtPriceX96 at add-liquidity time)
    mapping(bytes32 => uint160) public entryPrices;

    error OnlyPoolManager();
    error InvalidSignature();
    error StaleInference();
    error InvalidFee();

    event InferenceUpdated(uint8 ilRisk, uint24 fee, bool rebalanceSignal, uint256 timestamp);
    event LiquidityAdded(bytes32 indexed poolId, uint160 sqrtPriceX96);
    event LiquidityRemoved(bytes32 indexed poolId, uint256 ilBps);

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    constructor(address _poolManager, address _oracle, address payable _insuranceFund) {
        poolManager    = IPoolManager(_poolManager);
        trustedOracle  = _oracle;
        insuranceFund  = ILInsuranceFund(_insuranceFund);
        deployedChainId = block.chainid;
    }

    // ── Oracle submission ─────────────────────────────────────────────────────

    function submitConsensusResult(
        bytes32 resultHash,
        uint8   ilRisk,
        uint256 predictedILBps,
        uint24  recommendedFee,
        bool    rebalanceSignal,
        uint8   yieldScore,
        uint256 timestamp,
        bytes calldata signature
    ) external {
        if (block.timestamp > timestamp + MAX_STALENESS) revert StaleInference();
        if (recommendedFee > LPFeeLibrary.MAX_LP_FEE)    revert InvalidFee();

        bytes32 message = keccak256(abi.encodePacked(
            resultHash, ilRisk, predictedILBps, recommendedFee,
            rebalanceSignal, yieldScore, timestamp, deployedChainId, address(this)
        ));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));

        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(ethSigned, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != trustedOracle) revert InvalidSignature();

        currentRisk          = ilRisk;
        currentFee           = recommendedFee;
        lastUpdateTimestamp  = timestamp;

        emit InferenceUpdated(ilRisk, recommendedFee, rebalanceSignal, timestamp);
    }

    // ── IL computation ────────────────────────────────────────────────────────

    function computeIL(uint256 entrySqrtPrice, uint256 exitSqrtPrice) public pure returns (uint256 ilBps) {
        if (entrySqrtPrice == 0 || exitSqrtPrice == 0) return 0;
        uint256 larger  = entrySqrtPrice > exitSqrtPrice ? entrySqrtPrice : exitSqrtPrice;
        uint256 smaller = entrySqrtPrice > exitSqrtPrice ? exitSqrtPrice  : entrySqrtPrice;
        uint256 q   = (larger * 1e18) / smaller;
        uint256 q2  = (q * q) / 1e18;
        uint256 num = 2 * q;
        uint256 den = 1e18 + q2;
        uint256 ratio = (num * 1e18) / den;
        if (ratio >= 1e18) return 0;
        uint256 il = 1e18 - ratio;
        ilBps = (il * 10000) / 1e18;
    }

    // ── IHooks implementation ─────────────────────────────────────────────────

    function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        external
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint24 feeOverride = currentFee | LPFeeLibrary.OVERRIDE_FEE_FLAG;
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, feeOverride);
    }

    function afterSwap(address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata)
        external
        override
        onlyPoolManager
        returns (bytes4, int128)
    {
        return (IHooks.afterSwap.selector, 0);
    }

    function beforeAddLiquidity(address, PoolKey calldata key, ModifyLiquidityParams calldata, bytes calldata)
        external
        override
        onlyPoolManager
        returns (bytes4)
    {
        PoolId poolId = key.toId();
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);
        bytes32 pid = PoolId.unwrap(poolId);
        if (entryPrices[pid] == 0) {
            entryPrices[pid] = sqrtPriceX96;
            emit LiquidityAdded(pid, sqrtPriceX96);
        }
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external
        override
        onlyPoolManager
        returns (bytes4, BalanceDelta)
    {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        override
        onlyPoolManager
        returns (bytes4)
    {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(address lp, PoolKey calldata key, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external
        override
        onlyPoolManager
        returns (bytes4, BalanceDelta)
    {
        PoolId poolId = key.toId();
        bytes32 pid   = PoolId.unwrap(poolId);
        uint160 entry = entryPrices[pid];
        if (entry > 0) {
            (uint160 exitPrice,,,) = poolManager.getSlot0(poolId);
            uint256 ilBps = computeIL(entry, exitPrice);
            emit LiquidityRemoved(pid, ilBps);
            if (ilBps > 100) {
                // Attempt insurance payout; ignore if fund is empty
                try insuranceFund.claim(payable(lp), ilBps, 1 ether) {} catch {}
            }
            delete entryPrices[pid];
        }
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    // ── Unimplemented optional hooks ──────────────────────────────────────────

    function beforeInitialize(address, PoolKey calldata, uint160) external override onlyPoolManager returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external override onlyPoolManager returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external override onlyPoolManager returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external override onlyPoolManager returns (bytes4) {
        return IHooks.afterDonate.selector;
    }
}
