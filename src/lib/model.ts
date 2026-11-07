/**
 * SureGames football model
 * ------------------------
 * Time-weighted Dixon–Coles bivariate Poisson model, fitted per league.
 *
 *   λ_home = c · H · A_home · D_away        (expected home goals)
 *   μ_away = c ·     A_away · D_home        (expected away goals)
 *
 * A = attack strength, D = defensive weakness (1.0 = league average),
 * H = home advantage, c = league scoring level.
 * Parameters are estimated by weighted maximum likelihood (iterative
 * proportional fitting) with exponential time decay and shrinkage toward
 * league average. The training target blends real goals with xG when
 * available, which is a much less noisy signal of team quality.
 * The Dixon–Coles ρ term corrects the under-prediction of 0-0 / 1-1 draws.
 * A separate model of the same form is fitted for corners, and HT/FT is
 * derived from a half-by-half Poisson split using the league's first-half
 * goal share.
 */

export type TrainingGame = {
  home: string;
  away: string;
  t: number; // kickoff ms
  hg: number;
  ag: number;
  hxg?: number | null;
  axg?: number | null;
  hthg?: number | null;
  htag?: number | null;
  hc?: number | null;
  ac?: number | null;
};

export type Strengths = { c: number; H: number; A: Record<string, number>; D: Record<string, number> };

export type Fit = {
  goals: Strengths;
  corners: Strengths | null;
  rho: number;
  htShare: number;
  nGames: number;
  asOf: number;
};

export type FitOptions = { halfLifeDays: number; xgWeight: number; shrink: number };
export const DEFAULT_OPTIONS: FitOptions = { halfLifeDays: 150, xgWeight: 0.5, shrink: 2.5 };
export const HALF_LIFE_DAYS = DEFAULT_OPTIONS.halfLifeDays;
const DAY = 86400000;

type Obs = { h: string; a: string; w: number; th: number; ta: number };

function fitStrengths(obs: Obs[], iterations = 80, SHRINK = DEFAULT_OPTIONS.shrink): Strengths {
  const teams = new Set<string>();
  for (const o of obs) {
    teams.add(o.h);
    teams.add(o.a);
  }
  const A: Record<string, number> = {};
  const D: Record<string, number> = {};
  for (const t of teams) {
    A[t] = 1;
    D[t] = 1;
  }
  let sw = 0;
  let sg = 0;
  let shg = 0;
  let sag = 0;
  for (const o of obs) {
    sw += o.w;
    sg += o.w * (o.th + o.ta);
    shg += o.w * o.th;
    sag += o.w * o.ta;
  }
  let H = sag > 0 ? shg / sag : 1.25;
  let c = sw > 0 ? sag / sw : 1.2;
  const mbar = sw > 0 ? sg / (2 * sw) : 1.3;

  for (let it = 0; it < iterations; it++) {
    // attack
    const aNum: Record<string, number> = {};
    const aDen: Record<string, number> = {};
    for (const t of teams) {
      aNum[t] = SHRINK * mbar;
      aDen[t] = SHRINK * mbar;
    }
    for (const o of obs) {
      aNum[o.h] += o.w * o.th;
      aDen[o.h] += o.w * c * H * D[o.a];
      aNum[o.a] += o.w * o.ta;
      aDen[o.a] += o.w * c * D[o.h];
    }
    for (const t of teams) A[t] = aNum[t] / aDen[t];
    // defence
    const dNum: Record<string, number> = {};
    const dDen: Record<string, number> = {};
    for (const t of teams) {
      dNum[t] = SHRINK * mbar;
      dDen[t] = SHRINK * mbar;
    }
    for (const o of obs) {
      dNum[o.a] += o.w * o.th;
      dDen[o.a] += o.w * c * H * A[o.h];
      dNum[o.h] += o.w * o.ta;
      dDen[o.h] += o.w * c * A[o.a];
    }
    for (const t of teams) D[t] = dNum[t] / dDen[t];
    // normalise to geometric mean 1
    let la = 0;
    let ld = 0;
    for (const t of teams) {
      la += Math.log(A[t]);
      ld += Math.log(D[t]);
    }
    const ga = Math.exp(la / teams.size);
    const gd = Math.exp(ld / teams.size);
    for (const t of teams) {
      A[t] /= ga;
      D[t] /= gd;
    }
    // home advantage & level
    let hn = 0;
    let hd = 0;
    let an = 0;
    let ad = 0;
    for (const o of obs) {
      hn += o.w * o.th;
      hd += o.w * c * A[o.h] * D[o.a];
      an += o.w * o.ta;
      ad += o.w * A[o.a] * D[o.h];
    }
    H = hd > 0 ? hn / hd : H;
    c = ad > 0 ? an / ad : c;
  }
  return { c, H, A, D };
}

