import express from "express";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as publishedScheduleController from "../controllers/publishedScheduleController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

router.get("/", publishedScheduleController.list);
router.post("/", publishedScheduleController.create);
router.put("/", publishedScheduleController.upsert);
router.get("/:id", publishedScheduleController.getById);
router.patch("/:id", publishedScheduleController.update);
router.delete("/:id", publishedScheduleController.remove);

export default router;
