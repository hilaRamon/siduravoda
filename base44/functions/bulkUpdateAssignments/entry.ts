import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, maxRetries = 5) {
  let delay = 600;
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

// Run items in parallel batches of `size`
async function batchAll(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    await Promise.all(chunk.map(fn));
    if (i + size < items.length) await sleep(250);
  }
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text();
    const { toCreate, toUpdate, date, workplace, hours, rate } = JSON.parse(bodyText);

    const clonedReq = new Request(req, { body: bodyText });
    const base44 = createClientFromRequest(clonedReq);
    const entities = base44.asServiceRole.entities;

    let updatedCount = 0;
    let createdCount = 0;

    // UPDATES: if we got a date + field changes, fetch ALL assignments for that date server-side
    // This avoids any client-side pagination limit issue
    if (toUpdate && toUpdate.length > 0) {
      // Extract just the IDs to update and the changes to apply
      const updateMap = {};
      for (const { id, fullRecord } of toUpdate) {
        updateMap[id] = fullRecord;
      }

      // Apply updates in parallel batches of 15
      await batchAll(toUpdate, 15, ({ id, fullRecord }) =>
        withRetry(() => entities.Assignment.update(id, fullRecord))
      );
      updatedCount = toUpdate.length;
    }

    // CREATES: bulk create new assignments
    if (toCreate && toCreate.length > 0) {
      await withRetry(() => entities.Assignment.bulkCreate(toCreate));
      createdCount = toCreate.length;
    }

    return Response.json({ success: true, updated: updatedCount, created: createdCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});