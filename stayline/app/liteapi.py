from __future__ import annotations

from typing import Any

import httpx


class LiteAPIError(Exception):
    pass


def _first_amount(entries: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    if not entries:
        return None
    for entry in entries:
        if isinstance(entry, dict) and entry.get("amount") is not None:
            return entry
    return None


class LiteAPIClient:
    def __init__(self, api_key: str, base: str = "https://api.liteapi.travel/v3.0"):
        if not api_key:
            raise LiteAPIError("LITEAPI_KEY is not configured")
        self.api_key = api_key
        self.base = base.rstrip("/")
        self._client = httpx.Client(
            base_url=self.base,
            headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            timeout=30,
        )

    def _request(self, method: str, path: str, json_body: dict[str, Any] | None = None) -> Any:
        try:
            resp = self._client.request(method, path, json=json_body)
        except httpx.HTTPError as exc:
            raise LiteAPIError(f"liteAPI request failed: {exc}") from exc
        if resp.status_code == 204:
            return {"error": {"code": 2001, "message": "no availability found"}}
        if resp.status_code >= 400:
            raise LiteAPIError(f"liteAPI {resp.status_code}: {resp.text[:300]}")
        if not resp.content:
            return {}
        try:
            return resp.json()
        except ValueError as exc:
            raise LiteAPIError(f"liteAPI returned invalid JSON: {resp.text[:200]}") from exc

    def search_rates(
        self,
        city: str,
        country: str = "US",
        checkin: str = "",
        checkout: str = "",
        adults: int = 2,
        limit: int = 12,
    ) -> list[dict[str, Any]]:
        body: dict[str, Any] = {
            "checkin": checkin,
            "checkout": checkout,
            "currency": "USD",
            "guestNationality": "US",
            "occupancies": [{"rooms": 1, "adults": max(1, min(int(adults), 8))}],
            "limit": max(1, min(int(limit), 50)),
            "maxRatesPerHotel": 1,
            "timeout": 12,
            "roomMapping": True,
        }
        cc = (country or "").strip().upper()
        if len(cc) == 2:
            body["countryCode"] = cc
            body["cityName"] = city
        else:
            body["aiSearch"] = city

        payload = self._request("POST", "/hotels/rates", body)
        hotels_meta = {h.get("id"): h for h in payload.get("hotels", []) if isinstance(h, dict)}
        results: list[dict[str, Any]] = []
        for entry in payload.get("data", []):
            hotel_id = entry.get("hotelId")
            meta = hotels_meta.get(hotel_id, {})
            best: dict[str, Any] | None = None
            for room_type in entry.get("roomTypes", []) or []:
                for rate in room_type.get("rates", []) or []:
                    total = _first_amount((rate.get("retailRate") or {}).get("total"))
                    if not total or total.get("amount") is None:
                        continue
                    if best is None or total["amount"] < best["_amount"]:
                        best = {
                            "_amount": total["amount"],
                            "offer_id": room_type.get("offerId"),
                            "room_name": rate.get("name"),
                            "board": rate.get("boardName"),
                            "refundable": (rate.get("cancellationPolicies") or {}).get("refundableTag"),
                            "total": total["amount"],
                            "currency": total.get("currency", "USD"),
                            "max_occupancy": rate.get("maxOccupancy"),
                        }
            if not best:
                continue
            nights = 2
            try:
                from .context import nights_between

                nights = nights_between(checkin, checkout)
            except Exception:
                nights = 2
            policies = []
            for room_type in entry.get("roomTypes", []) or []:
                for rate in room_type.get("rates", []) or []:
                    for info in ((rate.get("cancellationPolicies") or {}).get("cancelPolicyInfos") or []):
                        if isinstance(info, dict) and info.get("cancelTime"):
                            policies.append(info)
            results.append(
                {
                    "hotel_id": hotel_id,
                    "name": meta.get("name") or hotel_id,
                    "address": meta.get("address") or "",
                    "city": meta.get("city_name") or city,
                    "country": (meta.get("country_code") or cc or "").upper(),
                    "stars": meta.get("stars"),
                    "rating": meta.get("rating"),
                    "review_count": meta.get("review_count"),
                    "photo": meta.get("main_photo") or "",
                    "room_name": best.get("room_name"),
                    "board": best.get("board"),
                    "refundable": best.get("refundable"),
                    "total": best.get("total"),
                    "per_night": round(best.get("total", 0) / max(1, nights), 2),
                    "currency": best.get("currency", "USD"),
                    "nights": nights,
                    "checkin": checkin,
                    "checkout": checkout,
                    "adults": adults,
                    "offer_id": best.get("offer_id"),
                    "max_occupancy": best.get("max_occupancy"),
                    "cancellation": policies[:2],
                }
            )
        results.sort(key=lambda r: r.get("total") or 0)
        return results

    def hotel_details(self, hotel_id: str) -> dict[str, Any] | None:
        payload = self._request("GET", f"/data/hotels?hotelIds={hotel_id}")
        data = payload.get("data") or []
        return data[0] if data else None

    def prebook(self, offer_id: str, adults: int = 2, currency: str = "USD") -> dict[str, Any]:
        body = {
            "offerId": offer_id,
            "occupancies": [{"rooms": 1, "adults": max(1, int(adults))}],
            "currency": currency,
            "guestNationality": "US",
        }
        payload = self._request("POST", "/rates/prebook", body)
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        return data or {}

    def book(
        self,
        prebook_id: str,
        first_name: str,
        last_name: str,
        email: str,
        phone: str = "",
    ) -> dict[str, Any]:
        holder = {"firstName": first_name, "lastName": last_name, "email": email}
        if phone:
            holder["phone"] = phone
        body = {"prebookId": prebook_id, "holder": holder, "payment": {"type": "NUITEE_PAY"}}
        payload = self._request("POST", "/rates/book", body)
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        return data or {}
