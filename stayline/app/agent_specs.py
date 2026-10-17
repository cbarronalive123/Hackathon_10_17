from __future__ import annotations

from typing import Any

from .config import Settings
from .prompts import (
    BOOKER_FIRST_MESSAGE,
    BOOKER_PROMPT,
    FRONTDESK_FIRST_MESSAGE,
    FRONTDESK_PROMPT,
)


def _tools(public_url: str, webhook_secret: str) -> list[dict[str, Any]]:
    headers: dict[str, str] = {}
    if webhook_secret:
        headers["X-Webhook-Secret"] = webhook_secret
    record_reservation = {
        "tool_name": "record_reservation_details",
        "description": (
            "Record or update the reservation details gathered so far: confirmation number, "
            "total price, room description, cancellation policy and notes. Call this as soon "
            "as you have details and again whenever they change."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "confirmation_number": {
                    "type": "string",
                    "description": "Reservation or confirmation number given by the hotel",
                },
                "total_price": {
                    "type": "string",
                    "description": "Total price quoted including taxes and fees, with currency",
                },
                "room_description": {"type": "string", "description": "Room type reserved"},
                "cancellation_policy": {
                    "type": "string",
                    "description": "Cancellation policy of the reservation",
                },
                "notes": {"type": "string", "description": "Anything else worth recording"},
            },
            "required": ["total_price"],
        },
        "url": f"{public_url}/tools/record_reservation",
        "method": "POST",
        "wait_for_response": True,
        "strict": False,
    }
    report_outcome = {
        "tool_name": "report_booking_outcome",
        "description": (
            "Report the final outcome of the booking attempt: booked, not_booked, "
            "callback_required or unavailable, with a short reason."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "outcome": {
                    "type": "string",
                    "enum": ["booked", "not_booked", "callback_required", "unavailable"],
                },
                "reason": {"type": "string", "description": "Short reason for the outcome"},
            },
            "required": ["outcome", "reason"],
        },
        "url": f"{public_url}/tools/report_outcome",
        "method": "POST",
        "wait_for_response": True,
        "strict": False,
    }
    if headers:
        for tool in (record_reservation, report_outcome):
            tool["headers"] = headers
    return [record_reservation, report_outcome]


def booker_agent_spec(settings: Settings) -> dict[str, Any]:
    conversation_config: dict[str, Any] = {
        "agent": {
            "name": "StayLine Booker",
            "prompt": {"prompt": BOOKER_PROMPT},
            "first_message": BOOKER_FIRST_MESSAGE,
            "language": "en",
        },
        "tts": {
            "voice_id": settings.booker_voice_id,
            "model_id": "eleven_turbo_v2_5",
            "voice_settings": {
                "stability": 0.55,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        },
        "asr": {"language": "en"},
        "conversation": {"text_only": False},
        "agent_settings": {"boost_variable_injection": True},
    }
    if settings.public_url:
        conversation_config["tools"] = _tools(settings.public_url, settings.webhook_secret)
    return {"conversation_config": conversation_config, "platform_settings": {}}


def frontdesk_agent_spec(settings: Settings) -> dict[str, Any]:
    return {
        "conversation_config": {
            "agent": {
                "name": "StayLine Front Desk Sim",
                "prompt": {"prompt": FRONTDESK_PROMPT},
                "first_message": FRONTDESK_FIRST_MESSAGE,
                "language": "en",
            },
            "tts": {
                "voice_id": settings.frontdesk_voice_id,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {
                    "stability": 0.6,
                    "similarity_boost": 0.75,
                    "style": 0.0,
                    "use_speaker_boost": True,
                },
            },
            "asr": {"language": "en"},
            "conversation": {"text_only": False},
            "agent_settings": {"boost_variable_injection": True},
        },
        "platform_settings": {},
    }
