from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import twiml as twiml_mod
from .agent_specs import booker_agent_spec, frontdesk_agent_spec
from .config import DB_FILE, PHONE_DIRECTORY_FILE, WEB_DIR, settings
from .context import build_booking_context, default_dates, frontdesk_context, nights_between
from .db import Store
from .elevenlabs_api import ElevenLabsClient, ElevenLabsError
from .liteapi import LiteAPIClient, LiteAPIError
from .phones import PhoneBook, normalize_phone
from .twilio_api import TwilioService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("stayline")

store = Store(DB_FILE)
lite: LiteAPIClient | None = None
el: ElevenLabsClient | None = None
if settings.liteapi_key:
    lite = LiteAPIClient(settings.liteapi_key, settings.liteapi_base)
if settings.elevenlabs_api_key:
    el = ElevenLabsClient(settings.elevenlabs_api_key, settings.elevenlabs_base)
tw = TwilioService(settings)
phonebook = PhoneBook(store, PHONE_DIRECTORY_FILE, settings.google_places_api_key)


class ProfileUpdate(BaseModel):
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    adults: int | None = None
    rooms: int | None = None
    room_preference: str | None = None
    budget_note: str | None = None
    payment_note: str | None = None
    special_requests: str | None = None


class PhoneUpdate(BaseModel):
    phone: str


class CallRequest(BaseModel):
    hotel_id: str | None = None
    offer: dict[str, Any] | None = None
    to_number: str | None = None
    mode: str | None = None


class OnlineBookingRequest(BaseModel):
    hotel_id: str
    offer_id: str
    checkin: str
    checkout: str
    adults: int = 2


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _conversation_dynamic_call_id(detail: dict[str, Any]) -> str | None:
    cicd = detail.get("conversation_initiation_client_data") or {}
    variables = cicd.get("dynamic_variables") or {}
    value = variables.get("call_id")
    return str(value) if value is not None else None


def merge_tool_events(call: dict[str, Any]) -> None:
    if not call.get("conversation_id"):
        return
    events = store.tool_events_for(str(call["conversation_id"]))
    reservation: dict[str, Any] = dict(call.get("reservation") or {})
    outcome: dict[str, Any] | None = call.get("outcome") or None
    for event in events:
        payload = event.get("payload") or {}
        if event.get("tool_name") == "record_reservation_details":
            for key, value in payload.items():
                if key in ("conversation_id", "tool_name", "agent_id", "message_type"):
                    continue
                if value not in (None, ""):
                    reservation[key] = value
        elif event.get("tool_name") == "report_booking_outcome":
            outcome = {
                "outcome": payload.get("outcome"),
                "reason": payload.get("reason"),
            }
    updates: dict[str, Any] = {}
    if reservation:
        updates["reservation"] = reservation
    if outcome:
        updates["outcome"] = outcome
    if updates:
        store.update_call(int(call["id"]), **updates)


def store_conversation(call: dict[str, Any], detail: dict[str, Any]) -> None:
    analysis = detail.get("analysis") or {}
    transcript = detail.get("transcript") or []
    updates: dict[str, Any] = {
        "conversation_id": detail.get("conversation_id"),
        "transcript": transcript,
        "analysis": analysis,
        "summary": analysis.get("transcript_summary"),
        "call_successful": analysis.get("call_successful"),
    }
    store.update_call(int(call["id"]), **updates)
    merged = store.get_call(int(call["id"]))
    if merged:
        merge_tool_events(merged)


def try_link_conversation(call: dict[str, Any]) -> None:
    if not el or not settings.booker_agent_id:
        return
    created = _parse_iso(call.get("created_at"))
    if not created:
        created = datetime.now(timezone.utc) - timedelta(minutes=10)
    try:
        conversations = el.list_conversations(settings.booker_agent_id, page_size=25)
    except ElevenLabsError as exc:
        log.warning("conversation list failed: %s", exc)
        return
    for item in conversations[:10]:
        conv_id = item.get("conversation_id") or item.get("id")
        if not conv_id:
            continue
        try:
            detail = el.get_conversation(str(conv_id))
        except ElevenLabsError:
            continue
        if _conversation_dynamic_call_id(detail) == str(call["id"]):
            store.update_call(int(call["id"]), conversation_id=str(conv_id))
            if detail.get("status") == "done":
                store_conversation(call, detail)
            else:
                updated = store.get_call(int(call["id"]))
                if updated:
                    merge_tool_events(updated)
            if call.get("mode") == "sim" and settings.frontdesk_agent_id:
                _attach_peer_transcript(int(call["id"]), created)
            return


