from __future__ import annotations

MACHINE_ANSWERS = {
    "machine_start",
    "machine_end_beep",
    "machine_end_silence",
    "fax",
    "machine",
}


def hangup_twiml() -> str:
    return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>'


def is_machine(answered_by: str | None) -> bool:
    value = (answered_by or "").strip().lower()
    if not value:
        return False
    if value in MACHINE_ANSWERS:
        return True
    return value.startswith("machine")


def map_twilio_status(status: str | None) -> str | None:
    mapping = {
        "queued": "queued",
        "initiated": "queued",
        "ringing": "ringing",
        "in-progress": "in_progress",
        "completed": "completed",
        "busy": "no_answer",
        "no-answer": "no_answer",
        "failed": "failed",
        "canceled": "cancelled",
    }
    if not status:
        return None
    return mapping.get(status.lower())
