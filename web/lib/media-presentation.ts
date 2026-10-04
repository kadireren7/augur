/** Viewing composition only; these settings do not affect oracle observations. */
export interface MediaComposition {
  fit: "cover" | "contain";
  position: string;
  heroPosition: string;
  wallPosition: string;
}
export const creatureComposition: Record<string, MediaComposition> = {
  Pablo: { fit: "cover", position: "50% 55%", heroPosition: "50% 56%", wallPosition: "32% 55%" },
  Bubbles: { fit: "cover", position: "50% 55%", heroPosition: "50% 55%", wallPosition: "72% 55%" },
  Turbo: { fit: "cover", position: "50% 50%", heroPosition: "50% 50%", wallPosition: "36% 50%" },
};
export function mediaComposition(name: string): MediaComposition {
  return creatureComposition[name] ?? {
    fit: "contain", position: "50% 50%", heroPosition: "50% 50%", wallPosition: "50% 50%",
  };
}
