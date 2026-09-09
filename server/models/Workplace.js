import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const workplaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    farm_name: { type: String },
    address: { type: String },
    company_id: { type: String },
    contact_phone: { type: String },
    accounting_phone: { type: String },
    accounting_email: { type: String },
    has_agreement: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

const Workplace =
  mongoose.models.Workplace || mongoose.model("Workplace", workplaceSchema);

export default Workplace;
