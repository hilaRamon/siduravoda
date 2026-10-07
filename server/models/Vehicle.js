import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const vehicleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    license_plate: { type: String, trim: true },
    insurance: { type: String },
    notes: { type: String },
  },
  baseSchemaOptions,
);

const Vehicle =
  mongoose.models.Vehicle || mongoose.model("Vehicle", vehicleSchema);

export default Vehicle;
