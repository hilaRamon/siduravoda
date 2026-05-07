import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text();
    const { date, dryRun = false } = bodyText ? JSON.parse(bodyText) : {};
    if (!date) return Response.json({ error: 'date is required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const entities = base44.asServiceRole.entities;

    // Fetch all assignments for the given date (sorted oldest first)
    const all = await entities.Assignment.filter({ date }, 'created_date', 2000);

    // Group by student_id — keep oldest (first created), collect rest to delete
    const seen = new Set();
    const toDelete = [];
    
    // Sort oldest first
    all.sort((a, b) => (a.created_date > b.created_date ? 1 : -1));
    
    for (const a of all) {
      if (seen.has(a.student_id)) {
        toDelete.push(a.id);
      } else {
        seen.add(a.student_id);
      }
    }

    if (dryRun) {
      return Response.json({ total: all.length, toDelete: toDelete.length, uniqueStudents: seen.size });
    }

    // Delete up to 50 per run to avoid timeout
    const batch = toDelete.slice(0, 50);
    let deleted = 0;
    for (const id of batch) {
      try {
        await entities.Assignment.delete(id);
        deleted++;
      } catch(e) {
        // skip
      }
      await sleep(400);
    }

    return Response.json({
      success: true,
      total: all.length,
      uniqueStudents: seen.size,
      totalDuplicates: toDelete.length,
      deletedThisRun: deleted,
      remaining: toDelete.length - deleted,
      done: toDelete.length <= 50,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});