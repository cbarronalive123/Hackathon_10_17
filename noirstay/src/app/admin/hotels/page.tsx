import HotelManager from "@/components/HotelManager";

export const metadata = { title: "Manage Hotels" };

export default function AdminHotelsPage() {
  return (
    <div>
      <p className="mb-6 text-sm text-zinc-500">
        The aggregated catalog. Add, edit, or remove any hotel listed across NoirStay.
      </p>
      <HotelManager />
    </div>
  );
}
