/**
 * Move workplaces whose names start with תת from משק ללא חיוב to משק לא עובד.
 *
 * Uses MONGODB_URI. Writes only when the same command sets CONFIRM_SPLIT=yes:
 *
 *   CONFIRM_SPLIT=yes node server/scripts/split-not-working-farm.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import Farm from "../models/Farm.js";
import Workplace from "../models/Workplace.js";

dotenv.config();

const SOURCE_FARM = "ללא חיוב";
const TARGET_FARM = "לא עובד";
const NAME_PREFIX = "תת";

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const source = await Farm.findOne({ name: SOURCE_FARM }).select("_id name").lean();
  if (!source) {
    console.error(`Farm "${SOURCE_FARM}" was not found`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const workplaces = await Workplace.find({ farm_id: source._id.toString() })
    .select("name")
    .sort({ name: 1 })
    .lean();
  const moving = workplaces.filter((workplace) =>
    String(workplace.name || "").startsWith(NAME_PREFIX),
  );

  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Workplaces starting with ${NAME_PREFIX}: ${moving.length}`);
  for (const workplace of moving) {
    console.log(`  ${workplace.name}`);
  }

  if (process.env.CONFIRM_SPLIT !== "yes") {
    console.error("Refusing to write. Run with CONFIRM_SPLIT=yes");
    await mongoose.disconnect();
    process.exit(1);
  }

  let target = await Farm.findOne({ name: TARGET_FARM }).select("_id name");
  if (!target) {
    target = await Farm.create({ name: TARGET_FARM });
    console.log(`Created farm ${TARGET_FARM}: ${target._id.toString()}`);
  } else {
    console.log(`Farm ${TARGET_FARM} already exists: ${target._id.toString()}`);
  }

  if (moving.length > 0) {
    await Workplace.updateMany(
      { _id: { $in: moving.map((workplace) => workplace._id) } },
      { $set: { farm_id: target._id.toString() } },
    );
  }

  console.log(`Moved ${moving.length} workplace(s) to ${target._id.toString()}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
