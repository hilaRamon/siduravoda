import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function updateWithRetry(entities, id, data, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await entities.Assignment.update(id, data);
      return true;
    } catch (err) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('Rate limit');
      if (is429 && attempt < maxRetries) {
        // Exponential backoff on rate limit
        await sleep(1000 * (attempt + 1));
      } else {
        throw err;
      }
    }
  }
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

    // Process updates one at a time with a fixed delay between each
    for (const { id, fullRecord } of toUpdate) {
      await updateWithRetry(entities, id, fullRecord);
      updatedCount++;
      await sleep(120); // 120ms between each update = ~8 requests/sec
    }

    // Bulk create in one shot
    if (toCreate.length > 0) {
      await entities.Assignment.bulkCreate(toCreate);
      createdCount = toCreate.length;
    }

    return Response.json({ success: true, updated: updatedCount, created: createdCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});