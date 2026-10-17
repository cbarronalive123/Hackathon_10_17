// Debug: replicate the intent-extraction LLM call used by /api/chat
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const envText = fs.readFileSync(__dirname + "/.env.local", "utf8");
const env = Object.fromEntries(
  envText.split("\n").filter((l) => l.includes("=")).map((l) => [l.split("=")[0], l.split("=").slice(1).join("=").trim()])
);
const base = env.SPUR_BASE_URL || "https://ai.spuric.com/v1";
const key = env.SPUR_API_KEY;

const messages = [
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
    content: `Conversation so far:\n\nNew message: Find me a hotel in Paris for 2 adults next weekend under $300 a night`,
  },
];

(async () => {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "spur-glm-5-3", messages, temperature: 0, max_tokens: 200 }),
  });
  console.log("status:", res.status);
  const text = await res.text();
  console.log("body:", text.slice(0, 1200));
})();
