// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRoomRegistry {
    enum RoomStatus {
        None,
        Draft,
        Active,
        Paused,
        Closed
    }

    struct Room {
        bytes32 creatureId;
        bytes32 configHash;
        bytes32 rulesetHash;
        address publisher;
        RoomStatus status;
        bool exists;
    }

    function getRoom(bytes32 chamberId) external view returns (Room memory);
}
