from __future__ import annotations

from typing import Any

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client as TwilioRestClient

from .config import Settings


class TwilioService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client: TwilioRestClient | None = None
        if settings.twilio_account_sid and settings.twilio_api_key_sid and settings.twilio_api_key_secret:
            self._client = TwilioRestClient(
                settings.twilio_api_key_sid,
                settings.twilio_api_key_secret,
                settings.twilio_account_sid,
            )
        elif settings.twilio_account_sid and settings.twilio_auth_token:
            self._client = TwilioRestClient(
                settings.twilio_account_sid, settings.twilio_auth_token
            )

    @property
    def ready(self) -> bool:
        return self._client is not None

    def create_call(
        self,
        to: str,
        from_: str,
        voice_url: str,
        status_callback: str | None = None,
        machine_detection: bool = False,
        record: bool = False,
        recording_callback: str | None = None,
        timeout: int = 40,
    ) -> str:
        kwargs: dict[str, Any] = {
            "to": to,
            "from_": from_,
            "url": voice_url,
            "timeout": timeout,
        }
        if status_callback:
            kwargs["status_callback"] = status_callback
            kwargs["status_callback_event"] = ["initiated", "ringing", "answered", "completed"]
        if machine_detection:
            kwargs["machine_detection"] = "Enable"
        if record:
            kwargs["record"] = True
            if recording_callback:
                kwargs["recording_status_callback"] = recording_callback
        call = self._client.calls.create(**kwargs)
        return call.sid

    def fetch_call(self, sid: str) -> dict[str, Any]:
        call = self._client.calls(sid).fetch()
        return {
            "sid": call.sid,
            "status": call.status,
            "duration": call.duration,
            "from": call.from_,
            "to": call.to,
            "start_time": call.start_time.isoformat() if call.start_time else None,
            "end_time": call.end_time.isoformat() if call.end_time else None,
        }

    def hangup(self, sid: str) -> None:
        self._client.calls(sid).update(twiml="<Response><Hangup/></Response>")

    def validate(self) -> dict[str, Any]:
        if not self._client:
            return {"ok": False, "error": "Twilio credentials not configured"}
        try:
            account = self._client.api.account.fetch()
            return {"ok": True, "friendly_name": account.friendly_name}
        except TwilioRestException as exc:
            return {"ok": False, "error": str(exc)}
