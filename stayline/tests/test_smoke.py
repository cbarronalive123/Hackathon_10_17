from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.context import (
    build_booking_context,
    default_dates,
    frontdesk_context,
    nights_between,
    prompt_variables,
)
from app.db import Store
from app.liteapi import LiteAPIClient
from app.phones import (
    find_chain_line,
    find_directory_phone,
    load_directory,
    normalize_phone,
    places_phone_from_payload,
)
from app.prompts import BOOKER_FIRST_MESSAGE, BOOKER_PROMPT, FRONTDESK_PROMPT
from app.twiml import is_machine, map_twilio_status, hangup_twiml

FIXTURES = Path(__file__).resolve().parents[1].parent / "hotel_api" / "tests" / "responses"
DIRECTORY = Path(__file__).resolve().parents[1] / "data" / "hotel_phones.json"

OFFER = {
    "hotel_id": "lpa5464",
    "name": "Park Terrace Hotel",
    "address": "18 West 40th Street",
    "city": "New York",
    "room_name": "King Room with Roll-in Shower",
    "board": "Room Only",
    "refundable": "RFN",
    "total": 500.29,
    "per_night": 250.15,
    "currency": "USD",
    "nights": 2,
    "checkin": "2026-12-10",
    "checkout": "2026-12-12",
    "adults": 2,
    "offer_id": "AwJ2MQAA",
}

PROFILE = {
    "guest_name": "Jane Doe",
    "guest_email": "jane@example.com",
    "guest_phone": "+15194760578",
    "adults": 2,
    "rooms": 1,
    "room_preference": "King room",
    "budget_note": "Up to $350 per night",
    "payment_note": "Guest will present card at check-in.",
    "special_requests": "High floor",
}


def test_normalize_phone():
    assert normalize_phone("212-555-0123") == "+12125550123"
    assert normalize_phone("(212) 555 0123") == "+12125550123"
    assert normalize_phone("1-212-555-0123") == "+12125550123"
    assert normalize_phone("+44 20 7946 0958") == "+442079460958"
    assert normalize_phone("+33 1 42 68 53 00") == "+33142685300"
    assert normalize_phone("") is None
    assert normalize_phone(None) is None
    assert normalize_phone("not a phone") is None


def test_directory_and_chain_lookup():
    directory = load_directory(DIRECTORY)
    assert directory, "phone directory fixture missing"
    phone = find_directory_phone(directory, "Park Terrace Hotel", "New York")
    assert phone == "+12125550101"
    assert find_directory_phone(directory, "Unknown Hotel", "Nowhere") is None
    chain = find_chain_line(directory, "Hilton Garden Inn NYC Financial Center")
    assert chain == "+18004458667"
    assert find_chain_line(directory, "Moxy NYC Chelsea") is None


def test_places_payload_parsing():
    payload = {
        "places": [
            {"displayName": {"text": "x"}},
            {"displayName": {"text": "Park Terrace"}, "nationalPhoneNumber": "(212) 555-0100"},
        ]
    }
    assert places_phone_from_payload(payload) == "(212) 555-0100"
    assert places_phone_from_payload({"places": []}) is None


def test_booking_context_covers_prompt_variables():
    context = build_booking_context(7, "real", PROFILE, OFFER, "+12125550101")
    needed = prompt_variables(BOOKER_PROMPT) | prompt_variables(BOOKER_FIRST_MESSAGE)
    missing = needed - set(context)
    assert not missing, f"missing dynamic variables: {missing}"
    assert context["guest_name"] == "Jane Doe"
    assert context["nights"] == "2"
    assert context["hotel_phone"] == "+12125550101"


def test_frontdesk_context_covers_prompt_variables():
    context = build_booking_context(7, "sim", PROFILE, OFFER, None)
    fd = frontdesk_context(context)
    needed = prompt_variables(FRONTDESK_PROMPT)
    assert not needed - set(fd), f"missing: {needed - set(fd)}"
    assert fd["hotel_name"] == "Park Terrace Hotel"
    assert "279" not in fd["sim_rate"]


