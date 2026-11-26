import express from "express";
import { isAdmin, isRegularUser } from "../config/permissions.js";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as transportationSummaryController from "../controllers/transportationSummaryController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

function requireSummaryAccess(req, res, next) {
  if (isAdmin(req.user) || isRegularUser(req.user)) {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
}

router.use(requireSummaryAccess);

router.get("/", transportationSummaryController.list);
router.post("/", transportationSummaryController.create);
router.patch("/:id", transportationSummaryController.update);

export default router;
