import { getModel } from "../models/index.js";
import { SKIP_WORKPLACES } from "../lib/reportConstants.js";
// import { SKIP_FARMS } from "../lib/reportConstants.js";

async function getWorkplaceMaps() {
  const Workplace = getModel("Workplace");
  const workplaces = await Workplace.find().select("name farm_name").lean();
  const byId = {};
  const skipIds = [];

  for (const workplace of workplaces) {
    const id = workplace._id.toString();
    const name = workplace.name || "";
    const farmName = workplace.farm_name || "";
    byId[id] = { name, farmName };
    if (SKIP_WORKPLACES.includes(name)) {
      // || SKIP_FARMS.includes(farmName)
      skipIds.push(id);
    }
  }

  return { byId, skipIds };
}

async function getStudentMap() {
  const Student = getModel("Student");
  const students = await Student.find().select("full_name").lean();
  const byId = {};

  for (const student of students) {
    byId[student._id.toString()] = student.full_name || "";
  }

  return byId;
}

function resolveWorkplaceName(workplaceId, assignmentName, byId) {
  const canonical = byId[workplaceId]?.name;
  if (canonical) return canonical;
  return assignmentName || "";
}

function shouldSkipAssignment(workplaceId, workplaceName, byId) {
  const info = byId[workplaceId];
  if (info) {
    return SKIP_WORKPLACES.includes(info.name);
    // || SKIP_FARMS.includes(info.farmName)
  }
  return SKIP_WORKPLACES.includes(workplaceName);
}

function resolveStudentName(studentId, assignmentName, byId) {
  const canonical = byId[studentId];
  if (canonical) return canonical;
  return assignmentName || "";
}

/**
 * @param {{ startDate: string, endDate: string }} params
 */
export async function getArzenuReport({ startDate, endDate }) {
  const Assignment = getModel("Assignment");
  const [{ byId: workplaceById, skipIds }, studentById] = await Promise.all([
    getWorkplaceMaps(),
    getStudentMap(),
  ]);

  const match = {
    date: { $gte: startDate, $lte: endDate },
    workplace_name: { $nin: SKIP_WORKPLACES, $exists: true, $ne: "" },
  };

  if (skipIds.length > 0) {
    match.workplace_id = { $nin: skipIds };
  }

  const assignments = await Assignment.find(match)
    .select("date student_id student_name workplace_name workplace_id")
    .lean();

  const rows = [];

  for (const assignment of assignments) {
    const workplace = resolveWorkplaceName(
      assignment.workplace_id,
      assignment.workplace_name,
      workplaceById,
    );

    if (
      !workplace ||
      shouldSkipAssignment(
        assignment.workplace_id,
        assignment.workplace_name,
        workplaceById,
      )
    ) {
      continue;
    }

    rows.push({
      date: assignment.date,
      name: resolveStudentName(
        assignment.student_id,
        assignment.student_name,
        studentById,
      ),
      workplace,
    });
  }

  rows.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.name.localeCompare(b.name, "he");
  });

  return { rows, totalRows: rows.length };
}
