import { describe, expect, it } from "vitest";
import { newPracticeState, placePracticePrediction } from "@/lib/practice-exchange";
import { practiceChartData } from "@/lib/practice-chart";

describe("timestamped practice chart", () => {
  it("charts actual stake changes and user markers, not fabricated prices", () => {
    const state = placePracticePrediction(newPracticeState(100000), "pablo", "BUY", 25, 101000);
    const { points, markers } = practiceChartData(state.rounds.pablo);
    expect(points).toHaveLength(2);
    expect(points[1].volume).toBe(25);
    expect(points[1].BUY + points[1].HOLD + points[1].SELL).toBeCloseTo(100);
    expect(markers).toEqual([{ time: 101, outcome: "BUY", stake: 25 }]);
  });
  it("merges same-second actions without duplicate chart times or lost volume", () => {
    const first = placePracticePrediction(newPracticeState(100000), "pablo", "BUY", 25, 100100);
    const second = placePracticePrediction(first, "pablo", "HOLD", 10, 100200);
    const data = practiceChartData(second.rounds.pablo);
    expect(data.points).toHaveLength(1);
    expect(data.points[0].volume).toBe(35);
    expect(data.markers).toHaveLength(2);
  });
  it("does not invent timestamps for old browser history", () => {
    const round = newPracticeState(100000).rounds.pablo;
    round.samples = [{ BUY: 10, HOLD: 20, SELL: 30 }];
    expect(practiceChartData(round).points).toEqual([]);
  });
});
