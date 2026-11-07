import Link from "next/link";
import { dayLabel } from "@/lib/format";

export default function DayTabs({
  base,
  active,
  days,
  extra = "",
}: {
  base: string;
  active: number;
  days: { offset: number; date: Date; count: number }[];
  extra?: string;
}) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1 text-sm font-semibold">
      {days.map((d) => (
        <Link
          key={d.offset}
          href={`${base}?day=${d.offset}${extra}`}
          className={`flex min-w-[72px] flex-col items-center rounded-lg px-3 py-1.5 transition ${
            active === d.offset ? "bg-emerald-500 text-emerald-950" : d.count ? "text-slate-200 hover:bg-white/5" : "text-slate-600"
          }`}
        >
          <span className="whitespace-nowrap">{dayLabel(d.offset, d.date)}</span>
          <span className={`text-[10px] ${active === d.offset ? "text-emerald-900" : "text-slate-500"}`}>{d.count} games</span>
        </Link>
      ))}
    </div>
  );
}