def test_nights_and_default_dates():
    assert nights_between("2026-12-10", "2026-12-12") == 2
    assert nights_between("2026-12-10", "2026-12-10") == 1
    assert nights_between("bad", "input") == 1
    checkin, checkout = default_dates()
    assert nights_between(checkin, checkout) == 2


def test_store_roundtrip(tmp_path):
    store = Store(tmp_path / "test.db")
    profile = store.get_profile()
    assert profile["adults"] == 2
    store.set_profile({"guest_name": "Jane Doe", "adults": 3})
    assert store.get_profile()["guest_name"] == "Jane Doe"
    assert store.get_profile()["adults"] == 3

    context = build_booking_context(1, "real", PROFILE, OFFER, "+12125550101")
    call_id = store.create_call(
        "real", "lpa5464", "Park Terrace Hotel", "New York",
        "+12125550101", "+15551234567", context,
    )
    store.update_call(call_id, status="ringing", twilio_sid="CA123")
    call = store.get_call(call_id)
    assert call["status"] == "ringing"
    assert call["twilio_sid"] == "CA123"
    assert call["booking_context"]["hotel_name"] == "Park Terrace Hotel"
    context["call_id"] = str(call_id)
    store.update_call(call_id, booking_context=context)
    call = store.get_call(call_id)
    assert call["booking_context"]["call_id"] == str(call_id)
    store.update_call(call_id, conversation_id="conv-1", reservation={"confirmation_number": "SIM-123"})
    call = store.get_call(call_id)
    assert call["reservation"]["confirmation_number"] == "SIM-123"

    store.add_tool_event("conv-1", "record_reservation_details", {"total_price": "$560", "confirmation_number": "SIM-9"})
    store.add_tool_event("conv-1", "report_booking_outcome", {"outcome": "booked", "reason": "confirmed"})
    events = store.tool_events_for("conv-1")
    assert len(events) == 2

    store.set_phone_override("lpa5464", "+12125550199")
    assert store.get_phone_override("lpa5464") == "+12125550199"

    booking_id = store.add_online_booking({
        "hotel_id": "lpa5464", "hotel_name": "Park Terrace Hotel", "checkin": "2026-12-10",
        "checkout": "2026-12-12", "guests": 2, "prebook_id": "pb-1", "booking_id": "BK-1",
        "status": "confirmed", "total_amount": 500.29, "currency": "USD", "voucher_url": "http://x",
        "raw": {"ok": True},
    })
    bookings = store.list_online_bookings()
    assert bookings[0]["booking_id"] == "BK-1"
    assert bookings[0]["raw"] == {"ok": True}
    assert booking_id == 1


def test_twiml_helpers():
    assert is_machine("machine_start")
    assert is_machine("human") is False
    assert is_machine(None) is False
    assert map_twilio_status("in-progress") == "in_progress"
    assert map_twilio_status("completed") == "completed"
    assert map_twilio_status("no-answer") == "no_answer"
    assert map_twilio_status(None) is None
    assert "<Hangup/>" in hangup_twiml()


def test_liteapi_rates_parsing(tmp_path, monkeypatch):
    fixture = FIXTURES / "03_rates_nyc.json"
    if not fixture.exists():
        return
    payload = json.loads(fixture.read_text(encoding="utf-8"))
    client = LiteAPIClient("dummy-key")
    monkeypatch.setattr(client, "_request", lambda method, path, body=None: payload)
    results = client.search_rates("New York", "US", "2026-12-10", "2026-12-12", 2, 10)
    assert results, "no results parsed from fixture"
    first = results[0]
    assert first["hotel_id"]
    assert first["name"]
    assert isinstance(first["total"], (int, float))
    assert first["currency"] == "USD"
    assert first["nights"] == 2
    assert first["checkin"] == "2026-12-10"
    totals = [r["total"] for r in results]
    assert totals == sorted(totals)
