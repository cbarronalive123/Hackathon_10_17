from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DEFAULT_PROFILE: dict[str, Any] = {
    "guest_name": "",
    "guest_email": "",
    "guest_phone": "",
    "adults": 2,
    "rooms": 1,
    "room_preference": "King or Queen room",
    "budget_note": "Up to $350 per night",
    "payment_note": "Guest will present their payment card at check-in. Do not ask for card details over the phone.",
    "special_requests": "High floor, quiet room if possible",
}

ACTIVE_STATUSES = ("queued", "ringing", "in_progress")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: Path | str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with closing(self._conn()) as conn, conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS guest_profile (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS phone_overrides (
                    hotel_id TEXT PRIMARY KEY,
                    phone TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS calls (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'queued',
                    hotel_id TEXT,
                    hotel_name TEXT,
                    city TEXT,
                    to_number TEXT,
                    from_number TEXT,
                    twilio_sid TEXT,
                    conversation_id TEXT,
                    booking_context TEXT,
                    reservation TEXT,
                    outcome TEXT,
                    transcript TEXT,
                    peer_transcript TEXT,
                    analysis TEXT,
                    summary TEXT,
                    call_successful TEXT,
                    recording_url TEXT,
                    error TEXT
                );
                CREATE TABLE IF NOT EXISTS tool_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    conversation_id TEXT,
                    tool_name TEXT NOT NULL,
                    payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS online_bookings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    hotel_id TEXT,
                    hotel_name TEXT,
                    checkin TEXT,
                    checkout TEXT,
                    guests INTEGER,
                    prebook_id TEXT,
                    booking_id TEXT,
                    status TEXT,
                    total_amount REAL,
                    currency TEXT,
                    voucher_url TEXT,
                    raw TEXT
                );
                CREATE TABLE IF NOT EXISTS phone_cache (
                    hotel_id TEXT PRIMARY KEY,
                    phone TEXT NOT NULL,
                    source TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_tool_events_conversation ON tool_events(conversation_id);
                CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
                CREATE INDEX IF NOT EXISTS idx_calls_conversation ON calls(conversation_id);
                """
            )
            for column in ("voice_twiml TEXT", "link_attempts INTEGER NOT NULL DEFAULT 0"):
                try:
                    conn.execute(f"ALTER TABLE calls ADD COLUMN {column}")
                except sqlite3.OperationalError:
                    pass

    def _row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        item = dict(row)
        for key in ("booking_context", "reservation", "outcome", "transcript", "peer_transcript", "analysis", "raw"):
            if item.get(key):
                try:
                    item[key] = json.loads(item[key])
                except (json.JSONDecodeError, TypeError):
                    pass
        return item

    def get_profile(self) -> dict[str, Any]:
        with closing(self._conn()) as conn:
            row = conn.execute("SELECT data FROM guest_profile WHERE id = 1").fetchone()
        if not row:
            return dict(DEFAULT_PROFILE)
        try:
            saved = json.loads(row["data"])
        except json.JSONDecodeError:
            return dict(DEFAULT_PROFILE)
        merged = dict(DEFAULT_PROFILE)
        merged.update({k: v for k, v in saved.items() if k in DEFAULT_PROFILE})
        return merged

    def set_profile(self, data: dict[str, Any]) -> dict[str, Any]:
        current = self.get_profile()
        current.update({k: v for k, v in data.items() if k in DEFAULT_PROFILE})
        with closing(self._conn()) as conn, conn:
            conn.execute(
                "INSERT INTO guest_profile (id, data) VALUES (1, ?) "
                "ON CONFLICT(id) DO UPDATE SET data = excluded.data",
                (json.dumps(current),),
            )
        return current

    def set_phone_override(self, hotel_id: str, phone: str) -> None:
        with closing(self._conn()) as conn, conn:
            conn.execute(
                "INSERT INTO phone_overrides (hotel_id, phone, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(hotel_id) DO UPDATE SET phone = excluded.phone, updated_at = excluded.updated_at",
                (hotel_id, phone, now_iso()),
            )

    def get_phone_override(self, hotel_id: str) -> str | None:
        with closing(self._conn()) as conn:
            row = conn.execute(
                "SELECT phone FROM phone_overrides WHERE hotel_id = ?", (hotel_id,)
            ).fetchone()
        return row["phone"] if row else None

    def create_call(
        self,
        mode: str,
        hotel_id: str | None,
        hotel_name: str | None,
        city: str | None,
        to_number: str,
        from_number: str,
        booking_context: dict[str, Any],
    ) -> int:
        ts = now_iso()
        with closing(self._conn()) as conn, conn:
            cur = conn.execute(
                "INSERT INTO calls (created_at, updated_at, mode, status, hotel_id, hotel_name, city, "
                "to_number, from_number, booking_context) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    ts,
                    ts,
                    mode,
                    "queued",
                    hotel_id,
                    hotel_name,
                    city,
                    to_number,
                    from_number,
                    json.dumps(booking_context),
                ),
            )
            return int(cur.lastrowid)

    def update_call(self, call_id: int, **fields: Any) -> None:
        if not fields:
            return
        allowed = {
            "status",
            "twilio_sid",
            "conversation_id",
            "booking_context",
            "reservation",
            "outcome",
            "transcript",
            "peer_transcript",
            "analysis",
            "summary",
            "call_successful",
            "recording_url",
            "error",
            "voice_twiml",
        }
        updates = {k: v for k, v in fields.items() if k in allowed}
        if not updates:
            return
        for key, value in updates.items():
            if isinstance(value, (dict, list)):
                updates[key] = json.dumps(value)
        sets = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [now_iso(), call_id]
        with closing(self._conn()) as conn, conn:
            conn.execute(f"UPDATE calls SET {sets}, updated_at = ? WHERE id = ?", values)

    def get_call(self, call_id: int) -> dict[str, Any] | None:
        with closing(self._conn()) as conn:
            row = conn.execute("SELECT * FROM calls WHERE id = ?", (call_id,)).fetchone()
        return self._row_to_dict(row) if row else None

    def list_calls(self, limit: int = 50) -> list[dict[str, Any]]:
        with closing(self._conn()) as conn:
            rows = conn.execute(
                "SELECT * FROM calls ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def active_calls(self) -> list[dict[str, Any]]:
        placeholders = ", ".join("?" for _ in ACTIVE_STATUSES)
        now = datetime.now(timezone.utc)
        link_cutoff = (now - timedelta(minutes=90)).isoformat(timespec="seconds")
        orphan_cutoff = (now - timedelta(minutes=45)).isoformat(timespec="seconds")
        with closing(self._conn()) as conn:
            rows = conn.execute(
                f"SELECT * FROM calls WHERE status IN ({placeholders}) "
                "OR (conversation_id IS NOT NULL AND transcript IS NULL AND updated_at >= ?) "
                "OR (status IN ('completed','failed','no_answer','cancelled') "
                "AND conversation_id IS NULL AND created_at >= ? AND link_attempts < 10) "
                "ORDER BY id DESC LIMIT 20",
                (*ACTIVE_STATUSES, link_cutoff, orphan_cutoff),
            ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def bump_link_attempts(self, call_id: int) -> None:
        with closing(self._conn()) as conn, conn:
            conn.execute(
                "UPDATE calls SET link_attempts = COALESCE(link_attempts, 0) + 1, "
                "updated_at = ? WHERE id = ?",
                (now_iso(), call_id),
            )

    def get_cached_phone(self, hotel_id: str) -> tuple[str, str] | None:
        with closing(self._conn()) as conn:
            row = conn.execute(
                "SELECT phone, source FROM phone_cache WHERE hotel_id = ?", (hotel_id,)
            ).fetchone()
        return (row["phone"], row["source"]) if row else None

    def cache_phone(self, hotel_id: str, phone: str, source: str) -> None:
        with closing(self._conn()) as conn, conn:
            conn.execute(
                "INSERT INTO phone_cache (hotel_id, phone, source, updated_at) VALUES (?,?,?,?) "
                "ON CONFLICT(hotel_id) DO UPDATE SET phone = excluded.phone, "
                "source = excluded.source, updated_at = excluded.updated_at",
                (hotel_id, phone, source, now_iso()),
            )

    def latest_sim_call(self) -> dict[str, Any] | None:
        with closing(self._conn()) as conn:
            row = conn.execute(
                "SELECT * FROM calls WHERE mode = 'sim' AND status IN ('queued','ringing','in_progress') "
                "ORDER BY id DESC LIMIT 1"
            ).fetchone()
        return self._row_to_dict(row) if row else None

    def add_tool_event(self, conversation_id: str | None, tool_name: str, payload: dict[str, Any]) -> int:
        with closing(self._conn()) as conn, conn:
            cur = conn.execute(
                "INSERT INTO tool_events (created_at, conversation_id, tool_name, payload) VALUES (?,?,?,?)",
                (now_iso(), conversation_id, tool_name, json.dumps(payload)),
            )
            return int(cur.lastrowid)

    def tool_events_for(self, conversation_id: str) -> list[dict[str, Any]]:
        with closing(self._conn()) as conn:
            rows = conn.execute(
                "SELECT * FROM tool_events WHERE conversation_id = ? ORDER BY id",
                (conversation_id,),
            ).fetchall()
        events = []
        for r in rows:
            item = dict(r)
            try:
                item["payload"] = json.loads(item["payload"])
            except (json.JSONDecodeError, TypeError):
                pass
            events.append(item)
        return events

    def add_online_booking(self, row: dict[str, Any]) -> int:
        with closing(self._conn()) as conn, conn:
            cur = conn.execute(
                "INSERT INTO online_bookings (created_at, hotel_id, hotel_name, checkin, checkout, guests, "
                "prebook_id, booking_id, status, total_amount, currency, voucher_url, raw) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    now_iso(),
                    row.get("hotel_id"),
                    row.get("hotel_name"),
                    row.get("checkin"),
                    row.get("checkout"),
                    row.get("guests"),
                    row.get("prebook_id"),
                    row.get("booking_id"),
                    row.get("status"),
                    row.get("total_amount"),
                    row.get("currency"),
                    row.get("voucher_url"),
                    json.dumps(row.get("raw", {})),
                ),
            )
            return int(cur.lastrowid)

    def list_online_bookings(self, limit: int = 50) -> list[dict[str, Any]]:
        with closing(self._conn()) as conn:
            rows = conn.execute(
                "SELECT * FROM online_bookings ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return [self._row_to_dict(r) for r in rows]
