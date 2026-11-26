/**
 * Mark existing minibuses and midibuses as transportation cars.
 * Matches a vehicle name that contains מיניבוס, מידיבוס, minibus, midibus, or medibus.
 * Other vehicles are left unchanged. Safe to run again.
 *
 *   npm run mark:transportation-vehicles
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import Vehicle from "../models/Vehicle.js";

dotenv.config();

const NAME_PATTERN = /מיניבוס|מידיבוס|minibus|midibus|medibus/i;

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const vehicles = await Vehicle.find().sort({ name: 1 });
  const matches = vehicles.filter((vehicle) => NAME_PATTERN.test(vehicle.name || ""));
  let updated = 0;
  let alreadyMarked = 0;

  for (const vehicle of matches) {
    if (vehicle.is_transportation === true) {
      alreadyMarked += 1;
      console.log(`already marked: ${vehicle.name}`);
      continue;
    }
    vehicle.is_transportation = true;
    await vehicle.save();
    updated += 1;
    console.log(`marked: ${vehicle.name}`);
  }

  console.log(
    `Done. Matched: ${matches.length}. Newly marked: ${updated}. Already marked: ${alreadyMarked}.`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
