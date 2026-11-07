import { getAllRecent, runSync, lastSyncError } from "@/lib/data";
import { isAdmin, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // first visit on an empty database runs the initial sync

export async function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  const list = await getAllRecent(600);
  return Response.json({ matches: list, lastSyncError });
}

/** Force a data refresh + model refit. */
export async function POST(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  const started = Date.now();
  await runSync();
  return Response.json({ ok: !lastSyncError, error: lastSyncError, ms: Date.now() - started });
}
