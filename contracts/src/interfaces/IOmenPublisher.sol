// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IOmenPublisher {
    enum OmenType {
        Sell,
        Hold,
        Buy
    }

    enum BehaviorType {
        ZoneOccupancy,
        ZoneEntry,
        ZoneExit,
        DirectionalMovement,
        Inactivity
    }

    struct PublishedOmen {
        bytes32 creatureId;
        uint64 sequence;
        OmenType omenType;
        BehaviorType behaviorType;
        uint64 observedAt;
        bytes32 rulesetHash;
        bytes32 provenanceHash;
        bool exists;
    }

    function getOmen(bytes32 chamberId, uint64 sequence)
        external
        view
        returns (PublishedOmen memory);

    function lastSequence(bytes32 chamberId) external view returns (uint64);
}
