import Link from "next/link";
import { getFinishedSince, getModelFits } from "@/lib/data";
import { modelMetrics } from "@/lib/stats";
import { LEAGUES, leagueByDiv } from "@/lib/leagues";
import { MARKETS } from "@/lib/markets";
import { HALF_LIFE_DAYS } from "@/lib/model";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // first visit on an empty database runs the initial sync
export const metadata = { title: "The SureGames Model | Dixon–Coles football predictions" };

export default async function ModelPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const { league = "E0" } = await searchParams;
  const [fits, finished] = await Promise.all([getModelFits(), getFinishedSince(35)]);
  const metrics = modelMetrics(finished);
  const fit = fits.find((f) => f.div === league) ?? fits[0];
  const lg = fit ? leagueByDiv(fit.div) : undefined;
  const maxAbs = fit ? Math.max(...fit.teams.map((t) => Math.abs(t.rating)), 0.5) : 1;

  return (
    <div className="space-y-10 py-8">
      <div>
        <h1 className="text-3xl font-black text-white md:text-4xl">🧠 The SureGames Model</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          A statistical football model in the Dixon–Coles family — the same framework used by professional betting syndicates as a
          baseline. No hype, no &quot;AI&quot; marketing: just maximum-likelihood estimates of how good each team is at scoring and preventing goals.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          ["1. Data", "Real results, half-time scores, corners, expected goals (xG) and average bookmaker odds for 17 leagues, current + previous season, refreshed every 2 hours."],
          ["2. Team strengths", `Each team gets an attack (A) and defence (D) rating per league via weighted Poisson maximum likelihood. Matches decay with a ${HALF_LIFE_DAYS}-day half-life; targets blend goals 50/50 with xG; ratings shrink toward average for small samples.`],
          ["3. Scorelines", "Expected goals: λ = c·H·A_home·D_away and μ = c·A_away·D_home. An 11×11 Poisson scoreline matrix is built and corrected with the Dixon–Coles ρ term for low-scoring draws."],
          ["4. Markets & grading", "1X2, O/U, BTTS, correct score come from the matrix; HT/FT from a half-by-half split; corners from a separate corner-rate model. Every prediction is out-of-sample and graded automatically."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-white/10 bg-[#0e1a14] p-5">
            <p className="font-bold text-emerald-300">{t}</p>
            <p className="mt-2 text-sm text-slate-400">{d}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0e1a14] p-5">
          <p className="text-lg font-bold text-white">Backtest vs bookmakers · last 35 days</p>
          <p className="mb-4 text-sm text-slate-400">{metrics.n} matches graded ({metrics.nMarket} with odds). Lower Brier / log loss is better.</p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr><th className="py-2">Metric</th><th>Model</th><th>Bookmakers</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr><td className="py-2 text-slate-300">1X2 accuracy</td><td className="font-bold text-white">{metrics.modelAcc}%</td><td className="text-slate-400">{metrics.marketAcc ?? "—"}%</td></tr>
              <tr><td className="py-2 text-slate-300">1X2 Brier score</td><td className="font-bold text-white">{metrics.modelBrier.toFixed(3)}</td><td className="text-slate-400">{metrics.marketBrier?.toFixed(3) ?? "—"}</td></tr>
              <tr><td className="py-2 text-slate-300">1X2 log loss</td><td className="font-bold text-white">{metrics.modelLogLoss.toFixed(3)}</td><td className="text-slate-400">{metrics.marketLogLoss?.toFixed(3) ?? "—"}</td></tr>
              <tr><td className="py-2 text-slate-300">Over/Under 2.5 accuracy</td><td className="font-bold text-white">{metrics.ouAcc}%</td><td className="text-slate-500">—</td></tr>
              <tr><td className="py-2 text-slate-300">BTTS accuracy</td><td className="font-bold text-white">{metrics.bttsAcc}%</td><td className="text-slate-500">—</td></tr>
            </tbody>
          </table>
          <p className="mt-4 text-xs text-slate-500">
            For reference: always picking the home team scores ~45%; a random 1X2 guess has a Brier score of 0.667. Matching the bookmakers is the gold standard.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {metrics.perMarket.map((p) => (
              <div key={p.key} className="rounded-lg bg-white/5 p-2">
                <p className="text-slate-400">{MARKETS.find((m) => m.key === p.key)?.short}</p>
                <p className="font-bold text-white">{p.rate}% <span className="font-normal text-slate-500">n={p.total}</span></p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0e1a14] p-5">
          <p className="text-lg font-bold text-white">Calibration</p>
          <p className="mb-4 text-sm text-slate-400">When the model says X%, how often does it happen? Perfect calibration = bars match.</p>
          <div className="space-y-2">
            {metrics.calibration.map((c) => (
              <div key={c.bucket} className="grid grid-cols-[70px_1fr_90px] items-center gap-3 text-xs">
                <span className="text-slate-400">{c.bucket}</span>
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-slate-500/60" style={{ width: `${c.predicted}%` }} />
                  <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${c.actual}%` }} />
                </div>
                <span className="text-right text-slate-300">{c.predicted}% → <b className="text-emerald-300">{c.actual}%</b> <span className="text-slate-600">({c.n})</span></span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500"><span className="text-slate-400">■ grey</span> predicted · <span className="text-emerald-400">■ green</span> observed frequency</p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h2 className="text-2xl font-extrabold text-white">Team ratings</h2>
            <p className="text-sm text-slate-400">
              Rating = expected goal difference per game vs an average team on neutral ground. Attack &gt; 1 scores more than average; defence &lt; 1 concedes less.
            </p>
          </div>
        </div>
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto text-xs">
          {LEAGUES.filter((l) => fits.some((f) => f.div === l.div)).map((l) => (
            <Link key={l.div} href={`/model?league=${l.div}`} className={`whitespace-nowrap rounded-full px-3 py-1.5 ${fit?.div === l.div ? "bg-white text-black" : "border border-white/10 text-slate-400 hover:text-white"}`}>
              {l.flag} {l.league}
            </Link>
          ))}
        </div>
        {fit && lg ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e1a14]">
            <div className="flex flex-wrap gap-4 border-b border-white/5 px-5 py-3 text-xs text-slate-400">
              <span>{lg.flag} <b className="text-white">{lg.country} · {lg.league}</b></span>
              <span>Home advantage ×{fit.homeAdv.toFixed(2)}</span>
              <span>Base rate {fit.level.toFixed(2)} goals</span>
              <span>ρ = {fit.rho.toFixed(2)}</span>
              <span>1st-half goal share {(fit.htShare * 100).toFixed(0)}%</span>
              <span>{fit.nGames} matches · fitted {fit.fittedAt.toUTCString().slice(0, 22)}</span>
            </div>
            <div className="divide-y divide-white/5">
              {fit.teams.map((t, i) => (
                <div key={t.team} className="grid grid-cols-[28px_1fr_70px_70px_1fr] items-center gap-3 px-5 py-2 text-sm">
                  <span className="text-xs text-slate-500">{i + 1}</span>
                  <span className="truncate font-semibold text-white">{t.team}</span>
                  <span className={`text-xs tabular-nums ${t.attack >= 1 ? "text-emerald-300" : "text-rose-300"}`}>A {t.attack.toFixed(2)}</span>
                  <span className={`text-xs tabular-nums ${t.defence <= 1 ? "text-emerald-300" : "text-rose-300"}`}>D {t.defence.toFixed(2)}</span>
                  <div className="flex items-center gap-2">
                    <div className="relative h-2 flex-1 rounded-full bg-white/5">
                      <div className="absolute left-1/2 top-0 h-2 w-px bg-white/20" />
                      <div
                        className={`absolute top-0 h-2 rounded-full ${t.rating >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                        style={t.rating >= 0 ? { left: "50%", width: `${(t.rating / maxAbs) * 50}%` } : { right: "50%", width: `${(-t.rating / maxAbs) * 50}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs font-bold tabular-nums text-white">{t.rating > 0 ? "+" : ""}{t.rating.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-slate-500">Model is still fitting — refresh in a moment.</p>
        )}
      </section>
    </div>
  );
}
