import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text();
    const { date } = bodyText ? JSON.parse(bodyText) : {};
    if (!date) return Response.json({ error: 'date is required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const entities = base44.asServiceRole.entities;

    // Fetch all assignments for the given date
    let all = [];
    let skip = 0;
    while (true) {
      const batch = await entities.Assignment.filter({ date }, 'created_date', 2000);
      if (batch.length === 0) break;
      all = all.concat(batch);
      if (batch.length < 2000) break;
      skip += 2000;
    }

    // Group by student_id — keep oldest (first created), delete the rest
    const byStudent = {};
    all.forEach(a => {
      if (!byStudent[a.student_id]) {
        byStudent[a.student_id] = [];
      }
      byStudent[a.student_id].push(a);
    });

    const toDelete = [];
    let kept = 0;
    for (const [studentId, recs] of Object.entries(byStudent)) {
      if (recs.length <= 1) { kept++; continue; }
      // Sort by created_date ascending — keep the first one
      recs.sort((a, b) => (a.created_date > b.created_date ? 1 : -1));
      kept++;
      for (let i = 1; i < recs.length; i++) {
        toDelete.push(recs[i].id);
      }
    }

    // Delete in batches with longer delay
    let deleted = 0;
    for (const id of toDelete) {
      try {
        await entities.Assignment.delete(id);
        deleted++;
      } catch(e) {
        // skip already deleted
      }
      await sleep(600);
    }

    return Response.json({
      success: true,
      total: all.length,
      kept,
      deleted,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});