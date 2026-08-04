/**
 * Migrate IncomingSMS → AbsenceRequest.
 * Run before or after IncomingSMS entity is removed:
 *   node server/scripts/migrate-incoming-sms-to-absence-requests.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import AbsenceRequest from "../models/AbsenceRequest.js";

dotenv.config();

async function loadIncomingSmsRows() {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name);
  const candidate =
    names.find((n) => n.toLowerCase() === "incomingsms") ||
    names.find((n) => n.toLowerCase().includes("incomingsms"));

  if (!candidate) {
    console.log("No IncomingSMS collection found. Nothing to migrate.");
    return [];
  }

  console.log(`Reading from collection: ${candidate}`);
  return db.collection(candidate).find({}).toArray();
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const rows = await loadIncomingSmsRows();
  console.log(`Found ${rows.length} IncomingSMS rows`);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const phone = row.phone || "";
    const message = row.message || "";
    const sms_date = row.sms_date || "";

    const existing = await AbsenceRequest.findOne({
      phone,
      message,
      sms_date,
      source: "sms",
    }).lean();

    if (existing) {
      skipped += 1;
      continue;
    }

    const doc = {
      date: row.parsed_date || null,
      student_id: row.student_id || null,
      submitted_name: row.parsed_student_name || row.student_name || "",
      reason: row.parsed_reason || "",
      status: row.status || "ממתין",
      source: "sms",
      phone,
      dest: row.dest || "",
      message,
      sms_date,
      notes: row.notes || "",
    };

    if (row.created_date) doc.created_date = row.created_date;
    if (row.updated_date) doc.updated_date = row.updated_date;

    await AbsenceRequest.create(doc);
    created += 1;
  }

  console.log(`Created ${created}, skipped (already migrated) ${skipped}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
