export function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function dayLabel(offset: number, d: Date) {
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  if (offset === 1) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
}

/** Accepts "today" | "yesterday" | "tomorrow" | integer offset. */
export function dayOffset(day?: string | null) {
  if (!day || day === "today") return 0;
  if (day === "yesterday") return -1;
  if (day === "tomorrow") return 1;
  const n = parseInt(day, 10);
  return Number.isFinite(n) ? Math.max(-14, Math.min(14, n)) : 0;
}

export type LiveState = "scheduled" | "live" | "awaiting" | "finished";

export function liveState(m: { status: string; kickoff: Date }, now = Date.now()): LiveState {
  if (m.status === "finished") return "finished";
  const t = m.kickoff.getTime();
  if (now < t) return "scheduled";
  if (now < t + 115 * 60000) return "live";
  return "awaiting";
}
