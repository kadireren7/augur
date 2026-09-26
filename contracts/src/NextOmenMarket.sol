// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { DemoToken } from "./DemoToken.sol";
import { IMarketTypes } from "./interfaces/IMarketTypes.sol";
import { IOmenPublisher } from "./interfaces/IOmenPublisher.sol";

contract NextOmenMarket is IMarketTypes {
    enum Outcome {
        Sell,
        Hold,
        Buy
    }

    struct Market {
        bytes32 chamberId;
        uint64 opensAt;
        uint64 locksAt;
        uint64 resolutionDeadline;
        uint64 minOmenSequence;
        uint64 maxOmenSequence;
        MarketState state;
        Outcome winningOutcome;
        uint64 resolvingSequence;
        uint256 totalPool;
        uint256 winningPool;
        uint256 remainingPool;
        uint256 remainingWinningStake;
        bool exists;
    }

    error Unauthorized();
    error InvalidMarketInput();
    error MarketNotFound(uint256 marketId);
    error InvalidMarketState(MarketState state);
    error PredictionWindowClosed();
    error InvalidOutcome(uint8 outcome);
    error InvalidAmount();
    error TransferFailed();
    error OmenNotFound(bytes32 chamberId, uint64 sequence);
    error IneligibleOmen(uint64 sequence);
    error OmenAlreadyConsumed(bytes32 chamberId, uint64 sequence);
    error ResolutionWindowClosed();
    error ResolutionDeadlinePending();
    error AlreadyClaimed(uint256 marketId, address account);
    error NoWinningPosition(uint256 marketId, address account);
    error NoRefund(uint256 marketId, address account);

    event MarketOpened(
        uint256 indexed marketId,
        bytes32 indexed chamberId,
        MarketType marketType,
        uint64 opensAt,
        uint64 locksAt,
        uint64 resolutionDeadline,
        uint64 minOmenSequence,
        uint64 maxOmenSequence
    );
    event PredictionPlaced(
        uint256 indexed marketId, address indexed participant, Outcome outcome, uint256 amount
    );
    event MarketLocked(uint256 indexed marketId, uint64 lockedAt);
    event MarketResolved(
        uint256 indexed marketId,
        Outcome outcome,
        uint64 indexed omenSequence,
        bytes32 provenanceHash,
        uint64 resolvedAt
    );
    event MarketCancelled(uint256 indexed marketId, bytes32 indexed reasonCode, uint64 cancelledAt);
    event Claimed(uint256 indexed marketId, address indexed participant, uint256 amount);
    event Refunded(uint256 indexed marketId, address indexed participant, uint256 amount);

    bytes32 public constant REASON_NO_WINNERS = keccak256("NO_WINNERS");
    bytes32 public constant REASON_DEADLINE_EXPIRED = keccak256("DEADLINE_EXPIRED");

    DemoToken public immutable token;
    IOmenPublisher public immutable omenPublisher;
    address public immutable marketOperator;
    uint256 public nextMarketId = 1;

    mapping(uint256 marketId => Market) private _markets;
    mapping(uint256 marketId => mapping(Outcome outcome => uint256)) public outcomePool;
    mapping(
        uint256 marketId => mapping(address account => mapping(Outcome outcome => uint256))
    ) public exposure;
    mapping(uint256 marketId => mapping(address account => uint256)) public userTotal;
    mapping(uint256 marketId => mapping(address account => bool)) public claimed;
    mapping(bytes32 chamberId => mapping(uint64 sequence => uint256 marketId)) public
        consumedByMarket;

    constructor(DemoToken token_, IOmenPublisher omenPublisher_, address marketOperator_) {
        if (
            address(token_) == address(0) || address(omenPublisher_) == address(0)
                || marketOperator_ == address(0)
        ) revert InvalidMarketInput();
        token = token_;
        omenPublisher = omenPublisher_;
        marketOperator = marketOperator_;
    }

    function createMarket(
        bytes32 chamberId,
        uint64 opensAt,
        uint64 locksAt,
        uint64 resolutionDeadline,
        uint64 minOmenSequence,
        uint64 maxOmenSequence
    ) external returns (uint256 marketId) {
        if (msg.sender != marketOperator) revert Unauthorized();
        if (
            chamberId == bytes32(0) || opensAt > locksAt || locksAt >= resolutionDeadline
                || minOmenSequence == 0
                || (maxOmenSequence != 0 && maxOmenSequence < minOmenSequence)
                || minOmenSequence <= omenPublisher.lastSequence(chamberId)
        ) revert InvalidMarketInput();
        marketId = nextMarketId++;
        _markets[marketId] = Market({
            chamberId: chamberId,
            opensAt: opensAt,
            locksAt: locksAt,
            resolutionDeadline: resolutionDeadline,
            minOmenSequence: minOmenSequence,
            maxOmenSequence: maxOmenSequence,
            state: MarketState.Open,
            winningOutcome: Outcome.Sell,
            resolvingSequence: 0,
            totalPool: 0,
            winningPool: 0,
            remainingPool: 0,
            remainingWinningStake: 0,
            exists: true
        });
        emit MarketOpened(
            marketId,
            chamberId,
            MarketType.NextOmen,
            opensAt,
            locksAt,
            resolutionDeadline,
            minOmenSequence,
            maxOmenSequence
        );
    }

    function predict(uint256 marketId, uint8 outcomeValue, uint256 amount) external {
        Market storage market = _requireMarket(marketId);
        if (
            market.state != MarketState.Open || block.timestamp < market.opensAt
                || block.timestamp >= market.locksAt
        ) revert PredictionWindowClosed();
        if (outcomeValue > uint8(Outcome.Buy)) revert InvalidOutcome(outcomeValue);
        if (amount == 0) revert InvalidAmount();
        Outcome outcome = Outcome(outcomeValue);

        market.totalPool += amount;
        outcomePool[marketId][outcome] += amount;
        exposure[marketId][msg.sender][outcome] += amount;
        userTotal[marketId][msg.sender] += amount;
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit PredictionPlaced(marketId, msg.sender, outcome, amount);
    }

    function lockMarket(uint256 marketId) external {
        Market storage market = _requireMarket(marketId);
        if (market.state != MarketState.Open) revert InvalidMarketState(market.state);
        if (block.timestamp < market.locksAt) revert PredictionWindowClosed();
        _lock(marketId, market);
    }

    function resolve(uint256 marketId, uint64 omenSequence) external {
        Market storage market = _requireMarket(marketId);
        if (market.state == MarketState.Open) {
            if (block.timestamp < market.locksAt) revert PredictionWindowClosed();
            _lock(marketId, market);
        }
        if (market.state != MarketState.Locked) revert InvalidMarketState(market.state);
        if (block.timestamp > market.resolutionDeadline) revert ResolutionWindowClosed();
        if (
            omenSequence < market.minOmenSequence
                || (market.maxOmenSequence != 0 && omenSequence > market.maxOmenSequence)
        ) revert IneligibleOmen(omenSequence);
        if (consumedByMarket[market.chamberId][omenSequence] != 0) {
            revert OmenAlreadyConsumed(market.chamberId, omenSequence);
        }
        IOmenPublisher.PublishedOmen memory omen =
            omenPublisher.getOmen(market.chamberId, omenSequence);
        if (!omen.exists) revert OmenNotFound(market.chamberId, omenSequence);
        if (omen.observedAt < market.locksAt || omen.observedAt > market.resolutionDeadline) {
            revert IneligibleOmen(omenSequence);
        }

        Outcome outcome = Outcome(uint8(omen.omenType));
        uint256 winners = outcomePool[marketId][outcome];
        consumedByMarket[market.chamberId][omenSequence] = marketId;
        if (winners == 0) {
            market.state = MarketState.Cancelled;
            emit MarketCancelled(marketId, REASON_NO_WINNERS, uint64(block.timestamp));
            return;
        }
        market.state = MarketState.Resolved;
        market.winningOutcome = outcome;
        market.resolvingSequence = omenSequence;
        market.winningPool = winners;
        market.remainingPool = market.totalPool;
        market.remainingWinningStake = winners;
        emit MarketResolved(
            marketId, outcome, omenSequence, omen.provenanceHash, uint64(block.timestamp)
        );
    }

    function cancelExpired(uint256 marketId) external {
        Market storage market = _requireMarket(marketId);
        if (market.state != MarketState.Open && market.state != MarketState.Locked) {
            revert InvalidMarketState(market.state);
        }
        if (block.timestamp <= market.resolutionDeadline) revert ResolutionDeadlinePending();
        market.state = MarketState.Cancelled;
        emit MarketCancelled(marketId, REASON_DEADLINE_EXPIRED, uint64(block.timestamp));
    }

    function claim(uint256 marketId) external returns (uint256 payout) {
        Market storage market = _requireMarket(marketId);
        if (market.state != MarketState.Resolved) revert InvalidMarketState(market.state);
        if (claimed[marketId][msg.sender]) revert AlreadyClaimed(marketId, msg.sender);
        uint256 stake = exposure[marketId][msg.sender][market.winningOutcome];
        if (stake == 0) revert NoWinningPosition(marketId, msg.sender);
        claimed[marketId][msg.sender] = true;
        if (stake == market.remainingWinningStake) {
            payout = market.remainingPool;
        } else {
            payout = (stake * market.totalPool) / market.winningPool;
        }
        market.remainingWinningStake -= stake;
        market.remainingPool -= payout;
        if (!token.transfer(msg.sender, payout)) revert TransferFailed();
        emit Claimed(marketId, msg.sender, payout);
    }

    function refund(uint256 marketId) external returns (uint256 amount) {
        Market storage market = _requireMarket(marketId);
        if (market.state != MarketState.Cancelled) revert InvalidMarketState(market.state);
        if (claimed[marketId][msg.sender]) revert AlreadyClaimed(marketId, msg.sender);
        amount = userTotal[marketId][msg.sender];
        if (amount == 0) revert NoRefund(marketId, msg.sender);
        claimed[marketId][msg.sender] = true;
        if (!token.transfer(msg.sender, amount)) revert TransferFailed();
        emit Refunded(marketId, msg.sender, amount);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return _requireMarket(marketId);
    }

    function _lock(uint256 marketId, Market storage market) internal {
        market.state = MarketState.Locked;
        emit MarketLocked(marketId, uint64(block.timestamp));
    }

    function _requireMarket(uint256 marketId) internal view returns (Market storage market) {
        market = _markets[marketId];
        if (!market.exists) revert MarketNotFound(marketId);
    }
}
