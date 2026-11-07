import type { Outcome } from "@/lib/markets";
import { liveState } from "@/lib/format";

export function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 75 ? "bg-emerald-400" : value >= 55 ? "bg-lime-400" : value >= 35 ? "bg-amber-400" : "bg-orange-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-bold tabular-nums text-white">{value}%</span>
    </div>
  );
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  if (outcome === "pending") return <span className="text-xs text-slate-500">—</span>;
  return outcome === "won" ? (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-xs font-black text-emerald-950" title="Won">✓</span>
  ) : (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-xs font-black text-white" title="Lost">✕</span>
  );
}

type ScoreLike = { status: string; kickoff: Date; homeScore: number | null; awayScore: number | null; htHome: number | null; htAway: number | null };

export function ScoreCell({ m }: { m: ScoreLike }) {
  const s = liveState(m);
  if (s === "live")
    return (
      <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> In play
      </span>
    );
  if (s === "awaiting") return <span className="text-[10px] font-semibold uppercase text-slate-500">Awaiting FT</span>;
  if (s === "finished" && m.homeScore != null)
    return (
      <span className="font-mono text-sm font-bold text-white">
        {m.homeScore}-{m.awayScore}
        {m.htHome != null && <span className="ml-1 text-[10px] font-normal text-slate-500">({m.htHome}-{m.htAway})</span>}
      </span>
    );
  return <span className="text-xs text-slate-500">vs</span>;
}

export function TipPill({ tip, hot }: { tip: string; hot?: boolean }) {
  return (
    <span
      className={`inline-block min-w-12 rounded-md px-2 py-1 text-center text-xs font-extrabold ${
        hot ? "bg-amber-400 text-amber-950" : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
      }`}
    >
      {tip}
    </span>
  );
}

export function OddsCell({ odds, edge, market }: { odds?: number; edge?: number; market: boolean }) {
  if (!odds) return <span className="text-xs text-slate-600">—</span>;
  return (
    <span className="flex flex-col leading-tight">
      <span className={`text-xs font-bold tabular-nums ${market ? "text-amber-300" : "text-slate-400"}`} title={market ? "Average bookmaker odds" : "Model fair odds"}>
        {odds.toFixed(2)}
        {!market && <span className="ml-0.5 text-[9px] font-normal">fair</span>}
      </span>
      {edge != null && (
        <span className={`text-[10px] font-semibold ${edge > 0 ? "text-emerald-400" : "text-slate-500"}`}>
          {edge > 0 ? "+" : ""}
          {edge}% EV
        </span>
      )}
    </span>
  );
}
