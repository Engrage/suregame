import Link from "next/link";
import { getDayCounts, getFinishedSince, getMatchesForDay, getModelFits } from "@/lib/data";
import { MARKETS, surePicks, valuePicks } from "@/lib/markets";
import { hitRates, modelMetrics, picksFor } from "@/lib/stats";
import { MarketBoard, PickBoard } from "@/components/MarketBoard";
import { dayLabel, fmtDate } from "@/lib/format";
import { LEAGUES } from "@/lib/leagues";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // first visit on an empty database runs the initial sync

const FAQ = [
  { q: "How does the SureGames model work?", a: "Each league is fitted with a time-weighted Dixon–Coles Poisson model. Every team gets an attack and a defence rating estimated from real results and expected goals (xG) over the last two seasons, with recent matches weighted more heavily. From the predicted goal rates we build a full scoreline probability matrix, which gives 1X2, over/under, BTTS, correct score and HT/FT probabilities." },
  { q: "What are sure games?", a: "Sure games are tips the model rates at 75% probability or higher (83%+ for double chance). They are the strongest single pick per fixture — still not guaranteed, but statistically the safest on the board." },
  { q: "What are value bets?", a: "A value bet is where the model's probability is higher than the bookmaker's implied probability by at least 5%. Over time, consistently betting positive expected value is the only way to beat the market." },
  { q: "Is the accuracy real?", a: "Yes. Every prediction is generated using only data available before the matchday (out-of-sample), stored, and graded automatically against the official result. The Model page compares our Brier score and log loss directly with bookmaker odds." },
  { q: "Where does the data come from?", a: "Results, xG, corners, half-time scores and average bookmaker odds come from football-data.co.uk and are refreshed every two hours." },
];

