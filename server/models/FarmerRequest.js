import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const farmerRequestSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true },
    workplace_id: { type: String, required: true, trim: true },
    workplace_name: { type: String, trim: true },
    requested_volunteers: { type: Number, default: null },
  },
  baseSchemaOptions,
);

farmerRequestSchema.index({ date: 1 });

const FarmerRequest =
  mongoose.models.FarmerRequest ||
  mongoose.model("FarmerRequest", farmerRequestSchema);

export default FarmerRequest;
