import { describe, expect, it } from "vitest";
import { formatAugd } from "./token-amount";

describe("AUGD display units", () => {
  it("formats indexed base units using all 18 decimals", () => {
    expect(formatAugd("1000000000000000000")).toBe("1");
    expect(formatAugd("10000000000000000000")).toBe("10");
    expect(formatAugd("10000000000000000001")).toBe("10.000000000000000001");
    expect(formatAugd(1n)).toBe("0.000000000000000001");
    expect(formatAugd("0")).toBe("0");
    expect(formatAugd("123456789012345678901234567890")).toBe("123456789012.34567890123456789");
  });
  it("preserves whole-token fixture amounts and rejects unsafe numbers", () => {
    expect(formatAugd(10)).toBe("10");
    expect(() => formatAugd(1e19)).toThrow();
    expect(() => formatAugd("1.5")).toThrow();
    expect(() => formatAugd(-1)).toThrow();
  });
});
