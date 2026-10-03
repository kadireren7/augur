import type { Species } from "./types";

/** Public display aliases, not onchain metadata or source attestations. */
export const creatureIdentity = {
  Hamster: {
    name: "Pablo",
    label: "Hamster",
    behavior: "Zone entry",
    rules:
      "LEFT → SELL · CENTER → HOLD · RIGHT → BUY. Confidence, debounce and cooldown must pass.",
  },
  Fish: {
    name: "Bubbles",
    label: "Fish",
    behavior: "Swimming direction",
    rules:
      "Validated left, center and right zone transitions map to SELL, HOLD and BUY. Conflicting observations produce no signal.",
  },
  Turtle: {
    name: "Turbo",
    label: "Tortoise",
    behavior: "Zone occupancy",
    rules:
      "Sustained zone occupancy maps to SELL, HOLD or BUY with the existing slower tortoise dwell and debounce template.",
  },
} satisfies Record<
  Species,
  { name: string; label: string; behavior: string; rules: string }
>;
