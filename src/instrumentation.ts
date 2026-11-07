export async function register() {
  // On self-hosted servers, warm up on boot. On Vercel (serverless) the cron job
  // and on-demand refreshes handle syncing instead.
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL && process.env.NEXT_PHASE !== "phase-production-build") {
    setTimeout(() => {
      import("./lib/data")
        .then((m) => m.runSync())
        .catch((e) => console.error("[instrumentation] initial sync failed", e));
    }, 1000);
  }
}
