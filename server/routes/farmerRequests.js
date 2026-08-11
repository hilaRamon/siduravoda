import express from "express";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as farmerRequestController from "../controllers/farmerRequestController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

router.get("/", farmerRequestController.list);
router.post("/", farmerRequestController.create);
router.get("/:id", farmerRequestController.getById);
router.delete("/:id", farmerRequestController.remove);

export default router;
