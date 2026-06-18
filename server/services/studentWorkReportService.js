import { getModel } from "../models/index.js";
import { SKIP_WORKPLACES } from "../lib/reportConstants.js";

async function getWorkplaceMaps() {
  const Workplace = getModel("Workplace");
  const workplaces = await Workplace.find().select("name").lean();
  const byId = {};
  const skipIds = [];

  for (const workplace of workplaces) {
    const id = workplace._id.toString();
    const name = workplace.name || "";
    byId[id] = name;
    if (SKIP_WORKPLACES.includes(name)) {
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
  const canonical = byId[workplaceId];
  if (canonical) return canonical;
  return assignmentName || "";
}

function resolveStudentName(studentId, assignmentName, byId) {
  const canonical = byId[studentId];
  if (canonical) return canonical;
  return assignmentName || "";
}

/**
 * @param {{ startDate: string, endDate: string, students?: string[] }} params
 */
export async function getStudentWorkReport({
  startDate,
  endDate,
  students = [],
}) {
  const Assignment = getModel("Assignment");
  const [{ byId: workplaceById, skipIds }, studentById] = await Promise.all([
    getWorkplaceMaps(),
    getStudentMap(),
  ]);

  const match = {
    date: { $gte: startDate, $lte: endDate },
    workplace_name: { $nin: SKIP_WORKPLACES, $exists: true, $ne: "" },
    student_id: { $exists: true, $ne: "" },
  };

  if (skipIds.length > 0) {
    match.workplace_id = { $nin: skipIds };
  }
  if (students.length > 0) {
    match.student_id = { $in: students };
  }

  const aggregated = await Assignment.aggregate([
    { $match: match },
    {
      $group: {
        _id: { student_id: "$student_id", date: "$date" },
        workplace_id: { $first: "$workplace_id" },
        student_name: { $first: "$student_name" },
        workplace_name: { $first: "$workplace_name" },
      },
    },
    {
      $group: {
        _id: {
          student_id: "$_id.student_id",
          workplace_id: "$workplace_id",
        },
        days: { $sum: 1 },
        student_name: { $first: "$student_name" },
        workplace_name: { $first: "$workplace_name" },
      },
    },
  ]);

  const studentBuckets = {};

  for (const item of aggregated) {
    const studentId = item._id.student_id;
    const workplaceId = item._id.workplace_id;
    const workplaceName = resolveWorkplaceName(
      workplaceId,
      item.workplace_name,
      workplaceById,
    );

    if (!workplaceName || SKIP_WORKPLACES.includes(workplaceName)) {
      continue;
    }

    const name = resolveStudentName(studentId, item.student_name, studentById);
    if (!studentBuckets[studentId]) {
      studentBuckets[studentId] = {
        studentId,
        name,
        workplaces: {},
      };
    }

    studentBuckets[studentId].workplaces[workplaceName] =
      (studentBuckets[studentId].workplaces[workplaceName] || 0) + item.days;
  }

  const result = Object.values(studentBuckets)
    .map((student) => {
      const workplaces = Object.entries(student.workplaces)
        .map(([workplaceName, days]) => ({ workplaceName, days }))
        .sort((a, b) => a.workplaceName.localeCompare(b.workplaceName, "he"));
      const totalDays = workplaces.reduce((sum, wp) => sum + wp.days, 0);
      return {
        studentId: student.studentId,
        name: student.name,
        workplaces,
        totalDays,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return { students: result };
}
