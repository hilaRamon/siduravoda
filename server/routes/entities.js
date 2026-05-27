import express from "express";
import { entityNames } from "../config/entities.js";
import { getModel } from "../models/index.js";
import {
  buildMongoFilter,
  buildSort,
  normalizeData,
  sortInMemory,
} from "../lib/query.js";
import { attachUser } from "../middleware/auth.js";
import { checkEntityAccess } from "../middleware/entityAccess.js";

const router = express.Router();

router.use(attachUser);

function requireEntity(req, res, next) {
  const { entityName } = req.params;

  if (!entityNames.includes(entityName)) {
    return res.status(404).json({ message: `Unknown entity: ${entityName}` });
  }

  req.entityName = entityName;
  req.model = getModel(entityName);
  return checkEntityAccess(req, res, next);
}

router.get("/:entityName", requireEntity, async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 1000;
    const sort = req.query.sort || undefined;
    const filter = req.query.filter ? JSON.parse(req.query.filter) : {};

    const items = await req.model
      .find(buildMongoFilter(filter))
      .sort(buildSort(sort))
      .limit(limit)
      .exec();

    res.json(items.map((item) => item.toJSON()));
  } catch (error) {
    next(error);
  }
});

router.post("/:entityName/filter", requireEntity, async (req, res, next) => {
  try {
    const limit = req.body.limit || 1000;
    const sort = req.body.sort || undefined;
    const filter = req.body.filter || {};

    const items = await req.model
      .find(buildMongoFilter(filter))
      .limit(limit)
      .exec();

    const sorted = sortInMemory(
      items.map((item) => item.toJSON()),
      sort,
    );

    res.json(sorted);
  } catch (error) {
    next(error);
  }
});

router.post("/:entityName", requireEntity, async (req, res, next) => {
  try {
    const payload = normalizeData(req.body);
    const doc = await req.model.create(payload);
    res.status(201).json(doc.toJSON());
  } catch (error) {
    next(error);
  }
});

router.post("/:entityName/bulk", requireEntity, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body.map(normalizeData) : [];

    if (items.length === 0) {
      return res.json([]);
    }

    const inserted = await req.model.insertMany(items, { ordered: false });
    return res.status(201).json(inserted.map((doc) => doc.toJSON()));
  } catch (error) {
    next(error);
  }
});

router.patch("/:entityName/:id", requireEntity, async (req, res, next) => {
  try {
    const payload = normalizeData(req.body);
    const doc = await req.model.findByIdAndUpdate(req.params.id, payload, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    return res.json(doc.toJSON());
  } catch (error) {
    next(error);
  }
});

router.delete("/:entityName/:id", requireEntity, async (req, res, next) => {
  try {
    const deleted = await req.model.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Document not found" });
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
