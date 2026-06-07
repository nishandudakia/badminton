# Badminton Championship

Modern mobile-first web app for running a weekly Americano-style badminton championship.

## What Is Included

- Next.js App Router, TypeScript, Tailwind CSS 4
- Local-first autosave so the MVP works immediately without Supabase keys
- Supabase repository adapter that loads and saves through the relational tables when env vars are configured
- Supabase schema and seed data in `supabase/`
- Americano-style schedule generator with fair partner, opponent, and bye balancing
- Separate session match points and championship points
- Proper competition ranking for tied session results
- Player management, guests, archive support, session history, recalculation, imports, stats, CSV export, image export, dark mode, and PWA shell

## Local Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The current dev server for this workspace is running in a detached `screen` session:

```bash
screen -r badminton-championship
```

Stop it with:

```bash
screen -S badminton-championship -X quit
```

## Supabase Setup

Create a Supabase project, then add the public client values to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Apply the database files:

```bash
supabase db push
supabase db execute --file supabase/seed.sql
```

The UI uses a persistence adapter. Without Supabase env vars it saves locally for offline match nights; with env vars it loads and saves through the Supabase tables.

## Core Files

- `src/lib/schedule.ts`: Americano schedule generation
- `src/lib/scoring.ts`: score validation, session leaderboard, competition ranking
- `src/lib/championship.ts`: player/session services, imports, finalization, season recalculation
- `src/lib/repository.ts`: local/Supabase persistence adapter
- `src/lib/stats.ts`: progression, partner records, head-to-head records
- `src/components/ChampionshipApp.tsx`: responsive app shell and workflow
- `supabase/migrations/0001_initial_schema.sql`: relational database schema
- `supabase/seed.sql`: existing championship standings as real seed data

## Production Build

```bash
npm run build
npm run start
```

For installable PWA behavior, serve the production build over HTTPS.

## Free GitHub Pages Deploy

This repo includes `.github/workflows/deploy-pages.yml`. On every push to `main`, GitHub Actions builds a static Next.js export and publishes `out/` to GitHub Pages.

In GitHub:

1. Open the repository settings.
2. Go to **Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main`.

For normal project repos, the workflow automatically serves the app under `/<repo-name>`. For `username.github.io` repos, it serves from `/`.

Optional Supabase hosting:

1. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as GitHub repository secrets.
2. Run the Supabase migration and seed files.
3. Push to `main` again.
