import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const assignmentSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    student_id: { type: String, required: true },
    student_name: { type: String },
    workplace_id: { type: String, required: true },
    workplace_name: { type: String },
    role: { type: String },
    rate: { type: Number, default: 40 },
    hours: { type: Number, default: 4.5 },
    bonus: { type: Number },
    notes: { type: String },
  },
  baseSchemaOptions,
);

assignmentSchema.index({ date: 1, student_id: 1 });

const Assignment =
  mongoose.models.Assignment || mongoose.model("Assignment", assignmentSchema);

export default Assignment;
