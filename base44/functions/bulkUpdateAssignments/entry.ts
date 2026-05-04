import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function updateWithRetry(entities, id, data) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await entities.Assignment.update(id, data);
      return;
    } catch (err) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('Rate limit');
      const is404 = err?.message?.includes('404') || err?.message?.includes('not found');
      if (is404) return; // already deleted, skip silently
      if (is429) {
        await sleep(2000 * (attempt + 1)); // 2s, 4s, 6s, 8s
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed to update ${id} after 5 attempts`);
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text();
    const { toCreate = [], toUpdate = [] } = JSON.parse(bodyText);

    const clonedReq = new Request(req, { body: bodyText });
    const base44 = createClientFromRequest(clonedReq);
    const entities = base44.asServiceRole.entities;

    let updatedCount = 0;
    let createdCount = 0;

    // Process updates strictly one at a time, 1.1s apart to stay under rate limit
    for (const { id, fullRecord } of toUpdate) {
      await updateWithRetry(entities, id, fullRecord);
      updatedCount++;
      if (updatedCount < toUpdate.length) {
        await sleep(1100);
      }
    }

    // Bulk create in one shot (no rate limit issue)
    if (toCreate.length > 0) {
      await entities.Assignment.bulkCreate(toCreate);
      createdCount = toCreate.length;
    }

    return Response.json({ success: true, updated: updatedCount, created: createdCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});