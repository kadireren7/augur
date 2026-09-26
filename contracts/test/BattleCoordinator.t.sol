// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { BattleCoordinator } from "../src/BattleCoordinator.sol";
import { TestBase } from "./TestBase.sol";

contract BattleCoordinatorTest is TestBase {
    BattleCoordinator internal coordinator;
    address internal constant PUBLISHER = address(0xBEEF);
    address internal constant STRANGER = address(0xBAD);
    bytes32 internal constant BATTLE = keccak256("battle-1");

    function setUp() public {
        vm.warp(100);
        coordinator = new BattleCoordinator(address(this), PUBLISHER);
        coordinator.createBattle(
            BATTLE,
            keccak256("hamster"),
            keccak256("fish"),
            keccak256("hamster-room"),
            keccak256("fish-room"),
            keccak256("MON"),
            110,
            200,
            1_000_000,
            keccak256("scoring-v1")
        );
    }

    function testLifecycleAndResolution() public {
        vm.warp(110);
        coordinator.activate(BATTLE);
        vm.warp(200);
        coordinator.end(BATTLE);
        vm.prank(PUBLISHER);
        coordinator.resolve(
            BATTLE,
            100,
            -100,
            BattleCoordinator.BattleResult.CreatureA,
            keccak256("prices"),
            keccak256("resolution")
        );
        BattleCoordinator.Battle memory battle = coordinator.getBattle(BATTLE);
        assertEq(uint256(battle.state), uint256(BattleCoordinator.BattleState.Resolved));
        assertEq(uint256(battle.result), uint256(BattleCoordinator.BattleResult.CreatureA));
    }

    function testTieAndResultValidation() public {
        vm.warp(110);
        coordinator.activate(BATTLE);
        vm.warp(200);
        coordinator.end(BATTLE);
        vm.prank(PUBLISHER);
        vm.expectPartialRevert(BattleCoordinator.ResultMismatch.selector);
        coordinator.resolve(
            BATTLE,
            0,
            0,
            BattleCoordinator.BattleResult.CreatureA,
            keccak256("prices"),
            keccak256("resolution")
        );
        vm.prank(PUBLISHER);
        coordinator.resolve(
            BATTLE,
            0,
            0,
            BattleCoordinator.BattleResult.Tie,
            keccak256("prices"),
            keccak256("resolution")
        );
    }

    function testCancellationAndUnauthorizedResolution() public {
        vm.prank(STRANGER);
        vm.expectPartialRevert(BattleCoordinator.Unauthorized.selector);
        coordinator.resolve(
            BATTLE,
            1,
            0,
            BattleCoordinator.BattleResult.CreatureA,
            keccak256("prices"),
            keccak256("resolution")
        );
        coordinator.cancel(BATTLE, keccak256("STALE_PRICE"));
        BattleCoordinator.Battle memory battle = coordinator.getBattle(BATTLE);
        assertEq(uint256(battle.state), uint256(BattleCoordinator.BattleState.Cancelled));
    }

    function testInvalidConfigurationRejected() public {
        vm.expectPartialRevert(BattleCoordinator.InvalidBattleInput.selector);
        coordinator.createBattle(
            keccak256("bad"),
            keccak256("same"),
            keccak256("same"),
            keccak256("room-a"),
            keccak256("room-b"),
            keccak256("MON"),
            110,
            200,
            1,
            keccak256("config")
        );
    }
}
