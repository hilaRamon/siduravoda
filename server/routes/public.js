import express from "express";
import { getPublicSchedule } from "../services/publishedScheduleService.js";

const router = express.Router();

/** Latest visible published schedule — no authentication */
router.get("/schedule", async (req, res, next) => {
  try {
    const doc = await getPublicSchedule();
    res.set("Cache-Control", "no-store");
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

export default router;
