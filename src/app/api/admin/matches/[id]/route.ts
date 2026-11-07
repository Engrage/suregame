import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdmin, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

const num = (v: unknown) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const { id } = await ctx.params;
  const b = (await req.json()) as Record<string, unknown>;
  const status = ["scheduled", "live", "finished"].includes(String(b.status)) ? String(b.status) : "finished";
  const [row] = await db
    .update(matches)
    .set({
      status,
      homeScore: num(b.homeScore),
      awayScore: num(b.awayScore),
      htHome: num(b.htHome),
      htAway: num(b.htAway),
      corners: num(b.corners),
    })
    .where(eq(matches.id, Number(id)))
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ match: row });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const { id } = await ctx.params;
  await db.delete(matches).where(eq(matches.id, Number(id)));
  return Response.json({ ok: true });
}
