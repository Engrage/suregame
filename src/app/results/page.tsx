import Link from "next/link";
import { getFinishedSince } from "@/lib/data";
import { hitRates, picksFor } from "@/lib/stats";
import { MARKETS, getMarket } from "@/lib/markets";
import { fmtDate, fmtTime } from "@/lib/format";
import { OutcomeBadge, TipPill } from "@/components/Bits";
import type { Pick } from "@/lib/markets";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // first visit on an empty database runs the initial sync

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const { market = "sure-games" } = await searchParams;
  const mk = getMarket(market) ?? MARKETS[0];
  const finished = await getFinishedSince(30);
  const rates = hitRates(finished);
  const rows = picksFor(finished, mk.key).sort((a, b) => b.match.kickoff.getTime() - a.match.kickoff.getTime());
  const byDay = new Map<string, Pick[]>();
  for (const r of rows) {
    const d = fmtDate(r.match.kickoff);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(r);
  }

  return (
    <div className="space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-black text-white md:text-4xl">✅ Results Archive</h1>
        <p className="mt-2 text-slate-400">
          Every model pick from the last 30 days graded against the official result. Predictions were made out-of-sample, before each matchday.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {rates.map((r) => (
          <Link key={r.key} href={`/results?market=${r.key}`} className={`rounded-2xl border p-4 ${r.key === mk.key ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-[#0e1a14] hover:border-white/20"}`}>
            <p className="text-sm text-slate-300">{r.icon} {r.name}</p>
            <p className="mt-1 text-3xl font-black text-white">{r.rate}%</p>
            <p className="text-xs text-slate-500">
              {r.won} won / {r.total - r.won} lost
              {r.roi != null && <span className={r.roi >= 0 ? " text-emerald-400" : " text-rose-400"}> · ROI {r.roi > 0 ? "+" : ""}{r.roi}%</span>}
            </p>
          </Link>
        ))}
      </div>

      {[...byDay.entries()].map(([d, list]) => {
        const won = list.filter((r) => r.outcome === "won").length;
        return (
          <section key={d}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold text-white">{d}</h2>
              <span className="text-sm text-slate-400"><b className="text-emerald-300">{won}</b> / {list.length} won</span>
            </div>
            <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#0e1a14]">
              {list.map((r) => (
                <Link key={`${r.match.id}-${r.market}`} href={`/match/${r.match.id}`} className="grid grid-cols-[50px_1fr_auto_50px_60px_28px] items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.03]">
                  <span className="text-xs text-slate-500">{fmtTime(r.match.kickoff)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-white">{r.match.homeTeam} <span className="text-slate-500">vs</span> {r.match.awayTeam}</p>
                    <p className="truncate text-[11px] text-slate-500">{r.match.country} · {r.match.league}</p>
                  </div>
                  <TipPill tip={r.tip.tip} />
                  <span className="text-right text-xs text-slate-400">{r.tip.confidence}%</span>
                  <span className="text-center font-mono font-bold text-white">{r.match.homeScore}-{r.match.awayScore}</span>
                  <OutcomeBadge outcome={r.outcome} />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {rows.length === 0 && <p className="text-center text-slate-500">No graded picks yet for this market.</p>}
    </div>
  );
}
