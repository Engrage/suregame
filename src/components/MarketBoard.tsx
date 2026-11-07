import Link from "next/link";
import type { PMatch } from "@/db/schema";
import { evaluate, tipFor, type BaseMarket, type Pick, marketShort } from "@/lib/markets";
import { fmtTime } from "@/lib/format";
import { flagFor } from "@/lib/leagues";
import { ConfidenceBar, OddsCell, OutcomeBadge, ScoreCell, TipPill } from "./Bits";

function groupByLeague(list: PMatch[]) {
  const map = new Map<string, PMatch[]>();
  for (const m of list) {
    const k = `${m.country}|${m.league}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(m);
  }
  return [...map.entries()];
}

export function MarketBoard({ list, market, limit }: { list: PMatch[]; market: BaseMarket; limit?: number }) {
  const rows = limit ? list.slice(0, limit) : list;
  if (rows.length === 0) return <Empty />;
  const showProbs = market === "1x2" || market === "double-chance";
  return (
    <div className="space-y-4">
      {groupByLeague(rows).map(([key, ms]) => {
        const [country, league] = key.split("|");
        return (
          <div key={key} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e1a14]">
            <div className="flex items-center justify-between bg-white/[0.03] px-4 py-2.5">
              <p className="text-sm font-bold text-white">
                <span className="mr-2">{flagFor(country)}</span>
                {country} <span className="text-slate-500">·</span> {league}
              </p>
              <span className="text-xs text-slate-500">{ms.length} matches</span>
            </div>
            <div className="divide-y divide-white/5">
              {ms.map((m) => {
                const t = tipFor(m, market);
                if (!t) return null;
                const outcome = evaluate(m, market, t);
                return (
                  <div key={m.id} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-3 text-sm md:grid-cols-[56px_1fr_160px_90px_110px_70px_80px_32px]">
                    <span className="text-xs font-semibold tabular-nums text-slate-400">{fmtTime(m.kickoff)}</span>
                    <Link href={`/match/${m.id}`} className="min-w-0 hover:text-emerald-300">
                      <p className="truncate font-semibold text-white">{m.homeTeam}</p>
                      <p className="truncate text-slate-300">{m.awayTeam}</p>
                    </Link>
                    <div className="hidden gap-1 md:flex">
                      {showProbs ? (
                        <>
                          <Prob v={m.homeProb} hi={t.tip.includes("1")} />
                          <Prob v={m.drawProb} hi={t.tip.includes("X")} />
                          <Prob v={m.awayProb} hi={t.tip.includes("2")} />
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">{t.label}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 md:block">
                      <TipPill tip={t.tip} hot={t.confidence >= 75} />
                      <span className="md:hidden"><OutcomeBadge outcome={outcome} /></span>
                    </div>
                    <div className="hidden md:block"><ConfidenceBar value={t.confidence} /></div>
                    <span className="hidden md:block"><OddsCell odds={t.odds} edge={t.edge} market={t.marketOdds} /></span>
                    <span className="hidden md:block"><ScoreCell m={m} /></span>
                    <span className="hidden md:block"><OutcomeBadge outcome={outcome} /></span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Prob({ v, hi }: { v: number; hi: boolean }) {
  return (
    <span className={`w-12 rounded-md py-1 text-center text-xs font-bold tabular-nums ${hi ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-slate-400"}`}>
      {Math.round(v)}%
    </span>
  );
}

export function PickBoard({ picks, limit, tone = "amber" }: { picks: Pick[]; limit?: number; tone?: "amber" | "sky" }) {
  const rows = limit ? picks.slice(0, limit) : picks;
  if (rows.length === 0) return <Empty />;
  const border = tone === "amber" ? "border-amber-400/20 from-amber-400/[0.06]" : "border-sky-400/20 from-sky-400/[0.06]";
  return (
    <div className={`overflow-hidden rounded-2xl border bg-gradient-to-b to-[#0e1a14] ${border}`}>
      <div className="hidden grid-cols-[56px_1fr_80px_100px_110px_70px_80px_32px] gap-3 border-b border-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
        <span>Time</span><span>Match</span><span>Market</span><span>Tip</span><span>Model prob.</span><span>Odds</span><span>Score</span><span />
      </div>
      <div className="divide-y divide-white/5">
        {rows.map(({ match: m, market, tip, outcome }) => (
          <div key={`${m.id}-${market}`} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-3 text-sm md:grid-cols-[56px_1fr_80px_100px_110px_70px_80px_32px]">
            <span className="text-xs font-semibold tabular-nums text-slate-400">{fmtTime(m.kickoff)}</span>
            <Link href={`/match/${m.id}`} className="min-w-0 hover:text-amber-200">
              <p className="truncate text-[11px] text-slate-500">{flagFor(m.country)} {m.country} · {m.league}</p>
              <p className="truncate font-semibold text-white">{m.homeTeam} <span className="text-slate-500">vs</span> {m.awayTeam}</p>
            </Link>
            <span className="hidden text-xs font-semibold text-slate-400 md:block">{marketShort(market)}</span>
            <div className="flex items-center gap-2 md:block">
              <TipPill tip={tip.tip} hot={tone === "amber"} />
              <span className="md:hidden"><OutcomeBadge outcome={outcome} /></span>
            </div>
            <div className="hidden md:block"><ConfidenceBar value={tip.confidence} /></div>
            <span className="hidden md:block"><OddsCell odds={tip.odds} edge={tip.edge} market={tip.marketOdds} /></span>
            <span className="hidden md:block"><ScoreCell m={m} /></span>
            <span className="hidden md:block"><OutcomeBadge outcome={outcome} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-400">
      No model picks for this selection. Try another day — most fixtures fall on weekends.
    </div>
  );
}
