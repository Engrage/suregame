import Link from "next/link";
import { MARKETS } from "@/lib/markets";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07110c]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-lime-300 text-lg font-black text-emerald-950">
            SG
          </span>
          <span className="text-xl font-extrabold tracking-tight text-white">
            Sure<span className="text-emerald-400">Games</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
          <Link href="/predictions/sure-games" className="rounded-lg bg-amber-400/15 px-3 py-2 text-amber-300 hover:bg-amber-400/25">
            🔥 Sure Games
          </Link>
          <Link href="/predictions/1x2" className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white">Predictions</Link>
          <Link href="/predictions/value" className="rounded-lg px-3 py-2 text-sky-300 hover:bg-white/5">💎 Value</Link>
          <Link href="/live" className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white">Matchday</Link>
          <Link href="/results" className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white">Results</Link>
          <Link href="/model" className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white">🧠 Model</Link>
        </nav>
        <Link href="/predictions/sure-games" className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-amber-950 md:hidden">
          🔥 Sure
        </Link>
      </div>
      <div className="border-t border-white/5 bg-[#0a1711]">
        <div className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 text-xs font-semibold">
          {MARKETS.map((m) => (
            <Link
              key={m.key}
              href={`/predictions/${m.key}`}
              className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:border-emerald-400/50 hover:text-emerald-300"
            >
              {m.icon} {m.short}
            </Link>
          ))}
          <Link href="/live" className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:text-emerald-300 md:hidden">🔴 Live</Link>
          <Link href="/results" className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:text-emerald-300 md:hidden">✅ Results</Link>
          <Link href="/model" className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:text-emerald-300 md:hidden">🧠 Model</Link>
        </div>
      </div>
    </header>
  );
}