def _attach_peer_transcript(call_id: int, created: datetime) -> None:
    if not el or not settings.frontdesk_agent_id:
        return
    try:
        conversations = el.list_conversations(settings.frontdesk_agent_id, page_size=10)
    except ElevenLabsError:
        return
    best: dict[str, Any] | None = None
    best_time: datetime | None = None
    for item in conversations:
        conv_id = item.get("conversation_id") or item.get("id")
        if not conv_id:
            continue
        try:
            detail = el.get_conversation(str(conv_id))
        except ElevenLabsError:
            continue
        started = detail.get("metadata", {}).get("start_time_unix_secs")
        if not isinstance(started, (int, float)):
            continue
        started_dt = datetime.fromtimestamp(float(started), tz=timezone.utc)
        if abs((started_dt - created).total_seconds()) > 300:
            continue
        if best_time is None or started_dt > best_time:
            best, best_time = detail, started_dt
    if best:
        store.update_call(call_id, peer_transcript=best.get("transcript") or [])


def poll_once() -> None:
    for call in store.active_calls():
        call_id = int(call["id"])
        status = call.get("status")
        if call.get("twilio_sid") and status in ("queued", "ringing", "in_progress"):
            try:
                info = tw.fetch_call(call["twilio_sid"])
                mapped = twiml_mod.map_twilio_status(info.get("status"))
                if mapped and mapped != status:
                    store.update_call(call_id, status=mapped)
                    status = mapped
            except Exception as exc:
                log.warning("twilio fetch failed for call %s: %s", call_id, exc)
        if not call.get("conversation_id") and status in ("in_progress", "completed"):
            try_link_conversation(call)
        elif call.get("conversation_id") and not call.get("transcript"):
            if not el:
                continue
            try:
                detail = el.get_conversation(str(call["conversation_id"]))
                if detail.get("status") == "done":
                    store_conversation(call, detail)
            except ElevenLabsError as exc:
                log.warning("conversation fetch failed for call %s: %s", call_id, exc)


async def poll_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(poll_once)
        except Exception:
            log.exception("poller error")
        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(poll_loop())
    log.info("StayLine up, mode=%s public_url=%s", settings.call_mode, settings.public_url or "unset")
    yield
    task.cancel()


app = FastAPI(title="StayLine", version="1.0.0", lifespan=lifespan)


@app.get("/api/health")
async def health() -> dict[str, Any]:
    modes = settings.call_modes_available
    return {
        "ok": True,
        "public_url_set": bool(settings.public_url),
        "elevenlabs_key": settings.elevenlabs_ready,
        "booker_agent": bool(settings.booker_agent_id),
        "frontdesk_agent": bool(settings.frontdesk_agent_id),
        "twilio_ready": tw.ready,
        "from_number": bool(settings.twilio_from_number),
        "sim_number": bool(settings.twilio_sim_number),
        "test_phone": bool(settings.test_phone),
        "liteapi": bool(lite),
        "google_places": bool(settings.google_places_api_key),
        "default_mode": settings.call_mode,
        "modes_available": modes,
    }


@app.get("/api/hotels")
async def search_hotels(
    city: str = Query(..., min_length=2),
    country: str = Query("US"),
    checkin: str = Query(""),
    checkout: str = Query(""),
    adults: int = Query(2),
    limit: int = Query(12),
) -> dict[str, Any]:
    if not lite:
        raise HTTPException(503, "LITEAPI_KEY not configured")
    if not checkin or not checkout:
        checkin, checkout = default_dates()
    if nights_between(checkin, checkout) < 1:
        raise HTTPException(400, "checkout must be after checkin")
    try:
        results = await asyncio.to_thread(
            lite.search_rates, city, country, checkin, checkout, adults, limit
        )
    except LiteAPIError as exc:
        raise HTTPException(502, str(exc))

    async def resolve(offer: dict[str, Any]) -> None:
        phone, source = await asyncio.to_thread(
            phonebook.resolve, offer.get("hotel_id"), offer.get("name", ""), offer.get("city", "")
        )
        offer["phone"] = phone
        offer["phone_source"] = source

    await asyncio.gather(*(resolve(r) for r in results))
    return {"query": {"city": city, "country": country, "checkin": checkin, "checkout": checkout}, "results": results}


