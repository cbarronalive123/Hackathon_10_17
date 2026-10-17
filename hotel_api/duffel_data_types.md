# Duffel Stays API — Input & Output Data Types

API: **Duffel Stays** (`https://api.duffel.com`, API version `v2`, free test mode)
Docs: https://duffel.com/docs/guides/getting-started-with-stays
Auth: `Authorization: Bearer <test_access_token>` + header `Duffel-Version: v2`
Test token: Duffel dashboard -> More -> Developers -> Access tokens (create test token)
Test hotels: search coordinates `latitude: -24.38, longitude: -128.32` always return results in test mode.

Booking flow: **search -> fetch rates -> quote -> booking**

---

## 1. POST /stays/search — INPUT (request body, wrapped in `{"data": {...}}`)

| Field | Type | Required | Description |
|---|---|---|---|
| `rooms` | integer | yes | Number of rooms required. Example: `1` |
| `guests` | array of object | yes | List of guests travelling |
| `guests[].type` | string | yes | `"adult"` or `"child"` |
| `guests[].age` | integer | for children | Age of child guest |
| `check_in_date` | string (ISO 8601 date) | yes | Check-in date, max 330 days in future. Example: `"2026-11-16"` |
| `check_out_date` | string (ISO 8601 date) | yes | Check-out date, stay up to 99 nights |
| `location` | object | one of location/accommodation | Area search descriptor |
| `location.radius` | number | with location | Search radius in kilometres. Example: `2` |
| `location.geographic_coordinates.latitude` | number | with location | Example: `-24.38` |
| `location.geographic_coordinates.longitude` | number | with location | Example: `-128.32` |
| `accommodation` | object | one of location/accommodation | Search by specific accommodation |
| `accommodation.id` | string | with accommodation | Accommodation ID (`acc_...`) |
| `accommodation.fetch_rates` | boolean | no | Whether to include rates when searching by accommodation |
| `free_cancellation_only` | boolean | no | Only return rates with free cancellation |
| `instant_payment` | boolean | no | `true` = only pay-now rates; `false` = only pay-at-accommodation |
| `mobile` | boolean | no | Marks search as from mobile device (affects rates/content) |
| `negotiated_rate_ids` | array of string | no | Negotiated rate IDs (`nre_...`) to include |

## 2. POST /stays/search — OUTPUT (response `{"data": {...}}`)

### Top level

| Field | Type | Description |
|---|---|---|
| `data.created_at` | string (ISO 8601 datetime) | When the search was requested. Example: `"2022-12-20T15:21:01Z"` |
| `data.results` | array of Search Result | One per available accommodation |

### `results[]` (Search Result)

| Field | Type | Description |
|---|---|---|
| `id` | string | Search result ID (`srr_...`) — used to fetch all rates |
| `rooms` | integer | Number of rooms requested |
| `guests` | array of object | Guest list echoed (`type`, `age`) |
| `check_in_date` | string (date) | Check-in date |
| `check_out_date` | string (date) | Check-out date |
| `expires_at` | string (datetime) | When the search result expires |
| `cheapest_rate_total_amount` | string (decimal) | Cheapest total price, always present. Example: `"799.00"` |
| `cheapest_rate_currency` | string | ISO 4217 currency for total amount |
| `cheapest_rate_base_amount` | string (decimal, nullable) | Base (pre-tax/fee) amount |
| `cheapest_rate_base_currency` | string | Currency for base amount |
| `cheapest_rate_public_amount` | string (decimal, nullable) | Public (compare-at) price |
| `cheapest_rate_public_currency` | string | Currency for public amount |
| `cheapest_rate_due_at_accommodation_amount` | string (decimal, nullable) | Amount due at the hotel |
| `cheapest_rate_due_at_accommodation_currency` | string | Currency for due-at-accommodation amount |
| `supported_negotiated_rates` | array of object | `id`, `display_name` — negotiated rates applied |
| `accommodation` | object | Full accommodation record (below) |

### `accommodation` object

| Field | Type | Description |
|---|---|---|
| `id` | string | Accommodation ID (`acc_...`) |
| `name` | string | Hotel name. Example: `"Duffel Test Hotel"` |
| `description` | string | Property description text |
| `rating` | integer | Star rating (0–5) |
| `review_score` | number | Guest review score (e.g. `8.8`) |
| `review_count` | integer | Number of guest reviews |
| `phone_number` | string | Contact phone |
| `email` | string | Contact email |
| `photos[].url` | string | Photo URLs |
| `amenities[].type` | string | e.g. `"parking"` |
| `amenities[].description` | string | Amenity description |
| `location.geographic_coordinates.latitude` | number | Latitude |
| `location.geographic_coordinates.longitude` | number | Longitude |
| `location.address.line_one` | string | Street address |
| `location.address.city_name` | string | City |
| `location.address.region` | string | Region/state |
| `location.address.postal_code` | string | Postal code |
| `location.address.country_code` | string | ISO 2-letter country |
| `chain.id` / `chain.name` | string | Hotel chain (e.g. `"Accor Hotels"`, `chn_...`) |
| `brand.id` / `brand.name` | string | Brand (`bra_...`) |
| `check_in_information.check_in_after_time` | string | e.g. `"14:30"` |
| `check_in_information.check_in_before_time` | string | e.g. `"00:00"` |
| `check_in_information.check_out_before_time` | string | e.g. `"11:30"` |
| `key_collection.instructions` | string | Key collection instructions |
| `payment_instruction_supported` | boolean | Supports booking payment instructions |
| `supported_loyalty_programme` | string | Loyalty programme slug |
| `rooms` | array of Room | Room + rate records (below) |

