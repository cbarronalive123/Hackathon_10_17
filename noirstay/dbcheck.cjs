const { Pool } = require("pg");
const fs = require("fs");
const env = fs.readFileSync(__dirname + "/.env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new Pool({ connectionString: url });
(async () => {
  const live = await pool.query(
    "SELECT id, name, city, price_per_night, provider_hotel_id FROM hotels WHERE provider = 'Nuitee Connect' ORDER BY id LIMIT 5"
  );
  const count = await pool.query(
    "SELECT count(*)::int AS n FROM hotels WHERE provider = 'Nuitee Connect'"
  );
  const msgs = await pool.query(
    "SELECT role, left(content, 120) AS c FROM chat_messages WHERE session_id = 'voyager_test' ORDER BY created_at"
  );
  console.log("live hotels:", count.rows[0].n, JSON.stringify(live.rows, null, 1));
  console.log("chat msgs:", JSON.stringify(msgs.rows, null, 1));
  await pool.end();
})();
