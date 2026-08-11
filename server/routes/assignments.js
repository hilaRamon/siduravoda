import express from "express";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as assignmentController from "../controllers/assignmentController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

router.get("/", assignmentController.list);
router.post("/", assignmentController.create);
router.post("/bulk", assignmentController.bulkCreate);
router.get("/:id", assignmentController.getById);
router.patch("/:id", assignmentController.update);
router.delete("/:id", assignmentController.remove);

export default router;
