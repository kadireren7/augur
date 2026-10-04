import { describe, expect, it } from "vitest";
import { wallRooms } from "./creature-wall";
import type { ChamberView } from "./types";

const indexed = {
  id: "public-chamber", slug: "indexed-public",
  creature: { species: "Hamster", name: "Hamster 72ca19" },
  latestOmen: { value: "BUY", sequence: 1 },
  activeMarket: { id: 2, mode: "CONTRACT", state: "OPEN", totalPool: "1000000000000000000" },
  marketHistory: [],
} as unknown as ChamberView;

describe("three-creature wall", () => {
  it("always links three readable identities, without inventing replay markets", () => {
    const rooms = wallRooms([indexed], "ENVIO");
    expect(rooms.map((room) => room.name)).toEqual(["Pablo", "Bubbles", "Turbo"]);
    expect(rooms.map((room) => room.href)).toEqual(["/chambers/indexed-public", "/replays/bubbles", "/replays/turbo"]);
    expect(rooms[0].market?.id).toBe(2);
    expect(rooms[0].omen?.value).toBe("BUY");
    for (const room of rooms.slice(1)) {
      expect(room.market).toBeNull();
      expect(room.omen).toBeNull();
    }
    expect(rooms[2].label).toBe("Land tortoise");
  });
  it("does not present local fixtures as indexed market truth", () => {
    expect(wallRooms([indexed], "LOCAL").every((room) => !room.market && !room.omen)).toBe(true);
  });
});
