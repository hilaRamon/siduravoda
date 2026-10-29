/**
 * Move farm_name and farm accounting fields off Workplace onto Farm.
 *
 *   npm run migrate:farms
 *
 * Refuses any database other than dev-db. The test database is allowed
 * only when CONFIRM_FARMS_MIGRATION=test.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { migrateFarms } from "../lib/migrateFarms.js";

dotenv.config();

const DEFAULT_DATABASE = "dev-db";
const TEST_DATABASE = "test";

function databaseName(uri) {
  const parsed = new URL(uri);
  return decodeURIComponent(parsed.pathname.replace(/^\//, "")).split("/")[0];
}

function allowedDatabases() {
  if (process.env.CONFIRM_FARMS_MIGRATION === TEST_DATABASE) {
    return [DEFAULT_DATABASE, TEST_DATABASE];
  }
  return [DEFAULT_DATABASE];
}

function expectedLabel(names) {
  return names.map((name) => `"${name}"`).join(" or ");
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  const allowed = allowedDatabases();
  const named = databaseName(mongoUri);
  if (!allowed.includes(named)) {
    console.error(
      `Refusing to migrate: database is "${named || "(none)"}", expected ${expectedLabel(allowed)}`,
    );
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const connected = mongoose.connection.name;
  if (!allowed.includes(connected) || connected !== named) {
    console.error(
      `Refusing to migrate: connected database is "${connected}", expected "${named}"`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Migrating farms in ${named}`);
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
