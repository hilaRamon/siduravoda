import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetDate } = await req.json();
    if (!targetDate) {
      return Response.json({ error: 'targetDate required' }, { status: 400 });
    }

    // Fetch all students
    const students = await base44.entities.Student.list('-created_date', 2000);
    const studentById = {};
    students.forEach(s => {
      studentById[s.id] = s;
    });

    // Fetch assignments for target date
    const assignments = await base44.entities.Assignment.filter({ date: targetDate }, '-created_date', 2000);

    // Find issues: distance_status "אאא- לפני שיבוץ" but assigned to "תתת - לא עובד"
    const toFix = [];
    assignments.forEach(a => {
      const student = studentById[a.student_id];
      if (!student || student.distance_status !== 'אאא- לפני שיבוץ') return;
      if (a.workplace_name === 'תתת - לא עובד') {
        toFix.push({
          id: a.id,
          studentId: a.student_id,
          studentName: a.student_name,
          currentStatus: student.distance_status,
          incorrectWorkplace: a.workplace_name,
        });
      }
    });

    // Fix: update to correct workplace "אאא- לפני שיבוץ"
    const CHUNK = 20;
    for (let i = 0; i < toFix.length; i += CHUNK) {
      const chunk = toFix.slice(i, i + CHUNK);
      for (const issue of chunk) {
        await base44.asServiceRole.entities.Assignment.update(issue.id, {
          workplace_id: '69e9eedac6dc0db454f4ea10',
          workplace_name: 'אאא- לפני שיבוץ',
          role: null,
          bonus: null,
        });
      }
    }

    return Response.json({
      targetDate,
      found: toFix.length,
      fixed: toFix.length,
      details: toFix,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});