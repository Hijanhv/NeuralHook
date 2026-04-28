// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ILInsuranceFund} from "../src/ILInsuranceFund.sol";

contract ILInsuranceFundTest is Test {
    ILInsuranceFund fund;
    address owner = address(this);
    address hook  = address(0xBEEF);
    address lp    = address(0xCAFE);

    function setUp() public {
        fund = new ILInsuranceFund(owner);
        fund.setHook(hook);
    }

    function test_AcceptsETHDeposits() public {
        (bool ok,) = address(fund).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(fund).balance, 1 ether);
        assertEq(fund.totalDeposited(), 1 ether);
    }

    function test_ClaimPaysLPAndRecordsStats() public {
        vm.deal(address(fund), 10 ether);
        uint256 lpBefore = lp.balance;

        vm.prank(hook);
        fund.claim(payable(lp), 1000, 1 ether); // 1000 bps IL, 1 ETH position

        assertGt(lp.balance, lpBefore);
        assertEq(fund.claimCount(), 1);
    }

    function test_ClaimRespects10PercentDrainCap() public {
        vm.deal(address(fund), 10 ether);

        vm.prank(hook);
        // Very large IL / position — payout should be capped at 1 ETH (10% of 10)
        fund.claim(payable(lp), 9999, 1000 ether);

        assertLe(lp.balance, 1 ether);
        assertGt(address(fund).balance, 0);
    }

    function test_OnlyHookCanClaim() public {
        vm.deal(address(fund), 1 ether);

        vm.prank(address(0x1234));
        vm.expectRevert(ILInsuranceFund.OnlyHook.selector);
        fund.claim(payable(lp), 500, 1 ether);
    }

    function test_ClaimRevertsWhenEmpty() public {
        vm.prank(hook);
        vm.expectRevert(ILInsuranceFund.InsufficientFunds.selector);
        fund.claim(payable(lp), 500, 1 ether);
    }

    function test_BalanceViewFunction() public {
        vm.deal(address(fund), 5 ether);
        assertEq(fund.balance(), 5 ether);
    }

    function test_SetHookCanOnlyBeCalledOnce() public {
        // Already set in setUp — calling again should revert
        vm.expectRevert(ILInsuranceFund.HookAlreadySet.selector);
        fund.setHook(address(0x1234));
    }

    function test_OnlyOwnerCanSetHook() public {
        ILInsuranceFund fresh = new ILInsuranceFund(owner);
        vm.prank(address(0x9999));
        vm.expectRevert(ILInsuranceFund.OnlyOwner.selector);
        fresh.setHook(hook);
    }

    function test_PausePreventsClaimsButNotDeposits() public {
        vm.deal(address(fund), 2 ether);
        fund.setPaused(true);

        // Deposits still work
        (bool ok,) = address(fund).call{value: 1 ether}("");
        assertTrue(ok);

        // Claims revert
        vm.prank(hook);
        vm.expectRevert(ILInsuranceFund.ContractPaused.selector);
        fund.claim(payable(lp), 500, 1 ether);
    }
}
