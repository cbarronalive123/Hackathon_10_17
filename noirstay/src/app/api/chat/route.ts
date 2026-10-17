import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { searchLiveHotels, getHotelContact, type LiveHotelRow } from "@/lib/liteapi";
import { isoInDays } from "@/lib/dates";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are the NoirStay Concierge, the voice-enabled AI assistant for NoirStay — a hotel aggregation platform that searches LIVE hotel inventory worldwide (via the Nuitee Connect API) and takes bookings.

Your job:
- Help travelers find hotels, compare options, and book stays.
- When a hotel catalog from a live search is provided below, recommend ONLY from it. Never invent hotels or prices.
- If no catalog is provided, the traveler has not given a usable destination yet: ask short clarifying questions (destination, dates, budget, guests). Do not recommend anything.
- Be concise and warm: 2-4 short sentences or a compact list. Travelers often speak to you by voice, so avoid markdown, tables, and long paragraphs. Plain conversational text only.
- Mention price per night and the city when recommending. Prices are live rates for the traveler's dates.
- If the traveler wants to book, tell them to open the hotel page to pick dates (each recommendation links to it automatically).
- If asked about things other than travel/hotels, steer politely back to helping with their stay.

After considering the catalog, ALWAYS end your reply with one final line in exactly this format (and nothing after it):
RECOMMENDS: <comma-separated hotel ids, up to 3>
Only include that line when you are recommending specific hotels from the catalog. If you have no recommendation yet, end with the line: RECOMMENDS: none`;

type ChatMsg = { role: string; content: string };

function catalogLine(h: {
  id: number;
  name: string;
  city: string;
  country: string;
  star_rating: number;
  guest_rating: number;
  price_per_night: number;
  amenities: string[];
}): string {
  return `#${h.id} ${h.name} — ${h.city}, ${h.country} | ${h.star_rating} stars | guest rating ${h.guest_rating} | $${h.price_per_night}/night | ${h.amenities.join(", ") || "live rate"}`;
}

