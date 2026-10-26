/**
 * Move farm_name and farm accounting fields off Workplace onto Farm.
 *
 *   npm run migrate:farms
 *
 * Refuses any database other than dev-db.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { migrateFarms } from "../lib/migrateFarms.js";

dotenv.config();

const ALLOWED_DATABASE = "dev-db";

function databaseName(uri) {
  const parsed = new URL(uri);
  return decodeURIComponent(parsed.pathname.replace(/^\//, "")).split("/")[0];
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  const named = databaseName(mongoUri);
  if (named !== ALLOWED_DATABASE) {
    console.error(
      `Refusing to migrate: database is "${named || "(none)"}", expected "${ALLOWED_DATABASE}"`,
    );
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  if (mongoose.connection.name !== ALLOWED_DATABASE) {
    console.error(
      `Refusing to migrate: connected database is "${mongoose.connection.name}", expected "${ALLOWED_DATABASE}"`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Migrating farms in ${ALLOWED_DATABASE}`);
  const result = await migrateFarms();
  console.log(
    `\nDone. Created ${result.farmsCreated} farm(s), linked ${result.workplacesLinked} workplace(s), ${result.workplacesWithoutFarm} workplace(s) left without a farm.`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
