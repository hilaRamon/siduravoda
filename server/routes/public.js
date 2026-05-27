import express from "express";
import { getModel } from "../models/index.js";
import { buildSort } from "../lib/query.js";

const router = express.Router();

/** Latest published schedule PDF — no authentication */
router.get("/schedule", async (req, res, next) => {
  try {
    const Model = getModel("PublishedSchedule");
    const sort = buildSort("-date");
    const doc = await Model.findOne().sort(sort).exec();
    res.json(doc ? doc.toJSON() : null);
  } catch (error) {
    next(error);
  }
});

export default router;
