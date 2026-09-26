// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ICreatureRegistry } from "./interfaces/ICreatureRegistry.sol";
import { IRoomRegistry } from "./interfaces/IRoomRegistry.sol";

contract RoomRegistry is IRoomRegistry {
    error RoomAlreadyExists(bytes32 chamberId);
    error RoomNotFound(bytes32 chamberId);
    error InvalidRoomInput();
    error CreatureUnavailable(bytes32 creatureId);
    error Unauthorized(bytes32 creatureId, address account);
    error UnauthorizedRegistrar(address account);
    error InvalidRoomTransition(RoomStatus from, RoomStatus to);
    error ConfigurationLocked(RoomStatus status);

    event ChamberRegistered(
        bytes32 indexed chamberId,
        bytes32 indexed creatureId,
        bytes32 configHash,
        bytes32 rulesetHash,
        address indexed publisher
    );
    event ChamberStatusChanged(
        bytes32 indexed chamberId, RoomStatus previousStatus, RoomStatus newStatus
    );
    event ChamberConfigurationChanged(
        bytes32 indexed chamberId,
        bytes32 configHash,
        bytes32 rulesetHash,
        address indexed publisher
    );

    ICreatureRegistry public immutable creatureRegistry;
    address public immutable administrator;
    mapping(bytes32 chamberId => Room) private _rooms;

    constructor(ICreatureRegistry creatureRegistry_) {
        if (address(creatureRegistry_) == address(0)) revert InvalidRoomInput();
        creatureRegistry = creatureRegistry_;
        administrator = msg.sender;
    }

    modifier onlyCreatureAuthority(bytes32 creatureId) {
        if (!creatureRegistry.isAuthorized(creatureId, msg.sender)) {
            revert Unauthorized(creatureId, msg.sender);
        }
        _;
    }

    function registerRoom(
        bytes32 chamberId,
        bytes32 creatureId,
        bytes32 configHash,
        bytes32 rulesetHash,
        address publisher
    ) external onlyCreatureAuthority(creatureId) {
        if (msg.sender != administrator) revert UnauthorizedRegistrar(msg.sender);
        if (
            chamberId == bytes32(0) || configHash == bytes32(0) || rulesetHash == bytes32(0)
                || publisher == address(0)
        ) revert InvalidRoomInput();
        if (!creatureRegistry.isActive(creatureId)) revert CreatureUnavailable(creatureId);
        if (_rooms[chamberId].exists) revert RoomAlreadyExists(chamberId);
        _rooms[chamberId] = Room({
            creatureId: creatureId,
            configHash: configHash,
            rulesetHash: rulesetHash,
            publisher: publisher,
            status: RoomStatus.Draft,
            exists: true
        });
        emit ChamberRegistered(chamberId, creatureId, configHash, rulesetHash, publisher);
    }

    function setStatus(bytes32 chamberId, RoomStatus nextStatus) external {
        Room storage room = _requireRoom(chamberId);
        if (!creatureRegistry.isAuthorized(room.creatureId, msg.sender)) {
            revert Unauthorized(room.creatureId, msg.sender);
        }
        RoomStatus current = room.status;
        bool valid = (current == RoomStatus.Draft && nextStatus == RoomStatus.Active)
            || (current == RoomStatus.Active
                && (nextStatus == RoomStatus.Paused || nextStatus == RoomStatus.Closed))
            || (current == RoomStatus.Paused
                && (nextStatus == RoomStatus.Active || nextStatus == RoomStatus.Closed));
        if (!valid) revert InvalidRoomTransition(current, nextStatus);
        if (nextStatus == RoomStatus.Active && !creatureRegistry.isActive(room.creatureId)) {
            revert CreatureUnavailable(room.creatureId);
        }
        room.status = nextStatus;
        emit ChamberStatusChanged(chamberId, current, nextStatus);
    }

    function updateConfiguration(
        bytes32 chamberId,
        bytes32 configHash,
        bytes32 rulesetHash,
        address publisher
    ) external {
        Room storage room = _requireRoom(chamberId);
        if (!creatureRegistry.isAuthorized(room.creatureId, msg.sender)) {
            revert Unauthorized(room.creatureId, msg.sender);
        }
        if (room.status != RoomStatus.Draft && room.status != RoomStatus.Paused) {
            revert ConfigurationLocked(room.status);
        }
        if (configHash == bytes32(0) || rulesetHash == bytes32(0) || publisher == address(0)) {
            revert InvalidRoomInput();
        }
        room.configHash = configHash;
        room.rulesetHash = rulesetHash;
        room.publisher = publisher;
        emit ChamberConfigurationChanged(chamberId, configHash, rulesetHash, publisher);
    }

    function getRoom(bytes32 chamberId) external view returns (Room memory) {
        return _requireRoom(chamberId);
    }

    function _requireRoom(bytes32 chamberId) internal view returns (Room storage room) {
        room = _rooms[chamberId];
        if (!room.exists) revert RoomNotFound(chamberId);
    }
}
