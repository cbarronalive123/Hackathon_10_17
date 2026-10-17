"""Coverage check: does liteAPI return hotels+rates worldwide?

Runs a rates search across cities on every inhabited continent, plus
checks the /data/countries and /data/cities static endpoints.
Respects the 5 req/s sandbox rate limit.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

BASE = "https://api.liteapi.travel/v3.0"
HERE = Path(__file__).resolve().parent


def load_key() -> str:
    key = os.environ.get("LITEAPI_KEY", "").strip()
    if not key:
        for line in (HERE / ".env").read_text(encoding="utf-8").splitlines():
            if line.startswith("LITEAPI_KEY="):
                key = line.split("=", 1)[1].strip()
    return key


def call(method: str, path: str, key: str, body: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("X-API-Key", key)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


CITIES = [
    ("US", "New York"), ("FR", "Paris"), ("JP", "Tokyo"), ("GB", "London"),
    ("AE", "Dubai"), ("BR", "Sao Paulo"), ("MX", "Mexico City"), ("ZA", "Cape Town"),
    ("NG", "Lagos"), ("EG", "Cairo"), ("IN", "Mumbai"), ("CN", "Shanghai"),
    ("AU", "Sydney"), ("SG", "Singapore"), ("TH", "Chiang Mai"), ("ID", "Bali"),
    ("KE", "Nairobi"), ("AR", "Buenos Aires"), ("CA", "Toronto"), ("TR", "Istanbul"),
]


def main() -> int:
    key = load_key()
    checkin = (date.today() + timedelta(days=30)).isoformat()
    checkout = (date.today() + timedelta(days=32)).isoformat()

    status, payload = call("GET", "/data/countries", key)
    countries = payload.get("data", payload) or []
    print(f"countries endpoint: HTTP {status}, {len(countries)} countries")

    for cc in ("US", "FR", "JP", "BR", "AU", "ZA", "AE"):
        s, p = call("GET", f"/data/cities?countryCode={cc}", key)
        cities = p.get("data", p) or []
        print(f"cities in {cc}: {len(cities)}", end="  ")
        time.sleep(0.25)
    print()

    print(f"\n{'City':<18} {'hotels':>6} {'rates':>6} {'sample price':>14}  name")
    hits = 0
    for cc, city in CITIES:
        body = {
            "countryCode": cc, "cityName": city,
            "checkin": checkin, "checkout": checkout,
            "currency": "USD", "guestNationality": "US",
            "occupancies": [{"rooms": 1, "adults": 2}],
            "limit": 20, "maxRatesPerHotel": 1, "timeout": 12,
        }
        s, p = call("POST", "/hotels/rates", key, body)
        data = p.get("data", []) if isinstance(p, dict) else []
        hotels = p.get("hotels", []) if isinstance(p, dict) else []
        by_id = {h.get("id"): h for h in hotels}
        price = name = ""
        if data:
            r0 = data[0]["roomTypes"][0]["rates"][0]
            t = r0.get("retailRate", {}).get("total", [{}])[0]
            price = f"{t.get('amount')} {t.get('currency')}"
            h0 = by_id.get(data[0]["hotelId"], {})
            name = (h0.get("name") or "")[:40]
            hits += 1
        print(f"{city:<18} {len(hotels):>6} {len(data):>6} {price:>14}  {name}")
        time.sleep(0.3)

    print(f"\n{hits}/{len(CITIES)} cities returned live rates")
    return 0 if hits == len(CITIES) else 1


if __name__ == "__main__":
    sys.exit(main())
