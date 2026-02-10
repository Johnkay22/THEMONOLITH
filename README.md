# The Monolith

Mobile-first, minimalist "King of the Hill" monument built with:

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + Framer Motion
- Supabase (PostgreSQL + Realtime)
- Stripe Payment Intents

## Current scaffold status

This repository now contains the full project structure for:

- Monolith display shell and control deck
- Initialize Syndicate modal UI
- Syndicate ledger UI list
- Supabase schema migration + seed
- Realtime hook scaffold for monolith updates
- Stripe API endpoint scaffolding (`create-payment-intent` + `webhook`)

## Directory structure

```txt
app/
  api/stripe/
    create-payment-intent/route.ts
    webhook/route.ts
  globals.css
  layout.tsx
  page.tsx

components/monolith/
  ControlDeck.tsx
  InitializeSyndicateModal.tsx
  MonolithDisplay.tsx
  MonolithExperience.tsx
  SyndicateLedger.tsx

hooks/
  useMonolithRealtime.ts

lib/
  env.ts
  stripe.ts
  protocol/
    monolith.ts
    payments.ts
    pricing.ts
  supabase/
    browser.ts
    server.ts

supabase/
  migrations/202602100001_initial_monolith_schema.sql
  seed.sql

types/
  monolith.ts
```

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template:

```bash
cp .env.example .env.local
```

3. Fill in Supabase + Stripe keys in `.env.local`.

4. Run the app:

```bash
npm run dev
```

## Protocol notes

- Seed occupant is `"WHO WILL BE FIRST?"` with valuation `$1.00`.
- Displacement cost is calculated as `current valuation + $1.00`.
- Syndicates are modeled as persistent pools that can auto-coup when threshold is passed.