### `accommodation.rooms[]`

| Field | Type | Description |
|---|---|---|
| `name` | string | Room name. Example: `"Double Suite"` |
| `photos[].url` | string | Room photo URLs |
| `beds[].type` | string | Bed type. Example: `"king"` |
| `beds[].count` | integer | Number of such beds |
| `rates` | array of Rate | Rates for this room (below) |

### `rooms[].rates[]` (most detailed when fetched via fetch_all_rates)

| Field | Type | Description |
|---|---|---|
| `id` | string | Rate ID (`rat_...`) — used to request a quote |
| `name` | string | Rate name. Example: `"Best Available Rate"` |
| `description` | string | Rate description (inclusions etc.) |
| `code` | string | Rate code |
| `total_amount` | string (decimal) | Total price. Example: `"799.00"` |
| `total_currency` | string | ISO 4217 currency |
| `base_amount` / `base_currency` | string | Base price before taxes/fees |
| `tax_amount` / `tax_currency` | string | Tax portion |
| `fee_amount` / `fee_currency` | string | Fee portion |
| `public_amount` / `public_currency` | string | Public (compare-at) price |
| `due_at_accommodation_amount` / `_currency` | string | Portion paid at the hotel |
| `estimated_commission_amount` / `_currency` | string | Estimated commission earned |
| `payment_type` | string | `"pay_now"` or `"pay_at_accommodation"` |
| `available_payment_methods` | array of array of string | e.g. `[["balance"], ["card"]]` |
| `board_type` | string | e.g. `"room_only"`, `"breakfast_included"` |
| `benefits[].type` | string | e.g. `"breakfast_included"` |
| `benefits[].title` | string | e.g. `"Daily breakfast"` |
| `benefits[].description` | string | Benefit detail |
| `deal_types[]` | array of string | e.g. `["closed_user_group", "corporate", "mobile"]` |
| `quantity_available` | integer | Rooms left at this rate |
| `expires_at` | string (datetime) | When the rate expires |
| `cancellation_timeline[].before` | string (datetime) | Deadline for this refund step |
| `cancellation_timeline[].refund_amount` | string (decimal) | Refund if cancelled before deadline |
| `cancellation_timeline[].currency` | string | Currency of refund |
| `conditions[].title` | string | e.g. `"Parking"` |
| `conditions[].description` | string | Condition detail |
| `supported_loyalty_programme` | string | Loyalty programme on this rate |
| `loyalty_programme_required` | boolean | Membership required to book |
| `negotiated_rate_id` | string | Negotiated rate applied |

---

## 3. POST /stays/search_results/{search_result_id}/actions/fetch_all_rates

INPUT: URL parameter `search_result_id` (string, `srr_...`), empty body.
OUTPUT: single Search Result object (same shape as `results[]` above, with complete room/rate data).

## 4. POST /stays/quotes — request a quote

INPUT: `rate_id` (string, `rat_...`).
OUTPUT: `quote_id` (string, `qte_...`), updated pricing, availability confirmation.

## 5. POST /stays/bookings — create a booking

INPUT:

| Field | Type | Required | Description |
|---|---|---|---|
| `quote_id` | string | yes | Quote from previous step |
| `phone_number` | string | yes | Guest phone (E.164) |
| `email` | string | yes | Guest email |
| `guests[].given_name` | string | yes | Guest first name |
| `guests[].family_name` | string | yes | Guest last name |
| `guests[].born_on` | string (date) | yes | Guest date of birth |
| `accommodation_special_requests` | string | no | e.g. early check-in |

OUTPUT: full booking record — `id` (`stb_...`), status, accommodation details, rooms/rates booked, total price, cancellation policy, `key_collection` instructions, loyalty details, payment instructions.

---

## Common data type notes

- All money values are **strings with decimal notation** (e.g. `"799.00"`), paired with a separate ISO 4217 currency string field — not floats.
- All dates are ISO 8601 (`YYYY-MM-DD`); timestamps are ISO 8601 datetime with `Z` timezone.
- IDs are prefixed strings: search result `srr_...`, accommodation `acc_...`, rate `rat_...`, quote `qte_...`, booking `stb_...`, chain `chn_...`, brand `bra_...`, negotiated rate `nre_...`.
- Every request body is wrapped in a top-level `data` object; responses likewise return `{"data": {...}}`.
