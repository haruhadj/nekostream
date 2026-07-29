export type TrackerStatus = "watching" | "completed";

/** A finished show should land in the right list, not sit at "watching". */
export function deriveStatus(
  progress: number,
  totalEpisodes: number | null
): TrackerStatus {
  if (totalEpisodes && progress >= totalEpisodes) return "completed";
  return "watching";
}
