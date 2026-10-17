from __future__ import annotations

from datetime import date
from typing import Any


def nights_between(checkin: str, checkout: str) -> int:
    try:
        a = date.fromisoformat(checkin)
        b = date.fromisoformat(checkout)
        return max(1, (b - a).days)
    except (ValueError, TypeError):
        return 1


def _fmt(value: Any) -> str:
    if value is None:
        return "N/A"
    if isinstance(value, float) and value == int(value):
        value = int(value)
    text = str(value).strip()
    return text if text else "N/A"


def build_booking_context(
    call_id: int | str,
    mode: str,
    profile: dict[str, Any],
    offer: dict[str, Any],
    hotel_phone: str | None,
) -> dict[str, str]:
    budget = str(profile.get("budget_note") or "").strip()
    if not budget and offer.get("total") is not None:
        budget = f"up to about {offer.get('currency', 'USD')} {offer['total']} total for the stay"
    checkin = str(offer.get("checkin") or "")
    checkout = str(offer.get("checkout") or "")
    context = {
        "call_id": str(call_id),
        "mode": mode,
        "guest_name": _fmt(profile.get("guest_name")),
        "guest_email": _fmt(profile.get("guest_email")),
        "guest_phone": _fmt(profile.get("guest_phone")),
        "hotel_name": _fmt(offer.get("name")),
        "hotel_address": _fmt(offer.get("address")),
        "hotel_city": _fmt(offer.get("city")),
        "hotel_phone": _fmt(hotel_phone),
        "checkin": _fmt(checkin),
        "checkout": _fmt(checkout),
        "nights": str(offer.get("nights") or nights_between(checkin, checkout)),
        "adults": str(profile.get("adults") or offer.get("adults") or 2),
        "rooms": str(profile.get("rooms") or 1),
        "room_type": _fmt(profile.get("room_preference") or offer.get("room_name")),
        "board": _fmt(offer.get("board")),
        "max_price": _fmt(budget),
        "payment_note": _fmt(profile.get("payment_note")),
        "special_requests": _fmt(profile.get("special_requests")),
        "per_night": _fmt(offer.get("per_night")),
        "currency": _fmt(offer.get("currency")),
    }
    return context


def frontdesk_context(booking_context: dict[str, Any] | None) -> dict[str, str]:
    ctx = booking_context or {}
    room = str(ctx.get("room_type") or "a standard king room")
    per_night = str(ctx.get("per_night") or "")
    if per_night and per_night not in ("N/A", ""):
        rate = f"{ctx.get('currency', 'USD')} {per_night}"
    else:
        rate = "USD 279"
    return {
        "hotel_name": str(ctx.get("hotel_name") or "the hotel"),
        "room_available": f"Yes, {room} is available",
        "sim_rate": rate,
        "checkin": str(ctx.get("checkin") or "N/A"),
        "checkout": str(ctx.get("checkout") or "N/A"),
    }


def default_dates(days_ahead: int = 30, nights: int = 2) -> tuple[str, str]:
    base = date.today().toordinal() + days_ahead
    checkin = date.fromordinal(base).isoformat()
    checkout = date.fromordinal(base + nights).isoformat()
    return checkin, checkout
