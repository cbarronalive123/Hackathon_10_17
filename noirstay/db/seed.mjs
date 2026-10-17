// Seed the NoirStay database. Run: node db/seed.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");

// Load DATABASE_URL from ../.env.local
let url = process.env.DATABASE_URL;
if (!url) {
  const envText = readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").replace(/^\uFEFF/, "");
  url = envText.split("\n").find((l) => l.startsWith("DATABASE_URL="))?.slice("DATABASE_URL=".length).trim();
}
if (!url) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;

const hotels = [
  ["The Grand Meridian New York", "New York", "United States", "455 Madison Avenue, Manhattan", "A landmark Art-Deco tower steps from Bryant Park, with a rooftop infinity pool overlooking the skyline.", 5, 9.4, 2810, 420, img("photo-1566073771259-6a8506099945"), ["Rooftop pool", "Spa", "Gym", "Fine dining", "Concierge"], "Meridian Group", true],
  ["Midtown Loft Hotel", "New York", "United States", "120 W 36th Street, Manhattan", "Industrial-chic lofts with exposed brick near the Empire State Building.", 4, 8.6, 1204, 260, img("photo-1611892440504-42a792e24d32"), ["Gym", "Breakfast", "Bar", "Wifi"], "StayBridge Co", false],
  ["Hôtel Lumière Paris", "Paris", "France", "18 Rue de la Paix, 2nd Arr.", "Haussmann-era elegance with a glass atrium breakfast room near the Opera.", 5, 9.5, 1934, 480, img("photo-1582719508461-905c673771fd"), ["Spa", "Michelin restaurant", "Bar", "Concierge"], "Lumière Collection", true],
  ["Le Petit Marais", "Paris", "France", "7 Rue des Rosiers, 3rd Arr.", "A intimate boutique stay in the heart of the Marais district.", 3, 8.2, 640, 190, img("photo-1520250497591-112f2f40a3f4"), ["Breakfast", "Wifi"], "Parisian Stays", false],
  ["The Kensington Row Hotel", "London", "United Kingdom", "22 Kensington Gore, Kensington", "Victorian grandeur beside Hyde Park with a private garden square.", 5, 9.2, 2101, 395, img("photo-1551882547-ff40c63fe5fa"), ["Afternoon tea", "Spa", "Gym", "Concierge"], "Royal Row Hotels", false],
  ["Shoreditch House Hotel", "London", "United Kingdom", "45 Rivington Street, Shoreditch", "Creative-quarter rooms with vinyl libraries and a neon basement bar.", 4, 8.5, 987, 240, img("photo-1590490360182-c33d57733427"), ["Bar", "Gym", "Coworking", "Wifi"], "East End Hospitality", false],
  ["Shibuya Sky Tower Hotel", "Tokyo", "Japan", "2-11-3 Shibuya, Shibuya City", "Sleek high-rise rooms above the famous scramble crossing.", 4, 8.8, 1732, 210, img("photo-1611892440504-42a792e24d32"), ["Onsen bath", "Rooftop bar", "Gym"], "Nippon Stay Group", false],
  ["Ginza Central Hotel", "Tokyo", "Japan", "4-2-1 Ginza, Chuo City", "Minimalist luxury with kaiseki dining in the Ginza shopping district.", 5, 9.3, 1544, 350, img("photo-1549294413-26f195200c16"), ["Kaiseki restaurant", "Spa", "Concierge"], "Nippon Stay Group", true],
  ["Palm Jumeirah Oasis Resort", "Dubai", "United Arab Emirates", "Crescent Road, Palm Jumeirah", "Overwater villas with private beach access and a sprawling lagoon pool.", 5, 9.6, 3205, 520, img("photo-1578683010236-d716f9a3f461"), ["Private beach", "Water sports", "Spa", "Kids club"], "Gulf Resorts", true],
  ["Desert Rose Downtown Hotel", "Dubai", "United Arab Emirates", "Sheikh Zayed Road, Al Satwa", "Modern business hotel with skyline views and an evening roof lounge.", 4, 8.4, 1120, 280, img("photo-1590490360182-c33d57733427"), ["Rooftop bar", "Gym", "Airport shuttle"], "Gulf Resorts", false],
  ["Villa Aurelia Roma", "Rome", "Italy", "Via Aurelia 88, Trionfale", "A converted 19th-century villa with cypress gardens near the Vatican.", 4, 9.0, 866, 270, img("photo-1445019980597-93fa8acb246c"), ["Garden", "Breakfast", "Restaurant"], "Villas of Italy", false],
  ["Trastevere Boutique Hotel", "Rome", "Italy", "12 Via della Lungaretta, Trastevere", "Ivy-covered townhouse rooms on a cobblestone street.", 3, 8.3, 428, 165, img("photo-1520250497591-112f2f40a3f4"), ["Breakfast", "Wifi"], "Villas of Italy", false],
  ["Barceloneta Beach Resort", "Barcelona", "Spain", "Passeig Marítim de la Barceloneta 22", "Beachfront rooms with sea-view terraces and a beach club.", 4, 8.9, 1489, 230, img("photo-1582719508461-905c673771fd"), ["Beach access", "Pool", "Beach club", "Gym"], "Ibérica Hotels", true],
  ["Gothic Quarter Hotel", "Barcelona", "Spain", "5 Carrer dels Escudellers, Ciutat Vella", "Medieval walls meet modern design in the old city.", 3, 8.1, 512, 150, img("photo-1618773928121-c32242e63f39"), ["Rooftop", "Breakfast"], "Ibérica Hotels", false],
  ["Marina Bay Crown Hotel", "Singapore", "Singapore", "10 Bayfront Avenue", "Sky-lobby luxury with an infinity pool above the bay.", 5, 9.4, 2640, 400, img("photo-1566073771259-6a8506099945"), ["Infinity pool", "Spa", "Fine dining", "Concierge"], "Crown Asia Pacific", true],
  ["Orchard Road Grand", "Singapore", "Singapore", "88 Orchard Road", "Shopping-district stay with a famous high-tea lounge.", 4, 8.7, 1320, 250, img("photo-1551882547-ff40c63fe5fa"), ["High tea", "Pool", "Gym"], "Crown Asia Pacific", false],
  ["Canal House Amsterdam", "Amsterdam", "Netherlands", "Keizersgracht 124, Centrum", "17th-century merchant house on the Keizersgracht canal.", 4, 9.1, 934, 245, img("photo-1445019980597-93fa8acb246c"), ["Canal terrace", "Bicycles", "Breakfast"], "Dutch Masters Stays", false],
  ["Museum Square Hotel", "Amsterdam", "Netherlands", "20 Museumstraat, Museumkwartier", "Gallery-lined quiet stay beside the Rijksmuseum.", 3, 8.2, 461, 175, img("photo-1611892440504-42a792e24d32"), ["Breakfast", "Wifi"], "Dutch Masters Stays", false],
  ["CN Tower View Hotel", "Toronto", "Canada", "290 Front Street West", "Floor-to-ceiling skyline views beside the CN Tower.", 4, 8.6, 1055, 220, img("photo-1590490360182-c33d57733427"), ["Gym", "Pool", "Restaurant"], "Maple Key Hotels", false],
  ["Distillery District Lofts", "Toronto", "Canada", "15 Trinity Street, Old Town", "Converted Victorian distillery lofts with exposed timber.", 3, 8.4, 389, 160, img("photo-1520250497591-112f2f40a3f4"), ["Wifi", "Breakfast"], "Maple Key Hotels", false],
  ["The Neon Palace", "Las Vegas", "United States", "3600 Las Vegas Boulevard South", "A maximalist resort with seven pools and a resident cirque show.", 5, 8.9, 5230, 290, img("photo-1578683010236-d716f9a3f461"), ["Casino", "Seven pools", "Shows", "Spa"], "Neon Resorts Intl", true],
  ["Fremont Street Hotel", "Las Vegas", "United States", "200 Freemont Street, Downtown", "Retro rooms under the Fremont Street Experience canopy.", 3, 7.8, 720, 130, img("photo-1549294413-26f195200c16"), ["Casino", "Pool", "Bar"], "Neon Resorts Intl", false],
  ["South Beach Art Deco Hotel", "Miami", "United States", "1420 Ocean Drive, South Beach", "Pastel Art-Deco charm directly on South Beach.", 4, 8.8, 1690, 310, img("photo-1582719508461-905c673771fd"), ["Beach access", "Beach club", "Poolside bar"], "Azure Coast Hotels", true],
  ["Brickell Skyline Hotel", "Miami", "United States", "1100 Brickell Bay Drive", "Glass-tower business hotel in the financial district.", 4, 8.5, 1002, 240, img("photo-1611892440504-42a792e24d32"), ["Gym", "Rooftop pool", "Business center"], "Azure Coast Hotels", false],
];

