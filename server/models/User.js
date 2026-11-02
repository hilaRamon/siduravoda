import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    password_hash: { type: String, required: true, select: false },
    full_name: { type: String, trim: true, default: "" },
    role: {
      type: String,
      enum: ["admin", "user", "workplace_manager", "reporter"],
      required: true,
      default: "user",
    },
    is_active: { type: Boolean, default: true },
  },
  baseSchemaOptions,
);

userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
