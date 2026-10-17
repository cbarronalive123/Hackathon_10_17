# NoirStay — Hotel Aggregator

Hotel aggregator built with **Next.js 16 (App Router)** + **PostgreSQL** for the October 2026 hackathon.
Dark monochrome theme (black → almost-black gradient, white/grey type and edges), a voice-driven AI
concierge chat on the main page, a storefront, and separate customer/admin portals.

## Stack

- **Next.js 16** — App Router, server components, route handlers (Turbopack)
- **PostgreSQL 16** — `pg` driver, schema + seed in `db/`
- **Auth** — bcryptjs + JWT sessions (jose) in httpOnly cookies; customer and admin roles
- **AI** — Spur API (`spur-glm-5-3`) powers the concierge chat
- **Voice** — ElevenLabs speech-to-text + text-to-speech endpoints (`/api/voice/*`), with the
  browser's Web Speech API / speechSynthesis as automatic fallback when no key is configured

## Features

- **Main page** — hero + voice chat ("Talk to NoirStay"). Tap the mic and speak; the concierge
  transcribes, queries the aggregated catalog, and answers with clickable hotel cards. Optional
  spoken replies via the speaker toggle.
- **Storefront** (`/hotels`) — search, city/price/stars filters, sorting; hotel detail pages with
  booking form (dates, guests, rooms, room type, live total).
- **Login** (`/login`) — one form, two buttons: **Customer Portal** and **Admin Portal**.
  Wrong-role logins are rejected with a clear message.
- **Customer dashboard** (`/dashboard`) — overview stats, bookings with cancel, profile editing.
- **Admin dashboard** (`/admin`) — platform stats/revenue, hotel CRUD, booking management, users.

Both dashboards use a full-height left sidebar whose header shows the current page title, and a
main content area with the page title in its own header.

## Setup

```bash
# 1. Configure env (see .env.local.example values below)
cp .env.local.example .env.local   # or create manually

# 2. Create the database (needs psql on PATH)
createdb noirstay

# 3. Apply schema + seed (24 hotels, 5 users, 11 bookings)
psql $DATABASE_URL -f db/schema.sql
node db/seed.mjs

# 4. Run
npm install
npm run dev        # http://localhost:3000
```

### Environment (`.env.local`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random hex used to sign session JWTs |
| `SPUR_API_KEY` / `SPUR_BASE_URL` / `SPUR_MODEL` | Spur LLM for the concierge chat |
| `ELEVENLABS_API_KEY` | Optional. Enables ElevenLabs voice input + spoken replies. Claim a key from the hackathon Discord (`#🎟️│coupon-codes`) |
| `ELEVENLABS_VOICE_ID` | Voice for TTS (default `21m00Tcm4TlvDq8ikWAM` — Rachel) |
| `LITEAPI_KEY` | Nuitee Connect (liteAPI) sandbox key — powers live hotel search in the concierge chat. Free key at [liteapi.travel](https://www.liteapi.travel/) |

Without an ElevenLabs key the mic uses the browser's built-in speech recognition and replies stay
text-only — everything still works.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Customer | `guest@noirstay.com` | `Guest123!` |
| Admin | `admin@noirstay.com` | `Admin123!` |

## Voice chat architecture

```
mic tap ─▶ Web Speech API (or ElevenLabs S2T if key set) ─▶ text
       ─▶ POST /api/chat
            ├─ LLM extracts search intent (destination, dates, guests)
            ├─ Nuitee Connect (liteAPI) live hotel search → results upserted into Postgres
            └─ Spur GLM-5 answers over the live catalog (RECOMMENDS protocol)
       ─▶ reply + recommended hotel ids ─▶ cards link to /hotels/[id]
       ─▶ optional spoken reply: ElevenLabs TTS (or browser speechSynthesis)
```

Chat history is persisted per session in `chat_messages`. Live hotels are stored with
`provider = 'Nuitee Connect'` and a unique `provider_hotel_id`, so detail pages and bookings
work the same as seeded hotels. Without a `LITEAPI_KEY` the chat falls back to the seeded catalog.

## Scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:schema` | Apply `db/schema.sql` |
| `npm run db:seed` | Re-seed demo data |
