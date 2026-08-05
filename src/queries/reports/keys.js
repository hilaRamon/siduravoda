export const reportKeys = {
  all: ["reports"],
  workByWorkplace: ({ startDate, endDate, workplaces, farms, groupBy }) => [
    ...reportKeys.all,
    "work-by-workplace",
    { startDate, endDate, workplaces, farms, groupBy },
  ],
  workplaces: () => [...reportKeys.all, "workplaces"],
  studentWork: ({ startDate, endDate, students }) => [
    ...reportKeys.all,
    "student-work",
    { startDate, endDate, students },
  ],
  arzenu: ({ startDate, endDate }) => [
    ...reportKeys.all,
    "arzenu",
    { startDate, endDate },
  ],
};
