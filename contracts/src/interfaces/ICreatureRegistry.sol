// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICreatureRegistry {
    function creatureExists(bytes32 creatureId) external view returns (bool);
    function isActive(bytes32 creatureId) external view returns (bool);
    function isAuthorized(bytes32 creatureId, address account) external view returns (bool);
}
