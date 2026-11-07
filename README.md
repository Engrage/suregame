# SureGames ⚽🔥

Football predictions from a real statistical model: a time-weighted **Dixon–Coles** Poisson model fitted on real results and xG for 17 leagues. Includes sure games, value bets, 1X2, double chance, over/under 2.5, both teams to score, HT/FT, correct score and corners, and every pick is graded in public.

Built with Next.js (App Router), PostgreSQL and Drizzle ORM. Data comes from [football-data.co.uk](https://www.football-data.co.uk).

---

## 🚀 Deploy to Vercel (about 10 minutes)

### 1. Put the code on GitHub

Create an **empty** repository on GitHub (no README or .gitignore), then run this in the project folder:

```bash
git init            # skip if the folder is already a git repo
git add .
git commit -m "SureGames"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/suregames.git
git push -u origin main
```

> `.env` is in `.gitignore`, so your local passwords are never uploaded.

### 2. Import the repo into Vercel

1. Go to **https://vercel.com/new** and sign in with GitHub.
2. Select your `suregames` repo and click **Import**. Vercel detects Next.js automatically. **Don't deploy yet.**

### 3. Add a Postgres database

Vercel doesn't run Postgres itself, so use a free hosted one:

- **Easiest:** in your Vercel project go to **Storage → Create Database → Neon (Postgres)** and connect it to the project. This sets `DATABASE_URL` for you.
- **Or** create a free database at [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com) and copy its connection string (it should end with `?sslmode=require`).

You don't need to run migrations. The app creates its tables automatically on first run.

### 4. Set environment variables

In **Project → Settings → Environment Variables**:

| Name | Value |
|---|---|
| `DATABASE_URL` | your Postgres connection string (auto-set if you used Vercel Storage) |
| `ADMIN_PASSWORD` | a password for `/admin` |
| `CRON_SECRET` | any long random string (e.g. from `openssl rand -hex 32`) |

### 5. Deploy and load the data

Click **Deploy**. When it finishes, load the data once (this downloads about 7,700 matches and fits all 17 league models, which takes 30–90 s):

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-APP.vercel.app/api/cron/sync
```

You can also just open the site. The first visit to an empty database runs the same sync (the page loads slowly once).

### Keeping data fresh

- `vercel.json` runs `/api/cron/sync` **daily at 06:00 UTC** (the Hobby plan allows daily crons).
- In between, when data is more than 2 hours old, a visit triggers a background refresh after the page is served.
- `/admin` has a **Refresh data & refit** button.

---

## 💻 Run locally

```bash
cp .env.example .env     # then edit DATABASE_URL
npm install
npm run dev
```

Open http://localhost:3000. The first load downloads the data and fits the model.

---

## 🧠 How the model works

- **Team strengths:** each team gets an attack and a defence rating per league, estimated by weighted Poisson maximum likelihood. Matches decay with a 150-day half-life, targets blend goals 50/50 with xG, and ratings shrink toward the league average when there are few games.
- **Expected goals:** `λ_home = c·H·A_home·D_away` and `μ_away = c·A_away·D_home`. These build an 11×11 scoreline matrix with the Dixon–Coles low-score correction (ρ).
- **Markets:** 1X2, over/under, both teams to score and correct score come from the matrix. HT/FT uses a half-by-half split, and corners use a separate corner-rate model.
- **Honest grading:** every prediction uses only data available before its matchday and is graded automatically. `/model` compares accuracy, Brier score and log loss against bookmaker odds, and shows calibration and team ratings.

## Project structure

```
src/lib/model.ts         Dixon–Coles model (fitting + prediction)
src/lib/footballData.ts  CSV fetch & parse (football-data.co.uk)
src/lib/data.ts          sync, prediction storage, queries
src/lib/markets.ts       tips, sure games, value bets, grading
src/lib/stats.ts         hit rates, ROI, Brier/log-loss, calibration
src/app/...              pages & API routes
```

API: `GET /api/predictions?day=0|1|-1&league=E0` returns JSON with matches, tips, sure games and value bets.

---

18+ only. Predictions are probabilities, not guarantees. Please gamble responsibly.
