import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // toCreate: array of full assignment objects to create
    // toUpdate: array of { id, fullRecord } where fullRecord is the complete merged assignment (no need to fetch from DB)
    const { toCreate, toUpdate } = await req.json();

    if (toCreate && toCreate.length > 0) {
      await base44.asServiceRole.entities.Assignment.bulkCreate(toCreate);
    }

    if (toUpdate && toUpdate.length > 0) {
      // Delete old records first
      for (const { id } of toUpdate) {
        await base44.asServiceRole.entities.Assignment.delete(id);
      }
      // Recreate with updated data
      const recreated = toUpdate.map(({ fullRecord }) => fullRecord);
      await base44.asServiceRole.entities.Assignment.bulkCreate(recreated);
    }

    return Response.json({ success: true, updated: toUpdate?.length || 0, created: toCreate?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});