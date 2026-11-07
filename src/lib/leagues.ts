export type LeagueInfo = { div: string; league: string; country: string; flag: string; tier: number };

export const LEAGUES: LeagueInfo[] = [
  { div: "E0", league: "Premier League", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier: 1 },
  { div: "SP1", league: "LaLiga", country: "Spain", flag: "🇪🇸", tier: 1 },
  { div: "I1", league: "Serie A", country: "Italy", flag: "🇮🇹", tier: 1 },
  { div: "D1", league: "Bundesliga", country: "Germany", flag: "🇩🇪", tier: 1 },
  { div: "F1", league: "Ligue 1", country: "France", flag: "🇫🇷", tier: 1 },
  { div: "N1", league: "Eredivisie", country: "Netherlands", flag: "🇳🇱", tier: 1 },
  { div: "P1", league: "Primeira Liga", country: "Portugal", flag: "🇵🇹", tier: 1 },
  { div: "B1", league: "Pro League", country: "Belgium", flag: "🇧🇪", tier: 1 },
  { div: "T1", league: "Süper Lig", country: "Turkey", flag: "🇹🇷", tier: 1 },
  { div: "G1", league: "Super League", country: "Greece", flag: "🇬🇷", tier: 1 },
  { div: "SC0", league: "Premiership", country: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", tier: 1 },
  { div: "E1", league: "Championship", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier: 2 },
  { div: "SP2", league: "LaLiga 2", country: "Spain", flag: "🇪🇸", tier: 2 },
  { div: "I2", league: "Serie B", country: "Italy", flag: "🇮🇹", tier: 2 },
  { div: "D2", league: "2. Bundesliga", country: "Germany", flag: "🇩🇪", tier: 2 },
  { div: "F2", league: "Ligue 2", country: "France", flag: "🇫🇷", tier: 2 },
  { div: "SC1", league: "Championship", country: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", tier: 2 },
];

export function leagueByDiv(div: string) {
  return LEAGUES.find((l) => l.div === div);
}

export function flagFor(country: string) {
  return LEAGUES.find((l) => l.country === country)?.flag ?? "🌍";
}
