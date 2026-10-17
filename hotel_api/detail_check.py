"""Check what the liteAPI hotel-details endpoint returns (phone? contact?)."""

import json
import os
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
key = ""
for line in (HERE / ".env").read_text(encoding="utf-8").splitlines():
    if line.startswith("LITEAPI_KEY="):
        key = line.split("=", 1)[1].strip()

req = urllib.request.Request("https://api.liteapi.travel/v3.0/data/hotel?hotelId=lp3723e")
req.add_header("X-API-Key", key)
with urllib.request.urlopen(req, timeout=30) as resp:
    data = json.loads(resp.read().decode())

print("top-level keys:", sorted(data.keys()))
hotel = data.get("data", data)
print("hotel keys:", sorted(hotel.keys()) if isinstance(hotel, dict) else type(hotel))
if isinstance(hotel, dict):
    print(json.dumps(hotel, indent=1)[:1500])
