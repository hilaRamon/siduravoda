import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text();
    const { toCreate, toUpdate } = JSON.parse(bodyText);

    const clonedReq = new Request(req, { body: bodyText });
    const base44 = createClientFromRequest(clonedReq);

    // Bulk create - single API call
    if (toCreate && toCreate.length > 0) {
      await base44.asServiceRole.entities.Assignment.bulkCreate(toCreate);
      await sleep(500);
    }

    // Serial updates with 350ms gap to avoid rate limit
    if (toUpdate && toUpdate.length > 0) {
      for (const { id, fullRecord } of toUpdate) {
        await base44.asServiceRole.entities.Assignment.update(id, fullRecord);
        await sleep(350);
      }
    }

    return Response.json({ success: true, updated: toUpdate?.length || 0, created: toCreate?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});