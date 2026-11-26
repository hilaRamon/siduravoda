import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const transportationSummarySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true },
    vehicle_id: { type: String, required: true, trim: true, ref: "Vehicle" },
    source: {
      type: String,
      required: true,
      enum: ["logistics", "manual"],
    },
    assembly: { type: String, default: "טצ" },
    destination: { type: String, default: "" },
    departure_time: { type: String, required: true, trim: true },
    return_time: { type: String, default: "12:00" },
  },
  baseSchemaOptions,
);

transportationSummarySchema.index(
  { date: 1, vehicle_id: 1, departure_time: 1 },
  { unique: true },
);

const TransportationSummary =
  mongoose.models.TransportationSummary ||
  mongoose.model("TransportationSummary", transportationSummarySchema);

export default TransportationSummary;
