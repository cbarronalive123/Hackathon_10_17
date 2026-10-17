from __future__ import annotations

from typing import Any

import httpx


class ElevenLabsError(Exception):
    pass


class ElevenLabsClient:
    def __init__(self, api_key: str, base: str = "https://api.elevenlabs.io"):
        if not api_key:
            raise ElevenLabsError("ELEVENLABS_API_KEY is not configured")
        self.base = base.rstrip("/")
        self._client = httpx.Client(
            base_url=self.base,
            headers={"xi-api-key": api_key, "Content-Type": "application/json"},
            timeout=60,
        )

    def _json(self, method: str, path: str, json_body: dict[str, Any] | None = None) -> Any:
        try:
            resp = self._client.request(method, path, json=json_body)
        except httpx.HTTPError as exc:
            raise ElevenLabsError(f"ElevenLabs request failed: {exc}") from exc
        if resp.status_code >= 400:
            raise ElevenLabsError(
                f"ElevenLabs {resp.status_code} on {method} {path}: {resp.text[:300]}"
            )
        if not resp.content:
            return {}
        try:
            return resp.json()
        except ValueError:
            return {"raw": resp.text}

    def _text(self, method: str, path: str, json_body: dict[str, Any] | None = None) -> str:
        try:
            resp = self._client.request(method, path, json=json_body)
        except httpx.HTTPError as exc:
            raise ElevenLabsError(f"ElevenLabs request failed: {exc}") from exc
        if resp.status_code >= 400:
            raise ElevenLabsError(
                f"ElevenLabs {resp.status_code} on {method} {path}: {resp.text[:300]}"
            )
        return resp.text

    def create_agent(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            result = self._json("POST", "/v1/convai/agents/create", payload)
        except ElevenLabsError:
            result = self._json("POST", "/v1/convai/agents", payload)
        if isinstance(result, dict) and result.get("agent_id"):
            return result
        if isinstance(result, dict) and result.get("id"):
            return {**result, "agent_id": result["id"]}
        return result

    def update_agent(self, agent_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._json("PATCH", f"/v1/convai/agents/{agent_id}", payload)

    def get_agent(self, agent_id: str) -> dict[str, Any]:
        return self._json("GET", f"/v1/convai/agents/{agent_id}")

    def list_agents(self) -> list[dict[str, Any]]:
        result = self._json("GET", "/v1/convai/agents")
        if isinstance(result, dict):
            return result.get("agents") or result.get("data") or []
        return result if isinstance(result, list) else []

    def register_call(
        self,
        agent_id: str,
        from_number: str,
        to_number: str,
        direction: str = "outbound",
        dynamic_variables: dict[str, Any] | None = None,
    ) -> str:
        body: dict[str, Any] = {
            "agent_id": agent_id,
            "from_number": from_number,
            "to_number": to_number,
            "direction": direction,
        }
        if dynamic_variables:
            body["conversation_initiation_client_data"] = {
                "dynamic_variables": {str(k): str(v) for k, v in dynamic_variables.items()}
            }
        return self._text("POST", "/v1/convai/twilio/register-call", body)

    def list_conversations(self, agent_id: str, page_size: int = 50) -> list[dict[str, Any]]:
        result = self._json(
            "GET", f"/v1/convai/conversations?agent_id={agent_id}&page_size={page_size}"
        )
        if isinstance(result, dict):
            return result.get("conversations") or []
        return result if isinstance(result, list) else []

    def get_conversation(self, conversation_id: str) -> dict[str, Any]:
        return self._json("GET", f"/v1/convai/conversations/{conversation_id}")

    def get_signed_url(self, agent_id: str) -> str:
        result = self._json(
            "GET", f"/v1/convai/conversation/get-signed-url?agent_id={agent_id}"
        )
        return result.get("signed_url", "")