@app.put("/api/hotels/{hotel_id}/phone")
async def set_phone(hotel_id: str, body: PhoneUpdate) -> dict[str, Any]:
    normalized = normalize_phone(body.phone)
    if not normalized:
        raise HTTPException(400, "could not parse that phone number, use E.164 like +12125550123")
    store.set_phone_override(hotel_id, normalized)
    return {"hotel_id": hotel_id, "phone": normalized, "source": "manual"}


@app.get("/api/profile")
async def get_profile() -> dict[str, Any]:
    return store.get_profile()


@app.put("/api/profile")
async def put_profile(body: ProfileUpdate) -> dict[str, Any]:
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    return store.set_profile(data)


@app.post("/api/calls")
async def place_call(body: CallRequest) -> dict[str, Any]:
    mode = (body.mode or settings.call_mode).lower()
    if mode not in ("real", "test", "sim"):
        raise HTTPException(400, "mode must be one of real, test, sim")
    if not settings.public_url:
        raise HTTPException(400, "PUBLIC_URL is not set. Start ngrok and set it in .env")
    if not tw.ready:
        raise HTTPException(400, "Twilio credentials incomplete")
    if not settings.twilio_from_number:
        raise HTTPException(400, "TWILIO_FROM_NUMBER is not set")
    if not el:
        raise HTTPException(400, "ELEVENLABS_API_KEY is not set")
    if not settings.booker_agent_id:
        raise HTTPException(400, "ELEVENLABS_BOOKER_AGENT_ID is not set, run scripts/setup_agents.py")
    if not settings.call_modes_available.get(mode):
        raise HTTPException(400, f"mode '{mode}' is not configured (check .env)")

    offer = body.offer or {}
    hotel_name = offer.get("name") or ""
    if not hotel_name:
        raise HTTPException(400, "offer is required: search hotels first and pass the selected result")

    if mode == "test":
        to_number = settings.test_phone
    elif mode == "sim":
        to_number = settings.twilio_sim_number
    else:
        to_number = normalize_phone(body.to_number or offer.get("phone"))
    if not to_number:
        raise HTTPException(
            400,
            "no phone number for this hotel: set one with PUT /api/hotels/{id}/phone "
            "or configure GOOGLE_PLACES_API_KEY",
        )

    profile = store.get_profile()
    context = build_booking_context("pending", mode, profile, offer, to_number)
    call_id = store.create_call(
        mode=mode,
        hotel_id=body.hotel_id or offer.get("hotel_id"),
        hotel_name=hotel_name,
        city=offer.get("city"),
        to_number=to_number,
        from_number=settings.twilio_from_number,
        booking_context=context,
    )
    context["call_id"] = str(call_id)
    store.update_call(call_id, booking_context=context)

    try:
        sid = await asyncio.to_thread(
            tw.create_call,
            to_number,
            settings.twilio_from_number,
            f"{settings.public_url}/twilio/voice/{call_id}",
            f"{settings.public_url}/twilio/status/{call_id}",
            mode == "real",
            settings.record_calls,
            f"{settings.public_url}/twilio/recording/{call_id}",
            settings.ring_timeout,
        )
    except Exception as exc:
        store.update_call(call_id, status="failed", error=str(exc))
        raise HTTPException(502, f"Twilio call creation failed: {exc}")
    store.update_call(call_id, twilio_sid=sid, status="queued")
    return store.get_call(call_id)


@app.get("/api/calls")
async def list_calls() -> dict[str, Any]:
    return {"calls": store.list_calls()}


@app.get("/api/calls/{call_id}")
async def get_call(call_id: int) -> dict[str, Any]:
    call = store.get_call(call_id)
    if not call:
        raise HTTPException(404, "call not found")
    return call


