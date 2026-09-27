// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { BattleCoordinator } from "../src/BattleCoordinator.sol";
import { CreatureRegistry } from "../src/CreatureRegistry.sol";
import { DemoToken } from "../src/DemoToken.sol";
import { NextOmenMarket } from "../src/NextOmenMarket.sol";
import { OmenPublisher } from "../src/OmenPublisher.sol";
import { RoomRegistry } from "../src/RoomRegistry.sol";

interface VmVerify {
    function envAddress(string calldata name) external view returns (address value);
    function envUint(string calldata name) external view returns (uint256 value);
}

contract VerifyDeployment {
    VmVerify private constant vm =
        VmVerify(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external view {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address expectedDeployer = vm.envAddress("EXPECTED_DEPLOYER");
        CreatureRegistry creatures = CreatureRegistry(vm.envAddress("CREATURE_REGISTRY_ADDRESS"));
        RoomRegistry rooms = RoomRegistry(vm.envAddress("ROOM_REGISTRY_ADDRESS"));
        OmenPublisher omens = OmenPublisher(vm.envAddress("OMEN_PUBLISHER_ADDRESS"));
        DemoToken token = DemoToken(vm.envAddress("DEMO_TOKEN_ADDRESS"));
        NextOmenMarket markets = NextOmenMarket(vm.envAddress("NEXT_OMEN_MARKET_ADDRESS"));
        BattleCoordinator battles = BattleCoordinator(vm.envAddress("BATTLE_COORDINATOR_ADDRESS"));

        require(block.chainid == expectedChainId, "chain ID mismatch");
        require(address(creatures).code.length > 0, "CreatureRegistry bytecode missing");
        require(address(rooms).code.length > 0, "RoomRegistry bytecode missing");
        require(address(omens).code.length > 0, "OmenPublisher bytecode missing");
        require(address(token).code.length > 0, "DemoToken bytecode missing");
        require(address(markets).code.length > 0, "NextOmenMarket bytecode missing");
        require(address(battles).code.length > 0, "BattleCoordinator bytecode missing");
        require(address(rooms.creatureRegistry()) == address(creatures), "room dependency mismatch");
        require(address(omens.roomRegistry()) == address(rooms), "omen room dependency mismatch");
        require(
            address(omens.creatureRegistry()) == address(creatures),
            "omen creature dependency mismatch"
        );
        require(address(markets.token()) == address(token), "market token dependency mismatch");
        require(
            address(markets.omenPublisher()) == address(omens), "market omen dependency mismatch"
        );
        require(
            address(battles.roomRegistry()) == address(rooms), "battle room dependency mismatch"
        );
        require(rooms.administrator() == expectedDeployer, "room administrator mismatch");
        require(markets.marketOperator() == expectedDeployer, "market operator mismatch");
        require(battles.operator() == expectedDeployer, "battle operator mismatch");
        require(battles.resultPublisher() == expectedDeployer, "battle publisher mismatch");
    }
}
