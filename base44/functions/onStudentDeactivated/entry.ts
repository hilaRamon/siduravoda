import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { event, data } = body;

    // Only act on updates where is_active changed to false
    if (event?.type !== 'update') return Response.json({ skipped: true });
    if (data?.is_active !== false) return Response.json({ skipped: true });

    const studentId = data?.id;
    if (!studentId) return Response.json({ skipped: true });

    const base44 = createClientFromRequest(req);
    const entities = base44.asServiceRole.entities;

    // Get tomorrow's date in Israel timezone
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
    const tomorrow = new Date(todayStr + 'T12:00:00');
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // Fetch all future assignments for this student (tomorrow and onwards)
    const allAssignments = await entities.Assignment.filter({ student_id: studentId });
    const futureAssignments = allAssignments.filter(a => a.date >= tomorrowStr);

    // Delete them one by one with small delay
    for (const assignment of futureAssignments) {
      await entities.Assignment.delete(assignment.id);
      await sleep(200);
    }

    return Response.json({ success: true, deleted: futureAssignments.length, student_id: studentId, from_date: today });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});