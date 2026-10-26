import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const farmSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company_id: { type: String, trim: true },
    address: { type: String, trim: true },
    accounting_phone: { type: String, trim: true },
    accounting_email: { type: String, trim: true },
    has_agreement: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

const Farm = mongoose.models.Farm || mongoose.model("Farm", farmSchema);

export default Farm;
