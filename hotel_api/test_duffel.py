"""Test the Duffel Stays hotel booking API (free test mode).

Docs: https://duffel.com/docs/guides/getting-started-with-stays
Auth: Bearer test access token from the Duffel dashboard (Developers -> Access tokens).
Test hotels: search coordinates -24.38, -128.32 always return results in test mode.

Usage:
    set DUFFEL_TOKEN=test_xxxxx   (or put DUFFEL_TOKEN=... in hotel_api/.env)
    python test_duffel.py

Writes raw JSON responses to tests/responses/ and prints a summary.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

BASE = "https://api.duffel.com"
HERE = Path(__file__).resolve().parent
RESP_DIR = HERE / "tests" / "responses"
RESP_DIR.mkdir(parents=True, exist_ok=True)


def load_token() -> str:
    token = os.environ.get("DUFFEL_TOKEN", "").strip()
    if not token:
        env_file = HERE / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("DUFFEL_TOKEN="):
                    token = line.split("=", 1)[1].strip()
    if not token:
        print("ERROR: no DUFFEL_TOKEN set (env var or hotel_api/.env)")
        sys.exit(1)
    return token


def call(method: str, path: str, token: str, body: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Duffel-Version", "v2")
    req.add_header("Accept", "application/json")
    data = None
    if body is not None:
        data = json.dumps({"data": body}).encode()
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept-Encoding", "gzip")
    import gzip
    try:
        with urllib.request.urlopen(req, data, timeout=60) as resp:
            raw = resp.read()
            if resp.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
            return resp.status, json.loads(raw.decode())
    except urllib.error.HTTPError as e:
        raw = e.read()
        if e.headers.get("Content-Encoding") == "gzip":
            import gzip as _gz
            try:
                raw = _gz.decompress(raw)
            except Exception:
                pass
        try:
            return e.code, json.loads(raw.decode())
        except Exception:
            return e.code, {"raw": raw[:500].decode(errors="replace")}


def save(name: str, payload) -> None:
    (RESP_DIR / f"{name}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> int:
    token = load_token()
    checkin = (date.today() + timedelta(days=30)).isoformat()
    checkout = (date.today() + timedelta(days=32)).isoformat()
    failures = 0

    # 1. Search for accommodation at the guaranteed test-hotel coordinates
    search_body = {
        "rooms": 1,
        "guests": [{"type": "adult"}, {"type": "adult"}],
        "check_in_date": checkin,
        "check_out_date": checkout,
        "location": {
            "radius": 2,
            "geographic_coordinates": {"latitude": -24.38, "longitude": -128.32},
        },
    }
    status, payload = call("POST", "/stays/search", token, search_body)
    results = payload.get("data", {}).get("results", [])
    print(f"[1] POST /stays/search (test hotels) -> HTTP {status}, {len(results)} results")
    for r in results[:3]:
        acc = r.get("accommodation", {})
        print(f"    {acc.get('name')!r} ({acc.get('id')}) - cheapest: "
              f"{r.get('cheapest_rate_total_amount')} {r.get('cheapest_rate_currency')} "
              f"(search_result {r.get('id')})")
    save("01_duffel_search", payload)
    if status != 200 or not results:
        failures += 1

    # 2. Fetch all room rates for the first search result
    srr_id = results[0]["id"] if results else ""
    if srr_id:
        status, payload = call(
            "POST", f"/stays/search_results/{srr_id}/actions/fetch_all_rates", token, {}
        )
        acc = payload.get("data", {}).get("accommodation", {})
        rooms = acc.get("rooms", [])
        n_rates = sum(len(rm.get("rates", [])) for rm in rooms)
        print(f"[2] POST /stays/search_results/{{id}}/actions/fetch_all_rates -> HTTP {status}, "
              f"{len(rooms)} rooms, {n_rates} rates")
        for rm in rooms[:3]:
            for rt in rm.get("rates", [])[:1]:
                print(f"    {rm.get('name')!r}: {rt.get('name')!r} -> {rt.get('total_amount')} "
                      f"{rt.get('total_currency')} ({rt.get('payment_type')}, board={rt.get('board_type')})")
        save("02_duffel_rates", payload)
        if status != 200 or not rooms:
            failures += 1
    else:
        print("[2] skipped - no search result")

    print("\nRESULT:", "SUCCESS - API returns live results" if failures == 0
          else f"FAILED ({failures} endpoint groups)")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
