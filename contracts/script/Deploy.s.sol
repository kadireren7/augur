// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { CreatureRegistry } from "../src/CreatureRegistry.sol";
import { DemoToken } from "../src/DemoToken.sol";
import { NextOmenMarket } from "../src/NextOmenMarket.sol";
import { OmenPublisher } from "../src/OmenPublisher.sol";
import { RoomRegistry } from "../src/RoomRegistry.sol";

interface VmDeploy {
    function envUint(string calldata name) external view returns (uint256 value);
    function addr(uint256 privateKey) external pure returns (address keyAddr);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployAugur {
    VmDeploy private constant vm =
        VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run()
        external
        returns (
            CreatureRegistry creatures,
            RoomRegistry rooms,
            OmenPublisher omens,
            DemoToken token,
            NextOmenMarket markets
        )
    {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);
        creatures = new CreatureRegistry();
        rooms = new RoomRegistry(creatures);
        omens = new OmenPublisher(rooms, creatures);
        token = new DemoToken();
        markets = new NextOmenMarket(token, omens, deployer);
        vm.stopBroadcast();
    }
}
