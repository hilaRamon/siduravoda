import express from "express";
import { isAdmin, isRegularUser } from "../config/permissions.js";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as vehicleController from "../controllers/vehicleController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

function requireVehicleAccess(req, res, next) {
  if (isAdmin(req.user) || isRegularUser(req.user)) {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
}

router.use(requireVehicleAccess);

router.get("/", vehicleController.list);
router.post("/", vehicleController.create);
router.get("/:id", vehicleController.getById);
router.patch("/:id", vehicleController.update);
router.delete("/:id", vehicleController.remove);

export default router;
