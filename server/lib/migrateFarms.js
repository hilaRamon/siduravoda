import Farm from "../models/Farm.js";
import Workplace from "../models/Workplace.js";

const FARM_FIELDS = [
  "company_id",
  "address",
  "accounting_phone",
  "accounting_email",
];

const UNSET_WORKPLACE_FIELDS = {
  farm_name: "",
  address: "",
  company_id: "",
  accounting_phone: "",
  accounting_email: "",
  has_agreement: "",
};

function trimmed(value) {
  return String(value ?? "").trim();
}

function byCreatedThenId(a, b) {
  const aTime = a.created_date ? new Date(a.created_date).getTime() : 0;
  const bTime = b.created_date ? new Date(b.created_date).getTime() : 0;
  if (aTime !== bTime) return aTime - bTime;
  return String(a._id).localeCompare(String(b._id));
}

function firstNonEmpty(workplaces, field) {
  for (const workplace of workplaces) {
    const value = trimmed(workplace[field]);
    if (value) return value;
  }
  return "";
}

/**
 * Copy farm fields off workplaces into Farm documents and set farm_id.
 * Reads the raw workplaces collection so farm_name is still visible.
 * Safe to run more than once.
 */
export async function migrateFarms() {
  const workplaces = await Workplace.collection.find({}).toArray();
  const pending = workplaces
    .filter((workplace) => trimmed(workplace.farm_name) && !workplace.farm_id)
    .sort(byCreatedThenId);

  const groups = new Map();
  for (const workplace of pending) {
    const name = trimmed(workplace.farm_name);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(workplace);
  }

  let farmsCreated = 0;
  let workplacesLinked = 0;

  for (const [name, group] of groups) {
    let farm = await Farm.findOne({ name });
    if (!farm) {
      const data = { name, has_agreement: group.some((workplace) => workplace.has_agreement === true) };
      for (const field of FARM_FIELDS) {
        const value = firstNonEmpty(group, field);
        if (value) data[field] = value;
      }
      farm = await Farm.create(data);
      farmsCreated += 1;
      console.log(`  created farm: ${name}`);
    }

    const farmId = farm._id.toString();
    for (const workplace of group) {
      await Workplace.collection.updateOne(
        { _id: workplace._id },
        {
          $set: { farm_id: farmId },
          $unset: UNSET_WORKPLACE_FIELDS,
        },
      );
      workplacesLinked += 1;
    }
  }

  const withoutFarm = workplaces.filter((workplace) => {
    if (workplace.farm_id) return false;
    return !trimmed(workplace.farm_name);
  }).length;

  if (farmsCreated > 0 || workplacesLinked > 0) {
    console.log(
      `Migrated ${farmsCreated} farm(s) and linked ${workplacesLinked} workplace(s).`,
    );
  } else {
    console.log("No workplaces left to move onto farms.");
  }

  return { farmsCreated, workplacesLinked, workplacesWithoutFarm: withoutFarm };
}
