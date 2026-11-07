import { LEAGUES, leagueByDiv } from "./leagues";

const BASE = "https://www.football-data.co.uk";

export type RawGame = {
  div: string;
  season: string;
  home: string;
  away: string;
  kickoff: Date;
  finished: boolean;
  hg: number | null;
  ag: number | null;
  hthg: number | null;
  htag: number | null;
  hc: number | null;
  ac: number | null;
  hxg: number | null;
  axg: number | null;
  odds1: number | null;
  oddsX: number | null;
  odds2: number | null;
  oddsOver25: number | null;
  oddsUnder25: number | null;
};

export function seasonCode(d = new Date(), back = 0) {
  const y = d.getUTCFullYear() % 100;
  const start = (d.getUTCMonth() >= 6 ? y : y - 1) - back;
  const p = (n: number) => String((n + 100) % 100).padStart(2, "0");
  return `${p(start)}${p(start + 1)}`;
}

/** Convert an Europe/London wall-clock time to a UTC Date (handles BST). */
function londonToUtc(y: number, mo: number, d: number, h: number, mi: number) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asLondon = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asLondon - guess));
}

function parseDate(date: string, time: string) {
  const [d, m, yRaw] = date.split("/").map((s) => parseInt(s, 10));
  if (!d || !m || !yRaw) return null;
  const y = yRaw < 100 ? 2000 + yRaw : yRaw;
  const [h, mi] = (time || "15:00").split(":").map((s) => parseInt(s, 10));
  return londonToUtc(y, m, d, Number.isFinite(h) ? h : 15, Number.isFinite(mi) ? mi : 0);
}

function parseCsv(text: string, forcedSeason?: string): RawGame[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().replace(/^\uFEFF/, ""));
  const idx = (k: string) => header.indexOf(k);
  const col = { div: idx("Div"), date: idx("Date"), time: idx("Time"), home: idx("HomeTeam"), away: idx("AwayTeam") };
  const out: RawGame[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    const get = (k: string) => {
      const j = idx(k);
      return j >= 0 ? (c[j] ?? "").trim() : "";
    };
    const num = (...keys: string[]) => {
      for (const k of keys) {
        const v = parseFloat(get(k));
        if (Number.isFinite(v)) return v;
      }
      return null;
    };
    const div = c[col.div]?.trim();
    if (!div || !leagueByDiv(div)) continue;
    const kickoff = parseDate(c[col.date]?.trim() ?? "", col.time >= 0 ? c[col.time]?.trim() ?? "" : "");
    const home = c[col.home]?.trim();
    const away = c[col.away]?.trim();
    if (!kickoff || !home || !away) continue;
    const hg = num("FTHG");
    const ag = num("FTAG");
    out.push({
      div,
      season: forcedSeason ?? seasonCode(kickoff),
      home,
      away,
      kickoff,
      finished: hg != null && ag != null,
      hg, ag,
      hthg: num("HTHG"), htag: num("HTAG"),
      hc: num("HC"), ac: num("AC"),
      hxg: num("HxG"), axg: num("AxG"),
      odds1: num("AvgH", "B365H", "PSH"),
      oddsX: num("AvgD", "B365D", "PSD"),
      odds2: num("AvgA", "B365A", "PSA"),
      oddsOver25: num("Avg>2.5", "B365>2.5", "P>2.5"),
      oddsUnder25: num("Avg<2.5", "B365<2.5", "P<2.5"),
    });
  }
  return out;
}

async function getText(url: string) {
  const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

export async function fetchSeason(div: string, season: string): Promise<RawGame[]> {
  try {
    return parseCsv(await getText(`${BASE}/mmz4281/${season}/${div}.csv`), season);
  } catch (e) {
    console.error("[football-data] season fetch failed", div, season, (e as Error).message);
    return [];
  }
}

export async function fetchFixtures(): Promise<RawGame[]> {
  try {
    const all = parseCsv(await getText(`${BASE}/fixtures.csv`));
    return all.filter((g) => LEAGUES.some((l) => l.div === g.div));
  } catch (e) {
    console.error("[football-data] fixtures fetch failed", (e as Error).message);
    return [];
  }
}
