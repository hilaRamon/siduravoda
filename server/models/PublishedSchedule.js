import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const publishedScheduleSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    file_url: { type: String, required: true },
    snapshot: { type: Object },
  },
  baseSchemaOptions,
);

publishedScheduleSchema.index({ date: 1 }, { unique: true });

const PublishedSchedule =
  mongoose.models.PublishedSchedule ||
  mongoose.model("PublishedSchedule", publishedScheduleSchema);

export default PublishedSchedule;
