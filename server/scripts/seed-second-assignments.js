/**
 * Add a second workplace (work_number 2) for a few students on a date,
 * plus pending TimeReports with custom hours for both works.
 *
 *   npm run seed:second-assignments -- --yes
 *   npm run seed:second-assignments -- --yes --date=2026-09-08
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { getModel } from "../models/index.js";
import Assignment from "../models/Assignment.js";
import { migrateAssignmentWorkNumber } from "../lib/migrateAssignmentWorkNumber.js";
import { PRICING_DEFAULTS, dailyToHourlyRate } from "../lib/pricing.js";

dotenv.config();

const ISRAEL_TZ = "Asia/Jerusalem";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STUDENT_COUNT = 3;
const HOURS = PRICING_DEFAULTS.default_hours;
const RATE = dailyToHourlyRate(
  PRICING_DEFAULTS.default_daily_rate,
  PRICING_DEFAULTS.hours_per_daily_unit,
);

const SKIP_WORKPLACE_NAMES = new Set([
  "לא עובד",
  "לימודים",
  "לא יצא",
  "קרוב",
  "רחוק",
  "אאא- לפני שיבוץ",
  "תתת - לא עובד",
]);

const FIRST_WORK_TIMES = { start_time: "07:00", end_time: "10:00" };
const SECOND_WORK_TIMES = { start_time: "10:30", end_time: "13:15" };

function parseArgs(argv) {
  const dateArg = argv.find((arg) => arg.startsWith("--date="));
  return {
    yes: argv.includes("--yes"),
    date: dateArg ? dateArg.slice("--date=".length) : null,
  };
}

function israelToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function idOf(doc) {
  return String(doc._id);
}

async function main() {
  const { yes, date: dateArg } = parseArgs(process.argv);
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed: NODE_ENV=production");
    process.exit(1);
  }

  if (!yes) {
    console.error("Refusing to seed without --yes");
    console.error("Run: npm run seed:second-assignments -- --yes");
    process.exit(1);
  }

  const date = dateArg || israelToday();
  if (!DATE_RE.test(date)) {
    console.error(`Invalid --date=${dateArg}. Use YYYY-MM-DD.`);
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  await migrateAssignmentWorkNumber();

  const Workplace = getModel("Workplace");
  const TimeReport = getModel("TimeReport");
  const farmWorkplaces = (await Workplace.find().lean()).filter(
    (w) => w.name && !SKIP_WORKPLACE_NAMES.has(w.name.trim()),
  );

  if (farmWorkplaces.length < 2) {
    console.error("Need at least two farm workplaces to seed a second assignment.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const primaries = await Assignment.find({
    date,
    $nor: [{ work_number: { $gt: 1 } }],
    workplace_name: { $nin: [...SKIP_WORKPLACE_NAMES], $exists: true, $ne: "" },
  })
    .sort({ student_name: 1, created_date: 1 })
    .lean();

  const uniquePrimaries = [];
  const seenStudents = new Set();
  for (const row of primaries) {
    if (seenStudents.has(row.student_id)) continue;
    seenStudents.add(row.student_id);
    uniquePrimaries.push(row);
  }

  if (uniquePrimaries.length === 0) {
    console.error(`No farm assignments found on ${date}.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const created = [];
  const skipped = [];

  for (const primary of uniquePrimaries) {
    if (created.length >= STUDENT_COUNT) break;

    const alreadySecond = await Assignment.findOne({
      date,
      student_id: primary.student_id,
      work_number: 2,
    }).lean();
    if (alreadySecond) {
      skipped.push(
        `${primary.student_name} already has a second assignment on ${date}`,
      );
      continue;
    }

    const secondWorkplace = farmWorkplaces.find(
      (w) => idOf(w) !== String(primary.workplace_id),
    );
    if (!secondWorkplace) {
      skipped.push(`${primary.student_name}: no other farm workplace`);
      continue;
    }

    await Assignment.updateOne(
      { _id: primary._id },
      { $set: { hours: HOURS, work_number: 1 } },
    );

    const second = await Assignment.create({
      date,
      student_id: primary.student_id,
      student_name: primary.student_name,
      workplace_id: idOf(secondWorkplace),
      workplace_name: secondWorkplace.name,
      work_number: 2,
      rate: primary.rate ?? RATE,
      hours: HOURS,
      role: primary.role || "",
    });

    const reports = [
      {
        assignment: { ...primary, hours: HOURS },
        workplace_id: String(primary.workplace_id),
        workplace_name: primary.workplace_name,
        times: FIRST_WORK_TIMES,
      },
      {
        assignment: second,
        workplace_id: idOf(secondWorkplace),
        workplace_name: secondWorkplace.name,
        times: SECOND_WORK_TIMES,
      },
    ];

    for (const report of reports) {
      const existingReport = await TimeReport.findOne({
        date,
        student_id: primary.student_id,
        workplace_id: report.workplace_id,
      }).lean();
      if (existingReport) continue;
      await TimeReport.create({
        date,
        student_id: primary.student_id,
        student_name: primary.student_name,
        workplace_id: report.workplace_id,
        workplace_name: report.workplace_name,
        start_time: report.times.start_time,
        end_time: report.times.end_time,
        status: "ממתין",
      });
    }

    created.push({
      student: primary.student_name,
      first: primary.workplace_name,
      second: secondWorkplace.name,
    });
  }

  console.log(`Date: ${date}`);
  if (created.length === 0) {
    console.log("No new second assignments created.");
  } else {
    console.log(`Created second assignments for ${created.length} student(s):`);
    created.forEach((row) => {
      console.log(
        `  ${row.student}: ${row.first} (4.75h) + ${row.second} (4.75h)`,
      );
    });
    console.log(
      "Pending TimeReports are waiting in Time Reports Admin (07:00–10:00 and 10:30–13:15).",
    );
  }
  skipped.forEach((msg) => console.log(`  skipped: ${msg}`));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
