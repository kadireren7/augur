// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract BattleCoordinator {
    enum BattleState {
        None,
        Created,
        Active,
        Ended,
        Resolved,
        Cancelled
    }

    enum BattleResult {
        CreatureA,
        CreatureB,
        Tie
    }

    struct Battle {
        bytes32 creatureA;
        bytes32 creatureB;
        bytes32 chamberA;
        bytes32 chamberB;
        bytes32 asset;
        uint64 startsAt;
        uint64 endsAt;
        uint256 startingNotional;
        bytes32 scoringConfigHash;
        BattleState state;
        int256 pnlA;
        int256 pnlB;
        BattleResult result;
        bytes32 priceSeriesHash;
        bytes32 cancellationReason;
        bool exists;
    }

    error Unauthorized();
    error InvalidBattleInput();
    error BattleAlreadyExists(bytes32 battleId);
    error BattleNotFound(bytes32 battleId);
    error InvalidBattleState(BattleState state);
    error InvalidBattleTime();
    error ResultMismatch();

    event BattleOpened(
        bytes32 indexed battleId,
        bytes32 indexed creatureA,
        bytes32 indexed creatureB,
        bytes32 chamberA,
        bytes32 chamberB,
        bytes32 asset,
        uint64 startsAt,
        uint64 endsAt,
        uint256 startingNotional,
        bytes32 scoringConfigHash
    );
    event BattleActivated(bytes32 indexed battleId, uint64 activatedAt);
    event BattleEnded(bytes32 indexed battleId, uint64 endedAt);
    event BattleResolved(
        bytes32 indexed battleId,
        BattleResult result,
        int256 pnlA,
        int256 pnlB,
        bytes32 priceSeriesHash,
        bytes32 resolutionHash
    );
    event BattleCancelled(bytes32 indexed battleId, bytes32 indexed reason, uint64 cancelledAt);

    address public immutable operator;
    address public immutable resultPublisher;
    mapping(bytes32 battleId => Battle) private _battles;

    constructor(address operator_, address resultPublisher_) {
        if (operator_ == address(0) || resultPublisher_ == address(0)) {
            revert InvalidBattleInput();
        }
        operator = operator_;
        resultPublisher = resultPublisher_;
    }

    function createBattle(
        bytes32 battleId,
        bytes32 creatureA,
        bytes32 creatureB,
        bytes32 chamberA,
        bytes32 chamberB,
        bytes32 asset,
        uint64 startsAt,
        uint64 endsAt,
        uint256 startingNotional,
        bytes32 scoringConfigHash
    ) external {
        if (msg.sender != operator) revert Unauthorized();
        if (_battles[battleId].exists) revert BattleAlreadyExists(battleId);
        if (
            battleId == bytes32(0) || creatureA == bytes32(0) || creatureB == bytes32(0)
                || creatureA == creatureB || chamberA == bytes32(0) || chamberB == bytes32(0)
                || chamberA == chamberB || asset == bytes32(0) || startsAt >= endsAt
                || startingNotional == 0 || scoringConfigHash == bytes32(0)
        ) revert InvalidBattleInput();
        _battles[battleId] = Battle({
            creatureA: creatureA,
            creatureB: creatureB,
            chamberA: chamberA,
            chamberB: chamberB,
            asset: asset,
            startsAt: startsAt,
            endsAt: endsAt,
            startingNotional: startingNotional,
            scoringConfigHash: scoringConfigHash,
            state: BattleState.Created,
            pnlA: 0,
            pnlB: 0,
            result: BattleResult.Tie,
            priceSeriesHash: bytes32(0),
            cancellationReason: bytes32(0),
            exists: true
        });
        emit BattleOpened(
            battleId,
            creatureA,
            creatureB,
            chamberA,
            chamberB,
            asset,
            startsAt,
            endsAt,
            startingNotional,
            scoringConfigHash
        );
    }

    function activate(bytes32 battleId) external {
        Battle storage battle = _requireBattle(battleId);
        if (battle.state != BattleState.Created) revert InvalidBattleState(battle.state);
        if (block.timestamp < battle.startsAt || block.timestamp >= battle.endsAt) {
            revert InvalidBattleTime();
        }
        battle.state = BattleState.Active;
        emit BattleActivated(battleId, uint64(block.timestamp));
    }

    function end(bytes32 battleId) external {
        Battle storage battle = _requireBattle(battleId);
        if (battle.state != BattleState.Active) revert InvalidBattleState(battle.state);
        if (block.timestamp < battle.endsAt) revert InvalidBattleTime();
        battle.state = BattleState.Ended;
        emit BattleEnded(battleId, uint64(block.timestamp));
    }

    function resolve(
        bytes32 battleId,
        int256 pnlA,
        int256 pnlB,
        BattleResult result,
        bytes32 priceSeriesHash,
        bytes32 resolutionHash
    ) external {
        if (msg.sender != resultPublisher) revert Unauthorized();
        Battle storage battle = _requireBattle(battleId);
        if (battle.state != BattleState.Ended) revert InvalidBattleState(battle.state);
        if (priceSeriesHash == bytes32(0) || resolutionHash == bytes32(0)) {
            revert InvalidBattleInput();
        }
        bool resultIsValid = (pnlA > pnlB && result == BattleResult.CreatureA)
            || (pnlB > pnlA && result == BattleResult.CreatureB)
            || (pnlA == pnlB && result == BattleResult.Tie);
        if (!resultIsValid) revert ResultMismatch();
        battle.pnlA = pnlA;
        battle.pnlB = pnlB;
        battle.result = result;
        battle.priceSeriesHash = priceSeriesHash;
        battle.state = BattleState.Resolved;
        emit BattleResolved(battleId, result, pnlA, pnlB, priceSeriesHash, resolutionHash);
    }

    function cancel(bytes32 battleId, bytes32 reason) external {
        if (msg.sender != operator && msg.sender != resultPublisher) revert Unauthorized();
        if (reason == bytes32(0)) revert InvalidBattleInput();
        Battle storage battle = _requireBattle(battleId);
        if (
            battle.state != BattleState.Created && battle.state != BattleState.Active
                && battle.state != BattleState.Ended
        ) revert InvalidBattleState(battle.state);
        battle.state = BattleState.Cancelled;
        battle.cancellationReason = reason;
        emit BattleCancelled(battleId, reason, uint64(block.timestamp));
    }

    function getBattle(bytes32 battleId) external view returns (Battle memory) {
        return _requireBattle(battleId);
    }

    function _requireBattle(bytes32 battleId) internal view returns (Battle storage battle) {
        battle = _battles[battleId];
        if (!battle.exists) revert BattleNotFound(battleId);
    }
}
