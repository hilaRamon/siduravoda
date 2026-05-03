import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, maxRetries = 6) {
  let delay = 800;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('Rate limit');
      if (is429 && attempt < maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * 2, 10000);
      } else {
        throw err;
      }
    }
  }
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text();
    const { toCreate, toUpdate } = JSON.parse(bodyText);

    const clonedReq = new Request(req, { body: bodyText });
    const base44 = createClientFromRequest(clonedReq);
    const entities = base44.asServiceRole.entities;

    // Delete existing records one by one (serial + retry) then bulk-recreate
    // This avoids N individual updates — only N deletes + 1 bulkCreate
    if (toUpdate && toUpdate.length > 0) {
      for (const { id } of toUpdate) {
        await withRetry(() => entities.Assignment.delete(id));
        await sleep(150);
      }

      const recreate = toUpdate.map(({ fullRecord }) => fullRecord);
      await withRetry(() => entities.Assignment.bulkCreate(recreate));
    }

    // New records
    if (toCreate && toCreate.length > 0) {
      await withRetry(() => entities.Assignment.bulkCreate(toCreate));
    }

    return Response.json({ success: true, updated: toUpdate?.length || 0, created: toCreate?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});