// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract ILInsuranceFund {
    address public immutable hook;
    uint256 public totalDeposited;
    uint256 public totalClaimed;
    uint256 public claimCount;

    event Deposited(address indexed from, uint256 amount);
    event Claimed(address indexed lp, uint256 amount, uint256 ilBps);

    error OnlyHook();
    error InsufficientFunds();
    error ZeroPayout();

    constructor(address _hook) {
        hook = _hook;
    }

    receive() external payable {
        totalDeposited += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function claim(address payable lp, uint256 ilBps, uint256 positionValue) external {
        if (msg.sender != hook) revert OnlyHook();
        uint256 bal = address(this).balance;
        if (bal == 0) revert InsufficientFunds();

        uint256 halfIL = (positionValue * ilBps) / 20000; // half of IL expressed in ETH
        uint256 cap    = bal / 10;                        // 10% drain protection
        uint256 payout  = halfIL < cap ? halfIL : cap;
        if (payout == 0) revert ZeroPayout();

        totalClaimed += payout;
        claimCount++;
        emit Claimed(lp, payout, ilBps);
        lp.transfer(payout);
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }
}
