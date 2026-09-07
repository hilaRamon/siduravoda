import express from "express";
import { isAdmin, isRegularUser, isReporterOnly } from "../config/permissions.js";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as studentController from "../controllers/studentController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

function requireStudentRead(req, res, next) {
  if (isAdmin(req.user) || isRegularUser(req.user) || isReporterOnly(req.user)) {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
}

function requireStudentWrite(req, res, next) {
  if (isAdmin(req.user) || isRegularUser(req.user)) {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
}

router.get("/", requireStudentRead, studentController.list);
router.post("/", requireStudentWrite, studentController.create);
router.post("/bulk", requireStudentWrite, studentController.bulkCreate);
router.post(
  "/rename-cohort",
  requireStudentWrite,
  studentController.renameCohortHandler,
);
router.get("/:id", requireStudentRead, studentController.getById);
router.patch("/:id", requireStudentWrite, studentController.update);
router.delete("/:id", requireStudentWrite, studentController.remove);

export default router;
