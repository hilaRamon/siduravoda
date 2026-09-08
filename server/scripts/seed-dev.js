/**
 * Seed realistic mock data into the local MongoDB database named `dev-db`.
 *
 * Refuses to run against any other database name, NODE_ENV=production,
 * or without --yes. Never reads Render env.
 *
 *   npm run seed:dev -- --yes
 *   npm run seed:dev -- --yes --reset
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { getModel } from "../models/index.js";
import Student from "../models/Student.js";
import Assignment from "../models/Assignment.js";
import PublishedSchedule from "../models/PublishedSchedule.js";
import AbsenceRequest from "../models/AbsenceRequest.js";
import FarmerRequest from "../models/FarmerRequest.js";
import { hashPassword } from "../lib/password.js";
import { ROLES } from "../config/permissions.js";
import { ensurePermissionRulesSeeded } from "../services/permissionRuleService.js";
import { PRICING_DEFAULTS, dailyToHourlyRate } from "../lib/pricing.js";

const DEFAULT_ASSIGNMENT_RATE = dailyToHourlyRate(
  PRICING_DEFAULTS.default_daily_rate,
  PRICING_DEFAULTS.hours_per_daily_unit,
);

dotenv.config();

const ALLOWED_DATABASE = "dev-db";
const ISRAEL_TZ = "Asia/Jerusalem";
const HEBREW_WEEKDAYS = ["א", "ב", "ג", "ד", "ה"];
const DEMO_PASSWORD = "DevPass2026!";
const DEMO_USERS = [
  {
    email: "user@siduravoda.local",
    full_name: "משתמש הדגמה",
    role: ROLES.USER,
  },
  {
    email: "workplace@siduravoda.local",
    full_name: "מנהל משקים",
    role: ROLES.WORKPLACE_MANAGER,
  },
  {
    email: "reporter@siduravoda.local",
    full_name: "מדווח זמנים",
    role: ROLES.REPORTER,
  },
];

const SPECIAL_WORKPLACE_NAMES = [
  "לא עובד",
  "לימודים",
  "לא יצא",
  "קרוב",
  "רחוק",
  "אאא- לפני שיבוץ",
  "תתת - לא עובד",
];

const FARM_WORKPLACES = [
  {
    name: "משק הכהן",
    farm_name: "משק הכהן",
    address: "מושב נהלל",
    company_id: "514123456",
    contact_phone: "04-6411122",
    accounting_phone: "04-6411133",
    accounting_email: "cohen-farm@example.com",
    has_agreement: true,
  },
  {
    name: "מטעי הגליל",
    farm_name: "מטעי הגליל",
    address: "כפר תבור",
    company_id: "514234567",
    contact_phone: "04-6767788",
    accounting_email: "galil-orchards@example.com",
    has_agreement: true,
  },
  {
    name: "חממות השרון",
    farm_name: "חממות השרון",
    address: "קדימה-צורן",
    company_id: "514345678",
    contact_phone: "09-8912233",
    has_agreement: true,
  },
  {
    name: "כרמי רגבים",
    farm_name: "כרמי רגבים",
    address: "רגבים",
    company_id: "514456789",
    contact_phone: "04-9893344",
    accounting_email: "regavim-vines@example.com",
    has_agreement: true,
  },
  {
    name: "לול הנגב",
    farm_name: "לול הנגב",
    address: "אופקים",
    company_id: "514567890",
    contact_phone: "08-9924455",
    has_agreement: false,
  },
  {
    name: "פרדס הזהב",
    farm_name: "פרדס הזהב",
    address: "חדרה",
    company_id: "514678901",
    contact_phone: "04-6245566",
    has_agreement: true,
  },
  {
    name: "משק דגן",
    farm_name: "משק דגן",
    address: "בית שאן",
    company_id: "514789012",
    contact_phone: "04-6066677",
    has_agreement: true,
  },
  {
    name: "גינת הירק",
    farm_name: "גינת הירק",
    address: "עמק חפר",
    company_id: "514890123",
    contact_phone: "09-8987788",
    has_agreement: false,
  },
];

const ROLE_DEFS = [
  { name: "נהג", description: "נהיגה לנקודות העבודה", color: "#2563eb" },
  { name: "ראש צוות", description: "אחראי על הצוות בשטח", color: "#16a34a" },
  { name: 'אחראי פק"ל', description: "אחראי פקודת לחימה / ציוד", color: "#ea580c" },
];

const VEHICLES = [
  { name: "טויוטה היילקס", license_plate: "12-345-67", insurance: "מקיף עד 12/2026" },
  { name: "פורד טרנזיט", license_plate: "23-456-78", insurance: "חובה עד 03/2027" },
  { name: "מיצובישי קנטר", license_plate: "34-567-89", notes: "משאית קטנה" },
  { name: "סובארו פורסטר", license_plate: "45-678-90" },
];

const STUDENTS = [
  { full_name: "יוסף כהן", phone: "052-1112233", cohort: "מחזור א'", free_day: ["א"], distance_status: "קרוב" },
  { full_name: "דוד לוי", phone: "052-2223344", cohort: "מחזור א'", free_day: ["ג"], distance_status: "רחוק" },
  { full_name: "משה ישראלי", phone: "053-3334455", cohort: "מחזור א'", distance_status: "קרוב" },
  { full_name: "אברהם גולדברג", phone: "054-4445566", cohort: "מחזור א'", free_day: ["ה"], distance_status: "אאא- לפני שיבוץ" },
  { full_name: "יצחק מזרחי", phone: "050-5556677", cohort: "מחזור א'", distance_status: "רחוק", forbidden_workplaces: ["לול הנגב"] },
  { full_name: "יעקב אזולאי", phone: "052-6667788", cohort: "מחזור א'", free_day: ["ב"], distance_status: "קרוב" },
  { full_name: "שלמה פרץ", phone: "053-7778899", cohort: "מחזור א'", distance_status: "קרוב" },
  { full_name: "בנימין חדד", phone: "054-8889900", cohort: "מחזור א'", free_day: ["ד"], distance_status: "רחוק" },
  { full_name: "אליהו ביטון", phone: "050-9990011", cohort: "מחזור א'", distance_status: "קרוב" },
  { full_name: "נתנאל שפירא", phone: "052-1011121", cohort: "מחזור א'", free_day: ["א", "ה"], distance_status: "רחוק" },
  { full_name: "אהרן רוזן", phone: "053-1213141", cohort: "מחזור א'", distance_status: "קרוב" },
  { full_name: "חיים אברהם", phone: "054-1516171", cohort: "מחזור א'", distance_status: "תתת - לא עובד" },
  { full_name: "אורי נחום", phone: "050-1819202", cohort: "מחזור ב'", free_day: ["ב"], distance_status: "קרוב" },
  { full_name: "מתן ברק", phone: "052-2122232", cohort: "מחזור ב'", distance_status: "רחוק" },
  { full_name: "תומר שלום", phone: "053-2425262", cohort: "מחזור ב'", free_day: ["ד"], distance_status: "קרוב" },
  { full_name: "עידו מלכה", phone: "054-2728293", cohort: "מחזור ב'", distance_status: "אאא- לפני שיבוץ", forbidden_workplaces: ["גינת הירק"] },
  { full_name: "נועם דהן", phone: "050-3031323", cohort: "מחזור ב'", free_day: ["ג"], distance_status: "קרוב" },
  { full_name: "איתן אוחנה", phone: "052-3334353", cohort: "מחזור ב'", distance_status: "רחוק" },
  { full_name: "רועי אמסלם", phone: "053-3637383", cohort: "מחזור ב'", free_day: ["ה"], distance_status: "קרוב" },
  { full_name: "ליאור סבג", phone: "054-3940414", cohort: "מחזור ב'", distance_status: "קרוב" },
  { full_name: "עומר חזן", phone: "050-4243444", cohort: "מחזור ב'", free_day: ["א"], distance_status: "רחוק" },
  { full_name: "אדם גבאי", phone: "052-4546474", cohort: "מחזור ב'", distance_status: "קרוב" },
  { full_name: "יונתן אלקיים", phone: "053-4849505", cohort: "מחזור ב'", free_day: ["ב", "ג"], distance_status: "רחוק" },
  { full_name: "אביתר סופר", phone: "054-5152535", cohort: "מחזור ב'", distance_status: "קרוב" },
  { full_name: "רפאל בן דוד", phone: "050-5455565", cohort: "צוות", free_day: ["ד"], distance_status: "קרוב" },
  { full_name: "שמעון קדוש", phone: "052-5758596", cohort: "צוות", distance_status: "רחוק" },
  { full_name: "ישראל עמר", phone: "053-6061626", cohort: "צוות", free_day: ["ה"], distance_status: "קרוב" },
  { full_name: "מיכאל אסרף", phone: "054-6364656", cohort: "צוות", distance_status: "קרוב", forbidden_workplaces: ["משק הכהן"] },
  { full_name: "גבריאל תורג'מן", phone: "050-6667686", cohort: "צוות", free_day: ["א"], distance_status: "רחוק" },
  { full_name: "אליעזר בוזגלו", phone: "052-6970717", cohort: "צוות", distance_status: "קרוב" },
  { full_name: "פנחס מלול", phone: "053-7273747", cohort: "מחזור א'", is_active: false, notes: "עזב באמצע השנה" },
  { full_name: "צבי קליין", phone: "054-7576777", cohort: "מחזור ב'", is_active: false, notes: "לא פעיל" },
];

function parseArgs(argv) {
  return {
    yes: argv.includes("--yes"),
    reset: argv.includes("--reset"),
  };
}

function parseMongoTarget(uri) {
  const parsed = new URL(uri);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).split(
    "/",
  )[0];
  return { host: parsed.host, database };
}

function idOf(doc) {
  return String(doc._id);
}

function pad(value) {
  return String(value).padStart(2, "0");
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

function addDays(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

function weekdayIndex(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function sundayOfWeek(dateStr) {
  return addDays(dateStr, -weekdayIndex(dateStr));
}

function workDaysAround(today) {
  const thisSunday = sundayOfWeek(today);
  const nextSunday = addDays(thisSunday, 7);
  return [thisSunday, nextSunday].flatMap((sunday) =>
    [0, 1, 2, 3, 4].map((offset) => addDays(sunday, offset)),
  );
}

function lastWorkDayOnOrBefore(dateStr) {
  let cursor = dateStr;
  for (let i = 0; i < 7; i += 1) {
    if (weekdayIndex(cursor) <= 4) return cursor;
    cursor = addDays(cursor, -1);
  }
  return dateStr;
}

function toGregDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function toHebrewDate(dateStr) {
  try {
    return new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${dateStr}T12:00:00`));
  } catch {
    return "";
  }
}

function byName(docs) {
  return Object.fromEntries(docs.map((doc) => [doc.name, doc]));
}

function pickWorkplace(student, dateLetter, farms, specials, index) {
  if (student.free_day?.includes(dateLetter)) {
    return specials["תתת - לא עובד"];
  }

  const allowedFarms = farms.filter(
    (farm) => !student.forbidden_workplaces?.includes(farm.name),
  );
  const pool = allowedFarms.length ? allowedFarms : farms;
  const bucket = (index * 13 + dateLetter.charCodeAt(0)) % 12;
  if (bucket === 0) return specials["לא עובד"];
  if (bucket === 1) return specials["לימודים"];
  if (bucket === 2 && index % 9 === 0) return specials["לא יצא"];
  return pool[index % pool.length];
}

function buildSnapshot(date, dayAssignments, logisticsDocs, studentDocs) {
  const studentsMap = Object.fromEntries(
    studentDocs.map((student) => [idOf(student), student]),
  );
  const logisticsMap = Object.fromEntries(
    logisticsDocs.map((row) => [row.workplace_id, row]),
  );

  const byWorkplace = {};
  dayAssignments.forEach((assignment) => {
    const key = assignment.workplace_id;
    if (!byWorkplace[key]) {
      byWorkplace[key] = {
        workplaceName: assignment.workplace_name,
        students: [],
      };
    }
    byWorkplace[key].students.push(assignment);
  });

  const reportGroups = Object.entries(byWorkplace)
    .map(([workplaceId, group]) => {
      const log = logisticsMap[workplaceId] || {};
      const vehicles = [log.vehicle_name, log.vehicle_name_2, log.vehicle_name_3]
        .filter(Boolean)
        .join(" + ");
      const sortedStudents = [...group.students].sort((a, b) => {
        const aCohort = studentsMap[a.student_id]?.cohort || "";
        const bCohort = studentsMap[b.student_id]?.cohort || "";
        const cohortCmp = aCohort.localeCompare(bCohort, "he");
        if (cohortCmp !== 0) return cohortCmp;
        return (a.student_name || "").localeCompare(b.student_name || "", "he");
      });
      return {
        workplaceName: group.workplaceName,
        students: sortedStudents,
        vehicleName: vehicles,
        exitTime: log.exit_time || (group.workplaceName.startsWith("תת") ? "" : "06:35"),
        notes: log.notes || "",
      };
    })
    .sort((a, b) => a.workplaceName.localeCompare(b.workplaceName, "he"));

  return {
    reportGroups,
    gregDate: toGregDate(date),
    hebrewDate: toHebrewDate(date),
  };
}

async function upsertAdmin() {
  const User = getModel("User");
  const email = (process.env.ADMIN_EMAIL || "admin@siduravoda.local")
    .toLowerCase()
    .trim();
  const password = process.env.ADMIN_PASSWORD || "SidurAdmin2026!";
  const fullName = process.env.ADMIN_NAME || "מנהל מערכת";
  const password_hash = await hashPassword(password);
  const existing = await User.findOne({ email });

  if (existing) {
    existing.password_hash = password_hash;
    existing.full_name = fullName;
    existing.role = ROLES.ADMIN;
    existing.is_active = true;
    await existing.save();
  } else {
    await User.create({
      email,
      password_hash,
      full_name: fullName,
      role: ROLES.ADMIN,
      is_active: true,
    });
  }

  return { email, password };
}

async function resetOperationalData() {
  const User = getModel("User");
  await Promise.all([
    Student.deleteMany({}),
    Assignment.deleteMany({}),
    PublishedSchedule.deleteMany({}),
    AbsenceRequest.deleteMany({}),
    FarmerRequest.deleteMany({}),
    getModel("Workplace").deleteMany({}),
    getModel("WorkplaceLogistics").deleteMany({}),
    getModel("TimeReport").deleteMany({}),
    getModel("AppSettings").deleteMany({}),
    getModel("Role").deleteMany({}),
    getModel("Vehicle").deleteMany({}),
  ]);

  await User.deleteMany({
    email: { $in: DEMO_USERS.map((user) => user.email) },
  });
}

async function main() {
  const { yes, reset } = parseArgs(process.argv);
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed: NODE_ENV=production");
    process.exit(1);
  }

  let target;
  try {
    target = parseMongoTarget(mongoUri);
  } catch {
    console.error("Could not parse MONGODB_URI");
    process.exit(1);
  }

  if (target.database !== ALLOWED_DATABASE) {
    console.error(
      `Refusing to seed: database is "${target.database || "(none)"}", expected "${ALLOWED_DATABASE}"`,
    );
    process.exit(1);
  }

  if (!yes) {
    console.error("Refusing to seed without --yes");
    console.error(`Would write to ${target.host} / database: ${target.database}`);
    console.error("Run: npm run seed:dev -- --yes");
    process.exit(1);
  }

  console.log(`Seeding ${target.host} / database: ${target.database}`);

  await mongoose.connect(mongoUri);
  const connectedDb = mongoose.connection.name;
  if (connectedDb !== ALLOWED_DATABASE) {
    console.error(
      `Refusing to seed: connected database is "${connectedDb}", expected "${ALLOWED_DATABASE}"`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  await ensurePermissionRulesSeeded();

  const existingStudents = await Student.countDocuments();
  if (existingStudents > 0 && !reset) {
    console.error(
      `Database already has ${existingStudents} students. Re-run with --reset to replace mock data.`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  if (reset) {
    console.log("Resetting operational collections in dev-db...");
    await resetOperationalData();
  }

  const admin = await upsertAdmin();
  const demoHash = await hashPassword(DEMO_PASSWORD);
  const User = getModel("User");
  for (const demo of DEMO_USERS) {
    await User.findOneAndUpdate(
      { email: demo.email },
      {
        email: demo.email,
        password_hash: demoHash,
        full_name: demo.full_name,
        role: demo.role,
        is_active: true,
      },
      { upsert: true, returnDocument: "after" },
    );
  }

  const AppSettings = getModel("AppSettings");
  await AppSettings.create({
    ...PRICING_DEFAULTS,
    default_rate: DEFAULT_ASSIGNMENT_RATE,
    default_start_time: "07:00",
    default_end_time: "11:45",
  });

  const Workplace = getModel("Workplace");
  const specialDocs = await Workplace.insertMany(
    SPECIAL_WORKPLACE_NAMES.map((name) => ({ name })),
  );
  const farmDocs = await Workplace.insertMany(FARM_WORKPLACES);
  const specials = byName(specialDocs);
  const allWorkplaces = [...specialDocs, ...farmDocs];

  const Role = getModel("Role");
  await Role.insertMany(ROLE_DEFS);

  const studentDocs = await Student.insertMany(
    STUDENTS.map((student) => ({
      is_active: student.is_active !== false,
      ...student,
    })),
  );
  const activeStudents = studentDocs.filter((student) => student.is_active !== false);

  const Vehicle = getModel("Vehicle");
  const vehicleDocs = await Vehicle.insertMany(VEHICLES);

  const today = israelToday();
  const workDates = workDaysAround(today);
  const rate = DEFAULT_ASSIGNMENT_RATE;
  const hours = PRICING_DEFAULTS.default_hours;
  const assignmentRoles = ROLE_DEFS.map((role) => role.name);

  const assignments = [];
  for (const date of workDates) {
    const letter = HEBREW_WEEKDAYS[weekdayIndex(date)] || "א";
    const dayAssignments = activeStudents.map((student, index) => {
      const workplace = pickWorkplace(
        student,
        letter,
        farmDocs,
        specials,
        index,
      );
      return {
        date,
        student_id: idOf(student),
        student_name: student.full_name,
        workplace_id: idOf(workplace),
        workplace_name: workplace.name,
        rate,
        hours,
        role: "",
      };
    });

    const farmAssigned = dayAssignments.filter(
      (row) => !SPECIAL_WORKPLACE_NAMES.includes(row.workplace_name),
    );
    assignmentRoles.forEach((roleName, roleIndex) => {
      const target = farmAssigned[roleIndex];
      if (target) target.role = roleName;
    });

    assignments.push(...dayAssignments);
  }

  const assignmentDocs = await Assignment.insertMany(assignments);

  const WorkplaceLogistics = getModel("WorkplaceLogistics");
  const logisticsDocs = [];
  for (const date of workDates) {
    const dayRows = assignmentDocs.filter((row) => row.date === date);
    const counts = new Map();
    dayRows.forEach((row) => {
      if (SPECIAL_WORKPLACE_NAMES.includes(row.workplace_name)) return;
      const current = counts.get(row.workplace_id) || {
        workplace_id: row.workplace_id,
        workplace_name: row.workplace_name,
        students: [],
      };
      current.students.push(row);
      counts.set(row.workplace_id, current);
    });
    const top = [...counts.values()]
      .sort((a, b) => b.students.length - a.students.length)
      .slice(0, 3);
    top.forEach((group, index) => {
      const driver = group.students[0];
      const vehicle = vehicleDocs[index % vehicleDocs.length];
      logisticsDocs.push({
        date,
        workplace_id: group.workplace_id,
        workplace_name: group.workplace_name,
        driver_student_id: driver.student_id,
        driver_student_name: driver.student_name,
        vehicle_id: idOf(vehicle),
        vehicle_name: vehicle.name,
        exit_time: "06:35",
      });
    });
  }
  const insertedLogistics = await WorkplaceLogistics.insertMany(logisticsDocs);

  const farmerDates = workDates.slice(0, 5);
  const farmerRequests = farmerDates.flatMap((date, dateIndex) => {
    const farms = farmDocs.slice(dateIndex % 3, (dateIndex % 3) + 3);
    return farms.map((farm, farmIndex) => ({
      date,
      workplace_id: idOf(farm),
      workplace_name: farm.name,
      requested_volunteers: 4 + farmIndex,
    }));
  });
  await FarmerRequest.insertMany(farmerRequests);

  const absenceDate = workDates.find((date) => date >= today) || workDates[0];
  const yesterday = lastWorkDayOnOrBefore(addDays(today, -1));
  const absenceStudents = activeStudents.slice(0, 8);
  const absencePayloads = [
    {
      date: absenceDate,
      student_id: idOf(absenceStudents[0]),
      submitted_name: absenceStudents[0].full_name,
      reason: "רופא שיניים",
      status: "ממתין",
      source: "manual",
      phone: absenceStudents[0].phone,
    },
    {
      date: absenceDate,
      student_id: idOf(absenceStudents[1]),
      submitted_name: absenceStudents[1].full_name,
      reason: "לא מרגיש טוב",
      status: "ממתין",
      source: "sms",
      phone: absenceStudents[1].phone,
      dest: "052-0000000",
      message: "לא אוכל להגיע מחר",
      sms_date: today,
    },
    {
      date: yesterday,
      student_id: idOf(absenceStudents[2]),
      submitted_name: absenceStudents[2].full_name,
      reason: "שמחה משפחתית",
      status: "אושר",
      source: "manual",
      phone: absenceStudents[2].phone,
    },
    {
      date: yesterday,
      student_id: idOf(absenceStudents[3]),
      submitted_name: absenceStudents[3].full_name,
      reason: "בחינה",
      status: "אושר",
      source: "sms",
      phone: absenceStudents[3].phone,
      dest: "052-0000000",
      message: "יש לי מבחן, לא מגיע",
      sms_date: yesterday,
    },
    {
      date: absenceDate,
      student_id: idOf(absenceStudents[4]),
      submitted_name: absenceStudents[4].full_name,
      reason: "נסיעה",
      status: "נדחה",
      source: "manual",
      phone: absenceStudents[4].phone,
      notes: "חסר אישור",
    },
    {
      date: workDates[0],
      student_id: idOf(absenceStudents[5]),
      submitted_name: absenceStudents[5].full_name,
      reason: "יום חופש",
      status: "אושר",
      source: "manual",
      phone: absenceStudents[5].phone,
    },
    {
      date: workDates[1],
      submitted_name: "לא מזוהה",
      reason: "",
      status: "ממתין",
      source: "sms",
      phone: "052-8887777",
      dest: "052-0000000",
      message: "שלום אני לא מגיע היום",
      sms_date: workDates[1],
    },
    {
      date: workDates[2],
      student_id: idOf(absenceStudents[6]),
      submitted_name: absenceStudents[6].full_name,
      reason: "לימודים",
      status: "נדחה",
      source: "manual",
      phone: absenceStudents[6].phone,
    },
  ];
  await AbsenceRequest.insertMany(absencePayloads);

  const notWorkingToday = specials["תתת - לא עובד"];
  const approvedAbsences = absencePayloads.filter(
    (row) => row.status === "אושר" && row.student_id,
  );
  for (const absence of approvedAbsences) {
    await Assignment.updateOne(
      { date: absence.date, student_id: absence.student_id },
      {
        $set: {
          workplace_id: idOf(notWorkingToday),
          workplace_name: notWorkingToday.name,
          role: "",
        },
      },
    );
  }

  const TimeReport = getModel("TimeReport");
  const reportDate = lastWorkDayOnOrBefore(today);
  const reportAssignments = await Assignment.find({
    date: reportDate,
    workplace_name: { $nin: ["לא עובד", "לימודים", "לא יצא", "תתת - לא עובד"] },
  }).limit(10);
  const reportStatuses = ["ממתין", "אושר", "נדחה", "ממתין", "אושר"];
  await TimeReport.insertMany(
    reportAssignments.map((row, index) => ({
      date: row.date,
      student_id: row.student_id,
      student_name: row.student_name,
      workplace_id: row.workplace_id,
      workplace_name: row.workplace_name,
      start_time: index % 4 === 0 ? "07:15" : "07:00",
      end_time: index % 4 === 0 ? "12:00" : "11:45",
      status: reportStatuses[index % reportStatuses.length],
      notes: index === 2 ? "יצא מוקדם" : "",
    })),
  );

  const publishDate = workDates.includes(today) ? today : workDates[0];
  const publishAssignments = (
    await Assignment.find({ date: publishDate }).lean()
  ).map((row) => ({
    ...row,
    student_id: String(row.student_id),
    workplace_id: String(row.workplace_id),
  }));
  const publishLogistics = insertedLogistics.filter(
    (row) => row.date === publishDate,
  );
  await PublishedSchedule.create({
    date: publishDate,
    file_url: "/uploads/seed-schedule.pdf",
    snapshot: buildSnapshot(
      publishDate,
      publishAssignments,
      publishLogistics,
      studentDocs,
    ),
  });

  const counts = {
    students: await Student.countDocuments(),
    workplaces: await Workplace.countDocuments(),
    assignments: await Assignment.countDocuments(),
    absences: await AbsenceRequest.countDocuments(),
    farmerRequests: await FarmerRequest.countDocuments(),
    timeReports: await TimeReport.countDocuments(),
    logistics: await WorkplaceLogistics.countDocuments(),
    published: await PublishedSchedule.countDocuments(),
    users: await User.countDocuments(),
  };

  console.log("\nSeed complete.");
  console.log(`Work dates: ${workDates[0]} … ${workDates[workDates.length - 1]}`);
  console.log(counts);
  console.log("\n--- Login ---");
  console.log(`Admin:    ${admin.email} / ${admin.password}`);
  console.log(`User:     ${DEMO_USERS[0].email} / ${DEMO_PASSWORD}`);
  console.log(`Manager:  ${DEMO_USERS[1].email} / ${DEMO_PASSWORD}`);
  console.log(`Reporter: ${DEMO_USERS[2].email} / ${DEMO_PASSWORD}`);
  console.log("-------------\n");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
