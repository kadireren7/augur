// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { RoomRegistry } from "../src/RoomRegistry.sol";

interface VmPermissionlessConfig {
    function envAddress(string calldata name) external view returns (address value);
    function envBytes32(string calldata name) external view returns (bytes32 value);
    function envOr(string calldata name, uint256 defaultValue) external view returns (uint256 value);
    function envUint(string calldata name) external view returns (uint256 value);
    function startBroadcast(address signer) external;
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract ConfigurePermissionless {
    VmPermissionlessConfig private constant vm =
        VmPermissionlessConfig(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external {
        uint256 key = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        RoomRegistry rooms = RoomRegistry(vm.envAddress("ROOM_REGISTRY_ADDRESS"));
        bytes32 rulesetHash = vm.envBytes32("RULESET_HASH");
        uint256 roomLimit = vm.envUint("MAX_ROOMS_PER_OWNER");
        require(roomLimit > 0 && roomLimit <= 100, "invalid room limit");

        if (key == 0) vm.startBroadcast(vm.envAddress("DEPLOYER_ADDRESS"));
        else vm.startBroadcast(key);
        rooms.setRulesetAllowed(rulesetHash, true);
        rooms.configurePermissionless(true, uint32(roomLimit));
        vm.stopBroadcast();
    }
}
