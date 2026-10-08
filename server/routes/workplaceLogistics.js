import express from "express";
import { isAdmin, isRegularUser, isReporterOnly } from "../config/permissions.js";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as workplaceLogisticsController from "../controllers/workplaceLogisticsController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

function requireLogisticsRead(req, res, next) {
  if (isAdmin(req.user) || isRegularUser(req.user) || isReporterOnly(req.user)) {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
}

function requireLogisticsWrite(req, res, next) {
  if (isAdmin(req.user) || isRegularUser(req.user) || isReporterOnly(req.user)) {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
}

function requireLogisticsDelete(req, res, next) {
  if (isAdmin(req.user) || isRegularUser(req.user)) {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
}

function restrictReporterPayload(req, res, next) {
  if (!isReporterOnly(req.user)) return next();
  const nextBody = {};
  if (req.body?.date !== undefined) nextBody.date = req.body.date;
  if (req.body?.workplace_id !== undefined) {
    nextBody.workplace_id = req.body.workplace_id;
  }
  if (req.body?.reported_units !== undefined) {
    nextBody.reported_units = req.body.reported_units;
    nextBody.units_status = "ממתין";
  }
  if (req.body?.is_piecework !== undefined) {
    nextBody.is_piecework = req.body.is_piecework;
  }
  req.body = nextBody;
  return next();
}

router.get("/", requireLogisticsRead, workplaceLogisticsController.list);
router.post(
  "/",
  requireLogisticsWrite,
  restrictReporterPayload,
  workplaceLogisticsController.create,
);
router.get("/:id", requireLogisticsRead, workplaceLogisticsController.getById);
router.patch(
  "/:id",
  requireLogisticsWrite,
  restrictReporterPayload,
  workplaceLogisticsController.update,
);
router.delete("/:id", requireLogisticsDelete, workplaceLogisticsController.remove);

export default router;
