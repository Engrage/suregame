import type { PMatch } from "@/db/schema";

export type MarketKey = "sure-games" | "value" | "1x2" | "double-chance" | "over-2-5" | "btts" | "htft" | "correct-score" | "corners";
export type BaseMarket = Exclude<MarketKey, "sure-games" | "value">;

export type MarketInfo = { key: MarketKey; name: string; short: string; description: string; icon: string };

export const MARKETS: MarketInfo[] = [
  { key: "sure-games", name: "Sure Games", short: "Sure", icon: "🔥", description: "The model's highest-probability picks: tips rated 75%+ by the Dixon–Coles model (83%+ for double chance) that bookmakers also agree with." },
  { key: "value", name: "Value Bets", short: "Value", icon: "💎", description: "Picks where the model's probability beats the bookmaker's implied probability by 5%+ — positive expected value." },
  { key: "1x2", name: "1X2 Predictions", short: "1X2", icon: "⚽", description: "Match winner probabilities from the model's full scoreline matrix: home (1), draw (X), away (2)." },
  { key: "double-chance", name: "Double Chance", short: "DC", icon: "🛡️", description: "Two of three outcomes covered: 1X, X2 or 12." },
  { key: "over-2-5", name: "Over/Under 2.5 Goals", short: "O/U 2.5", icon: "🥅", description: "Probability of 3+ goals from the model's expected goals for each side." },
  { key: "btts", name: "Both Teams To Score", short: "BTTS", icon: "🎯", description: "Probability both sides score, from the Dixon–Coles scoreline matrix." },
  { key: "htft", name: "Half Time / Full Time", short: "HT/FT", icon: "⏱️", description: "Most likely HT/FT combination from a half-by-half Poisson split." },
  { key: "correct-score", name: "Correct Score", short: "CS", icon: "📊", description: "The single most likely final scoreline and its probability." },
  { key: "corners", name: "Corners", short: "Corners", icon: "🚩", description: "Total corners from a separate team corner-rate model." },
];

export const BASE_MARKETS: BaseMarket[] = ["1x2", "double-chance", "over-2-5", "btts", "htft", "correct-score", "corners"];

export function getMarket(key: string): MarketInfo | undefined {
  return MARKETS.find((m) => m.key === key);
}

export type Tip = { tip: string; label: string; confidence: number; odds?: number; edge?: number; marketOdds: boolean };

const fair = (p: number) => Math.round((100 / Math.max(p, 0.5)) * 100) / 100;

function mk(tip: string, label: string, p: number, bookOdds?: number | null): Tip {
  const confidence = Math.round(p);
  if (bookOdds && bookOdds > 1) {
    return { tip, label, confidence, odds: bookOdds, edge: Math.round(((p / 100) * bookOdds - 1) * 1000) / 10, marketOdds: true };
  }
  return { tip, label, confidence, odds: fair(p), marketOdds: false };
}

export function tipFor(m: PMatch, market: BaseMarket): Tip | null {
  switch (market) {
    case "1x2": {
      const o = [
        { t: "1", p: m.homeProb, o: m.odds1, l: `${m.homeTeam} win` },
        { t: "X", p: m.drawProb, o: m.oddsX, l: "Draw" },
        { t: "2", p: m.awayProb, o: m.odds2, l: `${m.awayTeam} win` },
      ].sort((a, b) => b.p - a.p)[0];
      return mk(o.t, o.l, o.p, o.o);
    }
    case "double-chance": {
      const o = [
        { t: "1X", p: m.homeProb + m.drawProb, l: `${m.homeTeam} or draw` },
        { t: "X2", p: m.awayProb + m.drawProb, l: `${m.awayTeam} or draw` },
        { t: "12", p: m.homeProb + m.awayProb, l: "Either team wins" },
      ].sort((a, b) => b.p - a.p)[0];
      return mk(o.t, o.l, o.p);
    }
    case "over-2-5":
      return m.over25Prob >= 50
        ? mk("Over 2.5", `xG ${(m.expHome + m.expAway).toFixed(2)}`, m.over25Prob, m.oddsOver25)
        : mk("Under 2.5", `xG ${(m.expHome + m.expAway).toFixed(2)}`, 100 - m.over25Prob, m.oddsUnder25);
    case "btts":
      return m.bttsProb >= 50 ? mk("GG", "Both teams score", m.bttsProb) : mk("NG", "Not both score", 100 - m.bttsProb);
    case "htft":
      return mk(m.htftTip, "Half time / Full time", m.htftProb);
    case "correct-score":
      return mk(`${m.predHome}-${m.predAway}`, "Most likely score", m.csProb);
    case "corners": {
      if (m.cornersLine == null || m.cornersOverProb == null) return null;
      return m.cornersOverProb >= 50
        ? mk(`Over ${m.cornersLine}`, `Exp. ${m.expCorners} corners`, m.cornersOverProb)
        : mk(`Under ${m.cornersLine}`, `Exp. ${m.expCorners} corners`, 100 - m.cornersOverProb);
    }
  }
}

export type Outcome = "won" | "lost" | "pending";

