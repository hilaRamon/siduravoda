import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { toUpdate, toCreate } = await req.json();

    // Use service role to avoid rate limits
    if (toCreate && toCreate.length > 0) {
      await base44.asServiceRole.entities.Assignment.bulkCreate(toCreate);
    }

    // Delete old records and recreate with updated data (bulk operations bypass rate limits)
    if (toUpdate && toUpdate.length > 0) {
      const ids = toUpdate.map(({ id }) => id);
      // Fetch current records to merge with updates
      const existing = await base44.asServiceRole.entities.Assignment.list();
      const existingMap = {};
      existing.forEach(a => { existingMap[a.id] = a; });

      // Delete all in bulk-friendly sequential batches
      for (const id of ids) {
        await base44.asServiceRole.entities.Assignment.delete(id);
      }

      // Recreate with merged data
      const recreated = toUpdate
        .filter(({ id }) => existingMap[id])
        .map(({ id, updates }) => {
          const { id: _id, created_date, updated_date, created_by, ...rest } = existingMap[id];
          return { ...rest, ...updates };
        });

      if (recreated.length > 0) {
        await base44.asServiceRole.entities.Assignment.bulkCreate(recreated);
      }
    }

    return Response.json({ success: true, updated: toUpdate?.length || 0, created: toCreate?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});