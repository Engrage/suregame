import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDayCounts, getFinishedSince, getMatchesForDay, dayStart } from "@/lib/data";
import { MARKETS, getMarket, surePicks, valuePicks, type BaseMarket } from "@/lib/markets";
import { hitRates } from "@/lib/stats";
import { dayLabel, dayOffset, fmtDate } from "@/lib/format";
import { LEAGUES, leagueByDiv } from "@/lib/leagues";
import DayTabs from "@/components/DayTabs";
import { MarketBoard, PickBoard } from "@/components/MarketBoard";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // first visit on an empty database runs the initial sync

export async function generateMetadata({ params }: { params: Promise<{ market: string }> }): Promise<Metadata> {
  const { market } = await params;
  const mk = getMarket(market);
  return { title: mk ? `${mk.name} Today | SureGames` : "Predictions | SureGames", description: mk?.description };
}

export default async function MarketPage({
  params,
  searchParams,
}: {
  params: Promise<{ market: string }>;
  searchParams: Promise<{ day?: string; league?: string }>;
}) {
  const { market } = await params;
  const { day, league } = await searchParams;
  const mk = getMarket(market);
  if (!mk) notFound();
  const offset = dayOffset(day);
  const lg = league ? leagueByDiv(league) : undefined;
  const [list, finished, days] = await Promise.all([getMatchesForDay(offset, lg?.div), getFinishedSince(30), getDayCounts(-3, 6)]);
  const rate = hitRates(finished).find((r) => r.key === mk.key);
  const extraLeague = lg ? `&league=${lg.div}` : "";

  return (
    <div className="py-8">
      <nav className="mb-3 text-xs text-slate-500">
        <Link href="/" className="hover:text-emerald-300">Home</Link> / <span>Predictions</span> / <span className="text-slate-300">{mk.name}</span>
      </nav>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-black text-white md:text-4xl">
            {mk.icon} {mk.name} <span className="text-emerald-400">{dayLabel(offset, dayStart(offset))}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-slate-400">{mk.description}</p>
          <p className="mt-1 text-xs text-slate-500">
            {fmtDate(dayStart(offset))} · times in UTC · {list.length} matches
            {lg && (
              <>
                {" "}· {lg.flag} {lg.country} {lg.league}{" "}
                <Link href={`/predictions/${mk.key}?day=${offset}`} className="text-emerald-300 hover:underline">clear</Link>
              </>
            )}
          </p>
        </div>
        {rate && rate.total > 0 && (
          <span className="self-start rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-sm font-semibold text-emerald-300 lg:self-end">
            30-day hit rate: {rate.rate}% ({rate.won}/{rate.total}){rate.roi != null && ` · ROI ${rate.roi > 0 ? "+" : ""}${rate.roi}%`}
          </span>
        )}
      </div>

      <div className="mt-5"><DayTabs base={`/predictions/${mk.key}`} active={offset} days={days} extra={extraLeague} /></div>

      <div className="no-scrollbar my-4 flex gap-2 overflow-x-auto">
        {MARKETS.map((m) => (
          <Link
            key={m.key}
            href={`/predictions/${m.key}?day=${offset}${extraLeague}`}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
              m.key === mk.key ? "bg-emerald-500 text-emerald-950" : "border border-white/10 bg-white/5 text-slate-300 hover:text-white"
            }`}
          >
            {m.icon} {m.name}
          </Link>
        ))}
      </div>

      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto text-xs">
        <Link href={`/predictions/${mk.key}?day=${offset}`} className={`whitespace-nowrap rounded-full px-3 py-1.5 ${!lg ? "bg-white text-black" : "border border-white/10 text-slate-400"}`}>All leagues</Link>
        {LEAGUES.map((l) => (
          <Link key={l.div} href={`/predictions/${mk.key}?day=${offset}&league=${l.div}`} className={`whitespace-nowrap rounded-full px-3 py-1.5 ${lg?.div === l.div ? "bg-white text-black" : "border border-white/10 text-slate-400 hover:text-white"}`}>
            {l.flag} {l.league}
          </Link>
        ))}
      </div>

      {mk.key === "sure-games" ? (
        <>
          <Notice tone="amber">🔥 Sure games are tips the model rates at <b>75%+</b> probability <b>and</b> the bookmakers also rate as likely (60%+ implied). No pick is guaranteed — stake responsibly.</Notice>
          <PickBoard picks={surePicks(list)} />
        </>
      ) : mk.key === "value" ? (
        <>
          <Notice tone="sky">💎 Value = model probability × bookmaker odds − 1 ≥ <b>5%</b>. Lower hit rate than sure games, but positive expected return over time.</Notice>
          <PickBoard picks={valuePicks(list)} tone="sky" />
        </>
      ) : (
        <MarketBoard list={list} market={mk.key as BaseMarket} />
      )}
    </div>
  );
}

function Notice({ tone, children }: { tone: "amber" | "sky"; children: React.ReactNode }) {
  const c = tone === "amber" ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-sky-400/30 bg-sky-400/10 text-sky-100";
  return <div className={`mb-4 rounded-2xl border p-4 text-sm ${c}`}>{children}</div>;
}
