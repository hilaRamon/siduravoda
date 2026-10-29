import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const workplaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contact_phone: { type: String, trim: true },
    contact_person: { type: String, trim: true },
    farm_id: { type: String, trim: true, ref: "Farm" },
    notes: { type: String },
  },
  baseSchemaOptions,
);

const Workplace =
  mongoose.models.Workplace || mongoose.model("Workplace", workplaceSchema);

export default Workplace;
