import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, maxRetries = 8) {
  let delay = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('Rate limit');
      const is404 = err?.message?.includes('404') || err?.message?.includes('not found');
      if (is404) return; // record already gone — skip silently
      if (is429 && attempt < maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * 2, 12000);
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

    // Serial updates — one at a time with 400ms gap + retry on rate limit
    if (toUpdate && toUpdate.length > 0) {
      for (const { id, fullRecord } of toUpdate) {
        await withRetry(() => entities.Assignment.update(id, fullRecord));
        await sleep(400);
      }
    }

    // New records — single bulk call
    if (toCreate && toCreate.length > 0) {
      await withRetry(() => entities.Assignment.bulkCreate(toCreate));
    }

    return Response.json({ success: true, updated: toUpdate?.length || 0, created: toCreate?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});