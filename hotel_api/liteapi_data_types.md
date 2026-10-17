# Nuitée Connect (liteAPI) — Input & Output Data Types

API: **Nuitée Connect / liteAPI v3.0** (`https://api.liteapi.travel/v3.0`, free sandbox)
Docs: https://docs.liteapi.travel/
Auth: `X-API-Key` header with sandbox key (`sand_...`) from the dashboard (Developer -> API Keys)
Sandbox: 5 requests/second; mirrors production; no credit card required.
Status: **TESTED 2026-10-17 — working, returns live rates** (see `tests/responses/`)

Tested endpoints:
- `GET /data/countries` -> 200, 249 countries
- `GET /data/hotels?countryCode=US&cityName=New York` -> 200, hotels list
- `POST /hotels/rates` (New York, 2 adults) -> 200, 10 hotels with live USD rates, `sandbox: true`

Booking flow: **rates search -> prebook -> book** (payment simulated in sandbox)

---

## 1. POST /hotels/rates — INPUT (request body, JSON)

Required: `occupancies`, `currency`, `guestNationality`, `checkin`, `checkout` + one "main query"
(`hotelIds`, `countryCode`+`cityName`, `latitude`/`longitude`+`radius`, `placeId`, `iataCode`, or `aiSearch`).

### Core search fields

| Field | Type | Required | Description |
|---|---|---|---|
| `checkin` | string (YYYY-MM-DD) | yes | Check-in date (ISO 8601) |
| `checkout` | string (YYYY-MM-DD) | yes | Check-out date (ISO 8601) |
| `currency` | string | yes | Display currency, e.g. `"USD"` |
| `guestNationality` | string | yes | ISO 2-letter country code, e.g. `"US"` |
| `occupancies` | array of object | yes | Guests per room |
| `occupancies[].rooms` | integer | no | Rooms for this occupancy |
| `occupancies[].adults` | integer | yes | Adults per room |
| `occupancies[].children` | array of integer | no | Ages of children |

### Main query options (pick one)

| Field | Type | Description |
|---|---|---|
| `hotelIds` | array of string | Hotel IDs from `/data/hotels` (e.g. `["lp1897"]`) |
| `countryCode` + `cityName` | string + string | Country (ISO 2-letter) + city search |
| `latitude` + `longitude` + `radius` | number + number + integer | Geo search, radius in meters |
| `placeId` | string | Google Place ID |
| `iataCode` | string | Airport code, e.g. `"LAX"` |
| `aiSearch` | string | Natural-language search, e.g. "Romantic getaway near London Eye" |

### Filters, sorting, pagination (optional)

| Field | Type | Description |
|---|---|---|
| `timeout` | integer | Seconds before live rate request cuts off (recommend 6-12) |
| `limit` | integer | Max results (default 200, max 5000) |
| `offset` | integer | Pagination offset |
| `maxRatesPerHotel` | integer | Rates per hotel, cheapest first (1 = listing pages) |
| `sort[].field` | string enum | `top_picks` / `price` / `revenue` |
| `sort[].direction` | string enum | `ascending` / `descending` |
| `boardType` | string | Meal plan filter: RO, BI, HB, FB, AI, DI, LI, BDI, BLI, LDI (comma-sep) |
| `refundableRatesOnly` | boolean | Only refundable (RFN) rates |
| `bedTypes` | array of string | e.g. `["double","twin","king","queen","single"]` |
| `starRating` | array of number | Star ratings to include |
| `minRating` | number | Min guest rating 0-5 |
| `minReviewsCount` | integer | Min review count |
| `facilities` | array of number | Facility IDs (OR by default) |
| `strictFacilityFiltering` | boolean | Require ALL facilities |
| `hotelTypeIds` | array of number | Hotel type IDs |
| `chainIds` | array of number | Hotel chain IDs |
| `hotelName` | string | Case-insensitive hotel name search |
| `zip` | string | Zip code filter |
| `roomAmenities` | array of number | Room amenity filter (legacy) |
| `roomAmenitiesFilter` | string | Grouped filter: `-` OR within group, `,` AND across groups |
| `amenityFilterLogic` | string enum | `AND` / `OR` for `roomAmenities` |
| `refundableRatesOnly` | boolean | Refundable rates only |

