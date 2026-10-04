import { creatureMedia } from "./media";
import { creatureIdentity } from "./creature-identity";
import type { ChamberView, Species } from "./types";

/** Display identities and indexed truth only; replay rooms do not acquire markets. */
export function wallRooms(chambers: ChamberView[], mode: "LOCAL" | "ENVIO") {
  return (["Hamster", "Fish", "Turtle"] as Species[]).map((species) => {
    const entry = creatureMedia[species];
    const chamber = mode === "ENVIO" ? chambers.find((room) => room.creature.species === species) : undefined;
    const market = chamber?.activeMarket ?? chamber?.marketHistory[0];
    return {
      ...creatureIdentity[species],
      species, slug: entry.slug, chamber,
      label: species === "Turtle" ? "Land tortoise" : creatureIdentity[species].label,
      href: chamber ? `/chambers/${chamber.slug}` : `/replays/${entry.slug}`,
      omen: chamber?.latestOmen ?? null,
      market: market?.mode === "CONTRACT" ? market : null,
    };
  });
}
