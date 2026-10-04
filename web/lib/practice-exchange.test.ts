import { describe, expect, it } from "vitest";
import { advancePractice, claimPracticeResult, estimatedPracticePayout, newPracticeState, OPEN_MS, LOCK_MS, placePracticePrediction, poolTotal, practicePools, restorePracticeState } from "./practice-exchange";
describe("isolated practice exchange", () => {
  it("places a real demo position and deducts credits", () => {
    const state = placePracticePrediction(newPracticeState(1000), "pablo", "BUY", 25, 2000);
    expect(state.balance).toBe(975);
    expect(state.rounds.pablo.positions.at(-1)).toMatchObject({ actor: "You", stake: 25, outcome: "BUY" });
  });
  it("rejects invalid stakes, insufficient funds and late positions", () => {
    for (const stake of [0, -1, 1.5, 1001, NaN]) expect(() => placePracticePrediction(newPracticeState(0), "pablo", "BUY", stake, 0)).toThrow();
    expect(() => placePracticePrediction(newPracticeState(0), "pablo", "BUY", 1, OPEN_MS)).toThrow(/locked/);
  });
  it("settles pro-rata, allows one claim and persists its result", () => {
    const placed = placePracticePrediction(newPracticeState(0), "pablo", "HOLD", 25, 0);
    const pools = practicePools(placed.rounds.pablo);
    const resolved = advancePractice(placed, OPEN_MS + LOCK_MS);
    const result = resolved.results.find((entry) => entry.creature === "pablo")!;
    expect(result.payout).toBe(Math.floor(poolTotal(pools) * 25 / pools.HOLD));
    const claimed = claimPracticeResult(resolved, result.id, OPEN_MS + LOCK_MS);
    expect(claimed.balance).toBe(975 + result.payout);
    expect(() => claimPracticeResult(claimed, result.id, 27000)).toThrow();
    expect(restorePracticeState(JSON.stringify(claimed), 27000).balance).toBe(claimed.balance);
  });
  it("records losses without fabricated credit returns", () => {
    const state = advancePractice(placePracticePrediction(newPracticeState(0), "pablo", "SELL", 25, 0), 26000);
    expect(state.results.find((entry) => entry.creature === "pablo")?.payout).toBe(0);
    expect(state.balance).toBe(975);
  });
  it("advances all three rooms, starts new rounds and does not settle twice", () => {
    const resolved = advancePractice(newPracticeState(0), 26000);
    expect(resolved.results).toHaveLength(3);
    expect(advancePractice(resolved, 27000).results).toHaveLength(3);
    expect(advancePractice(resolved, 36000).rounds.turbo.number).toBe(2);
  });
  it("estimates resulting pool share and rejects corrupt storage", () => {
    const round = newPracticeState(0).rounds.pablo, pools = practicePools(round);
    expect(estimatedPracticePayout(round, "BUY", 20)).toBe(Math.floor((poolTotal(pools) + 20) * 20 / (pools.BUY + 20)));
    expect(restorePracticeState('{"balance":999999}', 100).balance).toBe(1000);
  });
  it("does not discard an unclaimed payout as newer rounds complete", () => {
    let state = advancePractice(placePracticePrediction(newPracticeState(0), "pablo", "HOLD", 25, 0), 26000);
    const result = state.results.find((entry) => entry.creature === "pablo")!;
    for (let round = 1; round <= 12; round++) {
      state = advancePractice(state, round * 36000);
      state = advancePractice(state, round * 36000 + 26000);
    }
    expect(state.results.find((entry) => entry.id === result.id)?.claimed).toBe(false);
    expect(claimPracticeResult(state, result.id, 500000).balance).toBe(975 + result.payout);
  });
  it("refunds demo positions when no stake backs the selected outcome", () => {
    const state = newPracticeState(0);
    state.rounds.pablo.positions = [{ actor: "You", outcome: "BUY", stake: 25 }];
    state.balance = 975;
    const resolved = advancePractice(state, 26000);
    expect(resolved.results.find((entry) => entry.creature === "pablo")?.payout).toBe(25);
  });
});
