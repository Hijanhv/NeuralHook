// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract ILInsuranceFund {
    address public owner;
    address public hook;
    uint256 public totalDeposited;
    uint256 public totalClaimed;
    uint256 public claimCount;
    bool    public paused;

    event Deposited(address indexed from, uint256 amount);
    event Claimed(address indexed lp, uint256 amount, uint256 ilBps);
    event HookSet(address indexed hook);
    event Paused(bool paused);

    error OnlyHook();
    error OnlyOwner();
    error InsufficientFunds();
    error ZeroPayout();
    error ContractPaused();
    error HookAlreadySet();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    receive() external payable {
        totalDeposited += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // Called once after hook is deployed to link the two contracts
    function setHook(address _hook) external onlyOwner {
        if (hook != address(0)) revert HookAlreadySet();
        hook = _hook;
        emit HookSet(_hook);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function claim(address payable lp, uint256 ilBps, uint256 positionValue) external {
        if (msg.sender != hook)  revert OnlyHook();
        if (paused)              revert ContractPaused();
        uint256 bal = address(this).balance;
        if (bal == 0)            revert InsufficientFunds();

        uint256 halfIL = (positionValue * ilBps) / 20000;
        uint256 cap    = bal / 10;
        uint256 payout = halfIL < cap ? halfIL : cap;
        if (payout == 0) revert ZeroPayout();

        totalClaimed += payout;
        claimCount++;
        emit Claimed(lp, payout, ilBps);
        lp.transfer(payout);
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    // Owner can rescue ETH if needed
    function withdraw(uint256 amount) external onlyOwner {
        payable(owner).transfer(amount);
    }
}
