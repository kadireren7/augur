// IOmenPublisher.BehaviorType enum order. This labels published metadata; it does not analyze video.
const publishedBehaviors = [
  "Zone occupancy",
  "Zone entry",
  "Zone exit",
  "Directional movement",
  "Inactivity",
];
export function behaviorLabel(value?: string): string {
  if (!value) return "Unavailable";
  if (/^INDEXED_\d+$/.test(value))
    return (
      publishedBehaviors[Number(value.slice(8))] ?? "Unknown published behavior"
    );
  return value.replaceAll("_", " ");
}
