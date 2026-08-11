import mongoose from "mongoose";
import { baseSchemaOptions } from "./schemaOptions.js";

const rememberTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    selector: {
      type: String,
      required: true,
      unique: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  baseSchemaOptions,
);

// Auto-remove expired tokens
rememberTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RememberToken =
  mongoose.models.RememberToken ||
  mongoose.model("RememberToken", rememberTokenSchema);

export default RememberToken;
