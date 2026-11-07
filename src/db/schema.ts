import { pgTable, serial, text, integer, timestamp, real, jsonb, index } from "drizzle-orm/pg-core";

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    div: text("div").notNull(),
    season: text("season").notNull(),
    league: text("league").notNull(),
    country: text("country").notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    kickoff: timestamp("kickoff", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"), // scheduled | finished
    // results
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    htHome: integer("ht_home"),
    htAway: integer("ht_away"),
    homeCorners: integer("home_corners"),
    awayCorners: integer("away_corners"),
    corners: integer("corners"),
    homeXg: real("home_xg"),
    awayXg: real("away_xg"),
    // market (average pre-match odds)
    odds1: real("odds_1"),
    oddsX: real("odds_x"),
    odds2: real("odds_2"),
    oddsOver25: real("odds_over25"),
    oddsUnder25: real("odds_under25"),
    // model prediction (out-of-sample, frozen at kickoff)
    predictedAt: timestamp("predicted_at", { withTimezone: true }),
    expHome: real("exp_home"),
    expAway: real("exp_away"),
    homeProb: real("home_prob"),
    drawProb: real("draw_prob"),
    awayProb: real("away_prob"),
    over25Prob: real("over25_prob"),
    bttsProb: real("btts_prob"),
    predHome: integer("pred_home"),
    predAway: integer("pred_away"),
    csProb: real("cs_prob"),
    htftTip: text("htft_tip"),
    htftProb: real("htft_prob"),
    expCorners: real("exp_corners"),
    cornersLine: real("corners_line"),
    cornersOverProb: real("corners_over_prob"),
    matrix: jsonb("matrix").$type<number[][]>(),
    source: text("source").notNull().default("football-data"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("matches_kickoff_idx").on(t.kickoff), index("matches_div_season_idx").on(t.div, t.season)],
);

export const modelFits = pgTable("model_fits", {
  div: text("div").primaryKey(),
  fittedAt: timestamp("fitted_at", { withTimezone: true }).notNull(),
  nGames: integer("n_games").notNull(),
  homeAdv: real("home_adv").notNull(),
  level: real("level").notNull(),
  rho: real("rho").notNull(),
  htShare: real("ht_share").notNull(),
  teams: jsonb("teams").$type<{ team: string; attack: number; defence: number; rating: number }[]>().notNull(),
  params: jsonb("params").notNull(),
});

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;

type Req<T, K extends keyof T> = Omit<T, K> & { [P in K]: NonNullable<T[P]> };
export type PMatch = Req<
  Match,
  "homeProb" | "drawProb" | "awayProb" | "over25Prob" | "bttsProb" | "predHome" | "predAway" | "csProb" | "htftTip" | "htftProb" | "expHome" | "expAway"
>;