### Behavior flags (optional)

| Field | Type | Description |
|---|---|---|
| `roomMapping` | boolean | Include `mappedRoomId` per rate (links to room images/details) |
| `includeHotelData` | boolean | Include hotel info even for hotelIds searches |
| `stream` | boolean | SSE streaming of results |
| `advancedAccessibilityOnly` | boolean | Only accessible hotels |
| `margin` | number | Per-request markup % override |
| `sessionId` | string | Price-consistency session ID |
| `feed` | string | Feed selection (multi-feed accounts) |
| `loyaltyProgram` | string | e.g. `"HH"` (Hilton Honors) |
| `loyaltyProgramDetails[].programId` | string | Loyalty program ID |
| `loyaltyProgramDetails[].membershipId` | string | Guest membership number |

## 2. POST /hotels/rates — OUTPUT (response, JSON)

### Top level

| Field | Type | Description | Verified |
|---|---|---|---|
| `data` | array of object | Rate results per hotel | ✔ (10 items) |
| `sandbox` | boolean | True when using sandbox key | ✔ (`true`) |
| `hotels` | array of object | Hotel metadata for the results | ✔ (10 items) |
| `guestLevel` | integer | Loyalty guest level | — |

### `data[]` (per hotel)

| Field | Type | Description | Verified |
|---|---|---|---|
| `hotelId` | string | Hotel ID (`lp...`) | ✔ |
| `roomTypes` | array of object | Offers for this hotel | ✔ |
| `et` | (undocumented) | Internal timing field | ✔ present |

### `data[].roomTypes[]` (an offer = bookable combination of rooms)

| Field | Type | Description | Verified |
|---|---|---|---|
| `roomTypeId` | string | Room type identifier | ✔ |
| `offerId` | string | Offer ID — used for prebook (long string) | ✔ |
| `supplier` | string | Inventory supplier (default "Nuitee") | ✔ |
| `supplierId` | integer | Supplier ID (Nuitee = 2) | ✔ |
| `rates` | array of object | One rate per requested occupancy | ✔ |
| `offerRetailRate` | array of `{amount: number, currency: string}` | Total price of whole offer | ✔ |
| `offerInitialPrice` | array of `{amount, currency}` | Offer price before discounts | ✔ |
| `suggestedSellingPrice` | array of `{amount, currency, source}` | Min public selling price | ✔ (`source: "providerDirect"`) |
| `priceType` | string | e.g. `"commission"` | ✔ |
| `rateType` | string | `standard` / `package` | ✔ |
| `paymentTypes` | array of string | e.g. `["NUITEE_PAY"]` | ✔ |
| `paymentSchedule` | string enum | `now` / `later` | ✔ |
| `loyaltyMembershipIdRequired` | boolean | Membership needed to book | — |

### `roomTypes[].rates[]` (per-room rate detail)

| Field | Type | Description | Verified |
|---|---|---|---|
| `rateId` | string | Rate identifier (used with offer for prebook) | ✔ |
| `occupancyNumber` | integer | Which room in multi-room booking | ✔ |
| `name` | string | Room/rate name, e.g. `"King Room with Roll-in Shower - Mobility Accessible"` | ✔ |
| `maxOccupancy` | integer | Max guests in room | ✔ |
| `adultCount` / `childCount` | integer | Guest counts | ✔ |
| `childrenAges` | array of integer | Child ages | ✔ |
| `boardType` | string | Meal plan code (e.g. `RO`, `BI`) | ✔ |
| `boardName` | string | Meal plan name | ✔ |
| `remarks` | string | Special remarks | ✔ |
| `priceType` | string | e.g. `"commission"` | ✔ |
| `providerCommission` | (undocumented) number | Provider commission | ✔ present |
| `mappedRoomId` | string | Mapped room (with `roomMapping: true`) | ✔ |
| `commission` | array of `{amount: number, currency: string}` | Commission included in price | ✔ |
| `paymentTypes` | array of string | Payment options for this rate | ✔ |
| `perks` | array of `{perkId: int, name: str, amount: num, currency: str, level: str}` | Perks (breakfast, upgrades...) | ✔ (empty in test) |
| `promotions` | array of `{name, from, to, discount, discountType, promotionCode, currency}` | Promotions on this rate | ✔ present |

