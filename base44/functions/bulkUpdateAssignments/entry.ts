import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text();
    const { toCreate, toUpdate } = JSON.parse(bodyText);

    const clonedReq = new Request(req, { body: bodyText });
    const base44 = createClientFromRequest(clonedReq);

    // For updates: delete the old records and bulk-recreate them — 2 API calls instead of N
    if (toUpdate && toUpdate.length > 0) {
      const ids = toUpdate.map(({ id }) => id);
      // Delete all old records in parallel batches of 10
      const BATCH = 10;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        await Promise.all(batch.map(id => base44.asServiceRole.entities.Assignment.delete(id)));
        if (i + BATCH < ids.length) await sleep(300);
      }
      // Recreate all as bulk (single API call)
      const recreate = toUpdate.map(({ fullRecord }) => fullRecord);
      await base44.asServiceRole.entities.Assignment.bulkCreate(recreate);
    }

    // New records: single bulk create
    if (toCreate && toCreate.length > 0) {
      await base44.asServiceRole.entities.Assignment.bulkCreate(toCreate);
    }

    return Response.json({ success: true, updated: toUpdate?.length || 0, created: toCreate?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});