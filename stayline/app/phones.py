from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import httpx

from .db import Store


def normalize_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    text = str(raw).strip()
    digits = re.sub(r"\D", "", text)
    if len(digits) == 10:
        return "+1" + digits
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits
    if text.startswith("+") and 8 <= len(digits) <= 15:
        return "+" + digits
    if 8 <= len(digits) <= 15:
        return "+" + digits
    return None


def _norm_name(*parts: str) -> str:
    joined = " ".join(p for p in parts if p)
    return re.sub(r"[^a-z0-9]", "", joined.lower())


def load_directory(path: Path | str) -> dict[str, Any]:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def find_directory_phone(directory: dict[str, Any], name: str, city: str) -> str | None:
    hotels = directory.get("hotels", {})
    if not isinstance(hotels, dict):
        return None
    target = _norm_name(name, city)
    for key, phone in hotels.items():
        if _norm_name(key) == target or _norm_name(key) == _norm_name(name):
            return phone
    return None


def find_chain_line(directory: dict[str, Any], name: str) -> str | None:
    chains = directory.get("chains", {})
    if not isinstance(chains, dict):
        return None
    lowered = (name or "").lower()
    for chain, phone in chains.items():
        if chain in lowered:
            return phone
    return None


def places_phone_from_payload(payload: dict[str, Any]) -> str | None:
    places = payload.get("places") or []
    for place in places:
        number = place.get("nationalPhoneNumber") or place.get("internationalPhoneNumber")
        if number:
            return number
    return None


class PhoneBook:
    def __init__(
        self,
        store: Store,
        directory_path: Path | str,
        google_api_key: str = "",
    ):
        self.store = store
        self.directory = load_directory(directory_path)
        self.google_api_key = google_api_key

    def resolve(self, hotel_id: str | None, name: str, city: str = "") -> tuple[str | None, str]:
        if hotel_id:
            override = self.store.get_phone_override(hotel_id)
            if override:
                return normalize_phone(override), "manual"
        phone = find_directory_phone(self.directory, name, city)
        if phone:
            return normalize_phone(phone), "directory"
        phone = find_chain_line(self.directory, name)
        if phone:
            return normalize_phone(phone), "chain"
        if self.google_api_key:
            phone = self._google_places_lookup(name, city)
            if phone:
                return normalize_phone(phone), "google"
        return None, "none"

    def _google_places_lookup(self, name: str, city: str) -> str | None:
        query = ", ".join(p for p in (name, city, "hotel") if p)
        try:
            resp = httpx.post(
                "https://places.googleapis.com/v1/places:searchText",
                headers={
                    "X-Goog-Api-Key": self.google_api_key,
                    "X-Goog-FieldMask": "places.displayName,places.nationalPhoneNumber,places.formattedAddress",
                    "Content-Type": "application/json",
                },
                json={"textQuery": query},
                timeout=15,
            )
            if resp.status_code >= 400:
                return None
            return places_phone_from_payload(resp.json())
        except httpx.HTTPError:
            return None
