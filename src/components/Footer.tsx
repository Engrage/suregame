import Link from "next/link";
import { MARKETS } from "@/lib/markets";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-[#060e0a]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-slate-400 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="text-lg font-extrabold text-white">
            Sure<span className="text-emerald-400">Games</span>
          </p>
          <p className="mt-2 max-w-md">
            Statistical football predictions from a time-weighted Dixon–Coles model fitted on real results and xG across 17
            leagues. Sure games, value bets, 1X2, over/under, BTTS, HT/FT, correct score and corners.
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Data: football-data.co.uk. 18+ only. Predictions are statistical estimates, not guarantees. Please gamble responsibly.
          </p>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Markets</p>
          <ul className="space-y-1.5">
            {MARKETS.map((m) => (
              <li key={m.key}>
                <Link className="hover:text-emerald-300" href={`/predictions/${m.key}`}>{m.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">More</p>
          <ul className="space-y-1.5">
            <li><Link className="hover:text-emerald-300" href="/live">Live scores</Link></li>
            <li><Link className="hover:text-emerald-300" href="/results">Results archive</Link></li>
            <li><Link className="hover:text-emerald-300" href="/model">How the model works</Link></li>
            <li><Link className="hover:text-emerald-300" href="/admin">Admin</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-white/5 py-4 text-center text-xs text-slate-600">© {new Date().getFullYear()} SureGames. All rights reserved.</p>
    </footer>
  );
}