const users = [
  ["Ava Reynolds", "admin@noirstay.com", "Admin123!", "+1 555 0100", "admin"],
  ["Jordan Miles", "guest@noirstay.com", "Guest123!", "+1 555 0111", "customer"],
  ["Sofia Laurent", "sofia@example.com", "Customer123!", "+33 6 555 0122", "customer"],
  ["Liam O'Connor", "liam@example.com", "Customer123!", "+353 85 555 0133", "customer"],
  ["Emma Chen", "emma@example.com", "Customer123!", "+65 8555 0144", "customer"],
];

function iso(d) {
  return d.toISOString().slice(0, 10);
}
const today = new Date();
const day = (n) => iso(new Date(today.getTime() + n * 86400000));

// userIndex, hotelIndex, checkIn offset, nights, guests, rooms, status
const bookings = [
  [1, 0, day(14), 3, 2, 1, "confirmed"],
  [1, 4, day(-40), 2, 2, 1, "completed"],
  [1, 12, day(-75), 5, 1, 1, "completed"],
  [2, 2, day(7), 4, 2, 1, "confirmed"],
  [2, 8, day(-20), 3, 1, 1, "cancelled"],
  [2, 20, day(60), 4, 4, 2, "pending"],
  [3, 3, day(10), 3, 2, 1, "confirmed"],
  [4, 14, day(21), 6, 2, 1, "confirmed"],
  [4, 0, day(-90), 2, 1, 1, "completed"],
  [4, 6, day(3), 2, 2, 1, "confirmed"],
  [4, 16, day(-10), 7, 1, 1, "completed"],
];

