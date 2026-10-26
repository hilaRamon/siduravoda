import express from "express";
import {
  isAdmin,
  isRegularUser,
  isReporterOnly,
  isWorkplaceManagerOnly,
} from "../config/permissions.js";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as workplaceController from "../controllers/workplaceController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

function canReadWorkplace(user) {
  return (
    isAdmin(user) ||
    isRegularUser(user) ||
    isWorkplaceManagerOnly(user) ||
    isReporterOnly(user)
  );
}

function canWriteWorkplace(user) {
  return isAdmin(user) || isRegularUser(user) || isWorkplaceManagerOnly(user);
}

function requireWorkplaceRead(req, res, next) {
  if (canReadWorkplace(req.user)) return next();
  return res.status(403).json({ message: "Forbidden" });
}

function requireWorkplaceWrite(req, res, next) {
  if (canWriteWorkplace(req.user)) return next();
  return res.status(403).json({ message: "Forbidden" });
}

router.get("/", requireWorkplaceRead, workplaceController.list);
router.post("/", requireWorkplaceWrite, workplaceController.create);
router.get("/:id", requireWorkplaceRead, workplaceController.getById);
router.patch("/:id", requireWorkplaceWrite, workplaceController.update);
router.delete("/:id", requireWorkplaceWrite, workplaceController.remove);

export default router;
