// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { CreatureRegistry } from "../src/CreatureRegistry.sol";
import { DemoToken } from "../src/DemoToken.sol";
import { NextOmenMarket } from "../src/NextOmenMarket.sol";
import { OmenPublisher } from "../src/OmenPublisher.sol";
import { RoomRegistry } from "../src/RoomRegistry.sol";
import { IMarketTypes } from "../src/interfaces/IMarketTypes.sol";
import { IOmenPublisher } from "../src/interfaces/IOmenPublisher.sol";
import { IRoomRegistry } from "../src/interfaces/IRoomRegistry.sol";
import { TestBase } from "./TestBase.sol";

contract NextOmenMarketTest is TestBase {
    CreatureRegistry internal creatures;
    RoomRegistry internal rooms;
    OmenPublisher internal omens;
    DemoToken internal token;
    NextOmenMarket internal markets;

    bytes32 internal constant CREATURE = keccak256("hamster-ada");
    bytes32 internal constant CHAMBER = keccak256("chamber-hamster");
    bytes32 internal constant RULESET = keccak256("ruleset-v1");
    address internal constant PUBLISHER = address(0xBEEF);
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA401);

    function setUp() public {
        vm.warp(100);
        creatures = new CreatureRegistry();
        rooms = new RoomRegistry(creatures);
        omens = new OmenPublisher(rooms, creatures);
        token = new DemoToken();
        markets = new NextOmenMarket(token, omens, address(this));

        creatures.registerCreature(
            CREATURE, CreatureRegistry.Species.Hamster, keccak256("metadata"), address(this)
        );
        rooms.registerRoom(CHAMBER, CREATURE, keccak256("config"), RULESET, PUBLISHER);
        rooms.setStatus(CHAMBER, IRoomRegistry.RoomStatus.Active);

        _fundAndApprove(ALICE);
        _fundAndApprove(BOB);
        _fundAndApprove(CAROL);
    }

    function testOpenPredictLockResolveClaim() public {
        uint256 marketId = _createMarket(1);
        _predict(ALICE, marketId, NextOmenMarket.Outcome.Sell, 100 ether);
        _predict(BOB, marketId, NextOmenMarket.Outcome.Buy, 300 ether);

        vm.warp(111);
        markets.lockMarket(marketId);
        _publish(CHAMBER, CREATURE, 1, IOmenPublisher.OmenType.Sell, RULESET);
        markets.resolve(marketId, 1);

        uint256 beforeBalance = token.balanceOf(ALICE);
        vm.prank(ALICE);
        uint256 payout = markets.claim(marketId);
        assertEq(payout, 400 ether);
        assertEq(token.balanceOf(ALICE) - beforeBalance, 400 ether);
    }

    function testMultipleUsersAndOutcomes() public {
        uint256 marketId = _createMarket(1);
        _predict(ALICE, marketId, NextOmenMarket.Outcome.Hold, 100 ether);
        _predict(BOB, marketId, NextOmenMarket.Outcome.Hold, 300 ether);
        _predict(CAROL, marketId, NextOmenMarket.Outcome.Buy, 200 ether);
        vm.warp(111);
        _publish(CHAMBER, CREATURE, 1, IOmenPublisher.OmenType.Hold, RULESET);
        markets.resolve(marketId, 1);

        vm.prank(ALICE);
        uint256 alicePayout = markets.claim(marketId);
        vm.prank(BOB);
        uint256 bobPayout = markets.claim(marketId);
        assertEq(alicePayout + bobPayout, 600 ether);
    }

    function testLatePredictionRejected() public {
        uint256 marketId = _createMarket(1);
        vm.warp(110);
        vm.prank(ALICE);
        vm.expectPartialRevert(NextOmenMarket.PredictionWindowClosed.selector);
        markets.predict(marketId, uint8(NextOmenMarket.Outcome.Buy), 1 ether);
    }

    function testInvalidOutcomeRejected() public {
        uint256 marketId = _createMarket(1);
        vm.prank(ALICE);
        vm.expectPartialRevert(NextOmenMarket.InvalidOutcome.selector);
        markets.predict(marketId, 3, 1 ether);
    }

    function testWrongChamberOmenRejected() public {
        bytes32 secondCreature = keccak256("fish-byte");
        bytes32 secondChamber = keccak256("chamber-fish");
        creatures.registerCreature(
            secondCreature, CreatureRegistry.Species.Fish, keccak256("fish-metadata"), address(this)
        );
        rooms.registerRoom(
            secondChamber, secondCreature, keccak256("fish-config"), RULESET, PUBLISHER
        );
        rooms.setStatus(secondChamber, IRoomRegistry.RoomStatus.Active);
        uint256 marketId = _createMarket(1);
        _predict(ALICE, marketId, NextOmenMarket.Outcome.Buy, 10 ether);
        vm.warp(111);
        _publish(secondChamber, secondCreature, 1, IOmenPublisher.OmenType.Buy, RULESET);
        vm.expectPartialRevert(NextOmenMarket.OmenNotFound.selector);
        markets.resolve(marketId, 1);
    }

    function testStaleAndWrongSequenceRejected() public {
        uint256 marketId = _createMarket(2);
        _predict(ALICE, marketId, NextOmenMarket.Outcome.Buy, 10 ether);
        vm.warp(111);
        _publish(CHAMBER, CREATURE, 1, IOmenPublisher.OmenType.Buy, RULESET);
        vm.expectPartialRevert(NextOmenMarket.IneligibleOmen.selector);
        markets.resolve(marketId, 1);
    }

    function testOmenCannotResolveTwoMarkets() public {
        uint256 first = _createMarket(1);
        uint256 second = _createMarket(1);
        _predict(ALICE, first, NextOmenMarket.Outcome.Buy, 10 ether);
        _predict(BOB, second, NextOmenMarket.Outcome.Buy, 10 ether);
        vm.warp(111);
        _publish(CHAMBER, CREATURE, 1, IOmenPublisher.OmenType.Buy, RULESET);
        markets.resolve(first, 1);
        vm.expectPartialRevert(NextOmenMarket.OmenAlreadyConsumed.selector);
        markets.resolve(second, 1);
    }

    function testCancellationRefundAndDoubleRefundBlocked() public {
        uint256 marketId = _createMarket(1);
        _predict(ALICE, marketId, NextOmenMarket.Outcome.Sell, 25 ether);
        vm.warp(201);
        markets.cancelExpired(marketId);

        uint256 beforeBalance = token.balanceOf(ALICE);
        vm.prank(ALICE);
        uint256 refund = markets.refund(marketId);
        assertEq(refund, 25 ether);
        assertEq(token.balanceOf(ALICE) - beforeBalance, 25 ether);

        vm.prank(ALICE);
        vm.expectPartialRevert(NextOmenMarket.AlreadyClaimed.selector);
        markets.refund(marketId);
    }

    function testDoubleClaimBlocked() public {
        uint256 marketId = _createMarket(1);
        _predict(ALICE, marketId, NextOmenMarket.Outcome.Buy, 10 ether);
        vm.warp(111);
        _publish(CHAMBER, CREATURE, 1, IOmenPublisher.OmenType.Buy, RULESET);
        markets.resolve(marketId, 1);
        vm.prank(ALICE);
        markets.claim(marketId);
        vm.prank(ALICE);
        vm.expectPartialRevert(NextOmenMarket.AlreadyClaimed.selector);
        markets.claim(marketId);
    }

    function testZeroWinnerCancelsAndRefunds() public {
        uint256 marketId = _createMarket(1);
        _predict(ALICE, marketId, NextOmenMarket.Outcome.Sell, 10 ether);
        _predict(BOB, marketId, NextOmenMarket.Outcome.Hold, 20 ether);
        vm.warp(111);
        _publish(CHAMBER, CREATURE, 1, IOmenPublisher.OmenType.Buy, RULESET);
        markets.resolve(marketId, 1);
        NextOmenMarket.Market memory market = markets.getMarket(marketId);
        assertEq(uint256(market.state), uint256(IMarketTypes.MarketState.Cancelled));
        vm.prank(ALICE);
        assertEq(markets.refund(marketId), 10 ether);
    }

    function testFuzzPayoutConservation(uint96 a, uint96 b, uint96 losing) public {
        vm.assume(a > 0 && b > 0 && losing > 0);
        uint256 aliceStake = uint256(a) % 100 ether + 1;
        uint256 bobStake = uint256(b) % 100 ether + 1;
        uint256 losingStake = uint256(losing) % 100 ether + 1;
        uint256 marketId = _createMarket(1);
        _predict(ALICE, marketId, NextOmenMarket.Outcome.Sell, aliceStake);
        _predict(BOB, marketId, NextOmenMarket.Outcome.Sell, bobStake);
        _predict(CAROL, marketId, NextOmenMarket.Outcome.Buy, losingStake);
        vm.warp(111);
        _publish(CHAMBER, CREATURE, 1, IOmenPublisher.OmenType.Sell, RULESET);
        markets.resolve(marketId, 1);
        vm.prank(ALICE);
        uint256 alicePayout = markets.claim(marketId);
        vm.prank(BOB);
        uint256 bobPayout = markets.claim(marketId);
        assertEq(alicePayout + bobPayout, aliceStake + bobStake + losingStake);
        assertEq(token.balanceOf(address(markets)), 0);
    }

    function testImmediateNextCycleAndIndependentChambers() public {
        uint256 first = _createMarket(1);
        _predict(ALICE, first, NextOmenMarket.Outcome.Buy, 10 ether);
        vm.warp(111);
        _publish(CHAMBER, CREATURE, 1, IOmenPublisher.OmenType.Buy, RULESET);
        markets.resolve(first, 1);

        uint256 second = markets.createMarket(CHAMBER, 111, 120, 200, 2, 0);
        assertEq(second, first + 1);
        NextOmenMarket.Market memory market = markets.getMarket(second);
        assertEq(market.chamberId, CHAMBER);
    }

    function _createMarket(uint64 minSequence) internal returns (uint256) {
        return markets.createMarket(CHAMBER, 100, 110, 200, minSequence, 0);
    }

    function _fundAndApprove(address account) internal {
        token.mint(account, 1_000 ether);
        vm.prank(account);
        token.approve(address(markets), type(uint256).max);
    }

    function _predict(
        address account,
        uint256 marketId,
        NextOmenMarket.Outcome outcome,
        uint256 amount
    ) internal {
        vm.prank(account);
        markets.predict(marketId, uint8(outcome), amount);
    }

    function _publish(
        bytes32 chamberId,
        bytes32 creatureId,
        uint64 sequence,
        IOmenPublisher.OmenType omenType,
        bytes32 rulesetHash
    ) internal {
        vm.prank(PUBLISHER);
        omens.publish(
            chamberId,
            creatureId,
            sequence,
            omenType,
            IOmenPublisher.BehaviorType.ZoneEntry,
            uint64(block.timestamp),
            rulesetHash,
            keccak256(abi.encode(chamberId, sequence))
        );
    }
}
