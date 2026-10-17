export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "customer" | "admin";
  created_at: string;
}

export interface Hotel {
  id: number;
  name: string;
  city: string;
  country: string;
  address: string;
  description: string;
  star_rating: number;
  guest_rating: number;
  reviews_count: number;
  price_per_night: number;
  image_url: string;
  amenities: string[];
  provider: string;
  featured: boolean;
  created_at: string;
}

export interface Booking {
  id: number;
  user_id: number;
  hotel_id: number;
  room_type: string;
  check_in: string;
  check_out: string;
  guests: number;
  rooms: number;
  nights: number;
  total_price: number;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  created_at: string;
  hotel_name?: string;
  hotel_city?: string;
  hotel_country?: string;
  hotel_image?: string;
  user_name?: string;
  user_email?: string;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: "customer" | "admin";
}
