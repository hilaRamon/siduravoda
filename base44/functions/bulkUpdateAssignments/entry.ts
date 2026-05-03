import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, retries = 5, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err?.message?.includes('Rate limit') || err?.status === 429 || err?.response?.status === 429;
      if (isRateLimit && i < retries - 1) {
        await sleep(delayMs * (i + 1));
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
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Bulk create - single API call
    if (toCreate && toCreate.length > 0) {
      await withRetry(() => base44.asServiceRole.entities.Assignment.bulkCreate(toCreate));
    }

    // Serial updates with retry on rate limit
    if (toUpdate && toUpdate.length > 0) {
      for (const { id, fullRecord } of toUpdate) {
        await withRetry(() => base44.asServiceRole.entities.Assignment.update(id, fullRecord));
        await sleep(100);
      }
    }

    return Response.json({ success: true, updated: toUpdate?.length || 0, created: toCreate?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});