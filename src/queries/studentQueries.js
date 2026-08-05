import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const studentKeys = {
  all: ["students"],
};

export function useStudents(options = {}) {
  const query = useQuery({
    queryKey: studentKeys.all,
    queryFn: () => base44.entities.Student.list("-created_date"),
    ...options,
  });

  const students = query.data ?? [];

  const cohorts = useMemo(() => {
    const names = new Set(students.map((s) => s.cohort).filter(Boolean));
    return [...names].sort();
  }, [students]);

  const studentOptions = useMemo(
    () =>
      students
        .filter((s) => s.id && s.full_name)
        .map((s) => ({ id: s.id, name: s.full_name }))
        .sort((a, b) => a.name.localeCompare(b.name, "he")),
    [students],
  );

  const studentNameById = useMemo(
    () => Object.fromEntries(studentOptions.map((s) => [s.id, s.name])),
    [studentOptions],
  );

  return {
    ...query,
    students,
    cohorts,
    studentOptions,
    studentNameById,
  };
}