### `rates[].retailRate` (pricing block)

| Field | Type | Description | Verified |
|---|---|---|---|
| `total` | array of `{amount: number, currency: string}` | Total price to pay | ✔ (e.g. `500.29 USD`) |
| `initialPrice` | array of `{amount, currency}` | Standard listed price (>= total; higher = discount) | ✔ |
| `suggestedSellingPrice` | array of `{amount, currency, source}` | Min public selling price | ✔ |
| `taxesAndFees` | array of `{included: boolean, description: string, amount: number, currency: string}` | Tax/fee breakdown | ✔ (e.g. TAX 73.79 included) |
| `promotions` | array of object | Early-booking deals, seasonal discounts | — |

### `rates[].cancellationPolicies`

| Field | Type | Description | Verified |
|---|---|---|---|
| `cancelPolicyInfos[].cancelTime` | string (ISO datetime) | Deadline before penalty applies | ✔ (e.g. `2026-12-14 04:00:00`) |
| `cancelPolicyInfos[].amount` | number | Penalty after deadline (0 = fully refundable) | ✔ (e.g. `265.6`) |
| `cancelPolicyInfos[].currency` | string | Penalty currency | ✔ (`USD`) |
| `cancelPolicyInfos[].type` | string | e.g. `"amount"` | ✔ |
| `cancelPolicyInfos[].timezone` | string | Always GMT | ✔ |
| `hotelRemarks` | array | Hotel cancellation remarks | ✔ (empty) |
| `refundableTag` | string | `RFN` (refundable) / `NRFN` (non-refundable) | ✔ (`RFN`) |

### `hotels[]` (hotel metadata)

| Field | Type | Description | Verified |
|---|---|---|---|
| `id` | string | Hotel ID (`lp...`) | ✔ |
| `name` | string | Hotel name | ✔ |
| `main_photo` | string | Main photo URL | ✔ |
| `thumbnail` | string | Thumbnail URL | ✔ |
| `address` | string | Street address | ✔ |
| `city_name` | string | City | ✔ |
| `country_code` | string | ISO 2-letter | ✔ |
| `latitude` / `longitude` | number | Coordinates | ✔ |
| `rating` | number | Guest rating | ✔ |
| `stars` | number | Star rating | ✔ |
| `review_count` | integer | Number of reviews | ✔ |
| `tags` | array of string | Descriptive tags | — |
| `persona` / `style` / `location_type` / `story` | string | Classification fields | — |

## 3. Other tested/related endpoints

| Endpoint | Method | Input | Output |
|---|---|---|---|
| `/data/countries` | GET | — | `{code, name}[]` (249 countries) |
| `/data/hotels` | GET | `countryCode`, `cityName`, `limit`, `offset` | `hotels[]` (same shape as above) |
| `/data/hotels/{hotelId}` | GET | hotel ID in path | Full hotel details (description, amenities, photos) |
| `/rates/prebook` | POST | `offerId`, occupancies, currency | `prebookId`, final pricing, cancellation terms |
| `/rates/book` | POST | `prebookId`, holder info, payment (simulated in sandbox) | `bookingId`, confirmation, voucher URL |

## Data type notes

- Prices are **JSON numbers** with a paired currency string (e.g. `amount: 500.29, currency: "USD"`) — unlike Duffel which uses strings.
- Dates are `YYYY-MM-DD`; datetimes are ISO-ish strings with GMT timezone.
- Hotel IDs look like `lp...`; offer IDs are long opaque strings; booking references look like `BK-XXXX...`.
- Error shape: HTTP 400 -> `{error: {code: int, description: str, message: str}}`; HTTP 204 -> `{error: {code: 2001, message: "no availability found"}}`.
- Real responses may include extra undocumented fields (`et`, `providerCommission`, rate-level `promotions`) — code defensively.
