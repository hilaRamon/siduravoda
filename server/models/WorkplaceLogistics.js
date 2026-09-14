import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const workplaceLogisticsSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true },
    workplace_id: { type: String, required: true, trim: true, ref: "Workplace" },
    driver_student_id: { type: String, ref: "Student" },
    vehicle_id: { type: String, ref: "Vehicle" },
    vehicle_id_2: { type: String, ref: "Vehicle" },
    vehicle_id_3: { type: String, ref: "Vehicle" },
    exit_time: { type: String },
    notes: { type: String },
  },
  baseSchemaOptions,
);

workplaceLogisticsSchema.index({ date: 1, workplace_id: 1 });

const WorkplaceLogistics =
  mongoose.models.WorkplaceLogistics ||
  mongoose.model("WorkplaceLogistics", workplaceLogisticsSchema);

export default WorkplaceLogistics;
