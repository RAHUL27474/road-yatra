import { z } from "zod";

export const phoneSchema = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

export const rentalSchema = z.object({
  rentalType: z.enum(["ONE_WAY", "ROUND_TRIP", "LOCAL", "AIRPORT"]),
  pickupCity: z.string().trim().min(1, "Choose a pickup city"),
  dropCity: z.string().trim().optional(),
  startAt: z.coerce.date(),
  returnAt: z.coerce.date().optional(),
});

const common = {
  passengerName: z.string().trim().min(2, "Enter passenger name"),
  passengerPhone: phoneSchema,
  payment: z.enum(["ONLINE", "CASH", "ADVANCE"]).default("ONLINE"),
};

export const seatBookingSchema = z.object({
  kind: z.literal("SEAT"),
  tripId: z.string().min(1),
  seatNos: z.array(z.number().int().positive()).min(1, "Select at least one seat").max(10, "Max 10 seats per booking"),
  pickupStopId: z.string().optional(),
  dropStopId: z.string().optional(),
  /** A different traveller per seat: their own ticket on WhatsApp, and the women's seat rule. */
  seatPassengers: z
    .array(
      z.object({
        seatNo: z.number().int().positive(),
        name: z.string().trim().max(80).optional(),
        phone: z.union([z.literal(""), phoneSchema]).optional(),
        female: z.boolean().optional(),
      }),
    )
    .max(10)
    .optional(),
  ...common,
});

export const rentalBookingSchema = rentalSchema.extend({
  kind: z.literal("RENTAL"),
  vehicleId: z.string().min(1),
  pickupAddress: z.string().trim().min(5, "Enter the full pickup address"),
  dropAddress: z.string().trim().optional(),
  passengers: z.number().int().min(1).max(60),
  ...common,
});

export const createBookingSchema = z.discriminatedUnion("kind", [seatBookingSchema, rentalBookingSchema]);
