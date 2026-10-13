const EMOJI: Record<string, string> = { SEDAN: "🚗", ERTIGA: "🚙", SUV: "🚙", INNOVA_CRYSTA: "🚙", TEMPO_TRAVELLER: "🚐", BUS: "🚌" };

/** Vehicle photo if one was uploaded, otherwise an emoji placeholder. */
export default function VehicleImage({ vehicle, className = "" }: { vehicle: { name: string; type: string; imageUrl: string | null }; className?: string }) {
  return (
    <div className={`grid place-items-center overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 ${className}`}>
      {vehicle.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vehicle.imageUrl} alt={vehicle.name} className="h-full w-full object-cover" />
      ) : (
        <span>{EMOJI[vehicle.type] ?? "🚐"}</span>
      )}
    </div>
  );
}
