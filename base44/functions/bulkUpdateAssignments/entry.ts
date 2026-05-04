import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function updateWithRetry(entities, id, data) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await entities.Assignment.update(id, data);
      return;
    } catch (err) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('Rate limit');
      const is404 = err?.message?.includes('404') || err?.message?.includes('not found');
      if (is404) return;
      if (is429) {
        await sleep(1500 * (attempt + 1));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed to update ${id} after retries`);
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text();
    const { toCreate = [], toUpdate = [] } = JSON.parse(bodyText);

    const clonedReq = new Request(req, { body: bodyText });
    const base44 = createClientFromRequest(clonedReq);
    const entities = base44.asServiceRole.entities;

    let updatedCount = 0;

    // Process each update serially with 700ms gap
    for (const { id, fullRecord } of toUpdate) {
      await updateWithRetry(entities, id, fullRecord);
      updatedCount++;
      if (updatedCount < toUpdate.length) {
        await sleep(700);
      }
    }

    if (toCreate.length > 0) {
      await entities.Assignment.bulkCreate(toCreate);
    }

    return Response.json({ success: true, updated: updatedCount, created: toCreate.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});