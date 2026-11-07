import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "SureGames | Sure Football Predictions Today, Tips & Results",
  description:
    "SureGames delivers AI football predictions today: sure games, 1X2, over 2.5, BTTS, HT/FT, correct score and corners for 100+ leagues, with a transparent results archive.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#08130e] text-slate-200 antialiased">
        <Header />
        <main className="mx-auto max-w-7xl px-4">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
