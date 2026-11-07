export function isAdmin(req: Request) {
  const key = req.headers.get("x-admin-key");
  const expected = process.env.ADMIN_PASSWORD || "admin123";
  return !!key && key === expected;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