export default async function Home() {
  const days = await getDayCounts(0, 7);
  const active = days.find((d) => d.count > 0) ?? days[0];
  const [list, finished, fits] = await Promise.all([getMatchesForDay(active.offset), getFinishedSince(30), getModelFits()]);
  const sure = surePicks(list);
  const value = valuePicks(list);
  const rates = hitRates(finished);
  const metrics = modelMetrics(finished);
  const sureRate = rates.find((r) => r.key === "sure-games");
  const valueRate = rates.find((r) => r.key === "value");
  const accaPicks = sure.filter((p) => p.match.status === "scheduled" && p.match.kickoff.getTime() > Date.now()).slice(0, 3);
  const accaOdds = accaPicks.reduce((acc, p) => acc * (p.tip.odds ?? 1), 1);
  const accaProb = accaPicks.reduce((acc, p) => acc * (p.tip.confidence / 100), 1);
  const label = active.offset === 0 ? "Today" : `${dayLabel(active.offset, active.date)} (next matchday)`;
  const leagueCounts = LEAGUES.map((l) => ({ ...l, n: list.filter((m) => m.div === l.div).length })).filter((l) => l.n > 0);

  return (
    <div className="space-y-12 py-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top_left,_rgba(16,185,129,0.35),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(250,204,21,0.15),_transparent_50%)] p-6 md:p-10">
        <div className="absolute inset-0 -z-10 bg-[#0b1912]" />
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Dixon–Coles model · {fits.length} leagues · {fmtDate(active.date)}
            </span>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
              Sure Football Predictions <span className="bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent">from a real model</span>
            </h1>
            <p className="mt-4 max-w-xl text-slate-300">
              Team attack & defence ratings fitted on real results and xG, turned into full scoreline probabilities — then
              compared against bookmaker odds to find sure games and value bets. Every pick is graded publicly.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/predictions/sure-games?day=${active.offset}`} className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-amber-950 shadow-lg shadow-amber-500/20 hover:bg-amber-300">
                🔥 {label} Sure Games
              </Link>
              <Link href={`/predictions/value?day=${active.offset}`} className="rounded-xl border border-sky-400/40 bg-sky-400/10 px-5 py-3 font-semibold text-sky-200 hover:bg-sky-400/20">
                💎 Value bets
              </Link>
              <Link href="/model" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white hover:bg-white/10">
                How the model works
              </Link>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat value={list.length} label={`matches ${active.offset === 0 ? "today" : "next matchday"}`} />
              <Stat value={sure.length} label="sure games" />
              <Stat value={sureRate?.total ? `${sureRate.rate}%` : "—"} label={`sure hit rate (30d, n=${sureRate?.total ?? 0})`} />
              <Stat value={valueRate?.roi != null ? `${valueRate.roi > 0 ? "+" : ""}${valueRate.roi}%` : "—"} label="value ROI (30d)" />
            </div>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-[#0d1813]/90 p-5">
            <div className="flex items-center justify-between">
              <p className="font-bold text-white">🎟️ Sure Acca</p>
              {accaPicks.length > 0 && (
                <span className="rounded-md bg-amber-400 px-2 py-1 text-xs font-black text-amber-950">@{accaOdds.toFixed(2)}</span>
              )}
            </div>
            {accaPicks.length > 0 && <p className="mt-1 text-xs text-slate-400">Model probability all 3 land: {Math.round(accaProb * 100)}%</p>}
            <div className="mt-4 space-y-3">
              {accaPicks.length === 0 && <p className="text-sm text-slate-400">No upcoming sure picks for this matchday yet.</p>}
              {accaPicks.map((p) => (
                <Link key={p.match.id} href={`/match/${p.match.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 hover:bg-white/10">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{p.match.homeTeam} vs {p.match.awayTeam}</p>
                    <p className="text-xs text-slate-400">{p.match.league} · {MARKETS.find((x) => x.key === p.market)?.short}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-amber-300">{p.tip.tip}</p>
                    <p className="text-[11px] text-slate-400">{p.tip.confidence}% · @{p.tip.odds?.toFixed(2)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle title="Prediction markets" sub="Every market is derived from the same scoreline probability matrix." />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {MARKETS.map((mk) => {
            const top = picksFor(list, mk.key).sort((a, b) => b.tip.confidence - a.tip.confidence)[0];
            return (
              <Link key={mk.key} href={`/predictions/${mk.key}?day=${active.offset}`} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${mk.key === "sure-games" ? "border-amber-400/40 bg-amber-400/10" : mk.key === "value" ? "border-sky-400/40 bg-sky-400/10" : "border-white/10 bg-[#0e1a14] hover:border-emerald-400/40"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{mk.icon}</span>
                  {top && <span className="text-xs font-bold text-emerald-300">{top.tip.confidence}%</span>}
                </div>
                <p className="mt-3 font-bold text-white">{mk.name}</p>
                <p className="mt-1 truncate text-xs text-slate-400">
                  {top ? <>Top: {top.match.homeTeam} · <span className="font-semibold text-emerald-300">{top.tip.tip}</span></> : "No picks"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle title={`🔥 ${label}'s sure games`} sub="Model probability 75%+ — the strongest single tip per match." href={`/predictions/sure-games?day=${active.offset}`} />
        <PickBoard picks={sure} limit={10} />
      </section>

      <section>
        <SectionTitle title="💎 Value bets" sub="Model probability beats the bookmaker's implied probability by 5%+." href={`/predictions/value?day=${active.offset}`} />
        <PickBoard picks={value} limit={8} tone="sky" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="rounded-2xl border border-white/10 bg-[#0e1a14] p-5">
          <p className="text-lg font-bold text-white">📈 Hit rates · last 30 days</p>
          <p className="mb-4 text-sm text-slate-400">Out-of-sample, graded from {finished.length} finished matches.</p>
          <div className="space-y-3">
            {rates.map((r) => (
              <div key={r.key}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">{r.icon} {r.name}</span>
                  <span className="font-bold text-white">
                    {r.rate}% <span className="text-xs font-normal text-slate-500">({r.won}/{r.total}{r.roi != null ? ` · ROI ${r.roi > 0 ? "+" : ""}${r.roi}%` : ""})</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
                  <div className={`h-full rounded-full ${r.key === "sure-games" ? "bg-amber-400" : r.key === "value" ? "bg-sky-400" : "bg-emerald-500"}`} style={{ width: `${r.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
          <Link href="/results" className="mt-5 inline-block text-sm font-semibold text-emerald-300 hover:underline">Full results archive →</Link>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#0e1a14] p-5">
            <p className="text-lg font-bold text-white">🧪 Model vs bookmakers (1X2, 30 days)</p>
            <p className="mb-4 text-sm text-slate-400">Lower Brier score / log loss = better probabilities. Bookmaker odds are the toughest benchmark in sport.</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Metric label="Accuracy" model={`${metrics.modelAcc}%`} market={metrics.marketAcc != null ? `${metrics.marketAcc}%` : "—"} />
              <Metric label="Brier" model={metrics.modelBrier.toFixed(3)} market={metrics.marketBrier?.toFixed(3) ?? "—"} />
              <Metric label="Log loss" model={metrics.modelLogLoss.toFixed(3)} market={metrics.marketLogLoss?.toFixed(3) ?? "—"} />
            </div>
            <Link href="/model" className="mt-4 inline-block text-sm font-semibold text-emerald-300 hover:underline">Calibration & team ratings →</Link>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0e1a14] p-5">
            <p className="mb-3 text-lg font-bold text-white">🏟️ Leagues on this matchday</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {leagueCounts.map((l) => (
                <Link key={l.div} href={`/predictions/1x2?day=${active.offset}&league=${l.div}`} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-sm hover:bg-white/10">
                  <span className="truncate text-slate-200">{l.flag} {l.country} · <span className="font-semibold text-white">{l.league}</span></span>
                  <span className="text-xs text-slate-500">{l.n}</span>
                </Link>
              ))}
              {leagueCounts.length === 0 && <p className="text-sm text-slate-500">No fixtures loaded.</p>}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle title={`⚽ ${label}'s 1X2 predictions`} sub="Win / draw / win probabilities with bookmaker odds and expected value." href={`/predictions/1x2?day=${active.offset}`} />
        <MarketBoard list={list} market="1x2" limit={25} />
      </section>

      <section className="space-y-3">
        <SectionTitle title="FAQ" />
        <div className="grid gap-3 lg:grid-cols-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-white/10 bg-[#0e1a14] p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-white">
                {f.q}
                <span className="text-emerald-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-slate-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

function Metric({ label, model, market }: { label: string; model: string; market: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-emerald-300">{model}</p>
      <p className="text-[11px] text-slate-500">book: {market}</p>
    </div>
  );
}

function SectionTitle({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">{title}</h2>
        {sub && <p className="text-sm text-slate-400">{sub}</p>}
      </div>
      {href && <Link href={href} className="shrink-0 text-sm font-semibold text-emerald-300 hover:underline">View all →</Link>}
    </div>
  );
}
