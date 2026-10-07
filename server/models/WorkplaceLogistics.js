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
    is_piecework: { type: Boolean, default: false },
    units_name: { type: String },
    units: { type: Number },
    rate: { type: Number },
  },
  baseSchemaOptions,
);

workplaceLogisticsSchema.index({ date: 1, workplace_id: 1 }, { unique: true });

const WorkplaceLogistics =
  mongoose.models.WorkplaceLogistics ||
  mongoose.model("WorkplaceLogistics", workplaceLogisticsSchema);

export default WorkplaceLogistics;
