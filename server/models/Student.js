import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const studentSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    cohort: { type: String, trim: true },
    free_day: {
      type: [{ type: String, enum: ["א", "ב", "ג", "ד", "ה"] }],
      default: null,
    },
    distance_status: {
      type: String,
      enum: ["קרוב", "רחוק", "אאא- לפני שיבוץ", "תתת - לא עובד", null],
    },
    is_active: { type: Boolean, default: true },
    forbidden_workplaces: [{ type: String }],
    notes: { type: String },
  },
  baseSchemaOptions,
);

const Student =
  mongoose.models.Student || mongoose.model("Student", studentSchema);

export default Student;
