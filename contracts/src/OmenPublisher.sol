// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ICreatureRegistry } from "./interfaces/ICreatureRegistry.sol";
import { IOmenPublisher } from "./interfaces/IOmenPublisher.sol";
import { IRoomRegistry } from "./interfaces/IRoomRegistry.sol";

contract OmenPublisher is IOmenPublisher {
    error InvalidPublisherInput();
    error ChamberNotActive(bytes32 chamberId, IRoomRegistry.RoomStatus status);
    error UnauthorizedPublisher(bytes32 chamberId, address account);
    error CreatureMismatch(bytes32 expected, bytes32 supplied);
    error CreatureInactive(bytes32 creatureId);
    error SequenceNotIncreasing(bytes32 chamberId, uint64 previous, uint64 supplied);
    error RulesetMismatch(bytes32 expected, bytes32 supplied);
    error FutureObservation(uint64 observedAt, uint256 currentTime);

    event OmenPublished(
        bytes32 indexed chamberId,
        bytes32 indexed creatureId,
        uint64 indexed sequence,
        OmenType omenType,
        BehaviorType behaviorType,
        uint64 observedAt,
        bytes32 rulesetHash,
        bytes32 provenanceHash,
        address publisher
    );

    IRoomRegistry public immutable roomRegistry;
    ICreatureRegistry public immutable creatureRegistry;
    mapping(bytes32 chamberId => uint64) public lastSequence;
    mapping(bytes32 chamberId => mapping(uint64 sequence => PublishedOmen)) private _omens;

    constructor(IRoomRegistry roomRegistry_, ICreatureRegistry creatureRegistry_) {
        if (address(roomRegistry_) == address(0) || address(creatureRegistry_) == address(0)) {
            revert InvalidPublisherInput();
        }
        roomRegistry = roomRegistry_;
        creatureRegistry = creatureRegistry_;
    }

    function publish(
        bytes32 chamberId,
        bytes32 creatureId,
        uint64 sequence,
        OmenType omenType,
        BehaviorType behaviorType,
        uint64 observedAt,
        bytes32 rulesetHash,
        bytes32 provenanceHash
    ) external {
        if (sequence == 0 || provenanceHash == bytes32(0)) {
            revert InvalidPublisherInput();
        }
        IRoomRegistry.Room memory room = roomRegistry.getRoom(chamberId);
        if (room.status != IRoomRegistry.RoomStatus.Active) {
            revert ChamberNotActive(chamberId, room.status);
        }
        if (msg.sender != room.publisher) revert UnauthorizedPublisher(chamberId, msg.sender);
        if (creatureId != room.creatureId) revert CreatureMismatch(room.creatureId, creatureId);
        if (!creatureRegistry.isActive(creatureId)) revert CreatureInactive(creatureId);
        uint64 previous = lastSequence[chamberId];
        if (sequence <= previous) revert SequenceNotIncreasing(chamberId, previous, sequence);
        if (rulesetHash != room.rulesetHash) {
            revert RulesetMismatch(room.rulesetHash, rulesetHash);
        }
        if (observedAt > block.timestamp) revert FutureObservation(observedAt, block.timestamp);

        lastSequence[chamberId] = sequence;
        _omens[chamberId][sequence] = PublishedOmen({
            creatureId: creatureId,
            sequence: sequence,
            omenType: omenType,
            behaviorType: behaviorType,
            observedAt: observedAt,
            rulesetHash: rulesetHash,
            provenanceHash: provenanceHash,
            exists: true
        });
        emit OmenPublished(
            chamberId,
            creatureId,
            sequence,
            omenType,
            behaviorType,
            observedAt,
            rulesetHash,
            provenanceHash,
            msg.sender
        );
    }

    function getOmen(bytes32 chamberId, uint64 sequence)
        external
        view
        returns (PublishedOmen memory)
    {
        return _omens[chamberId][sequence];
    }
}
