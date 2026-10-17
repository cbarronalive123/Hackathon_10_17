from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
WEB_DIR = Path(__file__).resolve().parent / "web"
ENV_FILE = ROOT / ".env"
PHONE_DIRECTORY_FILE = DATA_DIR / "hotel_phones.json"
DB_FILE = DATA_DIR / "stayline.db"

load_dotenv(ENV_FILE, override=False)


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def _bool(name: str, default: str = "false") -> bool:
    return _env(name, default).lower() in ("1", "true", "yes", "on")


def _int(name: str, default: int) -> int:
    try:
        return int(_env(name, str(default)))
    except ValueError:
        return default


@dataclass
class Settings:
    port: int = _int("PORT", 8010)

    liteapi_key: str = _env("LITEAPI_KEY")
    liteapi_base: str = _env("LITEAPI_BASE", "https://api.liteapi.travel/v3.0")

    elevenlabs_api_key: str = _env("ELEVENLABS_API_KEY")
    elevenlabs_base: str = _env("ELEVENLABS_BASE", "https://api.elevenlabs.io")
    booker_agent_id: str = _env("ELEVENLABS_BOOKER_AGENT_ID")
    frontdesk_agent_id: str = _env("ELEVENLABS_FRONTDESK_AGENT_ID")
    booker_voice_id: str = _env("ELEVENLABS_BOOKER_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    frontdesk_voice_id: str = _env("ELEVENLABS_FRONTDESK_VOICE_ID", "pNInz6obpgDQGcFmaJgB")

    twilio_account_sid: str = _env("TWILIO_ACCOUNT_SID")
    twilio_api_key_sid: str = _env("TWILIO_API_KEY_SID")
    twilio_api_key_secret: str = _env("TWILIO_API_KEY_SECRET")
    twilio_auth_token: str = _env("TWILIO_AUTH_TOKEN")
    twilio_from_number: str = _env("TWILIO_FROM_NUMBER")
    twilio_sim_number: str = _env("TWILIO_SIM_NUMBER")
    test_phone: str = _env("TEST_PHONE")

    google_places_api_key: str = _env("GOOGLE_PLACES_API_KEY")

    public_url: str = _env("PUBLIC_URL").rstrip("/")
    call_mode: str = _env("CALL_MODE", "real").lower()
    record_calls: bool = _bool("RECORD_CALLS")
    ring_timeout: int = _int("RING_TIMEOUT", 40)
    webhook_secret: str = _env("WEBHOOK_SECRET")

    @property
    def twilio_ready(self) -> bool:
        if not self.twilio_account_sid:
            return False
        return bool(
            (self.twilio_api_key_sid and self.twilio_api_key_secret) or self.twilio_auth_token
        )

    @property
    def elevenlabs_ready(self) -> bool:
        return bool(self.elevenlabs_api_key)

    @property
    def call_modes_available(self) -> dict[str, bool]:
        return {
            "real": bool(self.public_url and self.twilio_ready and self.twilio_from_number),
            "test": bool(self.public_url and self.twilio_ready and self.twilio_from_number and self.test_phone),
            "sim": bool(
                self.public_url
                and self.twilio_ready
                and self.twilio_from_number
                and self.twilio_sim_number
            ),
        }


settings = Settings()
