import Image from "next/image";
import { vehiclePhoto } from "@/lib/media";

/** Vehicle photo uploaded by the office, otherwise a generic stock photo for the vehicle type. */
export default function VehicleImage({
  vehicle,
  className = "",
  sizes = "(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw",
  priority = false,
}: {
  vehicle: { name: string; type: string; imageUrl: string | null };
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {vehicle.imageUrl ? (
        <Image src={vehicle.imageUrl} alt={vehicle.name} fill sizes={sizes} unoptimized className="object-cover" />
      ) : (
        <Image src={vehiclePhoto(vehicle.type, vehicle.name)} alt={vehicle.name} fill sizes={sizes} priority={priority} className="object-cover" />
      )}
    </div>
  );
}
