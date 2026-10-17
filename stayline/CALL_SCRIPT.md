# StayLine Test-Call Script — YOU are the hotel front desk

You are testing the StayLine AI booking agent. Press **CALL MY PHONE** in the GUI
(`gui.py`), answer your phone, and read this script. The AI agent plays a booking
assistant calling on behalf of your guest; you play the front desk clerk of
**The Grand Meridian Hotel**. Your job: take the booking, **hold the room**, and give
the agent all the pertinent details (reference number, dates, times, suite type,
price, cancellation policy) so it can be verified in the GUI afterward.

---

## 1. Before you answer

- The call comes from your Twilio number (`TWILIO_FROM_NUMBER`) — pick up like a normal call.
- Speak naturally at a normal pace. Pause after each of your lines — the agent takes
  about a second to respond.
- If the agent says "let me record that" or goes quiet for 1–2 seconds, it is calling
  its reservation tool. Wait for it to continue.
- Stay in character. If you fumble a line, just say it again — the agent copes fine.

## 2. What you will hear first (the AI's opening)

> "Hello! My name is Alex, I'm an automated assistant calling on behalf of **[guest
> name]**. I'd like to book a room at your hotel from **[check-in]** to
> **[check-out]**. Is now a good time for a quick reservation?"

(With the GUI defaults this is **Jane Doe**, **November 16 to November 18** — use
whatever dates and name the agent actually says.)

**Your reply:**

> "Thank you for calling the Grand Meridian Hotel, this is the front desk — yes, now
> is fine, I can help you with that."

## 3. The conversation

### Step 1 — Take the details

The agent will tell you the guest name, the dates, and that it wants the
**Deluxe King Suite** for **2 adults, 1 room**.

**Ask for the spelling (the agent should confirm it):**

> "Could you spell the guest's last name for me?"

The agent spells it. Then confirm:

> "Perfect. So that's the Deluxe King Suite, checking in [check-in date] and
> checking out [check-out date], two adults, one room. Let me pull up the rate."

### Step 2 — Quote availability and price

> "Good news — the Deluxe King Suite is available for those dates. It's a corner
> suite on a high floor, about 540 square feet with a city view.
> The rate is **$289 per night plus 14% tax** — so for the two nights that comes to
> **$658.92 total, taxes included**."

If the agent asks whether that's the total including all taxes and fees (it will):

> "Yes — $658.92 all in. That's the room, the tax, and it includes the Wi-Fi.
> Breakfast in the lobby is available for $18 per person if you'd like to add it."

(If it asks about adding breakfast, politely decline on the guest's behalf —
"room only" is fine — unless you feel like testing the agent with an upsell.)

### Step 3 — Ask for the email and make the booking

> "Can I have an email address to send the confirmation to?"

The agent gives the guest's email (e.g. jane@example.com). Then:

> "Thank you. I have you all set — I'm making that reservation now."

*(pause 2–3 seconds — rustle imaginary papers)*

> "You're confirmed. Your **booking reference is GM-7QK482** — that's Golf,
> Mike, seven, Quebec, Kilo, four, eight, two."

### Step 4 — The hold

The agent will ask how the reservation is guaranteed / about payment.
Your reply:

> "Since the guest will present their card at check-in, I've placed a **courtesy
> hold** on the suite. The reservation is held and guaranteed for late arrival up
> until **6 PM on arrival day** — after that the room would be released. If the
> guest arrives after 6 PM, just call the hotel and we'll extend the hold."

### Step 5 — The details the agent will ask for

The agent asks for check-in/check-out times and the cancellation policy.
Give these:

> "**Check-in is from 3:00 PM** on arrival day — if the suite is ready earlier we
> can do a complimentary early check-in, just ask at the desk. **Check-out is
> 11:00 AM.**"

> "For cancellation: it's **free to cancel any time up to 24 hours before
> check-in** — that's until 3:00 PM the day before arrival. Inside 24 hours,
> we'd charge the first night. After check-in the full stay applies."

### Step 6 — Wrap up

The agent will re-confirm the reference number and total, then thank you.
Your closing line:

> "Absolutely — just to confirm: Deluxe King Suite, [check-in] to [check-out],
> two nights at $289 a night, $658.92 total, booking reference **GM-7QK482**,
> held until 6 PM on arrival day. The confirmation email is on its way.
> We look forward to having [guest name] with us — have a great day!"

The agent says goodbye and ends the call.

---

## 4. Cheat sheet — every number you give

| Detail | Value |
|---|---|
| Hotel | The Grand Meridian Hotel, 1 Meridian Plaza, New York |
| Suite | **Deluxe King Suite** (corner suite, high floor, ~540 sq ft, city view) |
| Guests | 2 adults, 1 room |
| Nights | 2 (GUI defaults: **Mon Nov 16 → Wed Nov 18, 2026**) — use the dates the agent states |
| Nightly rate | **$289** + 14% tax |
| **Total** | **$658.92** including tax |
| **Booking reference** | **GM-7QK482** |
| Hold | Courtesy hold, guaranteed until **6:00 PM arrival day** (card at check-in) |
| Check-in | From **3:00 PM** (early check-in on request) |
| Check-out | **11:00 AM** |
| Cancellation | Free until **24 hours before check-in** (3:00 PM day before); inside 24h = first night |
| Extras | Wi-Fi included; breakfast $18/person; gym and pool included |

## 5. If the agent asks something else

- **"Are there any resort or facility fees?"** — "No resort fees — the $658.92 is
  everything. Gym, pool and Wi-Fi are included."
- **"Is a rollaway or different suite available?"** — "We also have a Junior Suite
  at $340 a night, but the Deluxe King is the better fit for two adults."
- **"Can I get a late checkout?"** — "Late checkout to 1:00 PM can be requested on
  arrival, subject to availability, no charge."
- **"Can you text or call back the guest?"** — "We'll include the guest's phone
  number in the confirmation email; the front desk can call if anything changes."
- **Anything you don't have a line for** — improvise as a helpful clerk. Never
  invent a *different* price or reference number; stay consistent with the table
  above so you can verify what the GUI recorded.

## 6. After the call — verify the AI captured everything

In the GUI, the **Live call** panel should fill in within a few seconds of
hanging up:

- **Confirmation #** → `GM-7QK482`
- **Dates** → `2026-11-16 → 2026-11-18`
- **Suite / room** → Deluxe King Suite
- **Total price** → $658.92 (incl. tax)
- **Cancellation** → free until 24h before check-in
- **Outcome** → `booked` (reason: confirmed with front desk)
- **Live transcript** → the full conversation, both sides

If a field is wrong or missing, that is exactly the bug you were testing for —
place another call and try wording the detail differently (e.g. say the reference
as "Golf Mike seven..." again slowly).

## 7. Quick troubleshooting

| Symptom | Fix |
|---|---|
| Call button errors with "PUBLIC_URL is not set" | start `ngrok http 8010`, put the https URL in `.env`, restart server |
| "ELEVENLABS_BOOKER_AGENT_ID is not set" | run `python scripts/setup_agents.py` |
| Phone rings, silence after answering | `PUBLIC_URL` in `.env` doesn't match your current ngrok URL — update and restart |
| No transcript appears | transcript arrives when the call ends; give it ~10 seconds, check the server console |
| Agent misheard the reference | just repeat it slowly, digit by digit |
