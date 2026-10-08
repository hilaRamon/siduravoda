import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const timeReportSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    student_id: { type: String, required: true },
    student_name: { type: String },
    workplace_id: { type: String, required: true },
    workplace_name: { type: String },
    start_time: { type: String },
    end_time: { type: String },
    status: {
      type: String,
      enum: ["ממתין", "אושר", "נדחה"],
      default: "ממתין",
    },
    notes: { type: String },
  },
  baseSchemaOptions,
);

timeReportSchema.index({ date: 1, student_id: 1 });

const TimeReport =
  mongoose.models.TimeReport || mongoose.model("TimeReport", timeReportSchema);

export default TimeReport;
