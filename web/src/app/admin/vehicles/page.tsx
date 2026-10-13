import Link from "next/link";
import { db } from "@/lib/db";
import { inr, VEHICLE_TYPES } from "@/lib/format";

export default async function VehiclesPage() {
  const vehicles = await db.vehicle.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vehicles</h1>
        <Link href="/admin/vehicles/new" className="btn-primary">+ Add vehicle</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Reg. no.</th>
              <th>Seats</th>
              <th>Booking modes</th>
              <th>Rate</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td>
                  <p className="font-semibold">{v.name}</p>
                  <p className="text-xs text-slate-500">{VEHICLE_TYPES[v.type] ?? v.type}</p>
                </td>
                <td className="font-mono">{v.regNumber}</td>
                <td>{v.seats}</td>
                <td className="space-x-1">
                  {v.allowSeatBooking && <span className="badge bg-green-100 text-green-700">Seats</span>}
                  {v.allowRental && <span className="badge bg-blue-100 text-blue-700">Rental</span>}
                </td>
                <td>{inr(v.ratePerKm)}/km</td>
                <td>{v.active ? <span className="badge bg-green-100 text-green-700">Active</span> : <span className="badge bg-slate-200 text-slate-600">Inactive</span>}</td>
                <td>
                  <Link href={`/admin/vehicles/${v.id}`} className="font-semibold text-brand">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