const roomTypes = ["Standard King", "Deluxe Queen", "Executive Suite", "Junior Suite"];

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query("BEGIN");
  await client.query("TRUNCATE chat_messages, bookings, hotels, users RESTART IDENTITY CASCADE");

  const userIds = [];
  for (const [name, email, password, phone, role] of users) {
    const hash = await bcrypt.hash(password, 10);
    const res = await client.query(
      "INSERT INTO users (name, email, password_hash, phone, role) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [name, email, hash, phone, role]
    );
    userIds.push(res.rows[0].id);
  }

  const hotelIds = [];
  for (const h of hotels) {
    const res = await client.query(
      `INSERT INTO hotels (name, city, country, address, description, star_rating, guest_rating,
        reviews_count, price_per_night, image_url, amenities, provider, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      h
    );
    hotelIds.push(res.rows[0].id);
  }

  for (let i = 0; i < bookings.length; i++) {
    const [uIdx, hIdx, checkIn, nights, guests, rooms, status] = bookings[i];
    const priceRes = await client.query("SELECT price_per_night FROM hotels WHERE id = $1", [hotelIds[hIdx]]);
    const price = parseFloat(priceRes.rows[0].price_per_night);
    const checkOut = iso(new Date(new Date(checkIn).getTime() + nights * 86400000));
    await client.query(
      `INSERT INTO bookings (user_id, hotel_id, room_type, check_in, check_out, guests, rooms, nights, total_price, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [userIds[uIdx], hotelIds[hIdx], roomTypes[i % roomTypes.length], checkIn, checkOut, guests, rooms, nights, (price * nights * rooms).toFixed(2), status]
    );
  }

  await client.query("COMMIT");
  console.log(`Seeded: ${users.length} users, ${hotels.length} hotels, ${bookings.length} bookings.`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Seed failed:", err);
  process.exit(1);
} finally {
  await client.end();
}
