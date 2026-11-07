import { db, pool } from "@/db";
import { after } from "next/server";
import { matches, modelFits, type Match, type NewMatch, type PMatch } from "@/db/schema";
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { LEAGUES, leagueByDiv } from "./leagues";
import { fetchFixtures, fetchSeason, seasonCode, type RawGame } from "./footballData";
import { fitLeague, predict, teamTable, type Fit, type TrainingGame } from "./model";

const DAY = 86400000;
const SYNC_INTERVAL = 2 * 60 * 60 * 1000;
const BACKTEST_DAYS = 35;

export function dayStart(offset = 0) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + offset * DAY);
}

const DDL = [
  sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='matches')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='div') THEN
      DROP TABLE matches;
    END IF;
  END $$`,
  sql`CREATE TABLE IF NOT EXISTS matches (
    id serial PRIMARY KEY, div text NOT NULL, season text NOT NULL, league text NOT NULL, country text NOT NULL,
    home_team text NOT NULL, away_team text NOT NULL, kickoff timestamptz NOT NULL, status text NOT NULL DEFAULT 'scheduled',
    home_score integer, away_score integer, ht_home integer, ht_away integer, home_corners integer, away_corners integer,
    corners integer, home_xg real, away_xg real, odds_1 real, odds_x real, odds_2 real, odds_over25 real, odds_under25 real,
    predicted_at timestamptz, exp_home real, exp_away real, home_prob real, draw_prob real, away_prob real, over25_prob real,
    btts_prob real, pred_home integer, pred_away integer, cs_prob real, htft_tip text, htft_prob real, exp_corners real,
    corners_line real, corners_over_prob real, matrix jsonb, source text NOT NULL DEFAULT 'football-data',
    updated_at timestamptz NOT NULL DEFAULT now())`,
  sql`CREATE INDEX IF NOT EXISTS matches_kickoff_idx ON matches (kickoff)`,
  sql`CREATE INDEX IF NOT EXISTS matches_div_season_idx ON matches (div, season)`,
  sql`CREATE TABLE IF NOT EXISTS model_fits (
    div text PRIMARY KEY, fitted_at timestamptz NOT NULL, n_games integer NOT NULL, home_adv real NOT NULL, level real NOT NULL,
    rho real NOT NULL, ht_share real NOT NULL, teams jsonb NOT NULL, params jsonb NOT NULL)`,
];

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  for (const q of DDL) await db.execute(q);
  schemaReady = true;
}

async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

function rawToRow(g: RawGame): NewMatch {
  const lg = leagueByDiv(g.div)!;
  return {
    div: g.div, season: g.season, league: lg.league, country: lg.country, homeTeam: g.home, awayTeam: g.away, kickoff: g.kickoff,
    status: g.finished ? "finished" : "scheduled",
    homeScore: g.hg, awayScore: g.ag, htHome: g.hthg, htAway: g.htag, homeCorners: g.hc, awayCorners: g.ac,
    corners: g.hc != null && g.ac != null ? g.hc + g.ac : null, homeXg: g.hxg, awayXg: g.axg,
    odds1: g.odds1, oddsX: g.oddsX, odds2: g.odds2, oddsOver25: g.oddsOver25, oddsUnder25: g.oddsUnder25,
  };
}

async function upsertDiv(div: string, raws: RawGame[]) {
  if (!raws.length) return;
  const seasons = [...new Set(raws.map((r) => r.season))];
  const existing = await db.select().from(matches).where(and(eq(matches.div, div), inArray(matches.season, seasons)));
  const byPair = new Map<string, Match[]>();
  for (const e of existing) {
    const k = `${e.homeTeam}|${e.awayTeam}`;
    if (!byPair.has(k)) byPair.set(k, []);
    byPair.get(k)!.push(e);
  }
  const inserts: NewMatch[] = [];
  const patches: { id: number; patch: Partial<NewMatch> }[] = [];
  for (const r of raws) {
    const cands = byPair.get(`${r.home}|${r.away}`) ?? [];
    const hit = cands
      .filter((c) => Math.abs(c.kickoff.getTime() - r.kickoff.getTime()) < 45 * DAY)
      .sort((a, b) => Math.abs(a.kickoff.getTime() - r.kickoff.getTime()) - Math.abs(b.kickoff.getTime() - r.kickoff.getTime()))[0];
    const row = rawToRow(r);
    if (!hit) {
      inserts.push(row);
      cands.push({ ...(row as Match), id: -1 });
      byPair.set(`${r.home}|${r.away}`, cands);
      continue;
    }
    if (hit.id < 0) continue;
    const patch: Partial<NewMatch> = {};
    if (r.finished) {
      if (hit.status !== "finished" || hit.homeScore !== r.hg || hit.awayScore !== r.ag || hit.corners == null) {
        Object.assign(patch, {
          status: "finished", homeScore: row.homeScore, awayScore: row.awayScore, htHome: row.htHome, htAway: row.htAway,
          homeCorners: row.homeCorners, awayCorners: row.awayCorners, corners: row.corners, homeXg: row.homeXg, awayXg: row.awayXg,
          kickoff: row.kickoff,
        });
      }
    } else if (hit.status !== "finished" && hit.kickoff.getTime() !== r.kickoff.getTime()) {
      patch.kickoff = row.kickoff;
    }
    if (hit.odds1 == null && row.odds1 != null) Object.assign(patch, { odds1: row.odds1, oddsX: row.oddsX, odds2: row.odds2 });
    if (hit.oddsOver25 == null && row.oddsOver25 != null) Object.assign(patch, { oddsOver25: row.oddsOver25, oddsUnder25: row.oddsUnder25 });
    if (Object.keys(patch).length) patches.push({ id: hit.id, patch });
  }
  await inBatches(patches, 8, (p) => db.update(matches).set({ ...p.patch, updatedAt: new Date() }).where(eq(matches.id, p.id)));
  for (let i = 0; i < inserts.length; i += 500) await db.insert(matches).values(inserts.slice(i, i + 500));
}

function toTraining(rows: Match[]): TrainingGame[] {
  return rows
    .filter((r) => r.status === "finished" && r.homeScore != null && r.awayScore != null)
    .map((r) => ({
      home: r.homeTeam, away: r.awayTeam, t: r.kickoff.getTime(), hg: r.homeScore!, ag: r.awayScore!,
      hxg: r.homeXg, axg: r.awayXg, hthg: r.htHome, htag: r.htAway, hc: r.homeCorners, ac: r.awayCorners,
    }));
}

async function predictDiv(div: string) {
  const rows = await db.select().from(matches).where(eq(matches.div, div));
  const train = toTraining(rows);
  const now = Date.now();
  const today = dayStart(0).getTime();
  const targets = rows.filter(
    (r) =>
      (r.status === "scheduled" && r.kickoff.getTime() > now) ||
      (r.homeProb == null && r.kickoff.getTime() >= now - BACKTEST_DAYS * DAY),
  );
  const fits = new Map<number, Fit | null>();
  const updates: { id: number; set: Partial<NewMatch> }[] = [];
  for (const r of targets) {
    const ds = Date.UTC(r.kickoff.getUTCFullYear(), r.kickoff.getUTCMonth(), r.kickoff.getUTCDate());
    // Only information available before the matchday is used. Upcoming games
    // use everything up to now; games already kicked off are cut at the start of their day.
    const asOf = r.kickoff.getTime() > now ? now : ds;
    if (!fits.has(asOf)) fits.set(asOf, fitLeague(train.filter((g) => g.t < asOf), asOf));
    const fit = fits.get(asOf);
    if (!fit) continue;
    const p = predict(fit, r.homeTeam, r.awayTeam);
    updates.push({ id: r.id, set: { ...p, predictedAt: new Date(asOf) } });
  }
  await inBatches(updates, 8, (u) => db.update(matches).set(u.set).where(eq(matches.id, u.id)));
  const latest = fitLeague(train, now);
  if (latest) {
    const row = {
      div, fittedAt: new Date(now), nGames: latest.nGames, homeAdv: latest.goals.H, level: latest.goals.c, rho: latest.rho,
      htShare: latest.htShare, teams: teamTable(latest), params: latest as unknown as Record<string, unknown>,
    };
    await db.insert(modelFits).values(row).onConflictDoUpdate({ target: modelFits.div, set: row });
  }
}

let lastSync = 0;
let syncing: Promise<void> | null = null;
export let lastSyncError: string | null = null;
const LOCK_ID = 727274; // arbitrary app-wide advisory lock key

async function sync() {
  await ensureSchema();
  // Cross-instance lock: on serverless several instances may try to sync at once.
  const client = await pool.connect();
  let locked = false;
  try {
    const r = await client.query<{ ok: boolean }>("select pg_try_advisory_lock($1) as ok", [LOCK_ID]);
    locked = r.rows[0]?.ok === true;
    if (!locked) return; // someone else is syncing
    await doSync();
  } finally {
    if (locked) await client.query("select pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
  }
}

async function doSync() {
  const now = new Date();
  const cur = seasonCode(now);
  const prev = seasonCode(now, 1);
  const haveRows = await db
    .select({ div: matches.div, season: matches.season, c: sql<number>`count(*)::int` })
    .from(matches)
    .groupBy(matches.div, matches.season);
  const have = new Set(haveRows.filter((r) => r.c > 50).map((r) => `${r.div}|${r.season}`));
  const jobs: { div: string; season: string }[] = [];
  for (const l of LEAGUES) {
    jobs.push({ div: l.div, season: cur });
    if (!have.has(`${l.div}|${prev}`)) jobs.push({ div: l.div, season: prev });
  }
  const [seasonData, fixtures] = await Promise.all([inBatches(jobs, 6, (j) => fetchSeason(j.div, j.season)), fetchFixtures()]);
  const all = [...seasonData.flat(), ...fixtures];
  if (!all.length) throw new Error("No data received from football-data.co.uk");
  for (const l of LEAGUES) await upsertDiv(l.div, all.filter((g) => g.div === l.div));
  // drop fixtures that never got a result (postponed) after 5 days
  await db
    .delete(matches)
    .where(and(eq(matches.status, "scheduled"), eq(matches.source, "football-data"), lt(matches.kickoff, new Date(Date.now() - 5 * DAY))));
  for (const l of LEAGUES) await predictDiv(l.div);
}

export function runSync() {
  if (!syncing) {
    syncing = sync()
      .then(() => {
        lastSync = Date.now();
        lastSyncError = null;
      })
      .catch((e: Error) => {
        lastSyncError = e.message;
        lastSync = Date.now() - SYNC_INTERVAL + 10 * 60 * 1000; // retry in 10 min
        console.error("[sync] failed", e);
      })
      .finally(() => {
        syncing = null;
      });
  }
  return syncing;
}

/** Last successful sync time, persisted in the DB so it survives serverless cold starts. */
async function lastSyncedAt(): Promise<number> {
  const [r] = await db.select({ t: sql<Date | null>`max(${modelFits.fittedAt})` }).from(modelFits);
  return r?.t ? new Date(r.t).getTime() : 0;
}

export async function ensureData() {
  await ensureSchema();
  if (Date.now() - lastSync < SYNC_INTERVAL) return;
  const dbLast = await lastSyncedAt();
  if (Date.now() - dbLast < SYNC_INTERVAL) {
    lastSync = dbLast;
    return;
  }
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(matches).where(isNotNull(matches.homeProb));
  if (c === 0) {
    await runSync(); // first boot: wait for data
    return;
  }
  // Stale data: serve what we have, refresh after the response is sent.
  try {
    after(() => runSync());
  } catch {
    void runSync();
  }
  lastSync = Date.now(); // avoid re-scheduling on every request in this instance
}

const predicted = isNotNull(matches.homeProb);

export async function getMatchesForDay(offset: number, div?: string): Promise<PMatch[]> {
  await ensureData();
  const start = dayStart(offset);
  const conds = [predicted, gte(matches.kickoff, start), lt(matches.kickoff, new Date(start.getTime() + DAY))];
  if (div) conds.push(eq(matches.div, div));
  return (await db.select().from(matches).where(and(...conds)).orderBy(asc(matches.kickoff), asc(matches.div))) as PMatch[];
}

export async function getDayCounts(from: number, to: number) {
  await ensureData();
  const rows = await db
    .select({ d: sql<string>`to_char(${matches.kickoff} at time zone 'UTC', 'YYYY-MM-DD')`, c: sql<number>`count(*)::int` })
    .from(matches)
    .where(and(predicted, gte(matches.kickoff, dayStart(from)), lt(matches.kickoff, dayStart(to + 1))))
    .groupBy(sql`1`);
  const map = new Map(rows.map((r) => [r.d, r.c]));
  const out: { offset: number; date: Date; count: number }[] = [];
  for (let o = from; o <= to; o++) {
    const d = dayStart(o);
    out.push({ offset: o, date: d, count: map.get(d.toISOString().slice(0, 10)) ?? 0 });
  }
  return out;
}

export async function getFinishedSince(days: number): Promise<PMatch[]> {
  await ensureData();
  return (await db
    .select()
    .from(matches)
    .where(and(predicted, eq(matches.status, "finished"), gte(matches.kickoff, dayStart(-days))))
    .orderBy(desc(matches.kickoff))) as PMatch[];
}

export async function getMatch(id: number): Promise<PMatch | undefined> {
  if (!Number.isFinite(id)) return undefined;
  await ensureData();
  const [m] = await db.select().from(matches).where(and(eq(matches.id, id), predicted));
  return m as PMatch | undefined;
}

export async function getTeamForm(team: string, before: Date, limit = 5): Promise<Match[]> {
  return db
    .select()
    .from(matches)
    .where(and(eq(matches.status, "finished"), lt(matches.kickoff, before), or(eq(matches.homeTeam, team), eq(matches.awayTeam, team))))
    .orderBy(desc(matches.kickoff))
    .limit(limit);
}

export async function getModelFits() {
  await ensureData();
  return db.select().from(modelFits);
}

export async function getModelFit(div: string) {
  const [f] = await db.select().from(modelFits).where(eq(modelFits.div, div));
  return f;
}

export async function getAllRecent(limit = 400): Promise<Match[]> {
  await ensureData();
  return db.select().from(matches).where(gte(matches.kickoff, dayStart(-7))).orderBy(asc(matches.kickoff)).limit(limit);
}

export async function repredictDiv(div: string) {
  await predictDiv(div);
}
