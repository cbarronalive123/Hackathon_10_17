"""Test the Nuitee Connect (liteAPI) hotel booking API.

Free sandbox API: https://docs.liteapi.travel/  (signup at https://www.liteapi.travel/)
Auth: X-API-Key header with a sandbox key.

Usage:
    set LITEAPI_KEY=sand_xxxxx   (or put LITEAPI_KEY=sand_xxxxx in hotel_api/.env)
    python test_liteapi.py

Writes raw JSON responses to tests/responses/ and prints a summary.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

BASE = "https://api.liteapi.travel/v3.0"
HERE = Path(__file__).resolve().parent
RESP_DIR = HERE / "tests" / "responses"
RESP_DIR.mkdir(parents=True, exist_ok=True)


def load_key() -> str:
    key = os.environ.get("LITEAPI_KEY", "").strip()
    if not key:
        env_file = HERE / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("LITEAPI_KEY="):
                    key = line.split("=", 1)[1].strip()
    if not key:
        print("ERROR: no LITEAPI_KEY set (env var or hotel_api/.env)")
        sys.exit(1)
    return key


def call(method: str, path: str, key: str, body: dict | None = None) -> tuple[int, dict | list]:
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-API-Key", key)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode())
            return resp.status, payload
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode())
        except Exception:
            payload = {"raw": str(e)}
        return e.code, payload


def save(name: str, payload) -> None:
    (RESP_DIR / f"{name}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> int:
    key = load_key()
    checkin = (date.today() + timedelta(days=60)).isoformat()
    checkout = (date.today() + timedelta(days=62)).isoformat()
    failures = 0

    # 1. Static data sanity check: countries
    status, payload = call("GET", "/data/countries", key)
    n = len(payload.get("data", payload)) if isinstance(payload, dict) else len(payload)
    print(f"[1] GET /data/countries        -> HTTP {status}, {n} countries")
    save("01_countries", payload)
    if status != 200:
        failures += 1

    # 2. Hotel list for a city
    status, payload = call("GET", "/data/hotels?countryCode=US&cityName=New%20York&limit=5", key)
    hotels = payload.get("data", payload) if isinstance(payload, dict) else payload
    n = len(hotels) if isinstance(hotels, list) else -1
    print(f"[2] GET /data/hotels?New York   -> HTTP {status}, {n} hotels")
    if n:
        h = hotels[0] if isinstance(hotels, list) else {}
        print(f"    first: id={h.get('id')} name={h.get('name')!r} stars={h.get('stars')}")
    save("02_hotels_nyc", payload)
    if status != 200 or not n:
        failures += 1

    # 3. Main search: live rates and availability
    body = {
        "countryCode": "US",
        "cityName": "New York",
        "checkin": checkin,
        "checkout": checkout,
        "currency": "USD",
        "guestNationality": "US",
        "occupancies": [{"rooms": 1, "adults": 2}],
        "limit": 10,
        "maxRatesPerHotel": 1,
        "timeout": 12,
        "roomMapping": True,
    }
    status, payload = call("POST", "/hotels/rates", key, body)
    data = payload.get("data", []) if isinstance(payload, dict) else []
    hotel_meta = payload.get("hotels", []) if isinstance(payload, dict) else []
    print(f"[3] POST /hotels/rates          -> HTTP {status}, {len(data)} hotels with rates, "
          f"{len(hotel_meta)} hotel records, sandbox={payload.get('sandbox') if isinstance(payload, dict) else '?'}")
    for h in data[:3]:
        for rt in h.get("roomTypes", [])[:1]:
            for r in rt.get("rates", [])[:1]:
                total = r.get("retailRate", {}).get("total", [{}])[0]
                print(f"    {h.get('hotelId')}: {r.get('name')!r} -> {total.get('amount')} {total.get('currency')}")
    save("03_rates_nyc", payload)
    if status != 200 or not data:
        failures += 1

    print("\nRESULT:", "SUCCESS - API returns live results" if failures == 0 else f"FAILED ({failures}/3 endpoints)")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
