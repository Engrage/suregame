import { getMatchesForDay } from "@/lib/data";
import { BASE_MARKETS, surePicks, tipFor, valuePicks } from "@/lib/markets";
import { dayOffset } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // first visit on an empty database runs the initial sync

export async function GET(req: Request) {
  const url = new URL(req.url);
  const offset = dayOffset(url.searchParams.get("day"));
  const list = await getMatchesForDay(offset, url.searchParams.get("league") ?? undefined);
  return Response.json({
    sureGames: surePicks(list).map((p) => ({ matchId: p.match.id, market: p.market, ...p.tip, outcome: p.outcome })),
    valueBets: valuePicks(list).map((p) => ({ matchId: p.match.id, market: p.market, ...p.tip, outcome: p.outcome })),
    matches: list.map((m) => ({ ...m, tips: Object.fromEntries(BASE_MARKETS.map((k) => [k, tipFor(m, k)])) })),
  });
}
