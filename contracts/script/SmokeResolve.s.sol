// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { NextOmenMarket } from "../src/NextOmenMarket.sol";
import { OmenPublisher } from "../src/OmenPublisher.sol";
import { IOmenPublisher } from "../src/interfaces/IOmenPublisher.sol";

interface VmSmokeResolve {
    function envAddress(string calldata name) external view returns (address value);
    function envBytes32(string calldata name) external view returns (bytes32 value);
    function envUint(string calldata name) external view returns (uint256 value);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract SmokeResolve {
    VmSmokeResolve private constant vm =
        VmSmokeResolve(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 marketId = vm.envUint("SMOKE_MARKET_ID");
        bytes32 chamberId = vm.envBytes32("SMOKE_CHAMBER_ID");
        bytes32 creatureId = vm.envBytes32("SMOKE_CREATURE_ID");
        bytes32 rulesetHash = vm.envBytes32("SMOKE_RULESET_HASH");
        OmenPublisher omens = OmenPublisher(vm.envAddress("OMEN_PUBLISHER_ADDRESS"));
        NextOmenMarket markets = NextOmenMarket(vm.envAddress("NEXT_OMEN_MARKET_ADDRESS"));

        vm.startBroadcast(key);
        omens.publish(
            chamberId,
            creatureId,
            1,
            IOmenPublisher.OmenType.Buy,
            IOmenPublisher.BehaviorType.ZoneEntry,
            uint64(block.timestamp),
            rulesetHash,
            keccak256(abi.encodePacked("smoke-proof:", chamberId))
        );
        markets.lockMarket(marketId);
        markets.resolve(marketId, 1);
        markets.claim(marketId);
        vm.stopBroadcast();
    }
}