function tau(x: number, y: number, l: number, m: number, rho: number) {
  if (x === 0 && y === 0) return 1 - l * m * rho;
  if (x === 0 && y === 1) return 1 + l * rho;
  if (x === 1 && y === 0) return 1 + m * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

export function expected(s: Strengths, home: string, away: string): [number, number] {
  const Ah = s.A[home] ?? UNKNOWN.A;
  const Dh = s.D[home] ?? UNKNOWN.D;
  const Aa = s.A[away] ?? UNKNOWN.A;
  const Da = s.D[away] ?? UNKNOWN.D;
  return [s.c * s.H * Ah * Da, s.c * Aa * Dh];
}

/** Newly promoted / unseen teams start slightly below league average. */
const UNKNOWN = { A: 0.85, D: 1.15 };

export function fitLeague(games: TrainingGame[], asOf: number, opts: FitOptions = DEFAULT_OPTIONS): Fit | null {
  const XI = Math.LN2 / opts.halfLifeDays;
  const XG_WEIGHT = opts.xgWeight;
  const train = games.filter((g) => g.t < asOf);
  if (train.length < 30) return null;
  const goalObs: Obs[] = [];
  const cornerObs: Obs[] = [];
  let htNum = 0;
  let htDen = 0;
  for (const g of train) {
    const w = Math.exp((-XI * (asOf - g.t)) / DAY);
    const hasXg = g.hxg != null && g.axg != null;
    const th = hasXg ? XG_WEIGHT * g.hxg! + (1 - XG_WEIGHT) * g.hg : g.hg;
    const ta = hasXg ? XG_WEIGHT * g.axg! + (1 - XG_WEIGHT) * g.ag : g.ag;
    goalObs.push({ h: g.home, a: g.away, w, th, ta });
    if (g.hc != null && g.ac != null) cornerObs.push({ h: g.home, a: g.away, w, th: g.hc, ta: g.ac });
    if (g.hthg != null && g.htag != null) {
      htNum += w * (g.hthg + g.htag);
      htDen += w * (g.hg + g.ag);
    }
  }
  const goals = fitStrengths(goalObs, 80, opts.shrink);
  const corners = cornerObs.length >= 30 ? fitStrengths(cornerObs, 40) : null;

  // ρ by weighted profile likelihood on real scorelines
  let bestRho = 0;
  let bestLL = -Infinity;
  for (let r = -0.2; r <= 0.1001; r += 0.01) {
    let ll = 0;
    let ok = true;
    for (let i = 0; i < train.length; i++) {
      const g = train[i];
      if (g.hg > 1 || g.ag > 1) continue;
      const [l, m] = expected(goals, g.home, g.away);
      const tv = tau(g.hg, g.ag, l, m, r);
      if (tv <= 0) {
        ok = false;
        break;
      }
      ll += goalObs[i].w * Math.log(tv);
    }
    if (ok && ll > bestLL) {
      bestLL = ll;
      bestRho = r;
    }
  }
  return {
    goals,
    corners,
    rho: Math.round(bestRho * 100) / 100,
    htShare: htDen > 0 ? Math.min(0.5, Math.max(0.38, htNum / htDen)) : 0.44,
    nGames: train.length,
    asOf,
  };
}

const MAXG = 10;
function pois(k: number, l: number) {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i++) p *= l / i;
  return p;
}
function poisVec(l: number, n = MAXG) {
  const v: number[] = [];
  for (let k = 0; k <= n; k++) v.push(pois(k, l));
  return v;
}

