# The Monolith

Mobile-first, minimalist "King of the Hill" monument built with:

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + Framer Motion
- Supabase (PostgreSQL + Realtime)
- Stripe Payment Intents

## Current status

Step 2 (Supabase integration) and Step 3 (Realtime transitions) are now wired.

- The landing page fetches the live monolith + active syndicates from Supabase.
- The client subscribes to Supabase Realtime updates for:
  - `monolith_history`
  - `syndicates`
- The center inscription fades between occupants with Framer Motion.
- The ledger updates live as syndicates are inserted/updated/archived.
- A syndicate initialize API route persists:
  - `syndicates` row
  - initial `contributions` row
- If a new syndicate immediately exceeds current valuation, it auto-coups.
- Stripe route scaffolding remains in place for Step 4 payment settlement.

## Directory structure

```txt
app/
  api/syndicates/
    initialize/route.ts
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
    constants.ts
    monolith.ts
    normalizers.ts
    payments.ts
    pricing.ts
  supabase/
    browser.ts
    server.ts

supabase/
  migrations/202602100001_initial_monolith_schema.sql
  migrations/202602100002_realtime_and_read_policies.sql
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

3. Fill in `.env.local` values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (required for syndicate initialize API route)
   - Stripe keys for upcoming Step 4 integration

4. Run the app:

```bash
npm run dev
```

## Protocol notes

- Seed occupant is `"WHO WILL BE FIRST?"` with valuation `$1.00`.
- Displacement cost is calculated as `current valuation + $1.00`.
- Syndicates are modeled as persistent pools that can auto-coup when threshold is passed.
- The `/api/syndicates/initialize` route currently records initial escrow directly (temporary backend path before Stripe webhook-first settlement is finalized in Step 4).  
