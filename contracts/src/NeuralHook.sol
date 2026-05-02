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
import {BaseHook}            from "./BaseHook.sol";
import {ILInsuranceFund}     from "./ILInsuranceFund.sol";

contract NeuralHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using StateLibrary  for IPoolManager;

    // ── Fee tiers (pips = 1/1,000,000) ──────────────────────────────────────
    uint24 public constant FEE_LOW      = 500;    // 0.05%
    uint24 public constant FEE_MEDIUM   = 3000;   // 0.30%
    uint24 public constant FEE_HIGH     = 7500;   // 0.75%
    uint24 public constant FEE_CRITICAL = 10000;  // 1.00%

    // ── Risk enum (must match agents/src/types.ts ILRisk index) ─────────────
    uint8 public constant RISK_LOW      = 0;
    uint8 public constant RISK_MEDIUM   = 1;
    uint8 public constant RISK_HIGH     = 2;
    uint8 public constant RISK_CRITICAL = 3;

    ILInsuranceFund public immutable insuranceFund;
    uint256         public immutable deployedChainId;

    address public owner;
    address public trustedOracle;
    bool    public paused;

    uint24  public currentFee  = FEE_LOW;
    uint8   public currentRisk = RISK_LOW;
    uint256 public lastUpdateTimestamp;

    // Inference results older than 10 minutes are rejected
    uint256 public constant MAX_STALENESS = 600;

    // IL payout threshold: 20 bps = 0.2%
    uint256 public constant IL_THRESHOLD_BPS = 20;

    // ── Per-LP position tracking ──────────────────────────────────────────────
    // poolId → LP → entry sqrtPriceX96
    mapping(bytes32 => mapping(address => uint160)) public entryPrices;
    // poolId → LP → position value (wei approximation)
    mapping(bytes32 => mapping(address => uint256)) public positionValues;
    // poolId → LP → entry tick range
    mapping(bytes32 => mapping(address => int24))   public entryTickLowers;
    mapping(bytes32 => mapping(address => int24))   public entryTickUppers;

    // ── Insurance fund fee accrual ────────────────────────────────────────────
    // Tracks 5% of LP fees earned per pool (in token0 units / pips).
    // The keeper calls settleFundFee() periodically to forward accrued ETH to the fund.
    mapping(bytes32 => uint128) public pendingFundFees;

    // ── Errors ────────────────────────────────────────────────────────────────
    error OnlyOwner();
    error InvalidSignature();
    error StaleInference();
    error InvalidFee();
    error ContractPaused();

    // ── Events ────────────────────────────────────────────────────────────────
    event InferenceUpdated(uint8 ilRisk, uint24 fee, bool rebalanceSignal, uint256 timestamp);
    event LiquidityAdded(bytes32 indexed poolId, address indexed lp, uint160 sqrtPriceX96, int24 tickLower, int24 tickUpper);
    event LiquidityRemoved(bytes32 indexed poolId, address indexed lp, uint256 ilBps);
    event FeeAccrued(bytes32 indexed poolId, uint128 amount);
    event FeeSettled(bytes32 indexed poolId, uint256 ethAmount);
    event OracleUpdated(address indexed newOracle);
    event Paused(bool paused);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    constructor(address _poolManager, address _oracle, address payable _insuranceFund)
        BaseHook(_poolManager)
    {
        trustedOracle   = _oracle;
        insuranceFund   = ILInsuranceFund(_insuranceFund);
        deployedChainId = block.chainid;
        owner           = msg.sender;
    }

    receive() external payable {}

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setOracle(address _oracle) external onlyOwner {
        trustedOracle = _oracle;
        emit OracleUpdated(_oracle);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
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
    ) external whenNotPaused {
        if (block.timestamp > timestamp + MAX_STALENESS) revert StaleInference();
        if (recommendedFee > LPFeeLibrary.MAX_LP_FEE)    revert InvalidFee();

        bytes32 message = keccak256(abi.encodePacked(
            resultHash, ilRisk, predictedILBps, recommendedFee,
            rebalanceSignal, yieldScore, timestamp, deployedChainId, address(this)
        ));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));

        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(ethSigned, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != trustedOracle) revert InvalidSignature();

        currentRisk         = ilRisk;
        currentFee          = recommendedFee;
        lastUpdateTimestamp = timestamp;

        emit InferenceUpdated(ilRisk, recommendedFee, rebalanceSignal, timestamp);
    }

    // ── IL computation ────────────────────────────────────────────────────────
    // Formula: IL = 1 - 2√k/(1+k) where k = exitPrice/entryPrice

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

    // ── Insurance fund fee settlement ─────────────────────────────────────────
    // Keeper sends ETH equal to accrued fund fees; the hook forwards it to the fund.

    function settleFundFee(bytes32 poolId) external payable {
        uint128 pending = pendingFundFees[poolId];
        pendingFundFees[poolId] = 0;
        uint256 amount = msg.value;
        (bool ok,) = address(insuranceFund).call{value: amount}("");
        require(ok, "fund transfer failed");
        emit FeeSettled(poolId, amount);
    }

    // ── Hook callbacks ────────────────────────────────────────────────────────

    function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        external override onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        // Return dynamic fee override based on latest AI-determined IL risk
        uint24 feeOverride = currentFee | LPFeeLibrary.OVERRIDE_FEE_FLAG;
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, feeOverride);
    }

    function afterSwap(address, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta, bytes calldata)
        external override onlyPoolManager
        returns (bytes4, int128)
    {
        // Track 5% of LP fee → insurance fund accrual
        // Use the input token amount (zeroForOne: token0 in, else token1 in)
        int128 inputAmount = params.zeroForOne ? delta.amount0() : delta.amount1();
        if (inputAmount != 0) {
            uint128 abs = inputAmount > 0 ? uint128(inputAmount) : uint128(-inputAmount);
            uint128 lpFee    = uint128(uint256(abs) * currentFee / 1_000_000);
            uint128 fundShare = lpFee / 20; // 5% of LP fee
            if (fundShare > 0) {
                bytes32 pid = PoolId.unwrap(key.toId());
                pendingFundFees[pid] += fundShare;
                emit FeeAccrued(pid, fundShare);
            }
        }
        return (IHooks.afterSwap.selector, 0);
    }

    function beforeAddLiquidity(address lp, PoolKey calldata key, ModifyLiquidityParams calldata params, bytes calldata)
        external override onlyPoolManager
        returns (bytes4)
    {
        PoolId poolId = key.toId();
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);
        bytes32 pid = PoolId.unwrap(poolId);

        if (entryPrices[pid][lp] == 0) {
            entryPrices[pid][lp]     = sqrtPriceX96;
            entryTickLowers[pid][lp] = params.tickLower;
            entryTickUppers[pid][lp] = params.tickUpper;

            int256 liq = params.liquidityDelta;
            uint256 posVal = liq > 0
                ? (uint256(liq) * sqrtPriceX96) >> 96
                : 1e17;
            positionValues[pid][lp] = posVal;

            emit LiquidityAdded(pid, lp, sqrtPriceX96, params.tickLower, params.tickUpper);
        }
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterRemoveLiquidity(address lp, PoolKey calldata key, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external override onlyPoolManager
        returns (bytes4, BalanceDelta)
    {
        PoolId poolId = key.toId();
        bytes32 pid   = PoolId.unwrap(poolId);
        uint160 entry = entryPrices[pid][lp];

        if (entry > 0) {
            (uint160 exitPrice,,,) = poolManager.getSlot0(poolId);
            uint256 ilBps    = computeIL(entry, exitPrice);
            uint256 posValue = positionValues[pid][lp];

            emit LiquidityRemoved(pid, lp, ilBps);

            // Payout if IL exceeds 0.2% (20 bps)
            if (ilBps > IL_THRESHOLD_BPS && posValue > 0) {
                try insuranceFund.claim(payable(lp), ilBps, posValue) {} catch {}
            }

            delete entryPrices[pid][lp];
            delete positionValues[pid][lp];
            delete entryTickLowers[pid][lp];
            delete entryTickUppers[pid][lp];
        }
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }
}
