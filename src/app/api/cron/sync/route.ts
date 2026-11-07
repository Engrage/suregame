import { runSync, lastSyncError } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Downloads the latest results/fixtures/odds and refits the model.
 * Called by Vercel Cron (see vercel.json). Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
 * You can also call it manually: curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/sync
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  await runSync();
  return Response.json({ ok: !lastSyncError, error: lastSyncError, ms: Date.now() - started });
}
