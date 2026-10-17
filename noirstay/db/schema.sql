-- NoirStay schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  phone         TEXT,
  role          TEXT        NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotels (
  id             SERIAL PRIMARY KEY,
  name           TEXT         NOT NULL,
  city           TEXT         NOT NULL,
  country        TEXT         NOT NULL,
  address        TEXT         NOT NULL DEFAULT '',
  description    TEXT         NOT NULL DEFAULT '',
  star_rating    INT          NOT NULL DEFAULT 3 CHECK (star_rating BETWEEN 1 AND 5),
  guest_rating   NUMERIC(2,1) NOT NULL DEFAULT 8.0 CHECK (guest_rating BETWEEN 0 AND 10),
  reviews_count  INT          NOT NULL DEFAULT 0,
  price_per_night NUMERIC(10,2) NOT NULL CHECK (price_per_night > 0),
  image_url      TEXT         NOT NULL DEFAULT '',
  amenities      TEXT[]       NOT NULL DEFAULT '{}',
  provider       TEXT         NOT NULL DEFAULT 'NoirStay Direct',
  provider_hotel_id TEXT      UNIQUE,
  featured       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id          SERIAL PRIMARY KEY,
  user_id     INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hotel_id    INT  NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_type   TEXT NOT NULL DEFAULT 'Standard King',
  check_in    DATE NOT NULL,
  check_out   DATE NOT NULL,
  guests      INT  NOT NULL DEFAULT 1,
  rooms       INT  NOT NULL DEFAULT 1,
  nights      INT  NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         SERIAL PRIMARY KEY,
  session_id TEXT        NOT NULL,
  user_id    INT          REFERENCES users(id) ON DELETE SET NULL,
  role       TEXT         NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT         NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user   ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_hotel  ON bookings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_chat_session    ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_hotels_city     ON hotels(city);
