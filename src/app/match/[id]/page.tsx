import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatch, getTeamForm } from "@/lib/data";
import { BASE_MARKETS, MARKETS, evaluate, tipFor } from "@/lib/markets";
import { fmtDate, fmtTime, liveState } from "@/lib/format";
import { flagFor } from "@/lib/leagues";
import { ConfidenceBar, OddsCell, OutcomeBadge, ScoreCell, TipPill } from "@/components/Bits";
import type { Match } from "@/db/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // first visit on an empty database runs the initial sync

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMatch(Number(id));
  if (!m) notFound();
  const [homeForm, awayForm] = await Promise.all([getTeamForm(m.homeTeam, m.kickoff), getTeamForm(m.awayTeam, m.kickoff)]);
  const implied =
    m.odds1 && m.oddsX && m.odds2
      ? (() => {
          const q = [1 / m.odds1, 1 / m.oddsX, 1 / m.odds2];
          const s = q[0] + q[1] + q[2];
          return q.map((x) => Math.round((x / s) * 1000) / 10);
        })()
      : null;
  const state = liveState(m);

  return (
    <div className="space-y-6 py-8">
      <nav className="text-xs text-slate-500">
        <Link href="/" className="hover:text-emerald-300">Home</Link> / <Link href={`/predictions/1x2?league=${m.div}`} className="hover:text-emerald-300">{m.league}</Link> /{" "}
        <span className="text-slate-300">{m.homeTeam} vs {m.awayTeam}</span>
      </nav>

      <section className="rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.25),_transparent_60%)] bg-[#0e1a14] p-6 md:p-10">
        <p className="text-center text-sm text-slate-400">
          {flagFor(m.country)} {m.country} · {m.league} · {fmtDate(m.kickoff)} {fmtTime(m.kickoff)} UTC
        </p>
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Team name={m.homeTeam} label="Home" xg={m.expHome} />
          <div className="text-center">
            {state === "finished" ? (
              <>
                <p className="text-4xl font-black text-white md:text-5xl">{m.homeScore} - {m.awayScore}</p>
                <p className="mt-1 text-xs text-slate-400">
                  HT {m.htHome ?? "-"}-{m.htAway ?? "-"} · Corners {m.corners ?? "-"}
                  {m.homeXg != null && <> · xG {m.homeXg.toFixed(2)}-{m.awayXg?.toFixed(2)}</>}
                </p>
              </>
            ) : state === "scheduled" ? (
              <p className="text-2xl font-black text-white">{fmtTime(m.kickoff)}</p>
            ) : (
              <ScoreCell m={m} />
            )}
            <p className="mt-2 text-xs text-slate-500">Model score: <b className="text-slate-300">{m.predHome}-{m.predAway}</b> ({m.csProb}%)</p>
          </div>
          <Team name={m.awayTeam} label="Away" xg={m.expAway} />
        </div>

        <div className="mx-auto mt-8 max-w-xl">
          <p className="mb-1 text-xs font-semibold text-slate-400">Model</p>
          <ProbBar a={m.homeProb} b={m.drawProb} c={m.awayProb} />
          {implied && (
            <>
              <p className="mb-1 mt-3 text-xs font-semibold text-slate-400">Bookmakers (implied, margin removed)</p>
              <ProbBar a={implied[0]} b={implied[1]} c={implied[2]} muted />
            </>
          )}
          <div className="mt-2 grid grid-cols-3 text-center text-xs text-slate-400">
            <span>1 {m.odds1 && <b className="text-amber-300">@{m.odds1.toFixed(2)}</b>}</span>
            <span>X {m.oddsX && <b className="text-amber-300">@{m.oddsX.toFixed(2)}</b>}</span>
            <span>2 {m.odds2 && <b className="text-amber-300">@{m.odds2.toFixed(2)}</b>}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e1a14]">
          <p className="border-b border-white/5 px-5 py-3 font-bold text-white">🤖 Model tips for every market</p>
          <div className="divide-y divide-white/5">
            {BASE_MARKETS.map((k) => {
              const t = tipFor(m, k);
              if (!t) return null;
              const info = MARKETS.find((x) => x.key === k)!;
              return (
                <div key={k} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-white">{info.icon} {info.name}</p>
                    <p className="text-xs text-slate-500">{t.label}</p>
                  </div>
                  <TipPill tip={t.tip} hot={t.confidence >= 75} />
                  <ConfidenceBar value={t.confidence} />
                  <OddsCell odds={t.odds} edge={t.edge} market={t.marketOdds} />
                  <OutcomeBadge outcome={evaluate(m, k, t)} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0e1a14] p-5">
          <p className="font-bold text-white">📊 Scoreline probabilities</p>
          <p className="mb-3 text-xs text-slate-500">Rows: {m.homeTeam} goals · Columns: {m.awayTeam} goals</p>
          {m.matrix && (
            <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
              <span />
              {[0, 1, 2, 3, 4, 5].map((g) => <span key={g} className="font-bold text-slate-400">{g}</span>)}
              {m.matrix.map((row, x) => (
                <Row key={x} x={x} row={row} actual={m.status === "finished" ? [m.homeScore, m.awayScore] : null} />
              ))}
            </div>
          )}
          <div className="mt-4 space-y-2">
            <Bar label="Over 2.5 goals" v={m.over25Prob} />
            <Bar label="Both teams to score" v={m.bttsProb} />
            {m.cornersOverProb != null && <Bar label={`Over ${m.cornersLine} corners (exp. ${m.expCorners})`} v={m.cornersOverProb} />}
            <p className="pt-1 text-xs text-slate-400">HT/FT most likely: <b className="text-white">{m.htftTip}</b> ({m.htftProb}%)</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Form team={m.homeTeam} list={homeForm} />
        <Form team={m.awayTeam} list={awayForm} />
      </section>
      <p className="text-xs text-slate-600">
        Prediction generated {m.predictedAt ? m.predictedAt.toUTCString() : "—"} using only data available before kick-off.
      </p>
    </div>
  );
}

function Row({ x, row, actual }: { x: number; row: number[]; actual: [number | null, number | null] | null }) {
  const max = 18;
  return (
    <>
      <span className="font-bold text-slate-400">{x}</span>
      {row.map((v, y) => {
        const hit = actual && actual[0] === x && actual[1] === y;
        return (
          <span
            key={y}
            className={`rounded py-1.5 tabular-nums ${hit ? "ring-2 ring-amber-400" : ""} ${v > 6 ? "text-emerald-950" : "text-slate-300"}`}
            style={{ backgroundColor: `rgba(52, 211, 153, ${Math.min(1, v / max)})` }}
          >
            {v >= 10 ? Math.round(v) : v.toFixed(1)}
          </span>
        );
      })}
    </>
  );
}

function Team({ name, label, xg }: { name: string; label: string; xg: number }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-lg font-black text-white md:h-20 md:w-20">{initials}</span>
      <p className="font-bold text-white md:text-lg">{name}</p>
      <p className="text-xs text-slate-500">{label} · exp. goals <b className="text-emerald-300">{xg.toFixed(2)}</b></p>
    </div>
  );
}

