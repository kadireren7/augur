// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMarketTypes {
    enum MarketType {
        NextOmen,
        NextTradeProfitable,
        CreatureBattleWinner
    }

    enum MarketState {
        Open,
        Locked,
        Resolved,
        Cancelled
    }
}
