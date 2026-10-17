"""Time liteAPI results via two paths: direct REST vs the MCP server.

REST: POST /hotels/rates (live hotel search)
MCP:  JSON-RPC over streamable HTTP at mcp.liteapi.travel (initialize ->
      tools/list -> tools/call hotel search)

Requests are spaced >=1s apart to respect the 5 req/s sandbox limit.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
REST_BASE = "https://api.liteapi.travel/v3.0"
MCP_BASE = "https://mcp.liteapi.travel/api/mcp"


def load_key() -> str:
    key = os.environ.get("LITEAPI_KEY", "").strip()
    if not key:
        for line in (HERE / ".env").read_text(encoding="utf-8").splitlines():
            if line.startswith("LITEAPI_KEY="):
                key = line.split("=", 1)[1].strip()
    return key


def http(method: str, url: str, headers: dict, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in headers.items():
        req.add_header(k, v)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            raw = resp.read().decode()
            elapsed = time.perf_counter() - t0
            return resp.status, dict(resp.headers), raw, elapsed
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - t0
        return e.code, dict(e.headers), e.read().decode(errors="replace"), elapsed


def parse_rpc(raw: str) -> dict | None:
    """Parse a JSON-RPC response that may be plain JSON or an SSE stream."""
    raw = raw.strip()
    if raw.startswith("{"):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None
    # SSE: find data: lines
    for line in reversed(raw.splitlines()):
        line = line.strip()
        if line.startswith("data:"):
            payload = line[5:].strip()
            try:
                return json.loads(payload)
            except json.JSONDecodeError:
                continue
    return None


def main() -> int:
    key = load_key()
    checkin = (date.today() + timedelta(days=30)).isoformat()
    checkout = (date.today() + timedelta(days=32)).isoformat()

    print("=== A. DIRECT REST API (api.liteapi.travel) ===")
    for city, cc in [("Paris", "FR"), ("Tokyo", "JP")]:
        body = {
            "countryCode": cc, "cityName": city, "checkin": checkin,
            "checkout": checkout, "currency": "USD", "guestNationality": "US",
            "occupancies": [{"rooms": 1, "adults": 2}],
            "limit": 10, "maxRatesPerHotel": 1, "timeout": 12,
        }
        status, _, raw, el = http("POST", f"{REST_BASE}/hotels/rates",
                                  {"X-API-Key": key, "Content-Type": "application/json"}, body)
        try:
            n = len(json.loads(raw).get("data", []))
        except Exception:
            n = -1
        print(f"REST /hotels/rates {city:<8} -> HTTP {status}, {n} hotels, {el*1000:7.0f}ms")
        time.sleep(1.1)

    print("\n=== B. MCP SERVER (mcp.liteapi.travel, JSON-RPC over HTTP) ===")
    url = f"{MCP_BASE}?apiKey={key}"
    base_headers = {"Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream"}

    # initialize
    status, headers, raw, el = http("POST", url, base_headers, {
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "noirstay-speed-test", "version": "1.0"},
        },
    })
    rpc = parse_rpc(raw) or {}
    print(f"MCP initialize        -> HTTP {status}, {el*1000:7.0f}ms, "
          f"server={rpc.get('result', {}).get('serverInfo', {}).get('name', '?')}")
    session = headers.get("Mcp-Session-Id") or headers.get("mcp-session-id")

    hdrs = dict(base_headers)
    if session:
        hdrs["Mcp-Session-Id"] = session
    time.sleep(0.5)

    # initialized notification (no response expected)
    http("POST", url, hdrs, {"jsonrpc": "2.0", "method": "notifications/initialized"})
    time.sleep(0.3)

    # tools/list
    status, _, raw, el = http("POST", url, hdrs, {
        "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    rpc = parse_rpc(raw) or {}
    tools = [t.get("name") for t in rpc.get("result", {}).get("tools", [])]
    tool_list = ", ".join(tools[:8]) + ("..." if len(tools) > 8 else "")
    print(f"MCP tools/list        -> HTTP {status}, {el*1000:7.0f}ms, "
          f"{len(tools)} tools: {tool_list}")
    time.sleep(0.5)

    # pick the hotel search tool
    search_names = [t for t in tools if "search" in t.lower() and "hotel" in " ".join(tools).lower()]
    tool = search_names[0] if search_names else (tools[0] if tools else "")

    # tools/call - the same rates search as the REST test, via MCP
    for city, cc in [("Paris", "FR"), ("Tokyo", "JP")]:
        args = {
            "countryCode": cc, "cityName": city,
            "checkin": checkin, "checkout": checkout,
            "currency": "USD", "guestNationality": "US",
            "occupancies": [{"rooms": 1, "adults": 2}],
            "limit": 10, "maxRatesPerHotel": 1, "timeout": 12,
        }
        status, _, raw, el = http("POST", url, hdrs, {
            "jsonrpc": "2.0", "id": 3, "method": "tools/call",
            "params": {"name": "post_hotels_rates", "arguments": args}})
        rpc = parse_rpc(raw) or {}
        content = rpc.get("result", {}).get("content", [])
        text = next((c.get("text", "") for c in content if isinstance(c, dict) and c.get("text")), "")
        is_err = rpc.get("result", {}).get("isError", False)
        try:
            parsed = json.loads(text)
            n = len(parsed.get("data", []))
        except Exception:
            n = -1
        print(f"MCP post_hotels_rates {city:<8} -> HTTP {status}, {el*1000:7.0f}ms, "
              f"error={is_err}, {n} hotels")
        time.sleep(1.1)

    return 0


if __name__ == "__main__":
    sys.exit(main())
