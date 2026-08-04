import express from "express";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as absenceRequestController from "../controllers/absenceRequestController.js";

const router = express.Router();

router.use(attachUser);

function requireIngestKey(req, res, next) {
  const expected = process.env.ABSENCE_INGEST_SECRET;
  const provided = req.headers["x-absence-ingest-key"];
  if (!expected || provided !== expected) {
    return res.status(401).json({ message: "Invalid ingest key" });
  }
  return next();
}

router.post(
  "/from-sms",
  requireIngestKey,
  absenceRequestController.createFromSmsHandler,
);

router.use(requireAuth);

router.get("/", absenceRequestController.list);
router.post("/", absenceRequestController.create);
router.get("/:id", absenceRequestController.getById);
router.patch("/:id", absenceRequestController.update);
router.post("/:id/approve", absenceRequestController.approve);
router.post("/:id/reject", absenceRequestController.reject);
router.delete("/:id", absenceRequestController.remove);

export default router;
