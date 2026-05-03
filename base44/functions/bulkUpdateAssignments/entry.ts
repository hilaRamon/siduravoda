import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, retries = 4, baseDelayMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err?.message || '';
      const isRateLimit = msg.includes('Rate limit') || msg.includes('429') || err?.status === 429;
      if (isRateLimit && i < retries - 1) {
        await sleep(baseDelayMs * (i + 1));
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

    // Bulk create - single API call
    if (toCreate && toCreate.length > 0) {
      await withRetry(() => base44.asServiceRole.entities.Assignment.bulkCreate(toCreate));
    }

    // Process updates in small batches of 5 in parallel to balance speed vs rate limits
    if (toUpdate && toUpdate.length > 0) {
      const BATCH_SIZE = 5;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(({ id, fullRecord }) =>
            withRetry(() => base44.asServiceRole.entities.Assignment.update(id, fullRecord))
          )
        );
        if (i + BATCH_SIZE < toUpdate.length) {
          await sleep(300);
        }
      }
    }

    return Response.json({ success: true, updated: toUpdate?.length || 0, created: toCreate?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});