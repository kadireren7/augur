// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { CreatureRegistry } from "../src/CreatureRegistry.sol";
import { DemoToken } from "../src/DemoToken.sol";
import { NextOmenMarket } from "../src/NextOmenMarket.sol";
import { RoomRegistry } from "../src/RoomRegistry.sol";
import { IRoomRegistry } from "../src/interfaces/IRoomRegistry.sol";

interface VmSmokeSetup {
    function envAddress(string calldata name) external view returns (address value);
    function envString(string calldata name) external view returns (string memory value);
    function envOr(string calldata name, uint256 defaultValue) external view returns (uint256 value);
    function addr(uint256 privateKey) external pure returns (address keyAddr);
    function startBroadcast(address signer) external;
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract SmokeSetup {
    VmSmokeSetup private constant vm =
        VmSmokeSetup(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run()
        external
        returns (bytes32 creatureId, bytes32 chamberId, bytes32 rulesetHash, uint256 marketId)
    {
        uint256 key = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        string memory label = vm.envString("SMOKE_TEST_LABEL");
        CreatureRegistry creatures = CreatureRegistry(vm.envAddress("CREATURE_REGISTRY_ADDRESS"));
        RoomRegistry rooms = RoomRegistry(vm.envAddress("ROOM_REGISTRY_ADDRESS"));
        DemoToken token = DemoToken(vm.envAddress("DEMO_TOKEN_ADDRESS"));
        NextOmenMarket markets = NextOmenMarket(vm.envAddress("NEXT_OMEN_MARKET_ADDRESS"));
        address deployer = key == 0 ? vm.envAddress("DEPLOYER_ADDRESS") : vm.addr(key);
        require(deployer == markets.marketOperator(), "smoke signer is not market operator");
        creatureId = keccak256(abi.encodePacked("smoke-creature:", label));
        chamberId = keccak256(abi.encodePacked("smoke-chamber:", label));
        bytes32 configHash = keccak256(abi.encodePacked("smoke-config:", label));
        rulesetHash = keccak256(abi.encodePacked("smoke-rules:", label));

        if (key == 0) vm.startBroadcast(deployer);
        else vm.startBroadcast(key);
        creatures.registerCreature(
            creatureId, CreatureRegistry.Species.Hamster, keccak256(bytes(label)), deployer
        );
        rooms.registerRoom(chamberId, creatureId, configHash, rulesetHash, deployer);
        rooms.setStatus(chamberId, IRoomRegistry.RoomStatus.Active);
        token.mint(deployer, 100 ether);
        token.approve(address(markets), 10 ether);
        marketId = markets.createMarket(
            chamberId,
            uint64(block.timestamp),
            uint64(block.timestamp + 30),
            uint64(block.timestamp + 300),
            1,
            1
        );
        markets.predict(marketId, uint8(NextOmenMarket.Outcome.Buy), 10 ether);
        vm.stopBroadcast();
    }
}