@app.post("/api/calls/{call_id}/hangup")
async def hangup_call(call_id: int) -> dict[str, Any]:
    call = store.get_call(call_id)
    if not call:
        raise HTTPException(404, "call not found")
    if call.get("twilio_sid"):
        try:
            await asyncio.to_thread(tw.hangup, call["twilio_sid"])
        except Exception as exc:
            raise HTTPException(502, f"hangup failed: {exc}")
    store.update_call(call_id, status="cancelled")
    return store.get_call(call_id)


@app.post("/api/bookings/online")
async def book_online(body: OnlineBookingRequest) -> dict[str, Any]:
    if not lite:
        raise HTTPException(503, "LITEAPI_KEY not configured")
    profile = store.get_profile()
    name = (profile.get("guest_name") or "").strip()
    email = (profile.get("guest_email") or "").strip()
    if not name or not email:
        raise HTTPException(400, "set guest_name and guest_email in the profile first")
    parts = name.split()
    first_name, last_name = parts[0], (parts[-1] if len(parts) > 1 else "Guest")
    try:
        prebook = await asyncio.to_thread(lite.prebook, body.offer_id, body.adults)
    except LiteAPIError as exc:
        raise HTTPException(502, f"prebook failed: {exc}")
    prebook_id = prebook.get("prebookId") or prebook.get("prebook_id")
    if not prebook_id:
        raise HTTPException(502, f"no prebookId returned: {str(prebook)[:300]}")
    try:
        booking = await asyncio.to_thread(
            lite.book, prebook_id, first_name, last_name, email, profile.get("guest_phone") or ""
        )
    except LiteAPIError as exc:
        raise HTTPException(502, f"book failed: {exc}")
    booking_id = booking.get("bookingId") or booking.get("booking_id")
    total = booking.get("totalPrice") or booking.get("total_lodging") or {}
    if isinstance(total, list):
        total = total[0] if total else {}
    row = {
        "hotel_id": body.hotel_id,
        "hotel_name": None,
        "checkin": body.checkin,
        "checkout": body.checkout,
        "guests": body.adults,
        "prebook_id": prebook_id,
        "booking_id": booking_id,
        "status": "confirmed" if booking_id else "unknown",
        "total_amount": total.get("amount"),
        "currency": total.get("currency"),
        "voucher_url": booking.get("voucherUrl") or booking.get("voucher_url"),
        "raw": booking,
    }
    row_id = store.add_online_booking(row)
    return {"id": row_id, **row}


@app.get("/api/bookings")
async def list_bookings() -> dict[str, Any]:
    return {"bookings": store.list_online_bookings()}


@app.post("/twilio/voice/{call_id}")
async def twilio_voice(call_id: int, request: Request) -> Response:
    form = await request.form()
    call = store.get_call(call_id)
    if not call:
        return Response(twiml_mod.hangup_twiml(), media_type="application/xml")
    answered_by = form.get("AnsweredBy")
    if call.get("mode") == "real" and twiml_mod.is_machine(answered_by):
        store.update_call(
            call_id,
            status="no_answer",
            outcome={"outcome": "unavailable", "reason": "answering machine or fax picked up"},
        )
        return Response(twiml_mod.hangup_twiml(), media_type="application/xml")
    if not el or not settings.booker_agent_id:
        store.update_call(call_id, status="failed", error="agent not configured")
        return Response(twiml_mod.hangup_twiml(), media_type="application/xml")
    store.update_call(call_id, status="in_progress")
    try:
        twiml_text = await asyncio.to_thread(
            el.register_call,
            settings.booker_agent_id,
            call.get("from_number") or "",
            call.get("to_number") or "",
            "outbound",
            call.get("booking_context") or {},
        )
    except ElevenLabsError as exc:
        log.error("register-call failed for call %s: %s", call_id, exc)
        store.update_call(call_id, status="failed", error=f"ElevenLabs register-call failed: {exc}")
        return Response(twiml_mod.hangup_twiml(), media_type="application/xml")
    return Response(content=twiml_text, media_type="application/xml")