export function evaluate(m: PMatch, market: BaseMarket, tip?: Tip | null): Outcome {
  if (m.status !== "finished" || m.homeScore == null || m.awayScore == null) return "pending";
  const t = tip === undefined ? tipFor(m, market) : tip;
  if (!t) return "pending";
  const h = m.homeScore;
  const a = m.awayScore;
  const res = h > a ? "1" : h < a ? "2" : "X";
  switch (market) {
    case "1x2":
      return t.tip === res ? "won" : "lost";
    case "double-chance":
      return t.tip.includes(res) ? "won" : "lost";
    case "over-2-5":
      return (t.tip.startsWith("Over") ? h + a > 2 : h + a <= 2) ? "won" : "lost";
    case "btts":
      return (t.tip === "GG") === (h > 0 && a > 0) ? "won" : "lost";
    case "htft": {
      if (m.htHome == null || m.htAway == null) return "pending";
      const ht = m.htHome > m.htAway ? "1" : m.htHome < m.htAway ? "2" : "X";
      return t.tip === `${ht}/${res}` ? "won" : "lost";
    }
    case "correct-score":
      return t.tip === `${h}-${a}` ? "won" : "lost";
    case "corners": {
      if (m.corners == null || m.cornersLine == null) return "pending";
      return (t.tip.startsWith("Over") ? m.corners > m.cornersLine : m.corners < m.cornersLine) ? "won" : "lost";
    }
  }
}

export type Pick = { match: PMatch; market: BaseMarket; tip: Tip; outcome: Outcome };

/** Bookmaker implied probability (margin removed) for a tip, when odds exist. */
export function impliedFor(m: PMatch, market: BaseMarket, tip: string): number | null {
  if ((market === "1x2" || market === "double-chance") && m.odds1 && m.oddsX && m.odds2) {
    const q = { "1": 1 / m.odds1, X: 1 / m.oddsX, "2": 1 / m.odds2 };
    const s = q["1"] + q.X + q["2"];
    return Math.round(([...tip] as ("1" | "X" | "2")[]).reduce((acc, k) => acc + q[k] / s, 0) * 100);
  }
  if (market === "over-2-5" && m.oddsOver25 && m.oddsUnder25) {
    const o = 1 / m.oddsOver25;
    const u = 1 / m.oddsUnder25;
    return Math.round(((tip.startsWith("Over") ? o : u) / (o + u)) * 100);
  }
  return null;
}

const MARKET_FLOOR = 60;

const SURE_MARKETS: BaseMarket[] = ["1x2", "double-chance", "over-2-5", "btts", "corners"];
const sureScore = (mkt: BaseMarket, t: Tip) => (mkt === "double-chance" ? t.confidence - 8 : t.confidence);

/** Best single high-probability pick per match. */
export function surePicks(list: PMatch[], threshold = 75): Pick[] {
  const picks: Pick[] = [];
  for (const m of list) {
    let best: Pick | null = null;
    for (const mkt of SURE_MARKETS) {
      const t = tipFor(m, mkt);
      if (!t) continue;
      const imp = impliedFor(m, mkt, t.tip);
      if (imp != null && imp < (mkt === "double-chance" ? MARKET_FLOOR + 15 : MARKET_FLOOR)) continue; // bookmakers disagree
      const s = sureScore(mkt, t);
      if (s >= threshold && (!best || s > sureScore(best.market, best.tip))) best = { match: m, market: mkt, tip: t, outcome: "pending" };
    }
    if (best) {
      best.outcome = evaluate(m, best.market, best.tip);
      picks.push(best);
    }
  }
  return picks.sort((a, b) => b.tip.confidence - a.tip.confidence);
}

/** Positive expected value vs bookmaker average odds (1X2 & O/U 2.5 where odds exist). */
export function valuePicks(list: PMatch[], minEdge = 5): Pick[] {
  const picks: Pick[] = [];
  for (const m of list) {
    const cands: { market: BaseMarket; tip: Tip }[] = [];
    const add = (market: BaseMarket, tip: string, label: string, p: number, o: number | null) => {
      if (o && o > 1 && o < 8) cands.push({ market, tip: mk(tip, label, p, o) });
    };
    add("1x2", "1", `${m.homeTeam} win`, m.homeProb, m.odds1);
    add("1x2", "X", "Draw", m.drawProb, m.oddsX);
    add("1x2", "2", `${m.awayTeam} win`, m.awayProb, m.odds2);
    add("over-2-5", "Over 2.5", "3+ goals", m.over25Prob, m.oddsOver25);
    add("over-2-5", "Under 2.5", "0-2 goals", 100 - m.over25Prob, m.oddsUnder25);
    const best = cands.filter((c) => (c.tip.edge ?? 0) >= minEdge).sort((a, b) => (b.tip.edge ?? 0) - (a.tip.edge ?? 0))[0];
    if (best) picks.push({ match: m, ...best, outcome: evaluate(m, best.market, best.tip) });
  }
  return picks.sort((a, b) => (b.tip.edge ?? 0) - (a.tip.edge ?? 0));
}

export function marketShort(key: MarketKey) {
  return getMarket(key)?.short ?? key;
}
