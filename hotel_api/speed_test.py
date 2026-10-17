"""Measure liteAPI response times + verify rate limiting for the hackathon demo.

Times each endpoint type (min/avg/max over N runs) and runs a burst test
to observe the sandbox rate limit (HTTP 429).
"""

import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEARCH_BASE = "https://api.liteapi.travel/v3.0"
BOOK_BASE = "https://book.liteapi.travel/v3.0"


def load_key() -> str:
    key = os.environ.get("LITEAPI_KEY", "").strip()
    if not key:
        for line in (HERE / ".env").read_text(encoding="utf-8").splitlines():
            if line.startswith("LITEAPI_KEY="):
                key = line.split("=", 1)[1].strip()
    return key


def timed(method: str, url: str, key: str, body: dict | None = None):
    """Return (status, payload, elapsed_seconds)."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-API-Key", key)
    if data:
        req.add_header("Content-Type", "application/json")
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            raw = resp.read()
            elapsed = time.perf_counter() - t0
            payload = json.loads(raw.decode()) if raw.strip() else {}
            return resp.status, payload, elapsed
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - t0
        try:
            return e.code, json.loads(e.read().decode()), elapsed
        except Exception:
            return e.code, {}, elapsed


def bench(label: str, runs: int, fn, sleep=0.4):
    times, ok = [], 0
    extra = ""
    for i in range(runs):
        status, payload, elapsed = fn()
        if status == 200:
            ok += 1
            times.append(elapsed)
        if i == 0:
            extra = payload if isinstance(payload, str) else ""
        time.sleep(sleep)
    if times:
        print(f"{label:<44} ok={ok}/{runs}  min={min(times)*1000:7.0f}ms  "
              f"avg={statistics.mean(times)*1000:7.0f}ms  max={max(times)*1000:7.0f}ms  {extra}")
    else:
        print(f"{label:<44} FAILED (no 200s)")
    return times


def main() -> int:
    key = load_key()
    checkin = (date.today() + timedelta(days=30)).isoformat()
    checkout = (date.today() + timedelta(days=32)).isoformat()
    occ = [{"rooms": 1, "adults": 2}]

    print("=== RESPONSE SPEED (sandbox) ===")
    bench("GET /data/countries (static)", 5,
          lambda: timed("GET", f"{SEARCH_BASE}/data/countries", key))

    bench("GET /data/hotels?cityName=New York limit=5", 5,
          lambda: timed("GET", f"{SEARCH_BASE}/data/hotels?countryCode=US&cityName=New%20York&limit=5", key))

    def rates(limit):
        body = {"countryCode": "US", "cityName": "New York", "checkin": checkin,
                "checkout": checkout, "currency": "USD", "guestNationality": "US",
                "occupancies": occ, "limit": limit, "maxRatesPerHotel": 1, "timeout": 12}
        def f():
            s, p, e = timed("POST", f"{SEARCH_BASE}/hotels/rates", key, body)
            return s, p, e
        return f

    bench("POST /hotels/rates New York limit=10", 5, rates(10))
    bench("POST /hotels/rates New York limit=50", 3, rates(50))

    def ai_search():
        body = {"aiSearch": "boutique hotel near Central Park New York",
                "checkin": checkin, "checkout": checkout, "currency": "USD",
                "guestNationality": "US", "occupancies": occ, "limit": 10, "timeout": 12}
        return timed("POST", f"{SEARCH_BASE}/hotels/rates", key, body)
    bench("POST /hotels/rates aiSearch (semantic)", 3, ai_search)

    # Prebook timing: search -> offerId -> prebook
    def prebook():
        s, p, e = rates(5)()
        if s != 200 or not p.get("data"):
            return 0, {"error": "search failed"}, 0
        offer_id = p["data"][0]["roomTypes"][0]["offerId"]
        return timed("POST", f"{BOOK_BASE}/rates/prebook", key,
                     {"offerId": offer_id, "usePaymentSdk": False})
    bench("POST /rates/prebook (full checkout session)", 3, prebook)

    print("\n=== RATE LIMIT BURST TEST (10 rapid requests) ===")
    results = []
    for i in range(10):
        s, p, e = timed("GET", f"{SEARCH_BASE}/data/countries", key)
        results.append(s)
    from collections import Counter
    print(f"statuses: {dict(Counter(results))}")
    if 429 in results:
        print("-> sandbox rate limit (5 req/s) confirmed: 429 Too Many Requests returned")
    else:
        print("-> no 429 in a 10-request burst")

    print("\n=== KEY SANDBOX CONSTRAINTS (documented) ===")
    print("- sandbox rate limit: 5 requests/second (production: 500 req/s)")
    print("- sandbox key does not create real reservations (book step is simulated)")
    print("- production requires credit card on file + funded wallet for live bookings")
    print("- core endpoints Rates/Prebook/Book are free in production (look-to-book ratio applies)")
    print("- price index endpoints $0.05/req, places endpoints $0.01/req in production")
    return 0


if __name__ == "__main__":
    sys.exit(main())
