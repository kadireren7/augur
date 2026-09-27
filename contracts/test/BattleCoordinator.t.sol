// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { BattleCoordinator } from "../src/BattleCoordinator.sol";
import { CreatureRegistry } from "../src/CreatureRegistry.sol";
import { RoomRegistry } from "../src/RoomRegistry.sol";
import { IRoomRegistry } from "../src/interfaces/IRoomRegistry.sol";
import { TestBase } from "./TestBase.sol";

contract BattleCoordinatorTest is TestBase {
    BattleCoordinator internal coordinator;
    CreatureRegistry internal creatures;
    RoomRegistry internal rooms;
    address internal constant PUBLISHER = address(0xBEEF);
    address internal constant STRANGER = address(0xBAD);
    bytes32 internal constant BATTLE = keccak256("battle-1");
    bytes32 internal constant CREATURE_A = keccak256("hamster");
    bytes32 internal constant CREATURE_B = keccak256("fish");
    bytes32 internal constant CHAMBER_A = keccak256("hamster-room");
    bytes32 internal constant CHAMBER_B = keccak256("fish-room");

    function setUp() public {
        vm.warp(100);
        creatures = new CreatureRegistry();
        rooms = new RoomRegistry(creatures);
        creatures.registerCreature(
            CREATURE_A, CreatureRegistry.Species.Hamster, keccak256("hamster-meta"), address(this)
        );
        creatures.registerCreature(
            CREATURE_B, CreatureRegistry.Species.Fish, keccak256("fish-meta"), address(this)
        );
        rooms.registerRoom(
            CHAMBER_A, CREATURE_A, keccak256("config"), keccak256("rules"), PUBLISHER
        );
        rooms.registerRoom(
            CHAMBER_B, CREATURE_B, keccak256("config"), keccak256("rules"), PUBLISHER
        );
        rooms.setStatus(CHAMBER_A, IRoomRegistry.RoomStatus.Active);
        rooms.setStatus(CHAMBER_B, IRoomRegistry.RoomStatus.Active);
        coordinator = new BattleCoordinator(address(this), PUBLISHER, rooms);
        coordinator.createBattle(
            BATTLE,
            CREATURE_A,
            CREATURE_B,
            CHAMBER_A,
            CHAMBER_B,
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
        assertEq(battle.resolutionHash, keccak256("resolution"));
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

    function testWrongCreatureChamberBindingRejected() public {
        vm.expectPartialRevert(BattleCoordinator.InvalidBattleInput.selector);
        coordinator.createBattle(
            keccak256("wrong-binding"),
            CREATURE_B,
            CREATURE_A,
            CHAMBER_A,
            CHAMBER_B,
            keccak256("MON"),
            110,
            200,
            1_000_000,
            keccak256("scoring-v1")
        );
    }

    function testDoubleResolutionAndPostStartMutationAreImpossible() public {
        vm.warp(110);
        coordinator.activate(BATTLE);
        vm.warp(200);
        coordinator.end(BATTLE);
        vm.prank(PUBLISHER);
        coordinator.resolve(
            BATTLE,
            1,
            0,
            BattleCoordinator.BattleResult.CreatureA,
            keccak256("prices"),
            keccak256("resolution")
        );
        vm.prank(PUBLISHER);
        vm.expectPartialRevert(BattleCoordinator.InvalidBattleState.selector);
        coordinator.resolve(
            BATTLE,
            1,
            0,
            BattleCoordinator.BattleResult.CreatureA,
            keccak256("prices"),
            keccak256("resolution-2")
        );
    }
}
