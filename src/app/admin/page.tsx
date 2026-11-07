"use client";

import { useCallback, useEffect, useState } from "react";

type M = {
  id: number; league: string; country: string; homeTeam: string; awayTeam: string; kickoff: string;
  status: string; homeScore: number | null; awayScore: number | null; htHome: number | null; htAway: number | null;
  corners: number | null; homeProb: number | null; drawProb: number | null; awayProb: number | null; source: string;
};

const input = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none";

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [list, setList] = useState<M[]>([]);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async (k: string) => {
    const r = await fetch("/api/admin/matches", { headers: { "x-admin-key": k } });
    if (!r.ok) {
      setAuthed(false);
      setMsg("Wrong password");
      return;
    }
    const d = (await r.json()) as { matches: M[] };
    setList(d.matches);
    setAuthed(true);
    setMsg("");
    sessionStorage.setItem("sg-admin", k);
  }, []);

  useEffect(() => {
    const k = sessionStorage.getItem("sg-admin");
    if (k) {
      setKey(k);
      void load(k);
    }
  }, [load]);

  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    setMsg("⏳ Downloading latest results & refitting all leagues…");
    const r = await fetch("/api/admin/matches", { method: "POST", headers: { "x-admin-key": key } });
    const d = (await r.json()) as { ok: boolean; error?: string; ms: number };
    setBusy(false);
    setMsg(d.ok ? `✅ Data refreshed and model refitted in ${(d.ms / 1000).toFixed(1)}s` : `❌ ${d.error}`);
    void load(key);
  }

  async function saveResult(id: number, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
    const r = await fetch(`/api/admin/matches/${id}`, { method: "PATCH", headers: { "content-type": "application/json", "x-admin-key": key }, body: JSON.stringify(fd) });
    if (r.ok) {
      setEditing(null);
      setMsg("✅ Result saved");
      void load(key);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this match?")) return;
    await fetch(`/api/admin/matches/${id}`, { method: "DELETE", headers: { "x-admin-key": key } });
    void load(key);
  }

  if (!authed)
    return (
      <div className="mx-auto max-w-sm py-20">
        <h1 className="text-2xl font-black text-white">🔐 Model Admin</h1>
        <p className="mt-1 text-sm text-slate-400">Enter the admin password to publish predictions and results.</p>
        <form onSubmit={(e) => { e.preventDefault(); void load(key); }} className="mt-6 space-y-3">
          <input type="password" className={input} placeholder="Password" value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="w-full rounded-lg bg-emerald-500 py-2 font-bold text-emerald-950 hover:bg-emerald-400">Sign in</button>
          {msg && <p className="text-sm text-rose-400">{msg}</p>}
          <p className="text-xs text-slate-500">Default password: <code>admin123</code> (set ADMIN_PASSWORD to change).</p>
        </form>
      </div>
    );

  const shown = list.filter((m) => `${m.homeTeam} ${m.awayTeam} ${m.league} ${m.country}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-white">🛠️ Model Admin</h1>
        <button onClick={() => { sessionStorage.removeItem("sg-admin"); setAuthed(false); setKey(""); }} className="text-sm text-slate-400 hover:text-white">Sign out</button>
      </div>
      {msg && <p className="rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">{msg}</p>}

      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-[#0e1a14] p-5 md:flex-row md:items-center">
        <div>
          <p className="font-bold text-white">Data &amp; model</p>
          <p className="text-sm text-slate-400">Results, fixtures and odds sync from football-data.co.uk every 2 hours automatically. Force a refresh and full model refit here.</p>
        </div>
        <button disabled={busy} onClick={refresh} className="shrink-0 rounded-lg bg-emerald-500 px-5 py-2 font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50">
          {busy ? "Refitting…" : "Refresh data & refit"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0e1a14]">
        <div className="flex items-center justify-between gap-4 border-b border-white/5 p-4">
          <p className="font-bold text-white">Matches ({shown.length})</p>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search team or league…" className={`${input} max-w-xs`} />
        </div>
        <div className="max-h-[600px] divide-y divide-white/5 overflow-y-auto">
          {shown.map((m) => (
            <div key={m.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white">{m.homeTeam} vs {m.awayTeam}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(m.kickoff).toUTCString().slice(0, 22)} · {m.country} {m.league} · {m.homeProb != null ? `${Math.round(m.homeProb)}/${Math.round(m.drawProb ?? 0)}/${Math.round(m.awayProb ?? 0)}` : "no prediction"} · {m.source}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded bg-white/5 px-2 py-1 text-xs uppercase text-slate-300">{m.status}</span>
                  {m.homeScore != null && <span className="font-mono font-bold text-white">{m.homeScore}-{m.awayScore}</span>}
                  <button onClick={() => setEditing(editing === m.id ? null : m.id)} className="text-emerald-300 hover:underline">Result</button>
                  <button onClick={() => remove(m.id)} className="text-rose-400 hover:underline">Delete</button>
                </div>
              </div>
              {editing === m.id && (
                <form onSubmit={(e) => saveResult(m.id, e)} className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-7">
                  <input name="homeScore" type="number" defaultValue={m.homeScore ?? ""} placeholder="FT home" className={input} />
                  <input name="awayScore" type="number" defaultValue={m.awayScore ?? ""} placeholder="FT away" className={input} />
                  <input name="htHome" type="number" defaultValue={m.htHome ?? ""} placeholder="HT home" className={input} />
                  <input name="htAway" type="number" defaultValue={m.htAway ?? ""} placeholder="HT away" className={input} />
                  <input name="corners" type="number" defaultValue={m.corners ?? ""} placeholder="Corners" className={input} />
                  <select name="status" defaultValue={m.status === "scheduled" ? "finished" : m.status} className={input}>
                    <option value="scheduled">Scheduled</option>
                    <option value="live">Live</option>
                    <option value="finished">Finished</option>
                  </select>
                  <button className="rounded-lg bg-emerald-500 font-bold text-emerald-950">Save</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
