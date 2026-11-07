import type { PMatch } from "@/db/schema";
import { MARKETS, BASE_MARKETS, evaluate, surePicks, tipFor, valuePicks, type MarketKey, type Pick, type BaseMarket } from "./markets";

export type HitRate = { key: MarketKey; name: string; icon: string; won: number; total: number; rate: number; roi: number | null };

function summarize(picks: { outcome: string; odds?: number; marketOdds: boolean }[]) {
  let won = 0;
  let total = 0;
  let profit = 0;
  let staked = 0;
  for (const p of picks) {
    if (p.outcome === "pending") continue;
    total++;
    if (p.outcome === "won") won++;
    if (p.marketOdds && p.odds) {
      staked++;
      profit += p.outcome === "won" ? p.odds - 1 : -1;
    }
  }
  return { won, total, rate: total ? Math.round((won / total) * 100) : 0, roi: staked >= 5 ? Math.round((profit / staked) * 1000) / 10 : null };
}

export function picksFor(list: PMatch[], key: MarketKey): Pick[] {
  if (key === "sure-games") return surePicks(list);
  if (key === "value") return valuePicks(list);
  const out: Pick[] = [];
  for (const m of list) {
    const t = tipFor(m, key as BaseMarket);
    if (t) out.push({ match: m, market: key as BaseMarket, tip: t, outcome: evaluate(m, key as BaseMarket, t) });
  }
  return out;
}

export function hitRates(finished: PMatch[]): HitRate[] {
  return MARKETS.map((mk) => {
    const s = summarize(picksFor(finished, mk.key).map((p) => ({ outcome: p.outcome, odds: p.tip.odds, marketOdds: p.tip.marketOdds })));
    return { key: mk.key, name: mk.name, icon: mk.icon, ...s };
  });
}

export type Metrics = {
  n: number;
  modelAcc: number;
  marketAcc: number | null;
  modelBrier: number;
  marketBrier: number | null;
  modelLogLoss: number;
  marketLogLoss: number | null;
  nMarket: number;
  ouAcc: number;
  bttsAcc: number;
  calibration: { bucket: string; predicted: number; actual: number; n: number }[];
  perMarket: { key: BaseMarket; rate: number; total: number }[];
};

export function modelMetrics(finished: PMatch[]): Metrics {
  let n = 0;
  let modelHit = 0;
  let brier = 0;
  let ll = 0;
  let nMk = 0;
  let mkHit = 0;
  let mkBrier = 0;
  let mkLL = 0;
  let ouHit = 0;
  let bttsHit = 0;
  const buckets = Array.from({ length: 10 }, () => ({ p: 0, a: 0, n: 0 }));
  for (const m of finished) {
    if (m.homeScore == null || m.awayScore == null) continue;
    n++;
    const res = m.homeScore > m.awayScore ? 0 : m.homeScore === m.awayScore ? 1 : 2;
    const p = [m.homeProb, m.drawProb, m.awayProb].map((x) => x / 100);
    const s = p[0] + p[1] + p[2];
    const pn = p.map((x) => x / s);
    const arg = pn.indexOf(Math.max(...pn));
    if (arg === res) modelHit++;
    brier += pn.reduce((acc, x, i) => acc + (x - (i === res ? 1 : 0)) ** 2, 0);
    ll += -Math.log(Math.max(1e-6, pn[res]));
    pn.forEach((x, i) => {
      const b = Math.min(9, Math.floor(x * 10));
      buckets[b].p += x;
      buckets[b].a += i === res ? 1 : 0;
      buckets[b].n++;
    });
    if (m.odds1 && m.oddsX && m.odds2) {
      const imp = [1 / m.odds1, 1 / m.oddsX, 1 / m.odds2];
      const is = imp[0] + imp[1] + imp[2];
      const q = imp.map((x) => x / is);
      nMk++;
      if (q.indexOf(Math.max(...q)) === res) mkHit++;
      mkBrier += q.reduce((acc, x, i) => acc + (x - (i === res ? 1 : 0)) ** 2, 0);
      mkLL += -Math.log(Math.max(1e-6, q[res]));
    }
    const goals = m.homeScore + m.awayScore;
    if ((m.over25Prob >= 50) === goals > 2) ouHit++;
    if ((m.bttsProb >= 50) === (m.homeScore > 0 && m.awayScore > 0)) bttsHit++;
  }
  const r = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
  return {
    n,
    modelAcc: n ? r((modelHit / n) * 100, 1) : 0,
    marketAcc: nMk ? r((mkHit / nMk) * 100, 1) : null,
    modelBrier: n ? r(brier / n) : 0,
    marketBrier: nMk ? r(mkBrier / nMk) : null,
    modelLogLoss: n ? r(ll / n) : 0,
    marketLogLoss: nMk ? r(mkLL / nMk) : null,
    nMarket: nMk,
    ouAcc: n ? r((ouHit / n) * 100, 1) : 0,
    bttsAcc: n ? r((bttsHit / n) * 100, 1) : 0,
    calibration: buckets
      .map((b, i) => ({ bucket: `${i * 10}-${i * 10 + 10}%`, predicted: b.n ? r((b.p / b.n) * 100, 1) : 0, actual: b.n ? r((b.a / b.n) * 100, 1) : 0, n: b.n }))
      .filter((b) => b.n > 0),
    perMarket: BASE_MARKETS.map((k) => {
      const s = summarize(picksFor(finished, k).map((p) => ({ outcome: p.outcome, odds: p.tip.odds, marketOdds: p.tip.marketOdds })));
      return { key: k, rate: s.rate, total: s.total };
    }),
  };
}