async function llm(
  messages: ChatMsg[],
  opts: { maxTokens: number; temperature: number }
): Promise<{ content: string; reasoning: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${process.env.SPUR_BASE_URL || "https://ai.spuric.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SPUR_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.SPUR_MODEL || "spur-glm-5-3",
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        // The model is a reasoning model; "low" keeps its thinking brief
        // (~10x faster responses) instead of burning the token budget.
        reasoning_effort: "low",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("Spur API error", res.status, errText);
      throw new Error(`LLM error ${res.status}`);
    }
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    // The model is a reasoning model: it may spend tokens on `reasoning` before
    // producing `content`, and can occasionally exhaust the budget in reasoning.
    return {
      content: String(msg?.content ?? "").trim(),
      reasoning: String(msg?.reasoning ?? "").trim(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

type SearchIntent = {
  search: boolean;
  cityName: string;
  countryCode: string;
  checkin: string;
  checkout: string;
  adults: number;
};

function parseIntent(raw: string): SearchIntent {
  const fallback: SearchIntent = {
    search: false,
    cityName: "",
    countryCode: "",
    checkin: isoInDays(30),
    checkout: isoInDays(32),
    adults: 2,
  };

  const cleaned = raw.replace(/```json|```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last <= first) return fallback;

  // The JSON may be embedded in reasoning prose — try the whole span, then
  // the last balanced-looking block (the final answer), then the first block.
  const candidates = [
    cleaned,
    cleaned.slice(cleaned.lastIndexOf("{"), last + 1),
    cleaned.slice(first, cleaned.indexOf("}", first) + 1),
  ];
  let parsed: Partial<SearchIntent> | null = null;
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as Partial<SearchIntent>;
      if (typeof obj === "object" && obj !== null && obj.search && obj.cityName) {
        parsed = obj;
        break;
      }
    } catch {
      // try next candidate
    }
  }
  if (!parsed) return fallback;

  const checkin = /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.checkin)) ? String(parsed.checkin) : fallback.checkin;
  let checkout = /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.checkout)) ? String(parsed.checkout) : fallback.checkout;
  if (Date.parse(checkout) <= Date.parse(checkin)) checkout = fallback.checkout;
  return {
    search: true,
    cityName: String(parsed.cityName).slice(0, 80),
    countryCode: String(parsed.countryCode ?? "").toUpperCase().slice(0, 2),
    checkin,
    checkout,
    adults: Math.min(Math.max(Number(parsed.adults) || 2, 1), 8),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = String(body.message ?? "").trim().slice(0, 2000);
    const sessionId = String(body.sessionId ?? "").slice(0, 64) || "anon";
    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const session = await getCurrentUser();

    const history = await query(
      `SELECT role, content FROM chat_messages
       WHERE session_id = $1 ORDER BY created_at DESC LIMIT 12`,
      [sessionId]
    ).catch(() => [] as { role: string; content: string }[]);

    const pastMsgs: ChatMsg[] = history
      .slice()
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    // Step 1: extract a live-search intent from the conversation.
    // The model reasons before answering, so give it a real token budget.
    const intentOut = await llm(
      [
        {
          role: "system",
          content: `You extract hotel search parameters from a conversation between a traveler and a hotel concierge.
Today's date is ${new Date().toISOString().slice(0, 10)}.
Return ONLY a JSON object, no prose:
{"search": <true only if the traveler has now stated a destination (city, area, or landmark) — even if dates/budget are still unknown>, "cityName": <normalized city or area name, e.g. "New York"; empty string if none>, "countryCode": <ISO 2-letter country code if inferable, else "">, "checkin": <YYYY-MM-DD or "">, "checkout": <YYYY-MM-DD or "">, "adults": <number of adult guests, 0 if unknown>}
Rules: keep dates and guest counts the traveler gave earlier in the conversation. Use an empty string for anything unknown. Compute concrete dates for relative phrases like "next weekend" or "in December".`,
        },
        {
          role: "user",
          content: `Conversation so far:\n${pastMsgs
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n")}\n\nNew message: ${message}`,
        },
      ],
      { maxTokens: 1600, temperature: 0 }
    ).catch((err): { content: string; reasoning: string } => {
      console.error("intent extraction failed", err);
      return { content: "", reasoning: "" };
    });

    const intent = parseIntent(intentOut.content || intentOut.reasoning);

    // Step 2: live search when we have a destination; fall back to the seeded catalog on failure.
    let liveHotels: LiveHotelRow[] = [];
    let liveError = false;
    if (intent.search) {
      try {
        liveHotels = await searchLiveHotels({
          cityName: intent.cityName,
          countryCode: intent.countryCode,
          checkin: intent.checkin,
          checkout: intent.checkout,
          adults: intent.adults,
          limit: 12,
        });
      } catch (err) {
        console.error("live search failed", err);
        liveError = true;
      }
    }

    let catalogRows: {
      id: number;
      name: string;
      city: string;
      country: string;
      star_rating: number;
      guest_rating: number;
      price_per_night: number;
      amenities: string[];
    }[] = liveHotels;

    if (liveError && intent.search) {
      catalogRows = await query(
        `SELECT id, name, city, country, star_rating, guest_rating, price_per_night, amenities
         FROM hotels ORDER BY featured DESC, guest_rating DESC LIMIT 80`
      );
    }

    const catalog = catalogRows.map(catalogLine).join("\n");

    await query(
      "INSERT INTO chat_messages (session_id, user_id, role, content) VALUES ($1, $2, 'user', $3)",
      [sessionId, session?.id ?? null, message]
    ).catch((err) => console.error("chat history insert failed", err));

    // Step 3: concierge reply over the (live) catalog.
    const messages: ChatMsg[] = [
      {
        role: "system",
        content:
          `${SYSTEM_PROMPT}\n\nHOTEL CATALOG${liveHotels.length ? " (live rates from a real-time inventory search)" : ""}:\n${catalog || "(no hotels — ask the traveler for a destination)"}` +
          (intent.search && liveHotels.length
            ? `\n\nSearched dates: check-in ${intent.checkin}, check-out ${intent.checkout}, ${intent.adults} adult(s).`
            : ""),
      },
      ...pastMsgs,
      { role: "user", content: message },
    ];

    const replyOut = await llm(messages, { maxTokens: 900, temperature: 0.6 });
    let reply = replyOut.content;
    if (!reply) {
      // The reasoning model can exhaust the token budget in reasoning; retry
      // once with a larger budget before giving up (mirrors the intent path).
      const retryOut = await llm(messages, { maxTokens: 2000, temperature: 0.6 }).catch(
        (err): { content: string; reasoning: string } => {
          console.error("reply retry failed", err);
          return { content: "", reasoning: "" };
        }
      );
      reply = retryOut.content || retryOut.reasoning;
    }
    if (!reply) {
      throw new Error("Empty reply from model");
    }

    // Extract RECOMMENDS line, strip it from the visible reply
    const match = reply.match(/RECOMMENDS:\s*([^\n]+)\s*$/i);
    let hotelIds: number[] = [];
    if (match) {
      reply = reply.slice(0, match.index).trim();
      hotelIds = match[1]
        .split(",")
        .map((s) => Number(s.trim().replace(/^#/, "")))
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 3);
    }

    let recommended: unknown[] = [];
    if (hotelIds.length) {
      recommended = await query(
        `SELECT id, name, city, country, star_rating, guest_rating, price_per_night,
           image_url, amenities, provider_hotel_id AS reference, phone
         FROM hotels WHERE id = ANY($1)`,
        [hotelIds]
      );

      // Enrich recommended live hotels with contact details (cached in the DB
      // after the first fetch, so this only costs ~200ms on first mention).
      await Promise.all(
        recommended.map(async (h) => {
          const hotel = h as {
            id: number;
            reference: string | null;
            phone: string | null;
            email?: string | null;
          };
          if (!hotel.reference || (hotel.phone && hotel.email)) return;
          const contact = await getHotelContact(hotel.reference).catch(
            () => ({}) as { phone?: string; email?: string }
          );
          if (contact?.phone || contact?.email) {
            if (contact.phone) hotel.phone = contact.phone;
            if (contact.email) hotel.email = contact.email;
            await query(
              "UPDATE hotels SET phone = COALESCE($1, phone), email = COALESCE($2, email) WHERE id = $3",
              [contact.phone ?? null, contact.email ?? null, hotel.id]
            ).catch(() => {});
          }
        })
      );
    }

    await query(
      "INSERT INTO chat_messages (session_id, user_id, role, content) VALUES ($1, $2, 'assistant', $3)",
      [sessionId, session?.id ?? null, reply]
    ).catch((err) => console.error("chat history insert failed", err));

    return NextResponse.json({ reply, hotels: recommended });
  } catch (err) {
    console.error("chat error", err);
    return NextResponse.json(
      {
        error:
          "The concierge is unavailable right now. Please try again in a moment — or browse hotels directly.",
      },
      { status: 500 }
    );
  }
}
