import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Run items in parallel batches of `size`
async function batchAll(items, size, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const chunkResults = await Promise.allSettled(chunk.map(fn));
    results.push(...chunkResults);
    if (i + size < items.length) await sleep(300); // brief pause between batches
  }
  return results;
}

async function withRetry(fn, maxRetries = 5) {
  let delay = 800;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('Rate limit');
      const is404 = err?.message?.includes('404') || err?.message?.includes('not found');
      if (is404) return;
      if (is429 && attempt < maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * 2, 8000);
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

    // Parallel batches of 10 — fast but rate-limit safe
    if (toUpdate && toUpdate.length > 0) {
      await batchAll(toUpdate, 10, ({ id, fullRecord }) =>
        withRetry(() => entities.Assignment.update(id, fullRecord))
      );
    }

    // Single bulk call for new records
    if (toCreate && toCreate.length > 0) {
      await withRetry(() => entities.Assignment.bulkCreate(toCreate));
    }

    return Response.json({ success: true, updated: toUpdate?.length || 0, created: toCreate?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});