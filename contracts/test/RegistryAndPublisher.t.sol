// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { CreatureRegistry } from "../src/CreatureRegistry.sol";
import { OmenPublisher } from "../src/OmenPublisher.sol";
import { RoomRegistry } from "../src/RoomRegistry.sol";
import { IOmenPublisher } from "../src/interfaces/IOmenPublisher.sol";
import { IRoomRegistry } from "../src/interfaces/IRoomRegistry.sol";
import { TestBase } from "./TestBase.sol";

contract RegistryAndPublisherTest is TestBase {
    CreatureRegistry internal creatures;
    RoomRegistry internal rooms;
    OmenPublisher internal omens;

    bytes32 internal constant CREATURE = keccak256("hamster-ada");
    bytes32 internal constant CHAMBER = keccak256("chamber-hamster");
    bytes32 internal constant CONFIG = keccak256("config-v1");
    bytes32 internal constant RULESET = keccak256("ruleset-v1");
    bytes32 internal constant PROVENANCE = keccak256("proof-1");
    address internal constant PUBLISHER = address(0xBEEF);
    address internal constant STRANGER = address(0xBAD);

    function setUp() public {
        creatures = new CreatureRegistry();
        rooms = new RoomRegistry(creatures);
        omens = new OmenPublisher(rooms, creatures);
        creatures.registerCreature(
            CREATURE, CreatureRegistry.Species.Hamster, keccak256("metadata"), address(this)
        );
        rooms.registerRoom(CHAMBER, CREATURE, CONFIG, RULESET, PUBLISHER);
    }

    function testCreatureHasStableIdentityAndAuthorization() public view {
        CreatureRegistry.Creature memory creature = creatures.getCreature(CREATURE);
        assertEq(creature.owner, address(this));
        assertTrue(creature.active);
        assertTrue(creatures.isAuthorized(CREATURE, address(this)));
        assertFalse(creatures.isAuthorized(CREATURE, STRANGER));
    }

    function testOnlyOwnerCanChangeCreature() public {
        vm.prank(STRANGER);
        vm.expectPartialRevert(CreatureRegistry.Unauthorized.selector);
        creatures.setActive(CREATURE, false);

        creatures.setActive(CREATURE, false);
        assertFalse(creatures.isActive(CREATURE));
    }

    function testRoomLifecycleRejectsInvalidTransitions() public {
        vm.expectPartialRevert(RoomRegistry.InvalidRoomTransition.selector);
        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Paused);

        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Active);
        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Paused);
        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Active);
        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Closed);

        vm.expectPartialRevert(RoomRegistry.InvalidRoomTransition.selector);
        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Active);
    }

    function testInvalidCreatureRoomRelationshipRejected() public {
        vm.prank(STRANGER);
        vm.expectPartialRevert(RoomRegistry.Unauthorized.selector);
        rooms.registerRoom(keccak256("bad-room"), keccak256("missing"), CONFIG, RULESET, PUBLISHER);
    }

    function testUnauthorizedPublisherRejected() public {
        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Active);
        vm.prank(STRANGER);
        vm.expectPartialRevert(OmenPublisher.UnauthorizedPublisher.selector);
        _publish(1);
    }

    function testPausedChamberRejectsPublication() public {
        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Active);
        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Paused);
        vm.prank(PUBLISHER);
        vm.expectPartialRevert(OmenPublisher.ChamberNotActive.selector);
        _publish(1);
    }

    function testPublishAndReplayProtection() public {
        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Active);
        vm.warp(100);
        vm.prank(PUBLISHER);
        _publish(1);

        IOmenPublisher.PublishedOmen memory omen = omens.getOmen(CHAMBER, 1);
        assertTrue(omen.exists);
        assertEq(omen.creatureId, CREATURE);
        assertEq(omens.lastSequence(CHAMBER), 1);

        vm.prank(PUBLISHER);
        vm.expectPartialRevert(OmenPublisher.SequenceNotIncreasing.selector);
        _publish(1);
    }

    function testWrongCreatureAndRulesetRejected() public {
        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Active);
        vm.warp(100);
        vm.prank(PUBLISHER);
        vm.expectPartialRevert(OmenPublisher.CreatureMismatch.selector);
        omens.publish(
            CHAMBER,
            keccak256("wrong-creature"),
            1,
            IOmenPublisher.OmenType.Buy,
            IOmenPublisher.BehaviorType.ZoneEntry,
            100,
            RULESET,
            PROVENANCE
        );

        vm.prank(PUBLISHER);
        vm.expectPartialRevert(OmenPublisher.RulesetMismatch.selector);
        omens.publish(
            CHAMBER,
            CREATURE,
            1,
            IOmenPublisher.OmenType.Buy,
            IOmenPublisher.BehaviorType.ZoneEntry,
            100,
            keccak256("wrong-rules"),
            PROVENANCE
        );
    }

    function testRoomRegistrationIsAllowlistedUntilPermissionlessMilestone() public {
        bytes32 secondCreature = keccak256("fish-byte");
        vm.prank(STRANGER);
        creatures.registerCreature(
            secondCreature, CreatureRegistry.Species.Fish, keccak256("fish-metadata"), STRANGER
        );
        vm.prank(STRANGER);
        vm.expectPartialRevert(RoomRegistry.UnauthorizedRegistrar.selector);
        rooms.registerRoom(keccak256("fish-room"), secondCreature, CONFIG, RULESET, PUBLISHER);
    }

    function _publish(uint64 sequence) internal {
        omens.publish(
            CHAMBER,
            CREATURE,
            sequence,
            IOmenPublisher.OmenType.Buy,
            IOmenPublisher.BehaviorType.ZoneEntry,
            uint64(block.timestamp),
            RULESET,
            PROVENANCE
        );
    }
}
