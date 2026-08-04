import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const STATUS = ["ממתין", "אושר", "נדחה"];
const SOURCE = ["sms", "manual"];

const absenceRequestSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true, default: null },
    student_id: { type: String, trim: true, default: null },
    submitted_name: { type: String, trim: true },
    reason: { type: String, trim: true },
    status: {
      type: String,
      enum: STATUS,
      default: "ממתין",
    },
    source: {
      type: String,
      enum: SOURCE,
      default: "manual",
    },
    phone: { type: String, trim: true },
    dest: { type: String, trim: true },
    message: { type: String },
    sms_date: { type: String, trim: true },
    notes: { type: String },
  },
  baseSchemaOptions,
);

absenceRequestSchema.index({ date: 1, status: 1 });
absenceRequestSchema.index({ status: 1, created_date: -1 });

const AbsenceRequest =
  mongoose.models.AbsenceRequest ||
  mongoose.model("AbsenceRequest", absenceRequestSchema);

export default AbsenceRequest;
export { STATUS as ABSENCE_STATUSES, SOURCE as ABSENCE_SOURCES };