export type Prediction = {
  expHome: number;
  expAway: number;
  homeProb: number;
  drawProb: number;
  awayProb: number;
  over25Prob: number;
  bttsProb: number;
  predHome: number;
  predAway: number;
  csProb: number;
  htftTip: string;
  htftProb: number;
  expCorners: number | null;
  cornersLine: number | null;
  cornersOverProb: number | null;
  matrix: number[][]; // 0..5 x 0..5 for display
};

const pct = (p: number) => Math.round(p * 1000) / 10;

export function predict(fit: Fit, home: string, away: string): Prediction {
  const [l, m] = expected(fit.goals, home, away);
  const ph = poisVec(l);
  const pa = poisVec(m);
  const P: number[][] = [];
  let tot = 0;
  for (let x = 0; x <= MAXG; x++) {
    P.push([]);
    for (let y = 0; y <= MAXG; y++) {
      const v = Math.max(0, ph[x] * pa[y] * tau(x, y, l, m, fit.rho));
      P[x].push(v);
      tot += v;
    }
  }
  let H = 0;
  let Dr = 0;
  let A = 0;
  let over = 0;
  let btts = 0;
  let best = { x: 0, y: 0, p: 0 };
  for (let x = 0; x <= MAXG; x++)
    for (let y = 0; y <= MAXG; y++) {
      const p = P[x][y] / tot;
      P[x][y] = p;
      if (x > y) H += p;
      else if (x === y) Dr += p;
      else A += p;
      if (x + y > 2) over += p;
      if (x > 0 && y > 0) btts += p;
      if (p > best.p) best = { x, y, p };
    }

  // HT/FT: independent halves
  const f = fit.htShare;
  const N = 7;
  const h1 = poisVec(l * f, N);
  const a1 = poisVec(m * f, N);
  const h2 = poisVec(l * (1 - f), N);
  const a2 = poisVec(m * (1 - f), N);
  const res = (x: number, y: number) => (x > y ? "1" : x < y ? "2" : "X");
  const htft: Record<string, number> = {};
  for (let x = 0; x <= N; x++)
    for (let y = 0; y <= N; y++) {
      const pHt = h1[x] * a1[y];
      const r1 = res(x, y);
      for (let u = 0; u <= N; u++)
        for (let v = 0; v <= N; v++) {
          const k = `${r1}/${res(x + u, y + v)}`;
          htft[k] = (htft[k] ?? 0) + pHt * h2[u] * a2[v];
        }
    }
  const htTot = Object.values(htft).reduce((s, v) => s + v, 0);
  const [htftTip, htftRaw] = Object.entries(htft).sort((a, b) => b[1] - a[1])[0];

  // corners
  let expCorners: number | null = null;
  let cornersLine: number | null = null;
  let cornersOverProb: number | null = null;
  if (fit.corners) {
    const [cl, cm] = expected(fit.corners, home, away);
    const T = cl + cm;
    expCorners = Math.round(T * 10) / 10;
    cornersLine = Math.min(12.5, Math.max(7.5, Math.floor(T) - 0.5));
    let cdf = 0;
    for (let k = 0; k <= Math.floor(cornersLine); k++) cdf += pois(k, T);
    cornersOverProb = pct(1 - cdf);
  }

  return {
    expHome: Math.round(l * 100) / 100,
    expAway: Math.round(m * 100) / 100,
    homeProb: pct(H),
    drawProb: pct(Dr),
    awayProb: pct(A),
    over25Prob: pct(over),
    bttsProb: pct(btts),
    predHome: best.x,
    predAway: best.y,
    csProb: pct(best.p),
    htftTip,
    htftProb: pct(htftRaw / htTot),
    expCorners,
    cornersLine,
    cornersOverProb,
    matrix: P.slice(0, 6).map((r) => r.slice(0, 6).map((v) => pct(v))),
  };
}

export function teamTable(fit: Fit) {
  return Object.keys(fit.goals.A)
    .map((t) => {
      const att = fit.goals.A[t];
      const def = fit.goals.D[t];
      return {
        team: t,
        attack: Math.round(att * 100) / 100,
        defence: Math.round(def * 100) / 100,
        // expected goal difference per game vs an average side on neutral ground
        rating: Math.round(fit.goals.c * Math.sqrt(fit.goals.H) * (att - def) * 100) / 100,
      };
    })
    .sort((a, b) => b.rating - a.rating);
}
