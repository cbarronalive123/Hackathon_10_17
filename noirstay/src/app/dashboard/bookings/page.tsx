import BookingsList from "@/components/BookingsList";

export const metadata = { title: "My Bookings" };

export default function BookingsPage() {
  return (
    <div>
      <p className="mb-6 text-sm text-zinc-500">
        Every stay you have booked through NoirStay. Cancel any upcoming booking up to check-in.
      </p>
      <BookingsList />
    </div>
  );
}
