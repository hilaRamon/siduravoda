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
  if (isAdmin(req.user) || isRegularUser(req.user)) {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
}

router.get("/", requireLogisticsRead, workplaceLogisticsController.list);
router.post("/", requireLogisticsWrite, workplaceLogisticsController.create);
router.get("/:id", requireLogisticsRead, workplaceLogisticsController.getById);
router.patch("/:id", requireLogisticsWrite, workplaceLogisticsController.update);
router.delete("/:id", requireLogisticsWrite, workplaceLogisticsController.remove);

export default router;
