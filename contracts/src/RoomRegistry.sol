// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ICreatureRegistry } from "./interfaces/ICreatureRegistry.sol";
import { IRoomRegistry } from "./interfaces/IRoomRegistry.sol";

contract RoomRegistry is IRoomRegistry {
    enum SourceMode {
        FixtureReplay,
        UploadedClip,
        LiveAdapter
    }

    error RoomAlreadyExists(bytes32 chamberId);
    error RoomNotFound(bytes32 chamberId);
    error InvalidRoomInput();
    error CreatureUnavailable(bytes32 creatureId);
    error Unauthorized(bytes32 creatureId, address account);
    error UnauthorizedRegistrar(address account);
    error InvalidRoomTransition(RoomStatus from, RoomStatus to);
    error ConfigurationLocked(RoomStatus status);
    error PermissionlessCreationDisabled();
    error RulesetNotAllowed(bytes32 rulesetHash);
    error RoomLimitReached(address owner);

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
    event PermissionlessChamberRegistered(
        bytes32 indexed chamberId,
        address indexed owner,
        SourceMode sourceMode,
        bytes32 indexed rulesetHash
    );
    event ChamberOwnershipSet(bytes32 indexed chamberId, address indexed owner);
    event PermissionlessPolicyChanged(bool enabled, uint32 maxRoomsPerOwner);
    event RulesetPolicyChanged(bytes32 indexed rulesetHash, bool allowed);

    ICreatureRegistry public immutable creatureRegistry;
    address public immutable administrator;
    mapping(bytes32 chamberId => Room) private _rooms;
    mapping(bytes32 chamberId => address) public chamberOwner;
    mapping(bytes32 chamberId => SourceMode) public chamberSourceMode;
    mapping(bytes32 chamberId => bool) public isPermissionlessRoom;
    mapping(bytes32 rulesetHash => bool) public allowedRuleset;
    mapping(address owner => uint32) public roomsByOwner;
    bool public permissionlessEnabled;
    uint32 public maxRoomsPerOwner = 10;

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

    modifier onlyAdministrator() {
        if (msg.sender != administrator) revert UnauthorizedRegistrar(msg.sender);
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
        _register(
            chamberId,
            creatureId,
            configHash,
            rulesetHash,
            publisher,
            msg.sender,
            SourceMode.FixtureReplay
        );
    }

    function registerPermissionlessRoom(
        bytes32 chamberId,
        bytes32 creatureId,
        bytes32 configHash,
        bytes32 rulesetHash,
        address publisher,
        SourceMode sourceMode
    ) external onlyCreatureAuthority(creatureId) {
        if (!permissionlessEnabled) revert PermissionlessCreationDisabled();
        if (!allowedRuleset[rulesetHash]) revert RulesetNotAllowed(rulesetHash);
        if (roomsByOwner[msg.sender] >= maxRoomsPerOwner) revert RoomLimitReached(msg.sender);
        _register(chamberId, creatureId, configHash, rulesetHash, publisher, msg.sender, sourceMode);
        isPermissionlessRoom[chamberId] = true;
        emit PermissionlessChamberRegistered(chamberId, msg.sender, sourceMode, rulesetHash);
    }

    function configurePermissionless(bool enabled, uint32 roomLimit) external onlyAdministrator {
        if (roomLimit == 0 || roomLimit > 100) revert InvalidRoomInput();
        permissionlessEnabled = enabled;
        maxRoomsPerOwner = roomLimit;
        emit PermissionlessPolicyChanged(enabled, roomLimit);
    }

    function setRulesetAllowed(bytes32 rulesetHash, bool allowed) external onlyAdministrator {
        if (rulesetHash == bytes32(0)) revert InvalidRoomInput();
        allowedRuleset[rulesetHash] = allowed;
        emit RulesetPolicyChanged(rulesetHash, allowed);
    }

    function setStatus(bytes32 chamberId, RoomStatus nextStatus) external {
        Room storage room = _requireRoom(chamberId);
        bool owner = msg.sender == chamberOwner[chamberId];
        bool emergencyPause = msg.sender == administrator && nextStatus == RoomStatus.Paused;
        if (!owner && !emergencyPause) {
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
        if (msg.sender != chamberOwner[chamberId]) {
            revert Unauthorized(room.creatureId, msg.sender);
        }
        if (room.status != RoomStatus.Draft && room.status != RoomStatus.Paused) {
            revert ConfigurationLocked(room.status);
        }
        if (configHash == bytes32(0) || rulesetHash == bytes32(0) || publisher == address(0)) {
            revert InvalidRoomInput();
        }
        if (isPermissionlessRoom[chamberId] && !allowedRuleset[rulesetHash]) {
            revert RulesetNotAllowed(rulesetHash);
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

    function _register(
        bytes32 chamberId,
        bytes32 creatureId,
        bytes32 configHash,
        bytes32 rulesetHash,
        address publisher,
        address owner,
        SourceMode sourceMode
    ) internal {
        if (
            chamberId == bytes32(0) || configHash == bytes32(0) || rulesetHash == bytes32(0)
                || publisher == address(0) || owner == address(0)
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
        chamberOwner[chamberId] = owner;
        chamberSourceMode[chamberId] = sourceMode;
        roomsByOwner[owner] += 1;
        emit ChamberRegistered(chamberId, creatureId, configHash, rulesetHash, publisher);
        emit ChamberOwnershipSet(chamberId, owner);
    }
}
