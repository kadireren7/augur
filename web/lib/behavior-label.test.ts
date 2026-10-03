import { describe, expect, it } from "vitest";
import { behaviorLabel } from "./behavior-label";
describe("published behavior labels", () => {
  it("follows the contract enum without inventing observations", () => {
    expect(behaviorLabel("INDEXED_1")).toBe("Zone entry");
    expect(behaviorLabel("INDEXED_99")).toBe("Unknown published behavior");
    expect(behaviorLabel()).toBe("Unavailable");
  });
});
