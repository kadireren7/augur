// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ICreatureRegistry } from "./interfaces/ICreatureRegistry.sol";

contract CreatureRegistry is ICreatureRegistry {
    enum Species {
        Hamster,
        Fish,
        Turtle
    }

    struct Creature {
        Species species;
        bytes32 metadataHash;
        address owner;
        address operator;
        bool active;
        bool exists;
    }

    error CreatureAlreadyExists(bytes32 creatureId);
    error CreatureNotFound(bytes32 creatureId);
    error InvalidCreatureInput();
    error Unauthorized(bytes32 creatureId, address account);

    event CreatureRegistered(
        bytes32 indexed creatureId,
        Species species,
        bytes32 indexed metadataHash,
        address indexed owner,
        address operator
    );
    event CreatureStatusChanged(bytes32 indexed creatureId, bool active);
    event CreatureOperatorChanged(bytes32 indexed creatureId, address indexed operator);
    event CreatureOwnershipTransferred(
        bytes32 indexed creatureId, address indexed previousOwner, address indexed newOwner
    );

    mapping(bytes32 creatureId => Creature) private _creatures;

    modifier onlyCreatureOwner(bytes32 creatureId) {
        Creature storage creature = _requireCreature(creatureId);
        if (msg.sender != creature.owner) revert Unauthorized(creatureId, msg.sender);
        _;
    }

    function registerCreature(
        bytes32 creatureId,
        Species species,
        bytes32 metadataHash,
        address operator
    ) external {
        if (creatureId == bytes32(0) || metadataHash == bytes32(0) || operator == address(0)) {
            revert InvalidCreatureInput();
        }
        if (_creatures[creatureId].exists) revert CreatureAlreadyExists(creatureId);
        _creatures[creatureId] = Creature({
            species: species,
            metadataHash: metadataHash,
            owner: msg.sender,
            operator: operator,
            active: true,
            exists: true
        });
        emit CreatureRegistered(creatureId, species, metadataHash, msg.sender, operator);
    }

    function setActive(bytes32 creatureId, bool active) external onlyCreatureOwner(creatureId) {
        _creatures[creatureId].active = active;
        emit CreatureStatusChanged(creatureId, active);
    }

    function setOperator(bytes32 creatureId, address operator)
        external
        onlyCreatureOwner(creatureId)
    {
        if (operator == address(0)) revert InvalidCreatureInput();
        _creatures[creatureId].operator = operator;
        emit CreatureOperatorChanged(creatureId, operator);
    }

    function transferOwnership(bytes32 creatureId, address newOwner)
        external
        onlyCreatureOwner(creatureId)
    {
        if (newOwner == address(0)) revert InvalidCreatureInput();
        address previousOwner = _creatures[creatureId].owner;
        _creatures[creatureId].owner = newOwner;
        emit CreatureOwnershipTransferred(creatureId, previousOwner, newOwner);
    }

    function getCreature(bytes32 creatureId) external view returns (Creature memory) {
        return _requireCreature(creatureId);
    }

    function creatureExists(bytes32 creatureId) external view returns (bool) {
        return _creatures[creatureId].exists;
    }

    function isActive(bytes32 creatureId) external view returns (bool) {
        return _creatures[creatureId].exists && _creatures[creatureId].active;
    }

    function isAuthorized(bytes32 creatureId, address account) external view returns (bool) {
        Creature storage creature = _creatures[creatureId];
        return creature.exists && (account == creature.owner || account == creature.operator);
    }

    function _requireCreature(bytes32 creatureId)
        internal
        view
        returns (Creature storage creature)
    {
        creature = _creatures[creatureId];
        if (!creature.exists) revert CreatureNotFound(creatureId);
    }
}