@app.post("/twilio/voice/frontdesk")
async def twilio_voice_frontdesk(request: Request) -> Response:
    form = await request.form()
    if not el or not settings.frontdesk_agent_id:
        return Response(twiml_mod.hangup_twiml(), media_type="application/xml")
    sim_call = store.latest_sim_call()
    ctx = frontdesk_context(sim_call.get("booking_context") if sim_call else None)
    from_number = form.get("To") or settings.twilio_sim_number or ""
    to_number = form.get("From") or settings.twilio_from_number or ""
    try:
        twiml_text = await asyncio.to_thread(
            el.register_call,
            settings.frontdesk_agent_id,
            from_number,
            to_number,
            "inbound",
            ctx,
        )
    except ElevenLabsError as exc:
        log.error("frontdesk register-call failed: %s", exc)
        return Response(twiml_mod.hangup_twiml(), media_type="application/xml")
    return Response(content=twiml_text, media_type="application/xml")


@app.post("/twilio/status/{call_id}")
async def twilio_status(call_id: int, request: Request) -> Response:
    form = await request.form()
    mapped = twiml_mod.map_twilio_status(form.get("CallStatus"))
    if mapped:
        store.update_call(call_id, status=mapped)
    return Response(content="<?xml version='1.0'?><Response/>", media_type="application/xml")


@app.post("/twilio/recording/{call_id}")
async def twilio_recording(call_id: int, request: Request) -> Response:
    form = await request.form()
    url = form.get("RecordingUrl")
    if url:
        store.update_call(call_id, recording_url=f"{url}.mp3")
    return Response(content="<?xml version='1.0'?><Response/>", media_type="application/xml")


def _check_webhook_secret(request: Request) -> None:
    if settings.webhook_secret:
        if request.headers.get("X-Webhook-Secret") != settings.webhook_secret:
            raise HTTPException(401, "invalid webhook secret")


async def _handle_tool(request: Request, tool_name: str) -> dict[str, Any]:
    _check_webhook_secret(request)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "invalid JSON")
    if not isinstance(payload, dict):
        raise HTTPException(400, "expected a JSON object")
    conversation_id = payload.get("conversation_id") or payload.get("conversationId")
    store.add_tool_event(conversation_id, tool_name, payload)
    if conversation_id:
        for call in store.list_calls(limit=50):
            if call.get("conversation_id") == conversation_id:
                merge_tool_events(call)
                break
    return {"status": "recorded"}


@app.post("/tools/record_reservation")
async def tool_record_reservation(request: Request) -> dict[str, Any]:
    result = await _handle_tool(request, "record_reservation_details")
    result["message"] = (
        "Reservation details saved. Please confirm the confirmation number and the total "
        "price once more with the hotel, then wrap up the call politely."
    )
    return result


@app.post("/tools/report_outcome")
async def tool_report_outcome(request: Request) -> dict[str, Any]:
    result = await _handle_tool(request, "report_booking_outcome")
    result["message"] = "Outcome recorded. You can thank them and end the call now."
    return result


@app.post("/webhooks/elevenlabs/post-call")
async def elevenlabs_post_call(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "invalid JSON")
    data = payload.get("data") if isinstance(payload, dict) else {}
    if not isinstance(data, dict):
        return {"ok": False}
    conversation_id = data.get("conversation_id")
    dynamic = (data.get("conversation_initiation_client_data") or {}).get("dynamic_variables") or {}
    call_id = dynamic.get("call_id")
    call = None
    if call_id:
        call = store.get_call(int(call_id)) if str(call_id).isdigit() else None
    if not call and conversation_id:
        for candidate in store.list_calls(limit=50):
            if candidate.get("conversation_id") == conversation_id:
                call = candidate
                break
    if not call:
        return {"ok": False, "reason": "no matching call"}
    if not call.get("conversation_id") and conversation_id:
        store.update_call(int(call["id"]), conversation_id=conversation_id)
        call = store.get_call(int(call["id"]))
    if call and not call.get("transcript"):
        store_conversation(call, data)
    return {"ok": True}


@app.get("/api/agent-specs")
async def agent_specs() -> dict[str, Any]:
    return {"booker": booker_agent_spec(settings), "frontdesk": frontdesk_agent_spec(settings)}


if WEB_DIR.exists():
    app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

    @app.get("/", include_in_schema=False)
    async def index() -> FileResponse:
        return FileResponse(Path(WEB_DIR) / "index.html")
