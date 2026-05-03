import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { toCreate, toUpdate } = await req.json();

    // Bulk create - single API call, no rate limit issue
    if (toCreate && toCreate.length > 0) {
      await base44.asServiceRole.entities.Assignment.bulkCreate(toCreate);
    }

    // For updates: batch into groups of 10 with a small delay between batches
    if (toUpdate && toUpdate.length > 0) {
      const BATCH_SIZE = 10;
      const DELAY_MS = 300;

      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(({ id, fullRecord }) =>
            base44.asServiceRole.entities.Assignment.update(id, fullRecord)
          )
        );
        if (i + BATCH_SIZE < toUpdate.length) {
          await sleep(DELAY_MS);
        }
      }
    }

    return Response.json({ success: true, updated: toUpdate?.length || 0, created: toCreate?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});