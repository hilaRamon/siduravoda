/**
 * Create transportation summary rows for logistics that already exist.
 * Inserts a row only when one is missing. Safe to run again.
 *
 * Run after marking the vehicles that should be included:
 *   npm run backfill:transportation-summaries
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { backfillTransportationSummaries } from "../services/transportationSummaryService.js";

dotenv.config();

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const result = await backfillTransportationSummaries();
  console.log(
    `Done. Logistics rows: ${result.logistics}. Inserted: ${result.inserted}. Skipped: ${result.skipped}.`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
