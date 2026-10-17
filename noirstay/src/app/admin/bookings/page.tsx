import AdminBookings from "@/components/AdminBookings";

export const metadata = { title: "Manage Bookings" };

export default function AdminBookingsPage() {
  return (
    <div>
      <p className="mb-6 text-sm text-zinc-500">
        Every reservation across the platform. Update statuses or remove records.
      </p>
      <AdminBookings />
    </div>
  );
}
