import express from "express";
import {
  isAdmin,
  isRegularUser,
  isWorkplaceManagerOnly,
} from "../config/permissions.js";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as farmController from "../controllers/farmController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

function requireFarmAccess(req, res, next) {
  if (
    isAdmin(req.user) ||
    isRegularUser(req.user) ||
    isWorkplaceManagerOnly(req.user)
  ) {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
}

router.use(requireFarmAccess);

router.get("/", farmController.list);
router.post("/", farmController.create);
router.get("/:id", farmController.getById);
router.patch("/:id", farmController.update);
router.delete("/:id", farmController.remove);

export default router;
