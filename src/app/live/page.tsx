import Link from "next/link";
import { getMatchesForDay } from "@/lib/data";
import { fmtTime, liveState } from "@/lib/format";
import { flagFor } from "@/lib/leagues";
import { tipFor } from "@/lib/markets";
import { ScoreCell, TipPill } from "@/components/Bits";
import type { PMatch } from "@/db/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // first visit on an empty database runs the initial sync

export default async function LivePage() {
  const [yesterday, today] = await Promise.all([getMatchesForDay(-1), getMatchesForDay(0)]);
  const all = [...yesterday, ...today];
  const live = all.filter((m) => liveState(m) === "live");
  const upcoming = today.filter((m) => liveState(m) === "scheduled");
  const awaiting = all.filter((m) => liveState(m) === "awaiting");
  const finished = all.filter((m) => liveState(m) === "finished").reverse();

  return (
    <div className="space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-black text-white md:text-4xl">🔴 Matchday Centre</h1>
        <p className="mt-2 text-slate-400">
          Kick-off status for yesterday and today. Official results arrive with the data feed (usually within hours of full time).
        </p>
      </div>
      <Block title={`In play (${live.length})`} list={live} empty="No matches in play right now." />
      <Block title={`Upcoming today (${upcoming.length})`} list={upcoming} empty="No more fixtures today." />
      {awaiting.length > 0 && <Block title={`Awaiting official result (${awaiting.length})`} list={awaiting} empty="" />}
      <Block title={`Finished (${finished.length})`} list={finished} empty="No finished matches yet." />
    </div>
  );
}

function Block({ title, list, empty }: { title: string; list: PMatch[]; empty: string }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-white">{title}</h2>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#0e1a14]">
          {list.map((m) => (
            <Link key={m.id} href={`/match/${m.id}`} className="grid grid-cols-[50px_1fr_auto_auto] items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.03]">
              <span className="text-xs text-slate-400">{fmtTime(m.kickoff)}</span>
              <div className="min-w-0">
                <p className="truncate text-[11px] text-slate-500">{flagFor(m.country)} {m.country} · {m.league}</p>
                <p className="truncate font-semibold text-white">{m.homeTeam} <span className="text-slate-500">vs</span> {m.awayTeam}</p>
              </div>
              <TipPill tip={tipFor(m, "1x2")?.tip ?? "-"} />
              <span className="w-24 text-right"><ScoreCell m={m} /></span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
