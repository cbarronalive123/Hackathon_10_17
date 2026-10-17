# Hackathon_10_17

Project workspace for the October 2026 hackathon.

## NoirStay — hotel aggregator (main submission)

A voice-first hotel aggregator: Next.js 16 + PostgreSQL, dark monochrome UI,
AI concierge chat (Spur GLM), ElevenLabs voice integration, storefront,
customer portal, and admin portal.

**Run it:**

```bash
cd noirstay
npm install
npm run dev   # http://localhost:3000
```

See `noirstay/README.md` for full setup (database, env, demo accounts).

## StayLine — AI phone booking agent

Searches live liteAPI hotel rates, enriches them with phone numbers, then places
real Twilio calls where an ElevenLabs AI agent books the room with the front desk.
Three modes: `real`, `test` (your phone), `sim` (agent-to-agent demo).

```bash
cd stayline
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
python scripts/setup_agents.py
python run.py   # http://127.0.0.1:8010
```

See `stayline/README.md` for full setup (Twilio, ElevenLabs, ngrok, call modes).

## Other folders

- `hotel_api/` — liteAPI (Nuitee Connect) sandbox test script
- `phone_agent/` — PyQt6 ADB dialer project (unrelated)