function ProbBar({ a, b, c, muted }: { a: number; b: number; c: number; muted?: boolean }) {
  return (
    <div className={`flex h-6 overflow-hidden rounded-lg text-[11px] font-bold ${muted ? "opacity-70" : ""}`}>
      <div className="grid place-items-center bg-emerald-500 text-emerald-950" style={{ width: `${a}%` }}>{Math.round(a)}%</div>
      <div className="grid place-items-center bg-slate-500 text-white" style={{ width: `${b}%` }}>{Math.round(b)}%</div>
      <div className="grid place-items-center bg-sky-500 text-sky-950" style={{ width: `${c}%` }}>{Math.round(c)}%</div>
    </div>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-slate-300">{label}</span><span className="font-bold text-white">{Math.round(v)}%</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-emerald-500" style={{ width: `${v}%` }} /></div>
    </div>
  );
}

function Form({ team, list }: { team: string; list: Match[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0e1a14] p-5">
      <p className="mb-3 font-bold text-white">🕑 {team} · last {list.length}</p>
      <div className="space-y-2">
        {list.map((r) => {
          const isHome = r.homeTeam === team;
          const gf = isHome ? r.homeScore! : r.awayScore!;
          const ga = isHome ? r.awayScore! : r.homeScore!;
          const res = gf > ga ? "W" : gf < ga ? "L" : "D";
          return (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded text-xs font-black ${res === "W" ? "bg-emerald-500 text-emerald-950" : res === "L" ? "bg-rose-500 text-white" : "bg-slate-500 text-white"}`}>{res}</span>
              <span className="flex-1 truncate text-slate-300">{isHome ? "vs" : "@"} {isHome ? r.awayTeam : r.homeTeam}</span>
              {r.homeXg != null && <span className="text-[11px] text-slate-500">xG {(isHome ? r.homeXg : r.awayXg)?.toFixed(1)}-{(isHome ? r.awayXg : r.homeXg)?.toFixed(1)}</span>}
              <span className="font-mono font-bold text-white">{gf}-{ga}</span>
            </div>
          );
        })}
        {list.length === 0 && <p className="text-sm text-slate-500">No previous results.</p>}
      </div>
    </div>
  );
}
