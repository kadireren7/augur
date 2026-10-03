import type { MarketView, OmenValue } from "./types";

const units = (value: string | number) =>
  typeof value === "number" ? BigInt(value) * 10n ** 18n : BigInt(value);
/** Hypothetical additional stake. Existing pools remain authoritative and unchanged. */
export function estimatePayout(
  market: MarketView,
  outcome: OmenValue,
  amount: number,
) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const stake = BigInt(amount) * 10n ** 18n;
  const winningPool = units(market.pools[outcome]) + stake;
  const totalPool = units(market.totalPool) + stake;
  return {
    payout: (stake * totalPool) / winningPool,
    shareBasisPoints: (stake * 10000n) / winningPool,
  };
}
